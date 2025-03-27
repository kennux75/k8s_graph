#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Database manager for storing node errors in MariaDB
"""

import mysql.connector
from mysql.connector import Error
import logging
import json
import time
from config.database import DB_CONFIG, NODE_ERRORS_TABLE, ERROR_REQUEST_SCHEMA, NODE_COMMUNICATIONS_TABLE

# Initialize logger with a default configuration
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

class DatabaseManager:
    def __init__(self):
        """Initialize the database manager with configuration from config file."""
        self.connection_params = DB_CONFIG
        self.connection = None
        self._init_database()

    def _init_database(self):
        """Initialize the database and create necessary tables if they don't exist."""
        try:
            # First connect without database to create it if it doesn't exist
            conn = mysql.connector.connect(
                host=self.connection_params['host'],
                user=self.connection_params['user'],
                password=self.connection_params['password']
            )
            cursor = conn.cursor()

            # Create database if it doesn't exist
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {self.connection_params['database']}")
            cursor.execute(f"USE {self.connection_params['database']}")

            # Create tables if they don't exist
            cursor.execute(NODE_ERRORS_TABLE)
            cursor.execute(NODE_COMMUNICATIONS_TABLE)
            conn.commit()
            cursor.close()
            conn.close()

            # Now connect with the database
            self.connection = mysql.connector.connect(**self.connection_params)
            logger.info("Database initialized successfully")
        except Error as e:
            logger.error(f"Error initializing database: {e}")
            raise

    def update_node_errors(self, node_id, error_count, error_requests=None):
        """Update the error count and requests for a specific node.
        
        Args:
            node_id (str): The identifier of the node
            error_count (int): Number of 5xx errors
            error_requests (list, optional): List of error request details
        """
        try:
            cursor = self.connection.cursor()
            
            # Log the input data
            logger.debug(f"Updating node {node_id} with error_count={error_count}")
            logger.debug(f"Error requests to store: {error_requests}")
            
            # Convert error requests to JSON string if provided
            error_requests_json = None
            if error_requests:
                # Add timestamp to each error request
                for request in error_requests:
                    if 'timestamp' not in request:
                        request['timestamp'] = time.time()
                error_requests_json = json.dumps(error_requests)
                logger.debug(f"Converted error requests to JSON: {error_requests_json}")
            
            # Get current error requests if they exist
            current_requests = []
            if error_requests_json is None:
                cursor.execute("SELECT error_requests FROM node_errors WHERE node_id = %s", (node_id,))
                result = cursor.fetchone()
                if result and result[0]:
                    current_requests = json.loads(result[0])
                    logger.debug(f"Retrieved current requests from database: {current_requests}")
            
            # Update or insert the record
            query = """
                INSERT INTO node_errors (node_id, error_count, error_requests)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    error_count = %s,
                    error_requests = %s
            """
            logger.debug(f"Executing query: {query}")
            logger.debug(f"Parameters: node_id={node_id}, error_count={error_count}, error_requests={error_requests_json}")
            
            cursor.execute(query, (node_id, error_count, error_requests_json, 
                                 error_count, error_requests_json))
            self.connection.commit()
            cursor.close()
            
            # Verify the update
            verify_cursor = self.connection.cursor()
            verify_cursor.execute("SELECT error_count, error_requests FROM node_errors WHERE node_id = %s", (node_id,))
            verify_result = verify_cursor.fetchone()
            verify_cursor.close()
            
            if verify_result:
                logger.debug(f"Verified update - Stored error_count: {verify_result[0]}")
                logger.debug(f"Verified update - Stored error_requests: {verify_result[1]}")
            else:
                logger.warning(f"Could not verify update for node {node_id}")
                
        except Error as e:
            logger.error(f"Error updating node errors: {e}")
            raise

    def get_node_errors(self, node_id):
        """Get the error count and requests for a specific node.
        
        Returns:
            tuple: (error_count, error_requests)
        """
        try:
            cursor = self.connection.cursor()
            query = "SELECT error_count, error_requests FROM node_errors WHERE node_id = %s"
            cursor.execute(query, (node_id,))
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                error_requests = json.loads(result[1]) if result[1] else []
                return result[0], error_requests
            return 0, []
        except Error as e:
            logger.error(f"Error getting node errors: {e}")
            raise

    def get_recent_errors(self, node_id, hours=1):
        """Get errors that occurred in the last specified hours.
        
        Args:
            node_id (str): The identifier of the node
            hours (int): Number of hours to look back
            
        Returns:
            tuple: (has_5xx, has_4xx) - Boolean flags indicating presence of errors
        """
        try:
            cursor = self.connection.cursor()
            query = "SELECT error_requests FROM node_errors WHERE node_id = %s"
            cursor.execute(query, (node_id,))
            result = cursor.fetchone()
            cursor.close()
            
            if not result or not result[0]:
                logger.debug(f"No error requests found for node {node_id}")
                return False, False
                
            error_requests = json.loads(result[0])
            cutoff_time = time.time() - (hours * 3600)  # Convert hours to seconds
            
            has_5xx = False
            has_4xx = False
            
            logger.debug(f"Checking {len(error_requests)} error requests for node {node_id}")
            for request in error_requests:
                timestamp = request.get('timestamp', 0)
                if timestamp >= cutoff_time:
                    status = str(request.get('status', ''))
                    logger.debug(f"Found recent error: status={status}, timestamp={timestamp}")
                    if status.startswith('5'):
                        has_5xx = True
                        logger.debug(f"Found 5xx error for node {node_id}")
                    elif status.startswith('4'):
                        has_4xx = True
                        logger.debug(f"Found 4xx error for node {node_id}")
            
            logger.debug(f"Node {node_id} status: has_5xx={has_5xx}, has_4xx={has_4xx}")
            return has_5xx, has_4xx
        except Error as e:
            logger.error(f"Error getting recent errors: {e}")
            return False, False

    def get_all_node_errors(self):
        """Get error counts and requests for all nodes.
        
        Returns:
            dict: Dictionary mapping node_ids to (error_count, error_requests) tuples
        """
        try:
            cursor = self.connection.cursor()
            query = "SELECT node_id, error_count, error_requests FROM node_errors"
            cursor.execute(query)
            results = cursor.fetchall()
            cursor.close()
            
            return {
                row[0]: (
                    row[1],
                    json.loads(row[2]) if row[2] else []
                ) for row in results
            }
        except Error as e:
            logger.error(f"Error getting all node errors: {e}")
            raise

    def close(self):
        """Close the database connection."""
        if self.connection and self.connection.is_connected():
            self.connection.close()
            logger.info("Database connection closed")

    def store_communication(self, source_node, target_node, weight=1):
        """Store or update a communication event between nodes.
        
        Args:
            source_node (str): The source node identifier
            target_node (str): The target node identifier
            weight (int): The weight of the communication
        """
        try:
            cursor = self.connection.cursor()
            
            # First check if the communication exists
            check_query = "SELECT weight FROM node_communications WHERE source_node = %s AND target_node = %s"
            cursor.execute(check_query, (source_node, target_node))
            result = cursor.fetchone()
            
            if result:
                # Update existing communication
                update_query = """
                    UPDATE node_communications 
                    SET timestamp = CURRENT_TIMESTAMP,
                        weight = weight + %s
                    WHERE source_node = %s AND target_node = %s
                """
                cursor.execute(update_query, (weight, source_node, target_node))
                logger.debug(f"Updated existing communication: {source_node} -> {target_node} with additional weight {weight}")
            else:
                # Insert new communication
                insert_query = """
                    INSERT INTO node_communications (source_node, target_node, weight)
                    VALUES (%s, %s, %s)
                """
                cursor.execute(insert_query, (source_node, target_node, weight))
                logger.debug(f"Stored new communication: {source_node} -> {target_node} with weight {weight}")
            
            self.connection.commit()
            cursor.close()
            
        except Error as e:
            logger.error(f"Error storing communication: {e}")
            raise

    def get_recent_communications(self, hours=1):
        """Get communications that occurred in the last specified hours.
        
        Args:
            hours (int): Number of hours to look back
            
        Returns:
            list: List of tuples (source_node, target_node, weight)
        """
        try:
            cursor = self.connection.cursor()
            query = """
                SELECT source_node, target_node, SUM(weight) as total_weight
                FROM node_communications
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL %s HOUR)
                GROUP BY source_node, target_node
            """
            cursor.execute(query, (hours,))
            results = cursor.fetchall()
            cursor.close()
            
            communications = [(row[0], row[1], row[2]) for row in results]
            logger.debug(f"Retrieved {len(communications)} recent communications")
            return communications
        except Error as e:
            logger.error(f"Error getting recent communications: {e}")
            return []

    def get_edge_weight(self, source_node, target_node, hours=1):
        """Get the weight of an edge based on recent communications.
        
        Args:
            source_node (str): The source node identifier
            target_node (str): The target node identifier
            hours (int): Number of hours to look back
            
        Returns:
            int: The weight of the edge
        """
        try:
            cursor = self.connection.cursor()
            query = """
                SELECT SUM(weight) as total_weight
                FROM node_communications
                WHERE source_node = %s AND target_node = %s
                AND timestamp >= DATE_SUB(NOW(), INTERVAL %s HOUR)
            """
            cursor.execute(query, (source_node, target_node, hours))
            result = cursor.fetchone()
            cursor.close()
            
            weight = result[0] if result and result[0] else 0
            logger.debug(f"Edge weight for {source_node} -> {target_node}: {weight}")
            return weight
        except Error as e:
            logger.error(f"Error getting edge weight: {e}")
            return 0

def set_logger(log_instance):
    """Set the global logger."""
    global logger
    logger = log_instance