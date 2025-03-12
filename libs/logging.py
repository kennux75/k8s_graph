#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Logging setup for Kubernetes Communications Graph Visualizer
"""

import logging

def setup_logging(debug_level):
    """Configure logging based on debug level."""
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    if debug_level == 0:
        level = logging.WARNING
    elif debug_level == 1:
        level = logging.INFO
    else:
        level = logging.DEBUG
    
    logging.basicConfig(
        level=level,
        format=log_format,
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('graph_k8s.log', mode='w')
        ]
    )
    return logging.getLogger('graph_k8s') 