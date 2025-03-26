#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Visualization Configuration for Kubernetes Communications Graph Visualizer

This file contains all configuration parameters related to the visualization of the graph,
including node appearance, edge appearance, physics settings, and layout configurations.
These settings are used in both Python (pyvis_viz.py) and JavaScript (main.js) code.
"""

# General Graph Configuration
GRAPH_CONFIG = {
    # Width and height of the visualization area (used in pyvis_viz.py)
    "width": "100%",
    "height": "100%",
    
    # Auto-resize settings (used in main.js)
    "auto_resize": True,
    
    # Node distribution dimensions (used in pyvis_viz.py)
    "distribution_width": 1800,
    "distribution_height": 1000,
    
    # Animation settings (used in main.js)
    "animation": {
        "duration": 1000,
        "easing_function": "easeInOutQuad"
    },
    
    # Focus behavior settings
    "focus": {
        "auto_focus_on_click": False,  # Whether to automatically focus on nodes when clicked
        "scale": 1.0,                  # Scale to use when focusing (if auto_focus_on_click is True)
    },
    
    # Interaction settings (used in main.js)
    "interaction": {
        "drag_nodes": True,
        "hide_edges_on_drag": False,
        "hide_nodes_on_drag": False,
        "navigation_buttons": True,
        "keyboard_enabled": True,
        "keyboard_speed": {
            "x": 10,
            "y": 10,
            "zoom": 0.02
        },
        "multi_select": False,
        "selectable": True,
        "select_connected_edges": False,
        "zoom_view": True
    }
}

# Node Appearance Configuration
NODE_CONFIG = {
    # Node size calculations (used in pyvis_viz.py)
    "base_size": 15,  # Base size for all nodes
    "size_factor": 0.5,  # Factor to multiply by connection count
    "min_size": 10,  # Minimum node size
    "max_size": 30,  # Maximum node size
    
    # Node appearance (used in main.js and pyvis_viz.py)
    "border_width": 1,
    "border_width_selected": 2,
    "font_size": 12,
    "font_face": "Segoe UI",
    "shape": "dot",  # Default shape for normal nodes
    "service_shape": "diamond",  # Shape for service nodes
    "pod_shape": "dot",  # Shape for pod nodes
    
    # Node transparency (used in pyvis_viz.py)
    "default_opacity": 1.0,
    "min_opacity": 0.7,
    
    # Physics configuration for nodes (used in pyvis_viz.py)
    "physics_threshold": 3,  # Nodes with weight less than this have physics enabled
    
    # Node grid layout (used in pyvis_viz.py)
    "layout": {
        "grid_rows": 10,
        "grid_cols": 10,
        "jitter_range": (-50, 50)  # Random jitter to prevent perfect grid alignment
    },
    
    # Scaling options for the vis.js (used in main.js and pyvis_viz.py)
    "scaling": {
        "min": 10,
        "max": 50,
        "label": {
            "enabled": True,
            "min": 14,
            "max": 30
        }
    }
}

# Edge Appearance Configuration
EDGE_CONFIG = {
    # Edge width settings (used in pyvis_viz.py)
    "default_width": 3,
    "fixed_width": True,  # Set to True to use the same width for all edges regardless of weight
    
    # The following settings are used only when fixed_width is False
    "max_width": 3,
    "width_factor": 70,  # Division factor for connection weight to determine width
    
    # Edge appearance (used in main.js)
    "color": "#848484",  # Default grey color for edges with no errors
    "highlight_color": "#1E90FF",
    "hover_color": "#1E90FF",
    "smooth": False,
    
    # Error color settings
    "warning_color": "#f39c12",  # Yellow/Orange for 4xx errors
    #"warning_color": "#848484",  # Fix in grey to disappear for 4xx errors
    "error_color": "#e74c3c",    # Red for 5xx errors
    #"error_color": "#f39c12",    # Yellow/Orange for 5xx errors
    
    # Arrow settings (used in main.js)
    "arrows": {
        "to_enabled": True,
        "scale_factor": 0.5
    },
    
    # Edge font settings (used in main.js)
    "font": {
        "align": "middle",
        "size": 10
    },
    
    # Edge selection settings
    "selection_width": 2,
    
    # Edge scaling
    "scaling": {
        "min": 1,
        "max": 5,
        "label": {
            "enabled": True
        }
    }
}

# Physics Configuration (used in both pyvis_viz.py and main.js)
PHYSICS_CONFIG = {
    # Whether physics is enabled by default
    "enabled": True,
    
    # Solver type
    "solver": "barnesHut",
    
    # Barnes Hut settings
    "barnes_hut": {
        "gravity": -1000,
        "central_gravity": 0.3,
        "spring_length": 80,
        "spring_strength": 0.05,
        "damping": 0.09,
        "avoid_overlap": 1.0,
    },
    
    # Stabilization settings
    "stabilization": {
        "enabled": True,
        "iterations": 1000,
        "update_interval": 50,
        "fit": True,
        "only_dynamic_edges": False
    },
    
    # Advanced physics settings
    "adaptive_timestep": True,
    "max_velocity": 10,
    "min_velocity": 1.0,
    "timestep": 0.2
}

# Update Interval Configuration (used in app.py and main.js)
UPDATE_CONFIG = {
    "default_interval": 60,  # Default update interval in seconds
    "min_interval": 5       # Minimum allowed update interval
}

# Filter Configuration
FILTER_CONFIG = {
    # Default namespace filter settings (all enabled by default)
    "namespaces_enabled_by_default": True
}

# Layout configuration
LAYOUT_CONFIG = {
    "random_seed": None,
    "improved_layout": True,
    "hierarchical": {
        "enabled": False
    }
}

# Export the grouped configurations as a single dictionary for JavaScript access
JS_CONFIG = {
    "graph": GRAPH_CONFIG,
    "nodes": NODE_CONFIG,
    "edges": EDGE_CONFIG,
    "physics": PHYSICS_CONFIG,
    "update": UPDATE_CONFIG,
    "filters": FILTER_CONFIG,
    "layout": LAYOUT_CONFIG
} 