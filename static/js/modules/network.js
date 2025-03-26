// K8s Communications Graph Visualizer - Network Module

import { network, config, networkOptions, dom, physicsOptions, animation } from './state.js';
import { getEdgeColorByErrors } from './physics.js';
import { updateNodeFilters, applyNodeFilters } from './filters.js';
import { applyEdgeFilters, updatePanelContentHeights } from './ui.js';
import { animateStep, drawAnimationDots } from './animation.js';

// Initialize the vis.js network
export function initNetwork() {
    console.log("Initializing network with data:", { nodes: network.nodes, edges: network.edges });
    
    if (network.instance !== null) {
        // Clean up any existing animation
        if (animation.requestId) {
            cancelAnimationFrame(animation.requestId);
            animation.requestId = null;
        }
        
        network.instance.destroy();
    }
    
    if (!dom.networkContainer) {
        console.error("Network container element not found!");
        return;
    }
    
    try {
        // Ensure the container size is properly set
        dom.networkContainer.style.width = '100%';
        dom.networkContainer.style.height = '100%';
        
        // Update physics enabled state in options
        networkOptions.physics.enabled = config.physicsEnabled;
        
        // Create the network with the current options
        network.instance = new vis.Network(
            dom.networkContainer, 
            { nodes: network.nodes, edges: network.edges }, 
            networkOptions
        );
        
        console.log("Network initialized successfully");
        
        // Set up network event handlers
        setupNetworkEvents();
        
        // Fit the graph to the window
        fitGraphToWindow();
    } catch (error) {
        console.error("Error initializing network:", error);
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Error creating graph visualization";
        }
    }
}

// Set up network event handlers
function setupNetworkEvents() {
    // Track node movements to preserve positions during updates
    network.instance.on("dragEnd", function(params) {
        if (params.nodes && params.nodes.length > 0) {
            // Store positions of moved nodes
            params.nodes.forEach(nodeId => {
                const position = network.instance.getPositions([nodeId])[nodeId];
                config.nodePositions[nodeId] = { x: position.x, y: position.y };
                
                if (config.fixedPositionsEnabled) {
                    // Update the node in the dataset to ensure position is fixed
                    network.nodes.update({
                        id: nodeId,
                        x: position.x,
                        y: position.y,
                        fixed: true
                    });
                }
            });
            console.log("Node positions updated:", config.nodePositions);
        }
    });
    
    // Track positions after stabilization completes (for initial layout)
    network.instance.on("stabilizationIterationsDone", function() {
        // Store all node positions after initial stabilization
        const allNodeIds = network.nodes.getIds();
        const positions = network.instance.getPositions(allNodeIds);
        
        allNodeIds.forEach(nodeId => {
            config.nodePositions[nodeId] = { 
                x: positions[nodeId].x, 
                y: positions[nodeId].y 
            };
        });
        
        console.log("All node positions stored after stabilization");
    });
    
    // Stabilization progress event
    network.instance.on("stabilizationProgress", function(params) {
        const maxIterations = params.total;
        const currentIteration = params.iterations;
        const progress = Math.round((currentIteration / maxIterations) * 100);
        
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = `Stabilizing: ${progress}%`;
        }
    });
    
    // Stabilization complete event
    network.instance.on("stabilizationIterationsDone", function() {
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Graph stable";
        }
    });
    
    // Click event
    network.instance.on("click", function(params) {
        // We'll still detect clicks on nodes but won't automatically zoom
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            console.log(`Node clicked: ${nodeId}`);
            
            // Check if auto focus is enabled in configuration
            const shouldAutoFocus = config.fullConfig && 
                                   config.fullConfig.graph && 
                                   config.fullConfig.graph.focus && 
                                   config.fullConfig.graph.focus.auto_focus_on_click === true;
            
            if (shouldAutoFocus) {
                // Only auto-focus if explicitly configured to do so
                const scale = (config.fullConfig.graph.focus.scale || 1.0);
                network.instance.focus(nodeId, {
                    scale: scale,
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            } else {
                // Just select the node without changing the view
                network.instance.selectNodes([nodeId], false); // false means don't zoom to fit
            }
        }
    });
    
    // If animation was enabled, set up animation
    if (animation.enabled) {
        initAnimationDots();
        
        // Set up the animation event handler
        network.instance.off("afterDrawing");
        network.instance.on("afterDrawing", drawAnimationDots);
        
        // Start the animation loop
        if (!animation.requestId) {
            animation.requestId = requestAnimationFrame(animateStep);
        }
    }
}

// Request graph data from the server
export function requestGraphData() {
    console.log("Requesting graph data from server");
    
    if (dom.statusDiv) {
        dom.statusDiv.innerHTML = "Loading graph data...";
    }
    
    fetch('/graph_data')
        .then(response => response.json())
        .then(data => {
            console.log("Received graph data:", data);
            updateGraph(data);
            
            const now = new Date();
            if (dom.lastUpdateDiv) {
                dom.lastUpdateDiv.innerHTML = `Last update: ${now.toLocaleTimeString()}`;
            }
            
            if (dom.statusDiv) {
                dom.statusDiv.innerHTML = "Graph data loaded";
            }
            
            // Reset countdown timer
            config.countdownTimer = config.updateInterval;
        })
        .catch(error => {
            console.error("Error fetching graph data:", error);
            if (dom.statusDiv) {
                dom.statusDiv.innerHTML = "Error loading graph data";
            }
        });
}

