#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Routes and route handlers for the Kubernetes Communications Graph Web Application
"""

import threading
import logging
from flask import Flask, render_template, jsonify, request

from config.config_utils import get_frontend_config, get_js_config
from config.app_config import UPDATE_INTERVAL
from libs.webapp.graph_manager import build_graph_data, get_graph_data, generate_test_graph
from libs.graph.communication_graph import K8sCommunicationGraph
from libs.common.logging_utils import get_logger

# Initialize logger
logger = get_logger(__name__)

# Flask app instance
app = None
socketio = None

def init_routes(flask_app, socketio_instance):
    """Initialize the routes with the Flask app instance"""
    global app, socketio
    app = flask_app
    socketio = socketio_instance
    
    # Set up the routes
    @app.route('/')
    def index():
        """Render the main visualization page"""
        # Get frontend configuration from the config module
        config = get_frontend_config()
        return render_template('index.html', config=config)

    @app.route('/config')
    def get_config():
        """API endpoint to get the visualization configuration"""
        return get_js_config()

    @app.route('/graph_data')
    def get_graph_data_route():
        """API endpoint to get the current graph data"""
        # Check if we have valid data
        current_data = get_graph_data()
        if not current_data['nodes'] and not current_data['edges']:
            logger.info("No graph data available yet, triggering build")
            # Build data if it's not available yet
            thread = threading.Thread(target=build_graph_data)
            thread.daemon = True
            thread.start()
            # Return empty but valid structure
            return jsonify({
                'nodes': [],
                'edges': [],
                'namespace_colors': {},
                'http_host_counts': {},
                'namespace_pod_counts': {}
            })
        return jsonify(current_data)

    @app.route('/filtered_graph_data', methods=['POST'])
    def get_filtered_graph_data():
        """API endpoint to get graph data for filtered nodes with their communications and sources"""
        try:
            data = request.json
            filtered_nodes = data.get('nodes', [])
            
            if not filtered_nodes:
                return jsonify({'status': 'error', 'message': 'No nodes provided'}), 400
            
            logger.info(f"Getting filtered graph data for {len(filtered_nodes)} nodes")
            
            # Get current graph data
            current_data = get_graph_data()
            if not current_data['nodes']:
                return jsonify({'status': 'error', 'message': 'No graph data available'}), 503
            
            # Create sets for efficient lookup
            filtered_nodes_set = set(filtered_nodes)
            nodes_to_include = set(filtered_nodes)
            edges_to_include = []
            
            # Find all edges related to filtered nodes
            for edge in current_data['edges']:
                source = edge['from']
                target = edge['to']
                
                # Include edge if target is in filtered nodes (incoming communications)
                if target in filtered_nodes_set:
                    nodes_to_include.add(source)  # Add source node
                    edges_to_include.append(edge)
                # Include edge if source is in filtered nodes (outgoing communications)
                elif source in filtered_nodes_set:
                    nodes_to_include.add(target)  # Add target node  
                    edges_to_include.append(edge)
                # Include edge if both nodes are already in our set
                elif source in nodes_to_include and target in nodes_to_include:
                    edges_to_include.append(edge)
            
            # Filter nodes to include only those in our final set
            nodes_to_include_list = []
            for node in current_data['nodes']:
                if node['id'] in nodes_to_include:
                    nodes_to_include_list.append(node)
            
            # Prepare response
            filtered_data = {
                'nodes': nodes_to_include_list,
                'edges': edges_to_include,
                'namespace_colors': current_data['namespace_colors'],
                'http_host_counts': current_data['http_host_counts'],
                'namespace_pod_counts': current_data['namespace_pod_counts'],
                'filtered_info': {
                    'original_nodes': len(filtered_nodes),
                    'total_nodes': len(nodes_to_include_list),
                    'total_edges': len(edges_to_include),
                    'added_source_nodes': len(nodes_to_include) - len(filtered_nodes_set)
                }
            }
            
            logger.info(f"Filtered graph data: {len(nodes_to_include_list)} nodes, {len(edges_to_include)} edges")
            return jsonify(filtered_data)
            
        except Exception as e:
            logger.error(f"Error getting filtered graph data: {e}", exc_info=True)
            return jsonify({'status': 'error', 'message': str(e)}), 500

    @app.route('/test_graph')
    def test_graph():
        """Generate a test graph without collecting logs"""
        result = generate_test_graph()
        if result.get("status") == "error":
            return jsonify(result), 500
        return jsonify(result)

    @app.route('/update_interval', methods=['POST'])
    def update_interval():
        """Update the graph refresh interval"""
        global UPDATE_INTERVAL
        
        try:
            data = request.json
            new_interval = int(data.get('interval', 60))
            if new_interval < 5:
                return jsonify({'status': 'error', 'message': 'Interval must be at least 5 seconds'}), 400
                
            # Update the interval in config
            from config.app_config import update_interval as update_config_interval
            update_config_interval(new_interval)
            
            # Reschedule the job with new interval
            from libs.webapp.app_controller import reschedule_update_job
            reschedule_update_job(new_interval)
            
            return jsonify({'status': 'success', 'message': f'Interval updated to {new_interval} seconds'})
        except Exception as e:
            logger.error(f"Error updating interval: {e}", exc_info=True)
            return jsonify({'status': 'error', 'message': str(e)}), 500

def set_logger(log_instance):
    """Set the logger for this module"""
    global logger
    logger = log_instance 