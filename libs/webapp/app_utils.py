#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Utility functions for the Kubernetes Communications Graph Web Application
"""

import json
import threading
import logging

# Initialize logger
logger = logging.getLogger(__name__)

def convert_dict_for_json(data):
    """Convert any dictionary with non-string keys to string keys for JSON serialization"""
    if isinstance(data, dict):
        # Create a new dictionary with string keys
        new_dict = {}
        for key, value in data.items():
            # Convert key to string if it's not a basic JSON type
            if not isinstance(key, (str, int, float, bool)) or key is None:
                str_key = str(key)
            else:
                str_key = key
                
            # Recursively convert any nested dictionaries
            new_dict[str_key] = convert_dict_for_json(value)
        return new_dict
    elif isinstance(data, list):
        # Recursively convert items in lists
        return [convert_dict_for_json(item) for item in data]
    else:
        # Return other types unchanged
        return data

def set_logger(log_instance):
    """Set the logger for this module"""
    global logger
    logger = log_instance 