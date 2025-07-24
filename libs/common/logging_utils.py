#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Common logging utilities for the Kubernetes Communications Graph project.
Provides a single helper to obtain a configured logger, avoiding the multitude
of duplicated set_logger() helpers across modules.
"""

import logging
import os
from typing import Optional

DEFAULT_LOG_FILE = os.getenv("K8S_GRAPH_LOGFILE", "graph_k8s.log")


def get_logger(name: Optional[str] = None,
               level: int = logging.INFO,
               logfile: str = DEFAULT_LOG_FILE) -> logging.Logger:
    """Return a logger configured with stream and file handlers.

    If the logger already has handlers attached, the same instance is returned
    unchanged. This avoids re-adding handlers when called multiple times.

    Args:
        name: Logger name. Defaults to root if None.
        level: Logging level.
        logfile: File to write logs to.

    Returns:
        logging.Logger: configured logger instance.
    """
    logger = logging.getLogger(name)

    root_logger = logging.getLogger()

    # Child logger: never add handlers, rely on ancestor.
    if name is not None:
        logger.setLevel(level)
        return logger

    # Root logger: configure if not already done.
    if root_logger.handlers:
        root_logger.setLevel(level)
        return root_logger

    # Configure root handlers (first invocation).
    logger.setLevel(level)

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    try:
        file_handler = logging.FileHandler(logfile, mode='w')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except (PermissionError, OSError):
        logger.warning("Unable to write log file %s – continuing with stream handler only", logfile)

    return logger 