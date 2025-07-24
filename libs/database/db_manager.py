#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Database manager for storing node errors in MariaDB
"""

import mysql.connector
from mysql.connector import Error
import json
import time
from config.database import DB_CONFIG, NODE_ERRORS_TABLE, ERROR_REQUEST_SCHEMA, NODE_COMMUNICATIONS_TABLE
from libs.database.repositories import NodeErrorsRepository
from libs.common.logging_utils import get_logger

# Logger
logger = get_logger(__name__)

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
            # Initialize repositories
            self.node_errors_repo = NodeErrorsRepository(self.connection)
            logger.info("Database initialized successfully")
        except Error as e:
            logger.error(f"Error initializing database: {e}")
            raise

    def update_node_errors(self, node_id, error_count, error_requests=None):
        """Delegate to NodeErrorsRepository.upsert_errors."""
        # Add timestamp if missing
        if error_requests:
            for req in error_requests:
                req.setdefault("timestamp", time.time())
        self.node_errors_repo.upsert_errors(node_id, error_count, error_requests)

    def get_node_errors(self, node_id):
        return self.node_errors_repo.fetch_errors(node_id)

    def get_recent_errors(self, node_id, hours=1):
        return self.node_errors_repo.fetch_recent_flags(node_id, hours)

    def get_all_node_errors(self):
        return self.node_errors_repo.fetch_all()

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