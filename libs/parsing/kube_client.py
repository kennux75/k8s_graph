#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lightweight wrapper around `kubectl` so that the rest of the codebase no longer
exécute directement des commandes shell dispersées.  Les méthodes proposées
couvrent les usages actuels : récupération des namespaces, comptage des pods et
récupération des informations de pods au format JSON.

Cette première version vise la parité fonctionnelle avec les appels existants
et pourra être enrichie ensuite (RBAC, retry, time-outs…).
"""

from __future__ import annotations

import json
import subprocess
from typing import List, Dict, Any, Optional

from libs.common.logging_utils import get_logger

logger = get_logger(__name__)


class KubeClient:
    """Encapsulates interaction with a single Kubernetes context/kubeconfig."""

    def __init__(self, context: Optional[str] = None, kubeconfig: Optional[str] = None):
        if not context and not kubeconfig:
            raise ValueError("Either context or kubeconfig must be provided to KubeClient")
        self.context = context
        self.kubeconfig = kubeconfig

    # ---------------------------------------------------------------------
    # Low-level helpers
    # ---------------------------------------------------------------------
    def _base_cmd(self) -> List[str]:
        cmd = ["kubectl"]
        if self.kubeconfig:
            cmd += ["--kubeconfig", self.kubeconfig]
        elif self.context:
            cmd += ["--context", self.context]
        return cmd

    def _run(self, args: List[str], capture_json: bool = False) -> Any:
        full_cmd = self._base_cmd() + args
        logger.debug("Executing kubectl command: %s", " ".join(full_cmd))
        try:
            result = subprocess.run(full_cmd, capture_output=True, text=True, check=True)
            return json.loads(result.stdout) if capture_json else result.stdout
        except subprocess.CalledProcessError as exc:
            logger.error("kubectl command failed: %s", exc)
            raise
        except json.JSONDecodeError as exc:
            logger.error("Failed to decode kubectl JSON output: %s", exc)
            raise

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_namespaces(self, excluded: Optional[List[str]] = None) -> List[str]:
        """Return namespaces minus any excluded names."""
        excluded = excluded or []
        data = self._run(["get", "namespaces", "-o", "json"], capture_json=True)
        namespaces = [ns["metadata"]["name"] for ns in data["items"]]
        return [ns for ns in namespaces if ns not in excluded]

    def count_pods(self, namespace: str) -> int:
        """Return the number of pods in *namespace*."""
        output = self._run(["get", "pods", "-n", namespace, "--no-headers"], capture_json=False)
        return len([line for line in output.strip().split("\n") if line])

    def get_pods_json(self, namespace: str) -> Dict[str, Any]:
        """Return the raw JSON structure for pods in *namespace*."""
        return self._run(["get", "pods", "-n", namespace, "-o", "json"], capture_json=True) 