#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Configuration constants for Kubernetes Communications Graph Visualizer
"""

# Constants
LOG_LINES_LIMIT = 800
EXCLUDED_NS_FILE = "config/excluded-ns.txt"
KUBE_CONTEXT = None  # Variable to hold the kube-context
KUBE_CONTEXTS_FILE = "config/kube-contexts.txt"
KUBE_CONFIG_DIR = "config/kube-configs"
CUSTOM_RULES_FILE = "config/custom-rules.yaml"

# Multithreading configuration
MAX_WORKER_THREADS = 12  # Maximum number of worker threads for parallel processing 
