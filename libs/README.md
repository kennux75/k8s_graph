# Libs Directory - Core Functionality

This directory contains the core functionality modules for the Kubernetes Communications Graph Visualizer.

## Module Overview

### /libs/graph

The graph module handles the construction and manipulation of communication graphs.

Key files:
- `communication_graph.py`: Defines the `K8sCommunicationGraph` class which is the main class responsible for building the graph of communications between pods
- `graph_builder.py`: Contains utility functions for creating simplified graph representations

### /libs/parsing

The parsing module handles extracting and interpreting data from Kubernetes and log files.

Key files:
- `kubernetes.py`: Functions for interacting with Kubernetes API and retrieving pod information
- `logs.py`: Functions for extracting and parsing logs from Kubernetes pods to detect communication patterns

### /libs/visualization

The visualization module provides utilities for preparing the graph data for visualization.

Key files:
- `tooltip_manager.py`: Manages the generation of tooltips and supplementary information for graph nodes and edges

### /libs/webapp

The webapp module contains the Flask web application components.

Key files:
- `app_controller.py`: Main controller for initializing and running the Flask application
- `graph_manager.py`: Manages the graph data and updates for the web interface
- `routes.py`: Defines the HTTP routes for the web application
- `socket_handlers.py`: Handles WebSocket connections for real-time updates
- `app_utils.py`: Utility functions for the web application

### Other Files

- `logging.py`: Common logging configuration and setup
- `__init__.py`: Package initialization files

## Relationship Between Modules

1. The `graph` module uses the `parsing` module to extract data from Kubernetes and logs
2. The `visualization` module prepares the graph data created by the `graph` module
3. The `webapp` module uses all other modules to serve the application via a web interface

## Usage

These modules are primarily used by the main application entry point (`app.py` in the root directory) and are not intended to be imported directly by external applications. 