#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Configuration utilities for the Kubernetes Communications Graph Visualizer

This module provides helper functions to access configuration values and expose them to
the JavaScript frontend.
"""

import json
from config.visualization import JS_CONFIG, GRAPH_CONFIG, NODE_CONFIG, EDGE_CONFIG, PHYSICS_CONFIG, UPDATE_CONFIG, FILTER_CONFIG

def get_js_config():
    """
    Returns the configuration settings as a JSON string suitable for JavaScript
    
    This function is used by the Flask app to expose configuration to the frontend.
    """
    return json.dumps(JS_CONFIG)

def get_frontend_config():
    """
    Returns a dictionary with the configuration settings for the frontend
    
    Used in the Flask templates to initialize frontend settings.
    """
    return {
        "updateInterval": UPDATE_CONFIG["default_interval"],
        "minInterval": UPDATE_CONFIG["min_interval"],
        "physics": {
            "enabled": PHYSICS_CONFIG["enabled"],
            "gravity": PHYSICS_CONFIG["barnes_hut"]["gravity"],
            "springLength": PHYSICS_CONFIG["barnes_hut"]["spring_length"],
            "springStrength": PHYSICS_CONFIG["barnes_hut"]["spring_strength"]
        }
    }

def get_visualization_config():
    """
    Returns the visualization configuration for the Python visualization module
    
    Used by pyvis_viz.py to configure the graph visualization.
    """
    return {
        "node_config": NODE_CONFIG,
        "edge_config": EDGE_CONFIG,
        "physics_config": PHYSICS_CONFIG,
        "graph_config": GRAPH_CONFIG
    } 