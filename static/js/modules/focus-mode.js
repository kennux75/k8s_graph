// K8s Communications Graph Visualizer - Focus Mode Module

import { config, network, dom } from './state.js';
import { featureFlags } from './feature-flags.js';
import { applyNodeFilters, updateNodeFilters } from './filters.js';

/**
 * Focus Mode Class
 * Provides functionality to focus on specific nodes and their connections
 */
export class FocusMode {
    constructor() {
        this.isEnabled = false;
        this.focusedNodes = new Set();      // Nodes that are focused
        this.originalFilters = new Set();   // Original node filters before focus mode
        this.focusType = 'direct';          // 'direct', 'neighbors', 'path'
        this.focusDepth = 1;               // How many levels of connections to include
        this.initialized = false;
        
        // Binding context for event handlers
        this.handleNodeClick = this.handleNodeClick.bind(this);
        this.handleNodeDoubleClick = this.handleNodeDoubleClick.bind(this);
    }

    /**
     * Initialize focus mode
     */
    initialize() {
        if (this.initialized) return;
        
        // Check if feature is enabled
        if (!featureFlags.isEnabled('focusMode')) {
            console.log('Focus mode feature is disabled');
            return;
        }

        this.setupEventListeners();
        this.initialized = true;
        console.log('Focus mode initialized');
    }

    /**
     * Setup event listeners for focus mode
     */
    setupEventListeners() {
        // Listen for feature flag changes
        featureFlags.addEventListener('featureChanged', (data) => {
            if (data.feature === 'focusMode') {
                if (!data.enabled && this.isEnabled) {
                    this.disable();
                }
            }
        });

        // Network click handlers will be attached when network is ready
        if (network.instance) {
            this.attachNetworkHandlers();
        }
    }

    /**
     * Attach network event handlers
     */
    attachNetworkHandlers() {
        if (!network.instance) return;

        // Handle node selection for focus
        network.instance.on('click', this.handleNodeClick);
        network.instance.on('doubleClick', this.handleNodeDoubleClick);
    }

    /**
     * Detach network event handlers
     */
    detachNetworkHandlers() {
        if (!network.instance) return;

        network.instance.off('click', this.handleNodeClick);
        network.instance.off('doubleClick', this.handleNodeDoubleClick);
    }

    /**
     * Enable focus mode
     * @param {Array|Set|string} nodes - Node(s) to focus on
     * @param {Object} options - Focus options
     */
    enable(nodes = [], options = {}) {
        if (!featureFlags.isEnabled('focusMode')) {
            console.warn('Focus mode feature is disabled');
            return false;
        }

        if (this.isEnabled) {
            this.disable(); // Disable current focus before enabling new one
        }

        // Parse nodes input
        if (typeof nodes === 'string') {
            this.focusedNodes = new Set([nodes]);
        } else if (Array.isArray(nodes)) {
            this.focusedNodes = new Set(nodes);
        } else if (nodes instanceof Set) {
            this.focusedNodes = new Set(nodes);
        } else {
            this.focusedNodes = new Set();
        }

        // Set options
        this.focusType = options.type || 'direct';
        this.focusDepth = options.depth || 1;

        // Save original filter state
        this.originalFilters = new Set(config.nodeFilters);

        // Enable focus mode
        this.isEnabled = true;

        // Apply focus filters
        this.applyFocusFilters();

        // Update UI
        this.updateFocusUI();

        console.log(`Focus mode enabled on ${this.focusedNodes.size} nodes with ${this.focusType} type`);
        
        // Emit event
        this.notifyFocusChange('enabled', {
            nodes: Array.from(this.focusedNodes),
            type: this.focusType,
            depth: this.focusDepth
        });

        return true;
    }

    /**
     * Disable focus mode
     */
    disable() {
        if (!this.isEnabled) return false;

        // Restore original filters
        config.nodeFilters.clear();
        this.originalFilters.forEach(nodeId => config.nodeFilters.add(nodeId));

        // Clear focus state
        this.focusedNodes.clear();
        this.isEnabled = false;

        // Apply filters to restore original view
        applyNodeFilters();

        // Update UI
        this.updateFocusUI();

        console.log('Focus mode disabled');
        
        // Emit event
        this.notifyFocusChange('disabled', {});

        return true;
    }

    /**
     * Toggle focus mode
     * @param {Array|Set|string} nodes - Node(s) to focus on (if enabling)
     * @param {Object} options - Focus options
     */
    toggle(nodes = [], options = {}) {
        if (this.isEnabled) {
            return this.disable();
        } else {
            return this.enable(nodes, options);
        }
    }

