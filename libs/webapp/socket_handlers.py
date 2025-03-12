#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Socket.IO event handlers for the Kubernetes Communications Graph Web Application
"""

import threading
import logging
from flask import request
from flask_socketio import SocketIO

from libs.webapp.graph_manager import graph_data, graph_lock, build_graph_data

# Initialize logger
logger = logging.getLogger(__name__)

# SocketIO instance
socketio = None

def init_socket_handlers(socketio_instance):
    """Initialize the socket.io event handlers"""
    global socketio
    socketio = socketio_instance
    
    # Set the socketio instance in the graph manager
    from libs.webapp.graph_manager import set_socketio
    set_socketio(socketio)
    
    @socketio.on('connect')
    def handle_connect(auth=None):
        """Handle client connection"""
        logger.info(f"Client connected with SID: {request.sid}")
        # Make sure we have a valid session ID
        if hasattr(request, 'sid') and request.sid:
            # Send current graph data to the new client
            with graph_lock:
                if graph_data['nodes']:
                    logger.info(f"Sending graph data to client {request.sid}")
                    socketio.emit('graph_update', graph_data, room=request.sid)
                else:
                    logger.info(f"No graph data available for client {request.sid}, triggering build")
                    # If we don't have data, trigger a build
                    thread = threading.Thread(target=build_graph_data)
                    thread.daemon = True
                    thread.start()
        else:
            logger.warning("Client connected but no SID available")

    @socketio.on('request_update')
    def handle_update_request():
        """Handle client request for updated data"""
        logger.info("Client requested graph update")
        # Build new graph data in a separate thread
        thread = threading.Thread(target=build_graph_data)
        thread.daemon = True
        thread.start()

def set_logger(log_instance):
    """Set the logger for this module"""
    global logger
    logger = log_instance 