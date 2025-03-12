# Graph Module Documentation

The graph module is responsible for constructing and manipulating the communication graphs that represent interactions between Kubernetes pods.

## Files

### communication_graph.py

Defines the `K8sCommunicationGraph` class which is the core component for building and analyzing pod communications.

#### Key Functions:

- `__init__(skip_logs)`: Initializes the graph with options to skip log analysis
- `build_graph()`: Main method that builds the complete communication graph
- `analyze_namespace(context, namespace, kubeconfig)`: Analyzes a single namespace for pod communications
- `process_namespace_threaded(context, namespace, kubeconfig, namespaces, pods_with_ips)`: Threaded version for parallel processing
- `merge_thread_results(results)`: Combines results from multiple threads
- `get_auth_value_for_node(node)`: Retrieves authentication values for graph nodes

The class maintains several data structures:
- `graph`: The main directed graph (NetworkX DiGraph)
- `simplified_graph`: A simplified version of the graph
- `namespace_colors`, `namespace_shapes`: Visual attributes for namespaces
- `edge_counts`: Communication frequency between nodes
- `node_to_namespace`, `node_to_context`: Mapping of nodes to their namespaces and contexts
- `http_host_counts`: HTTP host information

### graph_builder.py

Contains utility functions for creating simplified representations of the communication graph.

#### Key Functions:

- `create_simplified_graph(graph, node_to_namespace)`: Creates a simplified graph by aggregating pods by namespace

## Dependencies

The graph module depends on:
- `networkx` for the graph data structure
- `libs/parsing/kubernetes` for Kubernetes resource information
- `libs/parsing/logs` for log analysis
- Threading and concurrency utilities for parallel processing

## Usage

The graph module is primarily used by the web application to generate visualizations of pod communications. The typical usage flow is:

1. Create an instance of `K8sCommunicationGraph`
2. Call `build_graph()` to analyze and build the graph
3. Access the graph or simplified_graph attributes for visualization

## Thread Safety

The module uses locks to ensure thread safety when accessing shared data structures during parallel processing:
- `edge_counts_lock`
- `http_host_counts_lock`
- `graph_lock` 