// Update the graph with new data
export function updateGraph(data) {
    console.log("Updating graph with data:", data);
    
    if (!data || !data.nodes || !data.edges) {
        console.error("Invalid graph data received:", data);
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Invalid graph data received";
        }
        return;
    }
    
    try {
        // Increment update counter
        config.updateCounter++;
        
        // Ensure fixed positions are enabled for updates
        // This ensures positions are preserved during scheduler updates
        const wasFixedPositionsEnabled = config.fixedPositionsEnabled;
        config.fixedPositionsEnabled = true;
        
        // Get current positions of all nodes before updating
        if (network.instance) {
            const existingNodeIds = network.nodes.getIds();
            if (existingNodeIds.length > 0) {
                const positions = network.instance.getPositions(existingNodeIds);
                existingNodeIds.forEach(nodeId => {
                    config.nodePositions[nodeId] = {
                        x: positions[nodeId].x,
                        y: positions[nodeId].y
                    };
                    
                    // Also update the node in the dataset to ensure it's fixed
                    network.nodes.update({
                        id: nodeId,
                        x: positions[nodeId].x,
                        y: positions[nodeId].y,
                        fixed: true
                    });
                });
                console.log("Saved positions for", existingNodeIds.length, "nodes before update");
            }
        }
        
        // Add all incoming nodes to the master list of known nodes
        data.nodes.forEach(node => {
            config.allKnownNodes.set(node.id, { ...node });
            
            // Count edges connected to this node
            const edgeCount = data.edges.filter(edge => 
                edge.from === node.id || edge.to === node.id
            ).length;
            
            config.nodeEdgeCounts[node.id] = edgeCount;
            
            // Pre-mark nodes that are filtered out
            node.hidden = config.nodeFilterSet.has(node.id);
        });
        
        // Store all edges in our global map for future reference
        data.edges.forEach(edge => {
            // Ensure each edge has a unique ID
            if (!edge.id) {
                // Create a unique ID based on from and to nodes
                edge.id = `${edge.from}-${edge.to}`;
            }
            
            // Store the edge in our global map
            config.allKnownEdges.set(edge.id, { ...edge });
            
            // Also store edges by their connected nodes for easier lookup
            // This helps when restoring edges for reselected nodes
            const fromNodeKey = `from:${edge.from}`;
            const toNodeKey = `to:${edge.to}`;
            
            if (!config.allKnownEdges.has(fromNodeKey)) {
                config.allKnownEdges.set(fromNodeKey, []);
            }
            if (!config.allKnownEdges.has(toNodeKey)) {
                config.allKnownEdges.set(toNodeKey, []);
            }
            
            // Add this edge to the lists for both connected nodes
            const fromEdges = config.allKnownEdges.get(fromNodeKey);
            const toEdges = config.allKnownEdges.get(toNodeKey);
            
            if (Array.isArray(fromEdges)) {
                // Check if this edge is already in the list
                const edgeExists = fromEdges.some(e => e.id === edge.id);
                if (!edgeExists) {
                    fromEdges.push({ ...edge });
                }
            }
            
            if (Array.isArray(toEdges)) {
                // Check if this edge is already in the list
                const edgeExists = toEdges.some(e => e.id === edge.id);
                if (!edgeExists) {
                    toEdges.push({ ...edge });
                }
            }
            
            // Extract HTTP error counts for coloring
            let error4xx = 0;
            let error5xx = 0;
            
            if (edge.title) {
                // Parse error counts from title
                const errorMatch = edge.title.match(/4xx: (\d+), 5xx: (\d+)/);
                if (errorMatch) {
                    error4xx = parseInt(errorMatch[1]) || 0;
                    error5xx = parseInt(errorMatch[2]) || 0;
                }
            }
            
            // Set edge color based on error counts
            edge.color = getEdgeColorByErrors(error4xx, error5xx);
            
            // Apply fixed width if configured
            if (config.fullConfig && config.fullConfig.edges && config.fullConfig.edges.fixed_width) {
                // Force the width to be fixed regardless of the value
                edge.width = config.fullConfig.edges.default_width;
                
                // Either remove the value property entirely, or set all values to the same value
                // to prevent vis.js from auto-scaling based on value
                delete edge.value;  // Remove value property completely
            }
        });
        
        // Process nodes to apply physics and position settings
        data.nodes.forEach(node => {
            const edgeCount = config.nodeEdgeCounts[node.id] || 0;
            
            // Disable physics for nodes with more than 3 edges
            if (edgeCount > 3) {
                node.physics = false;
            }
            
            // Always use saved position for this node during updates
            if (config.nodePositions[node.id]) {
                node.x = config.nodePositions[node.id].x;
                node.y = config.nodePositions[node.id].y;
                node.fixed = true;
            }
            
            // Pre-mark nodes that are filtered out
            node.hidden = config.nodeFilterSet.has(node.id);
        });
        
        // Get the current state of node filters
        config.nodeFilterSet = new Set(config.nodeFilters);
        
        // Filter out edges that connect to hidden nodes
        const visibleEdges = data.edges.filter(edge => {
            return !config.nodeFilterSet.has(edge.from) && !config.nodeFilterSet.has(edge.to);
        });
        
        // Filter out hidden nodes
        const visibleNodes = data.nodes.filter(node => {
            return !config.nodeFilterSet.has(node.id);
        });
        
        // Update the datasets without reinitializing the network
        network.nodes.clear();
        network.edges.clear();
        network.nodes.add(visibleNodes);
        network.edges.add(visibleEdges);
        
        // Apply edge filters
        applyEdgeFilters();
        
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
        
        // Restore the original fixed positions setting
        config.fixedPositionsEnabled = wasFixedPositionsEnabled;
        
        // Update the fixed positions button state based on actual node states
        if (dom.toggleFixedPositionsBtn) {
            const allNodes = network.nodes.get();
            const hasFixedNodes = allNodes.some(node => node.fixed);
            if (hasFixedNodes) {
                dom.toggleFixedPositionsBtn.classList.add('active');
                config.fixedPositionsEnabled = true;
            } else {
                dom.toggleFixedPositionsBtn.classList.remove('active');
                config.fixedPositionsEnabled = false;
            }
        }
        
        // Update namespace filters if provided
        if (data.namespace_colors) {
            config.namespaceColors = data.namespace_colors;
        }
        
        // Update node filters
        updateNodeFilters();
        
        // Store filtered node IDs for future updates
        config.nodeFilters = config.nodeFilterSet;
        
        // Update panel content heights
        updatePanelContentHeights();
        
        // Reinitialize animation if enabled
        if (animation.enabled) {
            initAnimationDots();
            
            // Ensure the animation event handler is set up
            network.instance.off("afterDrawing"); // Remove any existing handlers
            network.instance.on("afterDrawing", drawAnimationDots);
            
            // Make sure the animation loop is running
            if (!animation.requestId) {
                animation.requestId = requestAnimationFrame(animateStep);
            }
        }
    } catch (error) {
        console.error("Error updating graph:", error);
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Error updating graph: " + error.message;
        }
    }
}

