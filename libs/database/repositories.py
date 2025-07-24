#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Repository classes encapsulating SQL interactions.

Cette couche isole les requêtes brutes SQL afin d’alléger `DatabaseManager`
et de simplifier les tests (les repositories pourront être mockés).
"""

from __future__ import annotations

import json
import time
from typing import Any, List, Tuple, Dict

from mysql.connector import Error

from libs.common.logging_utils import get_logger

logger = get_logger(__name__)


class NodeErrorsRepository:
    """CRUD helper for table *node_errors*."""

    def __init__(self, connection):
        self._conn = connection

    # ------------------------------------------------------------
    # Write helpers
    # ------------------------------------------------------------
    def upsert_errors(
        self,
        node_id: str,
        error_count: int,
        error_requests: List[Dict[str, Any]] | None = None,
    ) -> None:
        cursor = self._conn.cursor()
        try:
            error_requests_json = json.dumps(error_requests) if error_requests else None
            query = (
                """
                INSERT INTO node_errors (node_id, error_count, error_requests)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE error_count=%s, error_requests=%s
                """
            )
            cursor.execute(
                query,
                (node_id, error_count, error_requests_json, error_count, error_requests_json),
            )
            self._conn.commit()
        except Error as exc:
            logger.error("Error in upsert_errors: %s", exc)
            raise
        finally:
            cursor.close()

    # ------------------------------------------------------------
    # Read helpers
    # ------------------------------------------------------------
    def fetch_errors(self, node_id: str) -> Tuple[int, List[Dict[str, Any]]]:
        cursor = self._conn.cursor()
        try:
            cursor.execute(
                "SELECT error_count, error_requests FROM node_errors WHERE node_id=%s", (node_id,)
            )
            row = cursor.fetchone()
            if row:
                error_requests = json.loads(row[1]) if row[1] else []
                return row[0], error_requests
            return 0, []
        finally:
            cursor.close()

    def fetch_recent_flags(self, node_id: str, hours: int = 1) -> Tuple[bool, bool]:
        """Return (has_5xx, has_4xx) within timeframe."""
        error_count, error_requests = self.fetch_errors(node_id)
        if not error_requests:
            return False, False
        cutoff = time.time() - hours * 3600
        has_5xx = any(r.get("timestamp", 0) >= cutoff and str(r.get("status", "")).startswith("5") for r in error_requests)
        has_4xx = any(r.get("timestamp", 0) >= cutoff and str(r.get("status", "")).startswith("4") for r in error_requests)
        return has_5xx, has_4xx

    def fetch_all(self) -> Dict[str, Tuple[int, List[Dict[str, Any]]]]:
        cursor = self._conn.cursor()
        try:
            cursor.execute("SELECT node_id, error_count, error_requests FROM node_errors")
            results = cursor.fetchall()
            return {
                row[0]: (row[1], json.loads(row[2]) if row[2] else []) for row in results
            }
        finally:
            cursor.close() 