#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kubernetes-related functions for Kubernetes Communications Graph Visualizer
"""

import json
import subprocess
from config.constants import EXCLUDED_NS_FILE, KUBE_CONTEXT, KUBE_CONTEXTS_FILE, KUBE_CONFIG_DIR

# Global logger (will be set by the main script)
logger = None

import os

def load_kube_contexts(KUBE_CONTEXTS_FILE):
    """Load Kubernetes contexts from files in the specified config directory."""
    contexts = []
    try:
        with open(KUBE_CONTEXTS_FILE, 'r') as f:
            for line in f:
                context = line.strip()
                if context and not line.startswith("#"):
                    contexts.append(context)
        logger.info(f"Loaded {len(contexts)} Kubernetes contexts from {KUBE_CONTEXTS_FILE}")
    except Exception as e:
        logger.error(f"Error loading Kubernetes contexts: {e}")
    return contexts

def load_kube_config(context):
    """Get the path to the kubeconfig file for a given context.
    
    Args:
        context (str): The Kubernetes context name
        
    Returns:
        str: The full path to the kubeconfig file, or None if not found
    """
    # Construct the path to the kubeconfig file
    config_path = os.path.join(KUBE_CONFIG_DIR, f"{context}.config")
    
    # Check if the kubeconfig file exists
    if os.path.exists(config_path):
        logger.info(f"Found kubeconfig file for context {context} at {config_path}")
        return config_path
    else:
        logger.warning(f"No kubeconfig file found for context {context} at {config_path}")
        return None

def load_excluded_namespaces():
    """Load namespaces to exclude from visualization."""
    excluded_ns = set()
    try:
        with open(EXCLUDED_NS_FILE, 'r') as f:
            for line in f:
                ns = line.strip()
                if ns:  # Skip empty lines
                    excluded_ns.add(ns)
        logger.info(f"Loaded {len(excluded_ns)} excluded namespaces: {', '.join(excluded_ns)}")
    except FileNotFoundError:
        logger.warning(f"Warning: {EXCLUDED_NS_FILE} not found. No namespaces will be excluded.")
    return excluded_ns

def get_namespaces(context, excluded_namespaces, kubeconfig=None):
    """Get all namespaces in the cluster except excluded ones.
    
    Args:
        context (str): The Kubernetes context
        excluded_namespaces (list): List of namespaces to exclude
        kubeconfig (str, optional): Path to the kubeconfig file
        
    Returns:
        list: List of namespace names
    """
    logger.info(f"Retrieving namespaces from cluster with context {context}...")
    all_namespaces = []
    
    if not context:
        logger.warning("No Kubernetes context found. Cannot retrieve namespaces.")
        return all_namespaces

    cmd = ["kubectl", "get", "namespaces", "-o", "json"]
    
    # Add context if specified
    #if context and not kubeconfig:
    #    cmd.insert(1, "--context")
    #    cmd.insert(2, context)
    if kubeconfig:
        cmd.insert(1, "--kubeconfig")
        cmd.insert(2, kubeconfig)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        namespaces_data = json.loads(result.stdout)
            
        for ns in namespaces_data["items"]:
            namespace = ns["metadata"]["name"]
            if namespace not in excluded_namespaces:
                all_namespaces.append(namespace)
            
        logger.info(f"Found {len(all_namespaces)} non-excluded namespaces in context {context}")
        logger.debug(f"Namespaces: {', '.join(all_namespaces)}")
    except subprocess.CalledProcessError as e:
        logger.error(f"Error executing kubectl command in context {context}: {e}")
        logger.debug(f"Command output: {e.stdout}\n{e.stderr}")
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing kubectl output in context {context}: {e}")

    return all_namespaces

def count_pods_in_namespace(context, namespace, kubeconfig=None):
    """Count the number of pods in a namespace.
    
    Args:
        context (str): The Kubernetes context
        namespace (str): The namespace to count pods in
        kubeconfig (str, optional): Path to the kubeconfig file
        
    Returns:
        int: Number of pods in the namespace
    """
    cmd = ["kubectl", "get", "pods", "-n", namespace, "--no-headers"]
    
    # Add context if specified
    #if context and not kubeconfig:
    #    cmd.insert(1, "--context")
    #    cmd.insert(2, context)
    if kubeconfig:
        cmd.insert(1, "--kubeconfig")
        cmd.insert(2, kubeconfig)
        
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        pod_count = len(result.stdout.strip().split('\n')) if result.stdout.strip() else 0
        logger.debug(f"In context {context}, namespace {namespace} has {pod_count} pods")
        return pod_count
    except subprocess.CalledProcessError as e:
        logger.warning(f"Error counting pods in namespace {namespace} in context {context}: {e}")
        return 0

def find_web_pod_in_namespace(context, namespace, kubeconfig=None, pods_with_ips=None):
    """Find a pod running a web server in the given namespace.
    
    Args:
        context (str): The Kubernetes context
        namespace (str): The namespace to search in
        kubeconfig (str, optional): Path to the kubeconfig file
        pods_with_ips (dict, optional): Dictionary of pods with their IPs
    Returns:
        str: Name of the first web pod found, or None if none found
    """
    logger.info(f"Looking for web pods in namespace {namespace} in context {context}...")
    cmd = ["kubectl", "get", "pods", "-n", namespace, "-o", "json"]
    
    # Add context if specified
    #if context and not kubeconfig:
    #    cmd.insert(1, "--context")
    #    cmd.insert(2, context)
    if kubeconfig:
        cmd.insert(1, "--kubeconfig")
        cmd.insert(2, kubeconfig)
        
    try:
        #result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        #pods_data = json.loads(result.stdout)
        #pods_data = pods_with_ips[namespace]
        
        # Look for pods with typical web server container names or ports
        for pod_name, pod_info in pods_with_ips[namespace].items():
            #logger.info(f"In context {context}, namespace {namespace} has pod {pod_name} with IP {pod_ip}")
            # Check if pod name contains web-related keywords
            if any(keyword in pod_name.lower() for keyword in ["web", "http", "nginx", "api", "webapp"]):
                logger.info(f"In context {context}, found web pod by name: {pod_name}")
                return pod_name
            
            port = pod_info["port"]
            if port in [80, 443, 8080, 8443]:
                logger.info(f"In context {context}, found web pod by port: {pod_name}")
                return pod_name
            # Check container ports
            # if "containers" in pod["spec"]:
            #     for container in pod["spec"]["containers"]:
            #         if "ports" in container:
            #             for port in container["ports"]:
            #                 if port.get("containerPort") in [80, 443, 8080, 8443]:
            #                     logger.info(f"In context {context}, found web pod by port: {pod_name}")
            #                     return pod_name
        
        # If no obvious web pod found, return the first pod (if any)
        if pods_with_ips[namespace].items():
            pod_name = pods_with_ips[namespace][0]["metadata"]["name"]
            logger.info(f"In context {context}, no specific web pod found, using first pod: {pod_name}")
            return pod_name
        else:
            logger.warning(f"In context {context}, no pods found in namespace {namespace}")
            return None
    except subprocess.CalledProcessError as e:
        logger.error(f"In context {context}, error getting pods in namespace {namespace}: {e}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"In context {context}, error parsing pod data for namespace {namespace}: {e}")
        return None

def get_all_pods_with_ips_in_namespaces(excluded_namespaces, contexts=None):
    """Get all pods and their IP addresses in a namespace.
    
    Args:
        context (str): The Kubernetes context
        namespace (str): The namespace to retrieve pods from
        kubeconfig (str, optional): Path to the kubeconfig file
        
    Returns:
        dict: A dictionary with pod names as keys and their IP addresses as values
    """
    pods_with_ips = {}
    for context in contexts:
        kubeconfig = load_kube_config(context)
        ns_in_context = get_namespaces(context, excluded_namespaces, kubeconfig)

        for namespace in ns_in_context:
            logger.debug(f"Retrieving pods and their IPs from namespace {namespace} in context {context} with kubeconfig {kubeconfig}")
            pods_with_ips[namespace] = {}
            cmd = ["kubectl", "get", "pods", "-n", namespace, "-o", "json"]
            
            if kubeconfig:
                cmd.insert(1, "--kubeconfig")
                cmd.insert(2, kubeconfig)
        
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                pods_data = json.loads(result.stdout)
        
                for pod in pods_data["items"]:
                    namespace = pod["metadata"]["namespace"]
                    pod_name = pod["metadata"]["name"]
                    pod_ip = pod["status"].get("podIP")
                    
                    # Check if the pod has containers and if the first container has ports
                    if "containers" in pod["spec"] and pod["spec"]["containers"]:
                        container = pod["spec"]["containers"][0]
                        if "ports" in container and container["ports"]:
                            pod_port = container["ports"][0].get("containerPort")
                        else:
                            pod_port = None  # Set to None if no ports are defined
                    else:
                        pod_port = None  # Set to None if no containers are defined
                    
                    pods_with_ips[namespace][pod_name] = {"ip": pod_ip, "port": pod_port}
            
                logger.debug(f"Found {len(pods_with_ips[namespace])} pods with IPs in namespace {namespace}")
            except subprocess.CalledProcessError as e:
                logger.error(f"Error retrieving pods in namespace {namespace} in context {context}: {e}")
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing pod data for namespace {namespace} in context {context}: {e}")

    return pods_with_ips

def set_logger(log_instance):
    """Set the global logger."""
    global logger
    logger = log_instance     