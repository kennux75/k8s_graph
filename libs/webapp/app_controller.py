#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Application Controller for the Kubernetes Communications Graph Web Application
Initializes and runs the Flask app with SocketIO
"""

import os
from libs.common.logging_utils import get_logger
import threading
from flask import Flask
from flask_socketio import SocketIO
from apscheduler.schedulers.background import BackgroundScheduler

from config.app_config import UPDATE_INTERVAL
from libs.webapp.graph_manager import build_graph_data
from libs.webapp.routes import init_routes
from libs.webapp.socket_handlers import init_socket_handlers
from libs.webapp.app_utils import *

# Initialize logger
logger = get_logger(__name__)

# Scheduler for background tasks
scheduler = None

def reschedule_update_job(interval):
    """Reschedule the graph update job with a new interval"""
    if scheduler:
        scheduler.remove_all_jobs()
        scheduler.add_job(build_graph_data, 'interval', seconds=interval)
        logger.info(f"Graph update job rescheduled with interval: {interval} seconds")

def create_app():
    """Create and configure the Flask application"""
    # Create output directories if they don't exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    
    # Initialize Flask app
    app = Flask(__name__, 
                template_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'templates'),
                static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static'))
    app.config['SECRET_KEY'] = 'k8s-graph-secret-key'
    
    # Initialize SocketIO
    socketio = SocketIO(app, cors_allowed_origins="*")
    
    return app, socketio

def init_app(app, socketio, logger_instance):
    """Initialize the application with routes and handlers"""
    # Override module-level logger if provided
    global logger
    if logger_instance:
        logger = logger_instance
    
    # Initialize routes and socket handlers
    init_routes(app, socketio)
    init_socket_handlers(socketio)
    
    # Build initial graph data
    build_graph_data()
    
    # Start the scheduler
    global scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(build_graph_data, 'interval', seconds=UPDATE_INTERVAL)
    scheduler.start()
    
    return app, socketio

def run_app(app, socketio):
    """Run the Flask application with SocketIO"""
    try:
        # Run the Flask app with SocketIO
        logger.info(f"Starting Kubernetes Communications Graph Web App on port 6200")
        socketio.run(app, host='0.0.0.0', port=6200, debug=False)
    except KeyboardInterrupt:
        # Stop the scheduler
        if scheduler:
            scheduler.shutdown()
        logger.info("Application stopped")
    except Exception as e:
        logger.error(f"Error running application: {e}", exc_info=True)
        if scheduler:
            scheduler.shutdown() 