// Fit the network graph to the window
export function fitGraphToWindow() {
    if (!network.instance) {
        console.log("Network not available yet");
        return;
    }

    // Fit the view to show all nodes
    network.instance.fit({
        animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad'
        }
    });

    // Update fixed positions state and button
    config.fixedPositionsEnabled = true;
    if (dom.toggleFixedPositionsBtn) {
        dom.toggleFixedPositionsBtn.classList.add('active');
    }

    // Update status
    if (dom.statusDiv) {
        dom.statusDiv.innerHTML = "View reset and positions fixed";
    }
}

// Initialize animation dots for all edges in the network
export function initAnimationDots() {
    // Clear any existing animation dots
    animation.dots = [];
    
    if (!network.instance || !network.edges) return;
    
    // Get all edges
    const allEdges = network.edges.get();
    if (!allEdges || allEdges.length === 0) return;
    
    // Create animation dots for each visible edge
    allEdges.forEach(edge => {
        // Skip hidden edges
        if (edge.hidden) return;
        
        const fromNodeId = edge.from;
        const toNodeId = edge.to;
        
        // Only add animation if both nodes exist and are not hidden
        const fromNode = network.nodes.get(fromNodeId);
        const toNode = network.nodes.get(toNodeId);

        // Get positions of the nodes
        const fromNodePos = network.instance.getPositions([edge.from])[edge.from];
        const toNodePos = network.instance.getPositions([edge.to])[edge.to];

        // Calculate the Euclidean distance
        const length = Math.sqrt(
            Math.pow(toNodePos.x - fromNodePos.x, 2) +
            Math.pow(toNodePos.y - fromNodePos.y, 2)
        );
        
        if (fromNode && toNode && !fromNode.hidden && !toNode.hidden) {
            // Add multiple dots per edge with different speeds and starting positions
            let dotsPerEdge = 1;
            if (length > 600) {
                dotsPerEdge = 2;
            } else {
                dotsPerEdge = 1;
            }
            
            for (let i = 0; i < dotsPerEdge; i++) {
                // Start dots at different positions along the edge
                const startProgress = Math.random();
                
                // Vary the speed slightly for each dot, but keep it slower overall
                // Thicker/higher value edges (more traffic) get faster dots
                const baseSpeed = 0.001 + (edge.value ? Math.min(edge.value / 2000, 0.002) : 0);
                const speed = baseSpeed + (Math.random() * 0.0001);
                
                animation.dots.push({
                    edge: edge,
                    fromNodeId: fromNodeId,
                    toNodeId: toNodeId,
                    progress: startProgress,
                    speed: speed
                });
            }
        }
    });
    
    console.log(`Initialized ${animation.dots.length} animation dots for visible edges`);
} 