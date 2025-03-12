# Visualization Module Documentation

The visualization module provides utilities for preparing graph data for visual presentation in the web interface. This module translates the raw graph data into formats that can be effectively visualized and interacted with by users.

## Files

### tooltip_manager.py

This file contains the `TooltipManager` class which manages the generation of tooltips and supplementary information for graph nodes and edges.

#### Key Functions:

- `__init__(graph_instance)`: Initializes the tooltip manager with a graph instance
- `generate_node_tooltip(node, is_namespace=False)`: Generates HTML tooltip content for a node or namespace
- `generate_edge_tooltip(source, target)`: Generates HTML tooltip content for an edge between nodes
- `generate_simplified_node_tooltip(node)`: Generates tooltip content for nodes in the simplified graph
- `generate_simplified_edge_tooltip(source, target)`: Generates tooltip content for edges in the simplified graph
- `format_http_hosts(http_hosts_data)`: Formats HTTP host information for display
- `get_auth_value(node)`: Retrieves authentication information for a node

The tooltip manager is responsible for:
- Creating human-readable information about nodes (pods/namespaces) and their connections
- Formatting data about communication frequency
- Highlighting important information about the connections
- Generating HTML content for tooltips that appear on hover in the visualization

## Visualization Approach

The visualization approach follows these principles:

1. **Information Density**: Tooltips provide detailed information without cluttering the main graph view
2. **Context Awareness**: Different tooltips for different graph elements (nodes vs. edges, detailed vs. simplified)
3. **HTML Formatting**: Uses HTML to create structured, readable tooltip content
4. **Data Enhancement**: Enriches raw graph data with additional context for better user understanding

## Integration with Web UI

The visualization module provides data to the web UI through:
1. Generating tooltip content that is sent to the frontend via the webapp module
2. Preparing node and edge attributes that determine visual properties (colors, shapes, etc.)

## Usage

The visualization module is primarily used by the webapp module to prepare graph data for display. The typical usage flow is:

1. Initialize a `TooltipManager` with a graph instance
2. Call appropriate tooltip generation methods based on the type of graph element
3. Include the generated tooltip content in the graph data sent to the frontend
4. The frontend renders the tooltips when users interact with graph elements

## Dependencies

The visualization module depends on:
- The graph module for accessing graph data
- HTML formatting utilities for creating tooltip content 