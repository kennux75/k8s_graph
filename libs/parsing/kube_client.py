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
    """Encapsulates interaction with a single Kubernetes context/kubeconfig.

    To limiter les forks de process, la classe maintient un *cache* interne :
    si un client pour (context, kubeconfig) existe déjà, le même objet est
    retourné.
    """

    _instances: dict[tuple[str | None, str | None], "KubeClient"] = {}

    def __new__(cls, context: Optional[str] = None, kubeconfig: Optional[str] = None):
        key = (context, kubeconfig)
        if key in cls._instances:
            return cls._instances[key]
        instance = super().__new__(cls)
        cls._instances[key] = instance
        return instance

    def __init__(self, context: Optional[str] = None, kubeconfig: Optional[str] = None):
        # __init__ may be called multiple times due to singleton pattern;
        # ensure idempotence.
        if hasattr(self, "_initialised"):
            return
        if not context and not kubeconfig:
            raise ValueError("Either context or kubeconfig must be provided to KubeClient")
        self.context = context
        self.kubeconfig = kubeconfig
        self._initialised = True

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

    def get_logs(self, namespace: str, target: str, tail: int | None = 100, since: str | None = None) -> str:
        """Return logs from *target* (pod ou deployment/xyz) in *namespace*.

        Args:
            namespace: Namespace name.
            target: Either a pod name or "deployment/<name>".
            tail: Equivalent à --tail.
            since: Ex. "1m" pour --since.
        """
        args = ["logs", "-n", namespace, target]
        if tail is not None:
            args += ["--tail", str(tail)]
        if since is not None:
            args += ["--since", since]
        return self._run(args, capture_json=False) 