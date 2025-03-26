// K8s Communications Graph Visualizer - Filters Module

import { config, network, dom } from './state.js';
import { initAnimationDots } from './network.js';

// Initialize the filters
export function initFilters() {
    // Initialize with empty node filters
    updateNodeFilters();
    
    console.log("Filters initialized");
}

// Update node filters UI
export function updateNodeFilters() {
    console.log("Updating node filters");
    const nodeFiltersContainer = dom.nodeFiltersDiv;
    
    if (!nodeFiltersContainer) {
        console.error("Node filters container not found");
        return;
    }
    
    // Save current filter state
    const currentFilterState = new Map();
    const existingCheckboxes = nodeFiltersContainer.querySelectorAll('.node-checkbox');
    existingCheckboxes.forEach(cb => {
        currentFilterState.set(cb.dataset.nodeId, cb.checked);
    });
    
    // Clear existing filters
    nodeFiltersContainer.innerHTML = '';
    
    if (config.allKnownNodes.size === 0) {
        nodeFiltersContainer.innerHTML = '<div class="loading">No nodes available</div>';
        return;
    }
    
    // Create a container for filters with scrolling
    const filtersContainer = document.createElement('div');
    filtersContainer.className = 'node-filters-container';
    
    // Get search term
    const searchTerm = dom.nodeSearchInput ? dom.nodeSearchInput.value.toLowerCase() : '';
    
    // Get all nodes from our master list and sort them alphabetically
    const nodeEntries = Array.from(config.allKnownNodes.entries())
        .filter(([nodeId]) => searchTerm === '' || nodeId.toLowerCase().includes(searchTerm))
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    // Add a filter for each node
    nodeEntries.forEach(([nodeId, nodeData]) => {
        const filterDiv = document.createElement('div');
        filterDiv.className = 'node-filter';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'node-checkbox';
        
        // Use existing state if available, otherwise default to visible (!nodeFilters.has)
        const isChecked = currentFilterState.has(nodeId) 
            ? currentFilterState.get(nodeId) 
            : !config.nodeFilters.has(nodeId);
        
        checkbox.checked = isChecked;
        checkbox.dataset.nodeId = nodeId;
        
        const label = document.createElement('span');
        label.className = 'node-label';
        label.textContent = nodeId;
        label.title = nodeId; // Add tooltip for long node names
        
        // Add event listener to the checkbox
        checkbox.addEventListener('change', (e) => {
            const nodeId = e.target.dataset.nodeId;
            if (e.target.checked) {
                // Show node
                config.nodeFilters.delete(nodeId);
            } else {
                // Hide node - save its position and edges first if it's in the network
                if (network.instance) {
                    // Save node position
                    const nodePosition = network.instance.getPositions([nodeId])[nodeId];
                    if (nodePosition) {
                        config.nodePositions[nodeId] = {
                            x: nodePosition.x,
                            y: nodePosition.y
                        };
                        console.log(`Saved position for node ${nodeId} before hiding:`, config.nodePositions[nodeId]);
                    }
                    
                    // Save all edges connected to this node
                    const currentEdges = network.edges.get();
                    const connectedEdges = currentEdges.filter(edge => 
                        edge.from === nodeId || edge.to === nodeId
                    );
                    
                    if (connectedEdges.length > 0) {
                        console.log(`Saving ${connectedEdges.length} edges for node ${nodeId} before hiding`);
                        
                        connectedEdges.forEach(edge => {
                            // Ensure the edge has an ID
                            if (!edge.id) {
                                edge.id = `${edge.from}-${edge.to}`;
                            }
                            
                            // Store in the global edge map
                            config.allKnownEdges.set(edge.id, { ...edge });
                            
                            // Also store by connected nodes
                            const fromNodeKey = `from:${edge.from}`;
                            const toNodeKey = `to:${edge.to}`;
                            
                            if (!config.allKnownEdges.has(fromNodeKey)) {
                                config.allKnownEdges.set(fromNodeKey, []);
                            }
                            if (!config.allKnownEdges.has(toNodeKey)) {
                                config.allKnownEdges.set(toNodeKey, []);
                            }
                            
                            // Add to the node-specific lists
                            const fromEdges = config.allKnownEdges.get(fromNodeKey);
                            const toEdges = config.allKnownEdges.get(toNodeKey);
                            
                            if (Array.isArray(fromEdges)) {
                                const edgeExists = fromEdges.some(e => e.id === edge.id);
                                if (!edgeExists) {
                                    fromEdges.push({ ...edge });
                                }
                            }
                            
                            if (Array.isArray(toEdges)) {
                                const edgeExists = toEdges.some(e => e.id === edge.id);
                                if (!edgeExists) {
                                    toEdges.push({ ...edge });
                                }
                            }
                        });
                    }
                }
                
                config.nodeFilters.add(nodeId);
            }
            
            // Apply filters
            applyNodeFilters();
        });
        
        filterDiv.appendChild(checkbox);
        filterDiv.appendChild(label);
        filtersContainer.appendChild(filterDiv);
    });
    
    nodeFiltersContainer.appendChild(filtersContainer);
}

