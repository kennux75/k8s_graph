#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Graph Manager for the Kubernetes Communications Graph Web Application
Handles building, updating, and managing the graph data
"""

import threading
import networkx as nx
import logging
from flask_socketio import SocketIO
from config.app_config import UPDATE_INTERVAL, APP_CONFIG
from libs.graph.communication_graph import K8sCommunicationGraph
from libs.visualization.tooltip_manager import generate_node_tooltip, generate_edge_tooltip
from libs.webapp.app_utils import convert_dict_for_json

# Initialize logger
logger = logging.getLogger(__name__)

# Global variables to store graph data
graph_data = {
    'nodes': [],
    'edges': [],
    'namespace_colors': {},
    'http_host_counts': {},
    'namespace_pod_counts': {}
}

# Thread lock for graph updates
graph_lock = threading.Lock()

# Reference to the socketio instance
socketio_instance = None

def set_socketio(socketio):
    """Set the socketio instance for emitting updates"""
    global socketio_instance
    socketio_instance = socketio

def get_graph_data():
    """Get the current graph data with lock protection"""
    with graph_lock:
        return graph_data

def build_graph_data():
    """Build the graph data and update the global variable"""
    global graph_data
    logger.info("Rebuilding graph data...")
    
    try:
        # Create and build the graph
        graph = K8sCommunicationGraph(skip_logs=False)
        graph.build_graph()
        
        logger.info(f"Graph built successfully: {len(graph.simplified_graph.nodes())} nodes, {len(graph.simplified_graph.edges())} edges")
        
        # Extract nodes and edges from the simplified graph
        nodes = []
        for node_id, attrs in graph.simplified_graph.nodes(data=True):
            node_attrs = {
                'id': node_id,
                'label': node_id, 
                'shape': 'dot', 
                'font': {'face': 'Roboto', 'size': 12}
            }
            
            # Extract metadata
            namespace = attrs.get('namespace', 'default')
            color = graph.namespace_colors.get(namespace, '#90EE90')  # Use light_green as default color
            pod_count = graph.namespace_pod_counts.get(namespace, 0)
            edge_count = graph.simplified_graph.degree(node_id)  # Get node degree
            
            # Set node size based on the number of edges and pods
            node_attrs['size'] = 4 + edge_count * 2 + pod_count / 4
            
            node_attrs['color'] = color
            
            # Set transparency based on the number of edges
            node_attrs['opacity'] = 0.5 if (edge_count > 1 and edge_count < 25) else 0.8 if edge_count >= 25 else 1.0
            
            # Get the context for this node
            context = attrs.get('context')
            
            # Generate node tooltip using the tooltip manager
            node_attrs['title'] = generate_node_tooltip(
                node_id, 
                graph.http_host_counts, 
                edge_count, 
                pod_count,
                context
            )
            
            nodes.append(node_attrs)
        
        logger.info(f"Processed {len(nodes)} nodes")
        
        # Extract edges
        edges = []
        for source, target, attrs in graph.simplified_graph.edges(data=True):
            weight = attrs.get('weight', 1)
            width = max(1, min(4, 1 + weight / 50))  # Scale width as in the original script
            
            # Generate edge tooltip using the tooltip manager
            edge_title = generate_edge_tooltip(
                source, 
                target, 
                weight, 
                graph.http_host_counts
            )
            
            edges.append({
                'from': source,
                'to': target,
                'weight': weight,
                'width': width,
                'smooth': {'type': 'continuous', 'roundness': 0.2},
                'title': edge_title
            })
        
        logger.info(f"Processed {len(edges)} edges")
        
        # Convert any complex data structures for JSON serialization
        serializable_http_host_counts = convert_dict_for_json(graph.http_host_counts)
        
        # Build updated graph_data
        with graph_lock:
            graph_data = {
                'nodes': nodes,
                'edges': edges,
                'namespace_colors': graph.namespace_colors,
                'http_host_counts': serializable_http_host_counts,
                'namespace_pod_counts': graph.namespace_pod_counts
            }
            logger.info(f"Graph data updated: {len(nodes)} nodes, {len(edges)} edges")
        
        # Emit the updated data to connected clients
        if socketio_instance:
            try:
                socketio_instance.emit('graph_update', graph_data)
                logger.info("Graph update emitted to all clients")
            except Exception as e:
                logger.error(f"Error emitting graph update: {e}", exc_info=True)
        
    except Exception as e:
        logger.error(f"Error building graph data: {e}", exc_info=True)
        return None

def generate_test_graph():
    """Generate a test graph without collecting logs"""
    global graph_data
    logger.info("Generating test graph data...")
    
    try:
        # Create a simplified test graph
        simplified_graph = nx.DiGraph()
        
        # Add some test nodes and edges
        namespaces = ["api-frontend", "api-backend", "database", "cache", "logging", "monitoring"]
        namespace_colors = {namespace: f"#{hash(namespace) % 0xffffff:06x}" for namespace in namespaces}
        
        # Add nodes
        for namespace in namespaces:
            simplified_graph.add_node(namespace)
        
        # Add some edges
        simplified_graph.add_edge("api-frontend", "api-backend", weight=50)
        simplified_graph.add_edge("api-backend", "database", weight=30)
        simplified_graph.add_edge("api-backend", "cache", weight=20)
        simplified_graph.add_edge("monitoring", "api-frontend", weight=5)
        simplified_graph.add_edge("monitoring", "api-backend", weight=5)
        simplified_graph.add_edge("monitoring", "database", weight=5)
        simplified_graph.add_edge("logging", "api-frontend", weight=10)
        simplified_graph.add_edge("logging", "api-backend", weight=10)
        
        # Build nodes and edges
        nodes = []
        for node_id in simplified_graph.nodes():
            nodes.append({
                'id': node_id,
                'label': node_id,
                'color': namespace_colors.get(node_id, "#90EE90"),
                'shape': 'dot',
                'size': 25 + simplified_graph.degree(node_id) * 2
            })
        
        edges = []
        for source, target, attrs in simplified_graph.edges(data=True):
            weight = attrs.get('weight', 1)
            width = max(1, min(4, 1 + weight / 50))
            edges.append({
                'from': source,
                'to': target,
                'value': weight,
                'title': f"Source: {source}\nDestination: {target}\nConnections: {weight}",
                'width': width
            })
        
        # Build test graph data
        with graph_lock:
            graph_data = {
                'nodes': nodes,
                'edges': edges,
                'namespace_colors': namespace_colors,
                'http_host_counts': {},
                'namespace_pod_counts': {namespace: 3 for namespace in namespaces}
            }
        
        # Emit the updated data
        if socketio_instance:
            socketio_instance.emit('graph_update', graph_data)
        logger.info(f"Test graph data generated: {len(nodes)} nodes, {len(edges)} edges")
        
        return {"status": "success", "message": "Test graph generated"}
    except Exception as e:
        logger.error(f"Error generating test graph: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

def set_logger(log_instance):
    """Set the logger for this module"""
    global logger
    logger = log_instance 