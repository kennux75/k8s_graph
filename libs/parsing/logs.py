#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Log parsing functions for Kubernetes Communications Graph Visualizer
"""

import json
import yaml
import re
from urllib.parse import urlparse, parse_qs
import subprocess
from collections import defaultdict
from config.constants import LOG_LINES_LIMIT

# Global logger (will be set by the main script)
logger = None

def extract_field_from_json_line(log_entry, field_name):
    """Extract a field from a JSON log entry."""
    value_field = log_entry.get(field_name, "")
    return value_field

def extract_field_from_request(request, field_name):
    # Extract the URL part from the request
    match = re.search(r'^(?:GET|POST|PUT|DELETE|PATCH|PURGE) (\S+) HTTP/\d\.\d', request)
    if not match:
        return None  # Invalid request format

    url = match.group(1)
    
    # Parse query parameters
    query_params = parse_qs(urlparse(url).query)

    # Return the requested parameter if it exists
    return query_params.get(field_name, [None])[0]

def parse_logs(logs, namespace, http_host_counts, namespaces_list, pods_with_ips):
    """Parse nginx logs to extract communication data and error counts."""
    logger.info(f"Parsing logs for namespace {namespace}")
    communications = []
    
    line_count = 0
    valid_json_count = 0
    skipped_metrics_count = 0

    for line in logs.split('\n'):
        if not line.strip():
            continue
            
        line_count += 1
        try:
            log_entry = json.loads(line)
            valid_json_count += 1
            
            # Extract infos from json line
            # the auth field in the json log_entry represents the source namespace or the origine of the request
            remoteaddr = extract_field_from_json_line(log_entry, "remoteaddr")
            source = extract_field_from_json_line(log_entry, "auth")
            user_agent = extract_field_from_json_line(log_entry, "user_agent")
            request = extract_field_from_json_line(log_entry, "request")
            http_host = extract_field_from_json_line(log_entry, "http_host")
            status_code = extract_field_from_json_line(log_entry, "status")

            remoteaddr_parsed_match = re.search(r'(\d+\.\d+\.\d+\.\d+)$', remoteaddr)
            #logger.debug(f"for ns {namespace} remoteaddr: {remoteaddr} -> remoteaddr_parsed_match: {remoteaddr_parsed_match}")
            if remoteaddr_parsed_match:
                remoteaddr_parsed = remoteaddr_parsed_match.group(1)
            else:
                #logger.warning(f"No valid IP found in remoteaddr: {remoteaddr} for namespace {namespace} remoteaddr_parsed_match: {remoteaddr_parsed_match}")
                remoteaddr_parsed = "unknown"  # or handle as needed

            # healthcheck or monitoring request
            if ("/metrics" in request.lower() or "/alive" in request.lower() or "/ready" in request.lower() or "/health" in request.lower() or "/ok.php" in request.lower() or "/monitoring" in request.lower()):
                skipped_metrics_count += 1
                #logger.debug(f"Skipping healthchecks request: {request}")
                continue

            
            # # # loop test to detect namespace in the pods_with_ips
            for ns, pods in pods_with_ips.items():
                for pod_name, pod_ip in pods.items():
                    if remoteaddr_parsed == pod_ip:
                        # the remoteaddr IP {remoteaddr} has been detected in namespace {ns} for pod {pod_name} 
                        source = ns
                        logger.debug(f"Remoteaddr IP {remoteaddr_parsed} detected in namespace: {ns} for pod {pod_name} - setting source to {ns} for namespace {namespace}")

                    # Check other IP addresses
                    if str(remoteaddr_parsed).startswith("172.17.2.5") or str(remoteaddr_parsed).startswith("172.18.2.5"):
                        source = "xinflbpub"
                        logger.debug(f"Remoteaddr IP {remoteaddr_parsed} detected as a xinflbpub IP - setting source to {source} for namespace {namespace}")
                    if str(remoteaddr_parsed).startswith("10.121.232") and not source:
                        source = "From-kubeworkers"
                        logger.debug(f"Remoteaddr IP {remoteaddr_parsed} detected as a kube worker IP - setting source to {source} for namespace {namespace}")
                        #else:
                        #    logger.debug(f"Remoteaddr IP {remoteaddr_parsed} detected as a kube worker IP - source already set to {source} for namespace {namespace}")
                            #continue
                    if "unknown" in str(remoteaddr_parsed).lower() and source:
                        logger.debug(f"Remoteaddr IP {remoteaddr_parsed} detected as a unknown IP - source already set to {source} for namespace {namespace}")
                        #continue
                    if remoteaddr_parsed in ["10.120.100.186", "10.120.1.54", "10.120.1.155", "10.120.101.224"]:
                        source = "xpayhdws"
                        logger.debug(f"Remoteaddr IP {remoteaddr_parsed} detected as a xpayhdws IP - setting source to {source} for namespace {namespace}")
                    else:
                        if source:
                            source = source
                            logger.debug(f"Source IP not detected in any namespace but has IP: {remoteaddr_parsed} pod_ip = {pod_ip} and auth field {source} - letting source to {source} for namespace {namespace}")
                        if not source:
                            source = "unknown"
                            logger.debug(f"Source IP not detected in any namespace but has IP: {remoteaddr_parsed} and auth field is empty - setting source to unknown to namespace {namespace}")
                continue

            target = namespace

            logger.debug(f"Communication detected: {source} -> {target}")
            communications.append((source, target))
            
            # Update http_host counts for the current namespace
            if http_host:
                # Include the auth value in the key for counting
                auth_value = source if source else "unknown_auth"  # Use "unknown_auth" if source is empty
                if (http_host, auth_value) not in http_host_counts[namespace]:
                    http_host_counts[namespace][(http_host, auth_value)] = {
                        'count': 0, 
                        '4xx': 0, 
                        '5xx': 0, 
                        '3xx': 0, 
                        '2xx': 0,
                        '5xx_entries': []  # New array to store 5xx log entries
                    }
                
                # Increment the count for the http_host
                http_host_counts[namespace][(http_host, auth_value)]['count'] += 1
                
                # Update error counts based on the current log entry
                if status_code is not None:
                    status_code_str = str(status_code)
                    if re.match(r'^4\d{2}$', status_code_str):  # Matches 4xx
                        http_host_counts[namespace][(http_host, auth_value)]['4xx'] += 1
                    elif re.match(r'^5\d{2}$', status_code_str):  # Matches 5xx
                        http_host_counts[namespace][(http_host, auth_value)]['5xx'] += 1
                        # Store the log entry for 5xx errors
                        # log_details = {
                        #     'status': status_code,
                        #     'request': extract_field_from_json_line(log_entry, "request"),
                        #     'time': extract_field_from_json_line(log_entry, "time_local"),
                        #     'error': extract_field_from_json_line(log_entry, "error")
                        # }
                        #http_host_counts[namespace][(http_host, auth_value)]['5xx_entries'].append(log_details)
                        http_host_counts[namespace][(http_host, auth_value)]['5xx_entries'].append(log_entry)
                    elif re.match(r'^3\d{2}$', status_code_str):  # Matches 3xx
                        http_host_counts[namespace][(http_host, auth_value)]['3xx'] += 1
                    elif re.match(r'^2\d{2}$', status_code_str):  # Matches 2xx
                        http_host_counts[namespace][(http_host, auth_value)]['2xx'] += 1
                logger.debug(f"Errors for {http_host}: 4xx: {http_host_counts[namespace][(http_host, auth_value)]['4xx']}, 5xx: {http_host_counts[namespace][(http_host, auth_value)]['5xx']}, 3xx: {http_host_counts[namespace][(http_host, auth_value)]['3xx']}, 2xx: {http_host_counts[namespace][(http_host, auth_value)]['2xx']}")
            
        except json.JSONDecodeError:
            # Not a valid JSON log line, skip
            logger.debug(f"Invalid JSON log line: {line[:100]}...")
            continue
    
    logger.info(f"Log parsing results: {line_count} lines, {valid_json_count} valid JSON, "
               f"{skipped_metrics_count} metrics requests skipped, {len(communications)} communications detected")
    
    return communications

# New thread-safe log extraction and parsing functions for multithreading
def extract_and_parse_logs_threaded(context, namespace, http_host_counts_lock, kubeconfig=None, namespaces=None, pods_with_ips=None):
    """
    Extract and parse logs for a namespace in a thread-safe manner.
    
    This function combines extraction and parsing in a single call for better
    threading efficiency. The http_host_counts is updated with a lock to ensure
    thread safety.
    
    Args:
        context (str): The Kubernetes context
        namespace (str): The namespace to extract and parse logs from
        http_host_counts_lock: A lock for safely updating the http_host_counts dictionary
        kubeconfig (str, optional): Path to the kubeconfig file
    
    Returns:
        A tuple containing:
        - List of communications detected
        - Dictionary of http_host counts for this namespace
    """
    logger.info(f"Thread extracting and parsing logs for namespace: {namespace} in context: {context} with kubeconfig: {kubeconfig}")
    
    # Find a web pod in this namespace
    from libs.parsing.kubernetes import find_web_pod_in_namespace
    web_pod = find_web_pod_in_namespace(context, namespace, kubeconfig)
    
    if not web_pod:
        logger.warning(f"In context {context}, no pods found in namespace {namespace}")
        return [], {}
    
    # Extract logs from the pod
    logs = extract_logs(context, namespace, web_pod, kubeconfig)
    
    if not logs:
        logger.warning(f"For context {context}, no logs extracted from pod {web_pod} in namespace {namespace}")
        return [], {}
    
    # Parse the logs
    # Use a local dictionary to collect http_host_counts for this namespace
    local_http_host_counts = defaultdict(lambda: defaultdict(lambda: {'count': 0, '4xx': 0, '5xx': 0, '3xx': 0, '2xx': 0}))
    communications = parse_logs(logs, namespace, {namespace: local_http_host_counts[namespace]}, namespaces, pods_with_ips)
    
    # Return the local results to be merged with the global data under a lock by the caller
    return communications, local_http_host_counts

def extract_logs(context, namespace, pod_name, kubeconfig=None):
    """Extract logs from a pod.
    
    Args:
        context (str): The Kubernetes context
        namespace (str): The namespace of the pod
        pod_name (str): The name of the pod
        kubeconfig (str, optional): Path to the kubeconfig file
        
    Returns:
        str: The logs from the pod
    """
    logger.info(f"Extracting logs from pod {pod_name} in namespace {namespace} in context {context} with kubeconfig: {kubeconfig}")
    cmd = ["kubectl", "logs", "-n", namespace, pod_name, "--tail", str(LOG_LINES_LIMIT)]
    
    # Add context if specified
    if context and not kubeconfig:
        cmd.insert(1, "--context")
        cmd.insert(2, context)
    elif kubeconfig:
        cmd.insert(1, "--kubeconfig")
        cmd.insert(2, kubeconfig)
        
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        log_lines = result.stdout.strip().split('\n')
        valid_lines = [line for line in log_lines if line.strip()]
        logger.debug(f"In context {context}, extracted {len(valid_lines)} log lines from {pod_name}")
        return result.stdout
    except subprocess.CalledProcessError as e:
        logger.error(f"In context {context}, error extracting logs from pod {pod_name}: {e}")
        logger.debug(f"Command output: {e.stdout}\n{e.stderr}")
        return ""

def set_logger(log_instance):
    """Set the global logger."""
    global logger
    logger = log_instance 
