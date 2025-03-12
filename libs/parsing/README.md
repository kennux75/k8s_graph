# Parsing Module Documentation

The parsing module is responsible for extracting and interpreting data from Kubernetes resources and log files. This module provides the raw data that is used to build the communication graph.

## Files

### kubernetes.py

This file contains functions for interacting with the Kubernetes API and retrieving information about pods, services, and other resources.

#### Key Functions:

- `load_kube_contexts(file_path)`: Loads the available Kubernetes contexts from a file
- `load_excluded_namespaces()`: Loads a list of namespaces to exclude from the graph
- `load_kube_config(context)`: Loads the kubeconfig for a specific context
- `get_namespaces(kubeconfig)`: Retrieves all namespaces from a Kubernetes cluster
- `count_pods_in_namespace(namespace, kubeconfig)`: Counts the number of pods in a namespace
- `find_web_pod_in_namespace(namespace, kubeconfig)`: Finds web-related pods in a namespace
- `get_all_pods_with_ips_in_namespaces(namespaces, kubeconfig)`: Retrieves all pods with their IP addresses across namespaces
- `get_pod_containers(pod_name, namespace, kubeconfig)`: Retrieves the containers in a specific pod
- `get_pod_logs(pod_name, container, namespace, kubeconfig, lines=500)`: Retrieves logs from a specific container in a pod

The module uses the Kubernetes Python client to interact with the API server.

### logs.py

This file contains functions for extracting and parsing logs from Kubernetes pods to detect communication patterns.

#### Key Functions:

- `extract_logs(pod_name, namespace, kubeconfig, lines=500)`: Extracts logs from all containers in a pod
- `extract_and_parse_logs_threaded(pods, namespace, kubeconfig, lines=500)`: Extracts and parses logs from multiple pods in parallel
- `parse_logs(logs)`: Parses logs to identify communication patterns
- `extract_http_hosts(logs)`: Extracts HTTP host information from logs
- `parse_log_line(line)`: Parses a single log line to extract communication data
- `extract_ips_from_logs(logs)`: Extracts IP addresses mentioned in logs

The log parsing uses pattern matching and regular expressions to identify communication between pods based on the log format.

## Log Formats

The module supports various log formats, including:
- Java application logs
- Nginx access logs
- Generic logs with IP addresses and HTTP requests

Custom log formats can be defined in the configuration files.

## Thread Safety

The log parsing functions use thread-safe data structures to allow parallel processing of logs from multiple pods, which significantly improves performance in large clusters.

## Usage

The parsing module is primarily used by the graph module to gather the raw data needed to build the communication graph. The typical usage flow is:

1. Load Kubernetes contexts and configurations
2. Retrieve pods and their IP addresses
3. Extract and parse logs from pods
4. Use the parsed data to establish connections between pods in the graph 