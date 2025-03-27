"""
Tooltip Manager for Kubernetes Communications Graph

This module centralizes the tooltip generation for nodes and edges in the K8s communications graph.
It provides consistent formatting and handles various data sources for tooltip content.
"""

import logging
from libs.database.db_manager import DatabaseManager

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize database manager
db_manager = None

def format_http_host_tooltip(http_hosts_data):
    """
    Formats HTTP host data for tooltips.
    
    Args:
        http_hosts_data (dict): Dictionary containing HTTP host data with error counts
        
    Returns:
        str: Formatted string for tooltip
    """
    if not http_hosts_data:
        return "No HTTP host data available"
    
    return "\n".join([
        f"{host}: {count['count']} (4xx: {count['4xx']}, 5xx: {count['5xx']}, 3xx: {count['3xx']}, 2xx: {count['2xx']})"
        for host, count in http_hosts_data.items()
    ])

def generate_node_tooltip(node_id, http_host_counts, edge_count, pod_count, context=None):
    """
    Generates tooltip text for a node.
    
    Args:
        node_id (str): The identifier of the node
        http_host_counts (dict): Dictionary containing HTTP host counts for nodes
        edge_count (int): Number of edges connected to the node
        pod_count (int): Number of pods in the namespace
        context (str, optional): The Kubernetes context of the node
        
    Returns:
        str: Formatted tooltip text
    """
    # Get error count and requests from database
    error_count = 0
    error_requests = []
    if db_manager:
        try:
            error_count, error_requests = db_manager.get_node_errors(node_id)
        except Exception as e:
            logger.error(f"Error getting node errors from database: {e}")
    
    # Build HTTP host tooltip section
    http_host_tooltip = ""
    if node_id in http_host_counts:
        http_host_tooltip = format_http_host_tooltip(http_host_counts[node_id])
    
    # Format node title, including context if available
    node_title = node_id
    if context:
        node_title = f"{node_id} - {context}"
    
    # Build error requests section
    error_requests_section = ""
    if error_requests:
        error_requests_section = "\n\n5xx Error Details:"
        for i, request in enumerate(error_requests[:5], 1):  # Show only top 5 errors
            error_requests_section += f"\n{i}. [{request['time']}] {request['status']} - {request['request']}"
            if request.get('error'):
                error_requests_section += f"\n   Error: {request['error']}"
    
    # Construct the complete tooltip
    title = (
        f"{node_title}\n\n"
        f"Total 5xx Errors: {error_count}"
        f"{error_requests_section}\n\n"
        f"Top HTTP Hosts with Origin:\n{http_host_tooltip or 'No HTTP host data available'}\n\n"
        f"Nombre d'arêtes: {edge_count}\nNombre de pods: {pod_count}"
    )
    
    return title

def generate_edge_tooltip(source, target, weight, http_host_counts):
    """
    Generates tooltip text for an edge.
    
    Args:
        source (str): Source node identifier
        target (str): Target node identifier
        weight (int): Edge weight (connection count)
        http_host_counts (dict): Dictionary containing HTTP host counts
        
    Returns:
        str: Formatted tooltip text
    """
    # Basic edge info
    edge_title = f"From: {source} To: {target}\nConnections detected in the last analysis: {weight}\n"
    
    # Add error counts from http_host_counts if available
    if target in http_host_counts:
        # Filter http_host entries related to this source
        filtered_counts = {host: count for host, count in http_host_counts[target].items() 
                          if source in host}
        
        if filtered_counts:
            edge_title += f"\nHTTP Status/Errors Counts from {source} to {target}:\n"
            host_tooltip_lines = [
                f"{host}: {count['count']} (4xx: {count['4xx']}, 5xx: {count['5xx']}, 3xx: {count['3xx']}, 2xx: {count['2xx']})"
                for host, count in filtered_counts.items()
            ]
            edge_title += "\n".join(host_tooltip_lines)
            
            # Add top 5 5xx error log entries when they exist
            has_5xx_errors = any(count.get('5xx', 0) > 0 for count in filtered_counts.values())
            if has_5xx_errors:
                edge_title += "\n\n5xx Error Examples:"
                for host, count in filtered_counts.items():
                    if count.get('5xx', 0) > 0 and '5xx_entries' in count:
                        # Get top 5 5xx entries
                        top_entries = count['5xx_entries'][:5]
                        for i, entry in enumerate(top_entries, 1):
                            status = entry.get('status', 'unknown')
                            http_host = entry.get('http_host', 'unknown')
                            request = entry.get('request', 'unknown')
                            time = entry.get('time', 'unknown')
                            error = entry.get('error', '')
                            error_info = f" ({error})" if error else ""
                            
                            edge_title += f"\n{i}. [{host}] {status} - {request} at {time}{error_info}"
    
    return edge_title