    /**
     * Add node(s) to focus
     * @param {Array|Set|string} nodes - Node(s) to add to focus
     */
    addToFocus(nodes) {
        if (!this.isEnabled) {
            return this.enable(nodes);
        }

        // Parse and add nodes
        if (typeof nodes === 'string') {
            this.focusedNodes.add(nodes);
        } else if (Array.isArray(nodes)) {
            nodes.forEach(node => this.focusedNodes.add(node));
        } else if (nodes instanceof Set) {
            nodes.forEach(node => this.focusedNodes.add(node));
        }

        // Reapply focus filters
        this.applyFocusFilters();
        this.updateFocusUI();

        console.log(`Added nodes to focus. Total focused: ${this.focusedNodes.size}`);
    }

    /**
     * Remove node(s) from focus
     * @param {Array|Set|string} nodes - Node(s) to remove from focus
     */
    removeFromFocus(nodes) {
        if (!this.isEnabled) return false;

        // Parse and remove nodes
        if (typeof nodes === 'string') {
            this.focusedNodes.delete(nodes);
        } else if (Array.isArray(nodes)) {
            nodes.forEach(node => this.focusedNodes.delete(node));
        } else if (nodes instanceof Set) {
            nodes.forEach(node => this.focusedNodes.delete(node));
        }

        // If no nodes left, disable focus mode
        if (this.focusedNodes.size === 0) {
            return this.disable();
        }

        // Reapply focus filters
        this.applyFocusFilters();
        this.updateFocusUI();

        console.log(`Removed nodes from focus. Remaining focused: ${this.focusedNodes.size}`);
        return true;
    }

    /**
     * Apply focus filters to hide non-relevant nodes
     */
    applyFocusFilters() {
        if (!this.isEnabled || this.focusedNodes.size === 0) {
            return;
        }

        // Calculate which nodes should be visible based on focus type
        const visibleNodes = this.calculateVisibleNodes();

        // Update node filters - hide all nodes not in visibleNodes
        config.nodeFilters.clear();
        
        // Add original filters back first
        this.originalFilters.forEach(nodeId => {
            if (!visibleNodes.has(nodeId)) {
                config.nodeFilters.add(nodeId);
            }
        });

        // Hide nodes that are not in the visible set
        config.allKnownNodes.forEach((nodeData, nodeId) => {
            if (!visibleNodes.has(nodeId)) {
                config.nodeFilters.add(nodeId);
            }
        });

        // Apply the filters
        applyNodeFilters();
    }

    /**
     * Calculate which nodes should be visible based on focus settings
     * @returns {Set} - Set of node IDs that should be visible
     */
    calculateVisibleNodes() {
        const visibleNodes = new Set(this.focusedNodes);

        if (this.focusType === 'direct') {
            // Only show focused nodes
            return visibleNodes;
        }

        if (this.focusType === 'neighbors') {
            // Show focused nodes and their direct neighbors
            this.focusedNodes.forEach(nodeId => {
                const neighbors = this.getNodeNeighbors(nodeId, this.focusDepth);
                neighbors.forEach(neighbor => visibleNodes.add(neighbor));
            });
        }

        if (this.focusType === 'path') {
            // Show focused nodes and paths between them
            const focusedArray = Array.from(this.focusedNodes);
            for (let i = 0; i < focusedArray.length; i++) {
                for (let j = i + 1; j < focusedArray.length; j++) {
                    const path = this.findShortestPath(focusedArray[i], focusedArray[j]);
                    path.forEach(node => visibleNodes.add(node));
                }
            }
        }

        return visibleNodes;
    }

    /**
     * Get neighbors of a node up to specified depth
     * @param {string} nodeId - Node ID
     * @param {number} depth - Maximum depth to search
     * @returns {Set} - Set of neighbor node IDs
     */
    getNodeNeighbors(nodeId, depth = 1) {
        const neighbors = new Set();
        const visited = new Set();
        const queue = [{ node: nodeId, depth: 0 }];

        while (queue.length > 0) {
            const { node, depth: currentDepth } = queue.shift();
            
            if (visited.has(node) || currentDepth > depth) continue;
            visited.add(node);

            if (currentDepth > 0) {
                neighbors.add(node);
            }

            if (currentDepth < depth) {
                // Find connected nodes from edges
                config.allKnownEdges.forEach((edgeData, edgeId) => {
                    if (typeof edgeData === 'object' && edgeData.from && edgeData.to) {
                        if (edgeData.from === node && !visited.has(edgeData.to)) {
                            queue.push({ node: edgeData.to, depth: currentDepth + 1 });
                        }
                        if (edgeData.to === node && !visited.has(edgeData.from)) {
                            queue.push({ node: edgeData.from, depth: currentDepth + 1 });
                        }
                    }
                });
            }
        }

        return neighbors;
    }

