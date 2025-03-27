#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Database configuration settings
"""

# Database connection settings
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'mypass',
    'database': 'k8s_graph'
}

# Table definitions
NODE_ERRORS_TABLE = """
CREATE TABLE IF NOT EXISTS node_errors (
    node_id VARCHAR(255) PRIMARY KEY,
    error_count INT DEFAULT 0,
    error_requests TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
"""

# Error request schema
ERROR_REQUEST_SCHEMA = {
    'status': str,
    'request': str,
    'time': str,
    'error': str,
    'timestamp': float  # Unix timestamp for easier time-based queries
}

# New table definition
NODE_COMMUNICATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS node_communications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_node VARCHAR(255),
    target_node VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    weight INT DEFAULT 1,
    UNIQUE KEY unique_communication (source_node, target_node),
    INDEX idx_timestamp (timestamp)
)
"""