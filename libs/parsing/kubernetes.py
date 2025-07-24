#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Kubernetes-related functions for Kubernetes Communications Graph Visualizer
"""

import json
import subprocess
import os
from libs.common.logging_utils import get_logger
from config.constants import EXCLUDED_NS_FILE, KUBE_CONTEXTS_FILE, KUBE_CONFIG_DIR
from libs.parsing.kube_client import KubeClient

# Logger
logger = get_logger(__name__)

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
    """Get all namespaces in the cluster except excluded ones using KubeClient."""
    client = KubeClient(context=context, kubeconfig=kubeconfig)
    try:
        namespaces = client.get_namespaces(excluded=list(excluded_namespaces))
        logger.info(f"Found {len(namespaces)} non-excluded namespaces in context {context}")
        logger.debug(f"Namespaces: {', '.join(namespaces)}")
        return namespaces
    except Exception as e:
        logger.error(f"Error retrieving namespaces in context {context}: {e}")
        return []

def count_pods_in_namespace(context, namespace, kubeconfig=None):
    """Count pods via KubeClient."""
    client = KubeClient(context=context, kubeconfig=kubeconfig)
    try:
        pod_count = client.count_pods(namespace)
        logger.debug(f"In context {context}, namespace {namespace} has {pod_count} pods")
        return pod_count
    except Exception as e:
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
    logger.info("Looking for web pods in namespace %s in context %s", namespace, context)
    try:
        
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
    except Exception as e:
        logger.error("In context %s, error processing pod data for namespace %s: %s", context, namespace, e)
        return None

def get_all_pods_with_ips_in_namespaces(excluded_namespaces, contexts=None):
    """Return a dict namespace -> {pod_name: {ip, port}} across *contexts* using KubeClient."""
    pods_with_ips: dict[str, dict[str, dict[str, str | int | None]]] = {}

    for context in contexts:
        kubeconfig = load_kube_config(context)
        client = KubeClient(context=context, kubeconfig=kubeconfig)

        ns_in_context = get_namespaces(context, excluded_namespaces, kubeconfig)

        for namespace in ns_in_context:
            try:
                logger.debug(
                    "Retrieving pods and their IPs from namespace %s in context %s", namespace, context
                )
                pods_with_ips.setdefault(namespace, {})

                pods_data = client.get_pods_json(namespace)

                for pod in pods_data["items"]:
                    pod_name = pod["metadata"]["name"]
                    pod_ip = pod["status"].get("podIP")

                    # First container -> first port as heuristic
                    pod_port = None
                    containers = pod["spec"].get("containers", [])
                    if containers and containers[0].get("ports"):
                        pod_port = containers[0]["ports"][0].get("containerPort")

                    pods_with_ips[namespace][pod_name] = {"ip": pod_ip, "port": pod_port}

                logger.debug(
                    "Found %d pods with IPs in namespace %s", len(pods_with_ips[namespace]), namespace
                )
            except Exception as e:
                logger.error(
                    "Error retrieving pods in namespace %s in context %s: %s", namespace, context, e
                )

    return pods_with_ips 