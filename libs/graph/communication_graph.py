#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Main class for the Kubernetes Communications Graph Visualizer
"""

import networkx as nx
from collections import defaultdict
import concurrent.futures
import threading
import time
from config.constants import MAX_WORKER_THREADS, KUBE_CONTEXTS_FILE
from libs.database.db_manager import DatabaseManager

from libs.parsing.kubernetes import load_kube_contexts, load_excluded_namespaces, get_namespaces, count_pods_in_namespace, find_web_pod_in_namespace, load_kube_config, get_all_pods_with_ips_in_namespaces
from libs.parsing.logs import parse_logs, extract_logs, extract_and_parse_logs_threaded
from libs.graph.graph_builder import create_simplified_graph

# Global logger (will be set by the main script)
logger = None

class K8sCommunicationGraph:
    def __init__(self, skip_logs=False):
        """Initialize the graph.
        
        Args:
            skip_logs: If True, skip log extraction and use a simplified communication pattern
        """
        self.graph = nx.DiGraph()
        self.simplified_graph = nx.DiGraph()
        self.namespace_colors = {}
        self.namespace_shapes = {}
        self.edge_counts = defaultdict(int)
        self.contexts = load_kube_contexts(KUBE_CONTEXTS_FILE)
        self.excluded_namespaces = load_excluded_namespaces()
        self.namespace_pod_counts = {}
        self.node_to_namespace = {}  # Mapping of node names to their namespaces
        self.node_to_context = {}    # Mapping of node names to their contexts
        self.skip_logs = skip_logs
        self.node_counts = {}  # Attribute to store node counts
        self.http_host_counts = defaultdict(lambda: defaultdict(int))  # Attribute to store http_host counts
        
        # Initialize database manager
        self.db_manager = DatabaseManager()
        
        # Load kubeconfig paths for each context
        self.context_to_kubeconfig = {}
        for context in self.contexts:
            self.context_to_kubeconfig[context] = load_kube_config(context)
        
        # Add locks for thread safety
        self.edge_counts_lock = threading.Lock()
        self.http_host_counts_lock = threading.Lock()
        self.graph_lock = threading.Lock()
        self.db_lock = threading.Lock()
    
    def analyze_namespace(self, context, namespace, kubeconfig):
        """Analyze communications for a namespace."""
        logger.info(f"Analyzing namespace: {namespace} for context: {context} with kubeconfig: {kubeconfig}")
        
        # Get the kubeconfig for this context
        #kubeconfig = self.context_to_kubeconfig.get(context)
        
        # If we're skipping logs, return a simplified pattern
        if self.skip_logs:
            # Create some simple mock communications for demonstration
            return [
                {"context": context, "source": "external", "target": namespace, "weight": 80},
                {"context": context, "source": namespace, "target": "api-" + namespace.split('-')[0], "weight": 20}
            ]
        
        # Normal log-based analysis
        web_pod = find_web_pod_in_namespace(context, namespace, kubeconfig)
        if not web_pod:
            logger.warning(f"No pods found in namespace {namespace} for context {context}")
            return []
        
        # Ensure the correct pod name is passed to extract_logs
        logs = extract_logs(context, namespace, web_pod, kubeconfig)  # Ensure web_pod is the correct pod name
        return parse_logs(logs, context, namespace, self.http_host_counts)
    
    def process_namespace_threaded(self, context, namespace, kubeconfig, namespaces, pods_with_ips):
        """
        Process a single namespace in a separate thread.
        This function is called by the thread pool executor.
        
        Args:
            context: The context to use for the namespace
            namespace: The namespace to process
            
        Returns:
            A dictionary containing the namespace and its processing results
        """
        logger.info(f"Thread processing namespace: {namespace} for context: {context} with kubeconfig: {kubeconfig}")
        
        # Get the kubeconfig for this context
        #kubeconfig = self.context_to_kubeconfig.get(context)
        
        if self.skip_logs:
            # Create mock communications for demonstration
            communications = [
                {"context": context, "source": "external", "target": namespace, "weight": 80},
                {"context": context, "source": namespace, "target": "api-" + namespace.split('-')[0], "weight": 20}
            ]
            
            # Count pods in this namespace
            #pod_count = count_pods_in_namespace(context, namespace, kubeconfig)
            pod_count = len(pods_with_ips.get(namespace, {}))
            
            return {
                'context': context,
                'namespace': namespace,
                'communications': communications,
                'pod_count': pod_count,
                'http_host_counts': {}
            }
        
        # Extract and parse logs in a thread-safe way
        communications, local_http_host_counts = extract_and_parse_logs_threaded(context, namespace, self.http_host_counts_lock, kubeconfig, namespaces, pods_with_ips)
        
        # Count pods in this namespace
        #pod_count = count_pods_in_namespace(context, namespace, kubeconfig)
        pod_count = len(pods_with_ips.get(namespace, {}))

        
        return {
            'context': context,
            'namespace': namespace,
            'communications': communications,
            'pod_count': pod_count,
            'http_host_counts': local_http_host_counts
        }
        
    def merge_thread_results(self, results):
        """
        Merge results from threaded processing into the main graph data.
        
        Args:
            results: List of result dictionaries from threaded processing
        """
        for result in results:
            namespace = result['namespace']
            communications = result['communications']
            pod_count = result['pod_count']
            local_http_host_counts = result['http_host_counts']
            context = result['context']
            
            # Update pod counts
            self.namespace_pod_counts[namespace] = pod_count
            
            # Count services per namespace
            self.node_counts[namespace] = self.node_counts.get(namespace, 0) + 1
            
            # Update http_host_counts with thread-local data
            with self.http_host_counts_lock:
                for ns, host_counts in local_http_host_counts.items():
                    for host_key, counts in host_counts.items():
                        self.http_host_counts[ns][host_key] = counts
                        
                        # Log the counts for debugging
                        logger.debug(f"Processing counts for node {ns}: {counts}")
                        
                        # Update error counts in database (only 5xx errors)
                        if counts.get('5xx', 0) > 0:
                            with self.db_lock:
                                try:
                                    current_errors, current_requests = self.db_manager.get_node_errors(ns)
                                    new_errors = current_errors + counts.get('5xx', 0)
                                    
                                    logger.debug(f"Current errors for {ns}: {current_errors}")
                                    logger.debug(f"New errors to add: {counts.get('5xx', 0)}")
                                    logger.debug(f"Total errors after update: {new_errors}")
                                    
                                    # Collect 5xx error requests
                                    error_requests = []
                                    if '5xx_entries' in counts:
                                        logger.debug(f"Found {len(counts['5xx_entries'])} 5xx entries for node {ns}")
                                        error_requests = [
                                            {
                                                'status': entry.get('status', 'unknown'),
                                                'request': entry.get('request', 'unknown'),
                                                'time': entry.get('time', 'unknown'),
                                                'error': entry.get('error', ''),
                                                'timestamp': time.time()  # Add current timestamp
                                            }
                                            for entry in counts['5xx_entries']
                                        ]
                                        logger.debug(f"Stored error requests with timestamps: {error_requests}")
                                    
                                    # Update database with new errors and requests
                                    self.db_manager.update_node_errors(ns, new_errors, error_requests)
                                    
                                    # Verify the update
                                    verify_errors, verify_requests = self.db_manager.get_node_errors(ns)
                                    logger.debug(f"Verified database update for {ns}: errors={verify_errors}, requests={len(verify_requests)}")
                                except Exception as e:
                                    logger.error(f"Error updating database for node {ns}: {e}")
                                    logger.error(f"Counts that caused the error: {counts}")
            
            # Process communications and store them in the database
            if communications:
                for comm in communications:
                    # Handle different formats of communication data
                    if isinstance(comm, tuple) and len(comm) == 2:
                        source, target = comm
                        weight = 1
                    elif isinstance(comm, tuple) and len(comm) == 3:
                        source, target, attrs = comm
                        weight = attrs.get('weight', 1)
                    elif isinstance(comm, dict):
                        source = comm.get('source')
                        target = comm.get('target')
                        weight = comm.get('weight', 1)
                    else:
                        logger.warning(f"Unexpected communication format: {comm}")
                        continue
                    
                    if source and target:
                        # Store the context for source and target nodes
                        self.node_to_context[source] = context
                        self.node_to_context[target] = context
                        
                        # Store communication in database
                        with self.db_lock:
                            try:
                                self.db_manager.store_communication(source, target, weight)
                            except Exception as e:
                                logger.error(f"Error storing communication {source} -> {target}: {e}")
                        
                        # Get recent errors for edge coloring
                        has_5xx, has_4xx = self.db_manager.get_recent_errors(target)
                        logger.debug(f"Edge {source} -> {target}: has_5xx={has_5xx}, has_4xx={has_4xx}")
                        
                        # Determine edge color based on recent errors
                        edge_color = 'green'  # Default color
                        if has_5xx:
                            edge_color = 'red'
                            logger.debug(f"Setting edge {source} -> {target} color to red (5xx error)")
                        elif has_4xx:
                            edge_color = 'orange'
                            logger.debug(f"Setting edge {source} -> {target} color to orange (4xx error)")
                        else:
                            logger.debug(f"Setting edge {source} -> {target} color to green (no errors)")
                        
                        # Get edge weight from database
                        edge_weight = self.db_manager.get_edge_weight(source, target)
                        
                        # Add edge to graph with weight and color
                        with self.graph_lock:
                            logger.debug(f"Added edge: {source} -> {target} with weight {edge_weight} and color {edge_color}")
                            self.graph.add_edge(
                                source, target, 
                                weight=edge_weight,
                                label=f"{edge_weight}",
                                color=edge_color
                            )
    
    def build_graph(self):
        """Build the communication graph based on log analysis using multithreading."""
        logger.info("Building communication graph with multithreading...")
        all_namespaces = []
        #for context in self.contexts:
        #    namespaces = get_namespaces(context, self.excluded_namespaces, self.context_to_kubeconfig.get(context))
        #    all_namespaces.extend(namespaces)
        
        pods_with_ips = get_all_pods_with_ips_in_namespaces(self.excluded_namespaces, self.contexts)

        # Display the contents of the pods_with_ips dictionary
        logger.debug("Pods with IP addresses by namespace:")
        for ns, pods in pods_with_ips.items():
             logger.debug(f"Namespace: {ns}")
             for pod_name, pod_ip in pods.items():
                 logger.debug(f"  Pod Name: {pod_name}, IP Address: {pod_ip} in namespace {ns}")

        #logger.debug(f"Pods with IPs: {pods_with_ips}")
        for context in self.contexts:
            # Get the kubeconfig for this context
            kubeconfig = self.context_to_kubeconfig.get(context)
            
            namespaces = get_namespaces(context, self.excluded_namespaces, self.context_to_kubeconfig.get(context))
        
            # Initialize node_counts dictionary for tracking service counts per namespace
            self.node_counts = {}
        
            # Process namespaces in parallel using a thread pool
            max_workers = min(MAX_WORKER_THREADS, len(namespaces))
            logger.info(f"Using {max_workers} worker threads for parallel processing for context {context}")
            
            results = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit tasks to the thread pool
                future_to_namespace = {
                    executor.submit(self.process_namespace_threaded, context, namespace, kubeconfig, all_namespaces, pods_with_ips): namespace 
                    #for namespace in non_excluded_namespaces
                    for namespace in namespaces
                }
            
                # Collect results as they complete
                for future in concurrent.futures.as_completed(future_to_namespace):
                    namespace = future_to_namespace[future]
                    try:
                        result = future.result()
                        results.append(result)
                        logger.info(f"Completed processing namespace: {namespace} for context {context}")
                    except Exception as exc:
                        logger.error(f"Namespace {namespace} in context {context} generated an exception: {exc}")
        
            # Merge results from threaded processing
            logger.info(f"Merging results from {len(results)} threads...")
            self.merge_thread_results(results)
        
            logger.info("Creating simplified graph...")
            self.simplified_graph = create_simplified_graph(self.graph, self.node_to_namespace, self.node_to_context)
        
            logger.info(f"Graph building complete: {len(self.graph.nodes())} nodes, {len(self.graph.edges())} edges for context {context}")
            logger.info(f"Simplified graph created: {len(self.simplified_graph.nodes())} nodes, {len(self.simplified_graph.edges())} edges for context {context}")
    
    def get_auth_value_for_node(self, node):
        """Retrieve the auth value for a given node."""
        # Assuming the auth value is stored in a way that can be accessed
        # This is a placeholder; implement logic to retrieve the actual auth value
        return "auth_value_placeholder"  # Replace with actual logic to get the auth value

    def __del__(self):
        """Cleanup method to close database connection."""
        if hasattr(self, 'db_manager'):
            self.db_manager.close()

def set_logger(log_instance):
    """Set the global logger."""
    global logger
    logger = log_instance 