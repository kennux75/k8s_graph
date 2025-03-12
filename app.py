#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Entry point for the Kubernetes Communications Graph Visualizer Web Application

This file serves as the main entry point and delegates the actual application logic
to the appropriate modules in the libs directory.
"""

import os
import sys
import argparse  # Importer argparse pour gérer les arguments de la ligne de commande

# Add libs to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

# Import our modules
from config.constants import KUBE_CONTEXT
from libs.logging import setup_logging
from libs.graph.communication_graph import set_logger as set_graph_logger
from libs.parsing.kubernetes import set_logger as set_kubernetes_logger
from libs.parsing.logs import set_logger as set_logs_logger
from libs.graph.graph_builder import set_logger as set_graph_builder_logger
from libs.visualization.tooltip_manager import set_logger as set_tooltip_logger
from libs.webapp.app_controller import create_app, init_app, run_app

if __name__ == '__main__':
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Kubernetes Communications Graph Visualizer')
    parser.add_argument('-d', '--debug', type=int, choices=[0, 1, 2], 
                        help='Set the logging level: 0 for debug, 1 for info, 2 for warning')
    args = parser.parse_args()  # Analyser les arguments

    # Set up logging
    log_level = 0  # Default to info level
    if args.debug is not None:
        log_level = args.debug  # Set to the provided debug level

    logger = setup_logging(log_level)  # Passer le niveau de journalisation
    
    # Configure loggers for all modules
    set_graph_logger(logger)
    set_kubernetes_logger(logger)
    set_logs_logger(logger)
    set_graph_builder_logger(logger)
    set_tooltip_logger(logger)
    
    # Create and initialize the Flask app
    app, socketio = create_app()
    app, socketio = init_app(app, socketio, logger)
    
    # Run the application
    run_app(app, socketio) 
