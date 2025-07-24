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
from libs.logging import setup_logging
from libs.visualization.tooltip_manager import set_database_manager
from libs.webapp.app_controller import create_app, init_app, run_app
from libs.database.db_manager import DatabaseManager

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
    
    # Root logger configured globally by setup_logging;
    # individual modules obtain their own logger via logging_utils.
    
    # Initialize database manager
    db_manager = DatabaseManager()
    
    # Set database manager for tooltip manager
    set_database_manager(db_manager)
    
    # Create and initialize the Flask app
    app, socketio = create_app()
    app, socketio = init_app(app, socketio, logger)
    
    # Run the application
    run_app(app, socketio)
