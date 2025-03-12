#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Graph building functions for Kubernetes Communications Graph Visualizer
"""

import networkx as nx
import random
import math
import matplotlib.colors as mcolors
from collections import defaultdict
from bokeh.palettes import Turbo256

# Global logger (will be set by the main script)
logger = None

def create_simplified_graph(graph, node_to_namespace, node_to_context=None):
    """Create a simplified graph with one node per namespace and one edge per direction."""
    logger.info("Creating simplified graph...")
    
    # Create a new simplified graph
    simplified_graph = nx.DiGraph()
    
    # Group nodes by namespace
    namespace_nodes = defaultdict(list)
    for node in graph.nodes():
        namespace = node_to_namespace.get(node, node)
        namespace_nodes[namespace].append(node)
    
    # Add namespace nodes to simplified graph
    for namespace, nodes in namespace_nodes.items():
        # If we have context information, use the context of the first node in the namespace
        context = None
        if node_to_context and nodes:
            context = node_to_context.get(nodes[0])
            
        simplified_graph.add_node(namespace, size=len(nodes), original_nodes=nodes, context=context)
        logger.debug(f"Added namespace node: {namespace} with {len(nodes)} services")
    
    # Consolidate edges between namespaces
    namespace_edges = defaultdict(int)
    for source, target, data in graph.edges(data=True):
        source_ns = node_to_namespace.get(source, source)
        target_ns = node_to_namespace.get(target, target)
        
        # Skip self-loops (namespaces talking to themselves)
        if source_ns == target_ns and source_ns != "external":
            continue
            
        namespace_edges[(source_ns, target_ns)] += data.get('weight', 1)
    
    # Add consolidated edges to simplified graph
    for (source_ns, target_ns), weight in namespace_edges.items():
        simplified_graph.add_edge(source_ns, target_ns, weight=weight)
        logger.debug(f"Added namespace edge: {source_ns} -> {target_ns} with weight {weight}")
    
    return simplified_graph

def set_logger(log_instance):
    """Set the global logger."""
    global logger
    logger = log_instance 