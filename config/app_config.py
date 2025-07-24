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

# Feature flags configuration
FEATURES = {
    'focusMode': False,           # Focus mode functionality
    'nodeGroups': False,          # Node groups management
    'nodeAnalysis': False,        # Node analysis panel
    'advancedFilters': False,     # Advanced filtering options
    'realTimeUpdates': True,      # Real-time updates via WebSocket
    'cumulativeData': True,       # Cumulative data tracking
    'exportFeatures': False,      # Export/import functionality
    'darkMode': False,           # Dark mode theme
    'performanceMode': False,     # Performance optimizations
    'debugMode': False           # Debug console and tools
}

def update_interval(new_interval):
    """Update the global UPDATE_INTERVAL value"""
    global UPDATE_INTERVAL
    if new_interval < 5:
        raise ValueError("Interval must be at least 5 seconds")
    UPDATE_INTERVAL = new_interval
    return UPDATE_INTERVAL

def get_features():
    """Get current feature flags configuration"""
    return FEATURES.copy()

def update_feature(feature_name, enabled):
    """Update a single feature flag"""
    if feature_name in FEATURES:
        FEATURES[feature_name] = bool(enabled)
        return True
    return False

def update_features(features_dict):
    """Update multiple feature flags"""
    updated = {}
    for feature_name, enabled in features_dict.items():
        if feature_name in FEATURES:
            FEATURES[feature_name] = bool(enabled)
            updated[feature_name] = FEATURES[feature_name]
    return updated 