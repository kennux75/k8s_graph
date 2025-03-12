#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Application configuration for Kubernetes Communications Graph Visualizer
"""

# Update interval in seconds
UPDATE_INTERVAL = 60

# App configuration
APP_CONFIG = {
    'port': 6200,
    'host': '0.0.0.0',
    'debug': False,
    'secret_key': 'k8s-graph-secret-key'
}

def update_interval(new_interval):
    """Update the global UPDATE_INTERVAL value"""
    global UPDATE_INTERVAL
    if new_interval < 5:
        raise ValueError("Interval must be at least 5 seconds")
    UPDATE_INTERVAL = new_interval
    return UPDATE_INTERVAL 