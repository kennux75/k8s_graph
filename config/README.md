# Configuration Directory Documentation

This directory contains configuration files that control the behavior of the Kubernetes Communications Graph Visualizer application.

## Files

### constants.py

Contains global constants used throughout the application.

Key constants:
- `LOG_LINES_LIMIT`: Maximum number of log lines to retrieve per pod
- `EXCLUDED_NS_FILE`: Path to the file containing excluded namespaces
- `KUBE_CONTEXT`: Variable to hold the current Kubernetes context
- `KUBE_CONTEXTS_FILE`: Path to the file containing available Kubernetes contexts
- `KUBE_CONFIG_DIR`: Directory for Kubernetes configuration files
- `CUSTOM_RULES_FILE`: Path to the file containing custom parsing rules
- `MAX_WORKER_THREADS`: Maximum number of worker threads for parallel processing

### app_config.py

Contains configuration specific to the web application.

Key configurations:
- `UPDATE_INTERVAL`: Default interval for graph updates (in seconds)
- Flask application settings
- Server configuration

### visualization.py

Contains settings for the graph visualization.

Key configurations:
- Node and edge display properties
- Color schemes for namespaces
- Shape definitions for different types of nodes
- Layout parameters for the graph visualization

### config_utils.py

Utility functions for working with configuration files.

Key functions:
- `load_config(config_path)`: Loads a configuration file
- `save_config(config_data, config_path)`: Saves configuration data to a file
- `merge_configs(base_config, override_config)`: Merges configuration objects

### Other Configuration Files

- `excluded-ns.txt`: List of namespaces to exclude from the graph
- `kube-contexts.txt`: List of available Kubernetes contexts
- `custom-rules.yaml`: YAML file containing custom parsing rules
- `log_format_java.txt`: Regular expressions for parsing Java logs
- `log_format_nginx.txt`: Regular expressions for parsing Nginx logs

## kube-configs Directory

This directory contains Kubernetes configuration files for different contexts. Each file should be named after the context it corresponds to.

## Usage

The configuration files are loaded when the application starts and determine how it behaves. Some settings can be modified at runtime through the web interface, including:

1. The excluded namespaces list
2. The graph update interval
3. The active Kubernetes context

Changes made through the web interface are persisted to the relevant configuration files.

## Adding Custom Log Formats

To add support for parsing logs in a new format:

1. Create a new file with regular expressions that match the log format
2. Add references to this file in the `custom-rules.yaml` file
3. The parser will automatically use these rules when analyzing logs

## Kubernetes Context Configuration

To add a new Kubernetes context:

1. Add the context name to `kube-contexts.txt`
2. Place the corresponding kubeconfig file in the `kube-configs` directory
3. The context will be available for selection in the web interface 