def modify_tooltip_for_cumulative_data(original_title, cumulative_data, is_edge=False):
    """
    Modifies a tooltip to include cumulative data.
    
    Args:
        original_title (str): The original tooltip text
        cumulative_data (dict): Dictionary containing cumulative data
        is_edge (bool): Whether this is for an edge (True) or node (False)
        
    Returns:
        str: Modified tooltip with cumulative data
    """
    if not cumulative_data or cumulative_data.get('updates', 0) <= 1:
        return original_title
    
    # Don't add duplicate cumulative data
    if "CUMULATIVE DATA" in original_title:
        return original_title
    
    # Keep any 5xx error examples if they exist
    five_xx_examples = ""
    if is_edge and "5xx Error Examples:" in original_title:
        parts = original_title.split("5xx Error Examples:")
        if len(parts) > 1:
            five_xx_examples = "5xx Error Examples:" + parts[1]
            original_title = parts[0]
    
    if is_edge:
        # Edge cumulative data
        cumulative_section = (
            f"\n\n--- CUMULATIVE DATA ({cumulative_data['updates']} updates) ---"
            f"\nTotal Connections: {cumulative_data['connectionCount']}"
            f"\nTotal HTTP Requests: {cumulative_data['errorCounts'].get('total', 0)}"
            f"\n2xx: {cumulative_data['errorCounts'].get('2xx', 0)}, "
            f"3xx: {cumulative_data['errorCounts'].get('3xx', 0)}, "
            f"4xx: {cumulative_data['errorCounts'].get('4xx', 0)}, "
            f"5xx: {cumulative_data['errorCounts'].get('5xx', 0)}"
        )
    else:
        # Node cumulative data (customize as needed)
        cumulative_section = (
            f"\n\n--- CUMULATIVE DATA ({cumulative_data['updates']} updates) ---"
            f"\nTotal Communications: {cumulative_data.get('totalCommunications', 0)}"
        )
    
    # Add the cumulative section and then any 5xx error examples
    result = original_title + cumulative_section
    if five_xx_examples:
        result += f"\n\n{five_xx_examples}"
    return result

def remove_cumulative_data(tooltip_text):
    """
    Removes cumulative data section from a tooltip.
    
    Args:
        tooltip_text (str): The tooltip text that may contain cumulative data
        
    Returns:
        str: Tooltip text with cumulative data removed
    """
    if not tooltip_text:
        return tooltip_text
    
    # Extract any 5xx error examples to preserve them
    five_xx_examples = ""
    if "5xx Error Examples:" in tooltip_text:
        parts = tooltip_text.split("5xx Error Examples:")
        if len(parts) > 1:
            five_xx_examples = "5xx Error Examples:" + parts[1].split("\n\n--- CUMULATIVE DATA")[0]
    
    # Split at the cumulative data marker and return just the first part
    base_tooltip = tooltip_text.split('\n\n--- CUMULATIVE DATA')[0]
    
    # Add back the 5xx error examples if they exist
    if five_xx_examples and "5xx Error Examples:" not in base_tooltip:
        return base_tooltip + "\n\n" + five_xx_examples
    return base_tooltip

def set_logger(log_instance):
    """
    Sets the logger for this module.
    
    Args:
        log_instance: Logger instance
    """
    global logger
    logger = log_instance

def set_database_manager(db_instance):
    """
    Sets the database manager for this module.
    
    Args:
        db_instance: DatabaseManager instance
    """
    global db_manager
    db_manager = db_instance