// Apply node filters to the network
export function applyNodeFilters() {
    if (!network.instance) return;
    
    console.log("Applying node filters: Hiding", config.nodeFilters.size, "nodes");
    
    // Get all nodes currently in the data set
    const allNodesInDataset = network.nodes.get();
    const visibleNodeIds = allNodesInDataset.map(node => node.id)
        .filter(nodeId => !config.nodeFilters.has(nodeId));
    
    // Save positions of all current nodes before making changes
    if (network.instance) {
        const positions = network.instance.getPositions(visibleNodeIds);
        visibleNodeIds.forEach(nodeId => {
            if (positions[nodeId]) {
                config.nodePositions[nodeId] = {
                    x: positions[nodeId].x,
                    y: positions[nodeId].y
                };
            }
        });
    }
    
    // Get nodes that should be visible but aren't in the dataset
    const nodesToAdd = [];
    
    // Check if there are any nodes in allKnownNodes that should be visible
    // but are not in the current dataset
    for (const [nodeId, nodeData] of config.allKnownNodes.entries()) {
        if (!config.nodeFilters.has(nodeId) && !visibleNodeIds.includes(nodeId)) {
            // This node should be visible but isn't in the dataset
            console.log(`Adding previously hidden node: ${nodeId}`);
            
            // Create a copy of the node data
            const nodeToAdd = { ...nodeData };
            
            // Apply saved position if available
            if (config.nodePositions[nodeId] && config.fixedPositionsEnabled) {
                nodeToAdd.x = config.nodePositions[nodeId].x;
                nodeToAdd.y = config.nodePositions[nodeId].y;
                nodeToAdd.fixed = true;
                
                // Preserve physics settings based on edge count
                const edgeCount = config.nodeEdgeCounts[nodeId] || 0;
                if (edgeCount > 3) {
                    nodeToAdd.physics = false;
                }
                
                console.log(`Applied saved position to node ${nodeId}:`, config.nodePositions[nodeId]);
            }
            
            nodesToAdd.push(nodeToAdd);
        }
    }
    
    // Get all nodes that should be visible (existing + any to add)
    const visibleNodes = allNodesInDataset.filter(node => !config.nodeFilters.has(node.id))
        .concat(nodesToAdd);
    
    // Get all edges that should be visible
    const visibleEdges = [];
    
    // First, add all currently visible edges that connect visible nodes
    const currentEdges = network.edges.get();
    for (const edge of currentEdges) {
        if (!config.nodeFilters.has(edge.from) && !config.nodeFilters.has(edge.to)) {
            visibleEdges.push(edge);
        }
    }
    
    // Then, check for any newly visible nodes and restore their edges
    // This happens when a node is reselected and we need to restore its edges
    const newlyVisibleNodes = nodesToAdd.map(node => node.id);
    
    if (newlyVisibleNodes.length > 0) {
        console.log("Restoring edges for newly visible nodes:", newlyVisibleNodes);
        
        // For each newly visible node, find all its edges in allKnownEdges
        newlyVisibleNodes.forEach(nodeId => {
            // Check edges where this node is the source
            const fromKey = `from:${nodeId}`;
            if (config.allKnownEdges.has(fromKey)) {
                const fromEdges = config.allKnownEdges.get(fromKey);
                if (Array.isArray(fromEdges)) {
                    fromEdges.forEach(edge => {
                        // Only add the edge if both nodes are visible
                        if (!config.nodeFilters.has(edge.to)) {
                            // Check if this edge is already in visibleEdges
                            const edgeExists = visibleEdges.some(e => 
                                (e.from === edge.from && e.to === edge.to) || 
                                (e.id && e.id === edge.id)
                            );
                            
                            if (!edgeExists) {
                                console.log(`Restoring outgoing edge: ${edge.from} -> ${edge.to}`);
                                visibleEdges.push({ ...edge });
                            }
                        }
                    });
                }
            }
            
            // Check edges where this node is the target
            const toKey = `to:${nodeId}`;
            if (config.allKnownEdges.has(toKey)) {
                const toEdges = config.allKnownEdges.get(toKey);
                if (Array.isArray(toEdges)) {
                    toEdges.forEach(edge => {
                        // Only add the edge if both nodes are visible
                        if (!config.nodeFilters.has(edge.from)) {
                            // Check if this edge is already in visibleEdges
                            const edgeExists = visibleEdges.some(e => 
                                (e.from === edge.from && e.to === edge.to) || 
                                (e.id && e.id === edge.id)
                            );
                            
                            if (!edgeExists) {
                                console.log(`Restoring incoming edge: ${edge.from} -> ${edge.to}`);
                                visibleEdges.push({ ...edge });
                            }
                        }
                    });
                }
            }
        });
    }
    
    // Also check all allKnownEdges for any edges that should be visible
    // This is a fallback to ensure we don't miss any edges
    for (const [edgeId, edgeData] of config.allKnownEdges.entries()) {
        // Skip the node-specific edge lists we created
        if (edgeId.startsWith('from:') || edgeId.startsWith('to:')) {
            continue;
        }
        
        // Check if this edge connects two visible nodes
        if (edgeData.from && edgeData.to && 
            !config.nodeFilters.has(edgeData.from) && !config.nodeFilters.has(edgeData.to)) {
            
            // Check if this edge is already in visibleEdges
            const edgeExists = visibleEdges.some(e => 
                (e.from === edgeData.from && e.to === edgeData.to) || 
                (e.id && e.id === edgeData.id)
            );
            
            if (!edgeExists) {
                console.log(`Restoring edge from global list: ${edgeData.from} -> ${edgeData.to}`);
                visibleEdges.push({ ...edgeData });
            }
        }
    }
    
    // Update the datasets
    network.nodes.clear();
    network.edges.clear();
    network.nodes.add(visibleNodes);
    network.edges.add(visibleEdges);
    
    // After updating, fix all node positions to prevent movement
    if (config.fixedPositionsEnabled && network.instance) {
        const allNodeIds = network.nodes.getIds();
        const currentPositions = network.instance.getPositions(allNodeIds);
        
        allNodeIds.forEach(nodeId => {
            // Update node positions in the dataset
            network.nodes.update({
                id: nodeId,
                x: currentPositions[nodeId].x,
                y: currentPositions[nodeId].y,
                fixed: true
            });
            
            // Also update our stored positions
            config.nodePositions[nodeId] = {
                x: currentPositions[nodeId].x,
                y: currentPositions[nodeId].y
            };
        });
    }
    
    // Update the node filter checkboxes to match the current state
    const nodeCheckboxes = document.querySelectorAll('.node-checkbox');
    nodeCheckboxes.forEach(checkbox => {
        const nodeId = checkbox.dataset.nodeId;
        checkbox.checked = !config.nodeFilters.has(nodeId);
    });
    
    // If animation is enabled, reinitialize dots
    if (config.animation && config.animation.enabled) {
        initAnimationDots();
    }
}

// Filter nodes by search term
export function filterNodesBySearchTerm(searchTerm) {
    // Update the node filters UI with the search term applied
    updateNodeFilters();
}

// Highlight matching nodes
export function highlightMatchingNodes(searchTerm) {
    if (!searchTerm || !network.instance) return;
    
    const visibleNodes = network.nodes.get();
    const matchingNodes = visibleNodes.filter(node => 
        node.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    matchingNodes.forEach(node => {
        // Highlight the node
        const originalColor = node.color || '#848484'; // Default color
        node.color = '#FF0000'; // Highlight color (red)
        
        // Temporarily disable physics for this node
        const originalPhysics = node.physics;
        node.physics = false; // Disable physics temporarily
        network.nodes.update(node);

        // Reset color and physics state after 2 seconds
        setTimeout(() => {
            node.color = originalColor;
            node.physics = originalPhysics; // Restore original physics state
            network.nodes.update(node);
        }, 2000);
    });
    
    // Update status
    if (dom.statusDiv) {
        dom.statusDiv.innerHTML = `Found ${matchingNodes.length} nodes matching "${searchTerm}"`;
    }
} 