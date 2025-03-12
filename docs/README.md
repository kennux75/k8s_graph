# Kubernetes Communications Graph Visualizer - Documentation

This directory contains detailed documentation for the Kubernetes Communications Graph Visualizer application.

## Project Overview

The Kubernetes Communications Graph Visualizer is a web application that analyzes and visualizes communication patterns between Kubernetes pods across namespaces and contexts. It builds a communication graph by analyzing Kubernetes configurations and pod logs.

## Directory Structure

The project is organized into the following main directories:

- **/app**: Frontend components
- **/config**: Configuration files and constants
- **/libs**: Core application logic
  - **/libs/graph**: Graph construction and manipulation
  - **/libs/parsing**: Kubernetes and log file parsing
  - **/libs/visualization**: Graph visualization utilities
  - **/libs/webapp**: Web application controllers and routes
- **/static**: Static assets for the web UI
- **/templates**: HTML templates for the web UI
- **/tests**: Application tests
- **/docs**: Documentation (you are here)

## Application Flow

1. The application starts from `app.py` in the root directory
2. It initializes loggers and creates a Flask web application
3. The core functionality is handled by classes in the `/libs` directory:
   - Kubernetes resource and log parsing
   - Communication graph construction
   - Graph visualization
   - Web interface serving

For detailed information about specific components, please refer to the documentation files in the corresponding directories. 