    /**
     * Find shortest path between two nodes (simplified BFS)
     * @param {string} startNode - Start node ID
     * @param {string} endNode - End node ID
     * @returns {Array} - Array of node IDs in the path
     */
    findShortestPath(startNode, endNode) {
        if (startNode === endNode) return [startNode];

        const queue = [[startNode]];
        const visited = new Set([startNode]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentNode = path[path.length - 1];

            // Find neighbors of current node
            const neighbors = this.getDirectNeighbors(currentNode);
            
            for (const neighbor of neighbors) {
                if (neighbor === endNode) {
                    return [...path, neighbor];
                }

                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }

        return [startNode, endNode]; // Fallback if no path found
    }

    /**
     * Get direct neighbors of a node
     * @param {string} nodeId - Node ID
     * @returns {Set} - Set of direct neighbor node IDs
     */
    getDirectNeighbors(nodeId) {
        const neighbors = new Set();
        
        config.allKnownEdges.forEach((edgeData) => {
            if (typeof edgeData === 'object' && edgeData.from && edgeData.to) {
                if (edgeData.from === nodeId) {
                    neighbors.add(edgeData.to);
                }
                if (edgeData.to === nodeId) {
                    neighbors.add(edgeData.from);
                }
            }
        });

        return neighbors;
    }

    /**
     * Handle node click events
     */
    handleNodeClick(event) {
        if (!featureFlags.isEnabled('focusMode')) return;
        
        const nodeId = event.nodes[0];
        if (!nodeId) return;

        // Check if Ctrl/Cmd key is pressed for multi-select focus
        if (event.event.srcEvent && (event.event.srcEvent.ctrlKey || event.event.srcEvent.metaKey)) {
            if (this.isEnabled && this.focusedNodes.has(nodeId)) {
                this.removeFromFocus(nodeId);
            } else {
                this.addToFocus(nodeId);
            }
        }
    }

    /**
     * Handle node double-click events
     */
    handleNodeDoubleClick(event) {
        if (!featureFlags.isEnabled('focusMode')) return;
        
        const nodeId = event.nodes[0];
        if (!nodeId) return;

        // Double-click to focus on node and its neighbors
        this.enable(nodeId, { type: 'neighbors', depth: 1 });
    }

    /**
     * Update focus mode UI elements
     */
    updateFocusUI() {
        // Update focus mode indicators in UI
        const focusIndicators = document.querySelectorAll('.focus-mode-indicator');
        focusIndicators.forEach(indicator => {
            indicator.classList.toggle('active', this.isEnabled);
        });

        // Update focused nodes list in UI
        const focusedNodesList = document.getElementById('focused-nodes-list');
        if (focusedNodesList) {
            if (this.isEnabled && this.focusedNodes.size > 0) {
                focusedNodesList.innerHTML = Array.from(this.focusedNodes)
                    .map(nodeId => `<span class="focused-node">${nodeId}</span>`)
                    .join('');
            } else {
                focusedNodesList.innerHTML = '<span class="no-focus">No nodes focused</span>';
            }
        }

        // Update node filters to reflect focus state
        updateNodeFilters();
    }

    /**
     * Get current focus state
     * @returns {Object} - Current focus state
     */
    getState() {
        return {
            enabled: this.isEnabled,
            focusedNodes: Array.from(this.focusedNodes),
            focusType: this.focusType,
            focusDepth: this.focusDepth,
            originalFilters: Array.from(this.originalFilters)
        };
    }

    /**
     * Set focus type
     * @param {string} type - Focus type ('direct', 'neighbors', 'path')
     */
    setFocusType(type) {
        if (['direct', 'neighbors', 'path'].includes(type)) {
            this.focusType = type;
            if (this.isEnabled) {
                this.applyFocusFilters();
                this.updateFocusUI();
            }
        }
    }

    /**
     * Set focus depth
     * @param {number} depth - Focus depth (1-5)
     */
    setFocusDepth(depth) {
        const validDepth = Math.max(1, Math.min(5, parseInt(depth)));
        this.focusDepth = validDepth;
        if (this.isEnabled && this.focusType === 'neighbors') {
            this.applyFocusFilters();
            this.updateFocusUI();
        }
    }

    /**
     * Notify listeners of focus changes
     * @private
     */
    notifyFocusChange(action, data) {
        const event = new CustomEvent('focusModeChanged', {
            detail: { action, data, state: this.getState() }
        });
        document.dispatchEvent(event);
    }
}

// Export singleton instance
export const focusMode = new FocusMode();

// Export utility functions
export const enableFocusMode = (nodes, options) => focusMode.enable(nodes, options);
export const disableFocusMode = () => focusMode.disable();
export const toggleFocusMode = (nodes, options) => focusMode.toggle(nodes, options);
export const isFocusModeEnabled = () => focusMode.isEnabled;
export const getFocusedNodes = () => Array.from(focusMode.focusedNodes); 