// K8s Communications Graph Visualizer Main JS

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const networkContainer = document.getElementById('network');
    const refreshBtn = document.getElementById('refresh-btn');
    const togglePhysicsBtn = document.getElementById('toggle-physics-btn');
    const physicsBtnText = document.getElementById('physics-btn-text');
    const stabilizeBtn = document.getElementById('stabilize-btn');
    const resetViewBtn = document.getElementById('reset-view-btn');
    const toggleFixedPositionsBtn = document.getElementById('toggle-fixed-positions-btn');
    //const toggleCumulativeDataBtn = document.getElementById('toggle-cumulative-data-btn');
    //const resetCumulativeDataBtn = document.getElementById('reset-cumulative-data-btn');
    //const testDataBtn = document.getElementById('test-data-btn');
    //const namespaceFilters = document.getElementById('namespace-filters');
    const statusDiv = document.getElementById('status');
    const lastUpdateDiv = document.getElementById('last-update');
    const updateIntervalInput = document.getElementById('update-interval');
    const setIntervalBtn = document.getElementById('set-interval-btn');
    const gravityValue = document.getElementById('gravity-value');
    const springLengthValue = document.getElementById('spring-length-value');
    const springStrengthValue = document.getElementById('spring-strength-value');
    const applyPhysicsBtn = document.getElementById('apply-physics-btn');
    const nodeSearchInput = document.getElementById('node-search');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const nodeFiltersDiv = document.getElementById('node-filters');
    const toggleAnimationBtn = document.getElementById('toggle-animation-btn');
    
    console.log("DOM content loaded");
    
    // Check if vis library is available
    if (typeof vis === 'undefined') {
        console.error("vis library not loaded!");
        statusDiv.innerHTML = "Error: Visualization library not loaded. Please refresh the page or check the console for errors.";
        return;
    } else {
        console.log("vis library loaded successfully");
    }
    
    // Globals
    let network = null;
    let nodes = new vis.DataSet();
    let edges = new vis.DataSet();
    let updateInterval = window.appConfig ? window.appConfig.updateInterval : 60;
    let updateTimer = null;
    let namespaceColors = {};
    let physicsEnabled = window.appConfig ? window.appConfig.physics.enabled : false;
    let nodeFilters = new Set(); // Set of nodes to hide
    let edgeFilters = new Set(); // For storing edge status filters
    let nodePositions = {}; // Object to store node positions
    let fixedPositionsEnabled = true; // Whether to keep positions fixed during updates
    let allKnownNodes = new Map(); // Store all nodes we've ever seen, keyed by node ID
    let allKnownEdges = new Map(); // Store all edges we've ever seen, keyed by edge ID
    let nodeEdgeCounts = {}; // Track the number of edges connected to each node
    let nodeFilterSet = new Set(); // Set of nodes to hide (derived from nodeFilters)
    
    // Cumulative data tracking
    let cumulativeNodeData = {}; // Store cumulative connection counts for nodes
    let cumulativeEdgeData = {}; // Store cumulative error counts for edges
    let updateCounter = 0; // Count the number of updates
    let cumulativeDataEnabled = true; // Whether to track cumulative data
    
    // Animation variables
    let animationEnabled = false; // Whether animation is enabled
    let animationDots = []; // Array to store animation data
    let animationRequestId = null; // Store animation frame request ID
    
    // Socket.io connection
    const socket = io();
    console.log("Socket.io initialized");
    
    // After defining the updateInterval variable
    let countdownTimer = updateInterval; // Initialize countdown timer with the update interval
    const countdownTimerDiv = document.getElementById('countdown-timer'); // Get the countdown timer element
    
    // Function to update the countdown timer
    function updateCountdown() {
        if (countdownTimer > 0) {
            countdownTimer--;
            countdownTimerDiv.innerHTML = `Next update in: ${countdownTimer} seconds`;
        } else {
            countdownTimer = updateInterval; // Reset the timer
            requestGraphData();
        }
    }
    
    // Set up the countdown timer to update every second
    setInterval(updateCountdown, 1000);
    
    // Function to request graph data from the server
    function requestGraphData() {
        console.log("Requesting graph data from server");
        statusDiv.innerHTML = "Loading graph data...";
        
        fetch('/graph_data')
            .then(response => response.json())
            .then(data => {
                console.log("Received graph data:", data);
                updateGraph(data);
                const now = new Date();
                lastUpdateDiv.innerHTML = `Last update: ${now.toLocaleTimeString()}`;
                statusDiv.innerHTML = "Graph data loaded";
            })
            .catch(error => {
                console.error("Error fetching graph data:", error);
                statusDiv.innerHTML = "Error loading graph data";
            });
    }
    
    // Function to fit the graph to the window
    function fitGraphToWindow() {
        if (network) {
            network.fit({
                animation: {
                    duration: 500,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    }
    
    // Function to set up automatic refresh of graph data
    function setupAutoRefresh() {
        // Clear any existing timer
        if (updateTimer) {
            clearInterval(updateTimer);
        }
        
        // Set up new timer for automatic updates
        updateTimer = setInterval(() => {
            console.log(`Auto-refreshing graph data (interval: ${updateInterval} seconds)`);
            requestGraphData();
            countdownTimer = updateInterval; // Reset countdown timer on data request
        }, updateInterval * 1000);
        
        console.log(`Auto-refresh set up with interval: ${updateInterval} seconds`);
    }
    
    // Fetch configuration from server or use defaults
    let config = window.appConfig || {};
    let fullConfig = null;
    
    // Physics options - initialize with values from config
    const physicsOptions = {
        enabled: config.physics ? config.physics.enabled : false,
        solver: "barnesHut",
        barnesHut: {
            gravitationalConstant: config.physics ? config.physics.gravity : -1000,
            centralGravity: config.physics ? config.physics.centralGravity : -0.3,
            springConstant: config.physics ? config.physics.springStrength : 0.01,
            springLength: config.physics ? config.physics.springLength : 150,
            damping: config.physics ? config.physics.damping : 0.05,
            avoidOverlap: config.physics ? config.physics.avoidOverlap : 1.2
        },
        stabilization: {
            enabled: true,
            iterations: 1000,
            updateInterval: 50,
            onlyDynamicEdges: false,
            fit: true
        },
        adaptiveTimestep: true,
        maxVelocity: 10,
        minVelocity: 1.0,
        timestep: 0.2
    };
    
    // Make sure the physics button text reflects the current state immediately
    if (physicsBtnText) {
        physicsBtnText.textContent = physicsEnabled ? "Disable Physics" : "Enable Physics";
    }
    
    // Load full configuration from API and update physics options
    function loadConfiguration() {
        fetch('/config')
            .then(response => response.json())
            .then(configData => {
                console.log("Loaded configuration from server:", configData);
                // Keep a reference to the full configuration
                fullConfig = configData;
                
                // Update physics options with values from config
                if (fullConfig && fullConfig.physics) {
                    const physicsConfig = fullConfig.physics;
                    
                    // Only set the initial physics enabled state if this is the first load
                    if (updateCounter === 0) {
                        physicsEnabled = physicsConfig.enabled;
                        // Update button text right away
                        updatePhysicsButtonText();
                    }
                    
                    physicsOptions.solver = physicsConfig.solver;
                    
                    if (physicsConfig.barnes_hut) {
                        physicsOptions.barnesHut.gravitationalConstant = physicsConfig.barnes_hut.gravity;
                        physicsOptions.barnesHut.centralGravity = physicsConfig.barnes_hut.central_gravity;
                        physicsOptions.barnesHut.springConstant = physicsConfig.barnes_hut.spring_strength;
                        physicsOptions.barnesHut.springLength = physicsConfig.barnes_hut.spring_length;
                        physicsOptions.barnesHut.damping = physicsConfig.barnes_hut.damping;
                        physicsOptions.barnesHut.avoidOverlap = physicsConfig.barnes_hut.avoid_overlap;
                    }
                    
                    if (physicsConfig.stabilization) {
                        physicsOptions.stabilization.enabled = physicsConfig.stabilization.enabled;
                        physicsOptions.stabilization.iterations = physicsConfig.stabilization.iterations;
                        physicsOptions.stabilization.updateInterval = physicsConfig.stabilization.update_interval;
                        physicsOptions.stabilization.onlyDynamicEdges = physicsConfig.stabilization.only_dynamic_edges;
                        physicsOptions.stabilization.fit = physicsConfig.stabilization.fit;
                    }
                    
                    physicsOptions.adaptiveTimestep = physicsConfig.adaptive_timestep;
                    physicsOptions.maxVelocity = physicsConfig.max_velocity;
                    physicsOptions.minVelocity = physicsConfig.min_velocity;
                    physicsOptions.timestep = physicsConfig.timestep;
                    
                    // Update the physics sliders with the new values
                    initPhysicsSliders();
                }
                
                // Reinitialize the network with the new configuration if it exists
                if (network) {
                    // Apply updated physics settings while preserving the enabled state
                    const updatedPhysics = {
                        ...physicsOptions,
                        enabled: physicsEnabled // Keep current enabled state
                    };
                    network.setOptions({ physics: updatedPhysics });
                }
            })
            .catch(error => {
                console.error("Error loading configuration:", error);
            });
    }
    
    // Initialize physics sliders with config values
    function initPhysicsSliders() {
        // This function can be removed entirely
    }
    
    // Visual setting options for vis.js
    const options = {
        nodes: {
            shape: 'dot',
            size: 16,
            font: {
                size: 12,
                color: '#000000'
            },
            borderWidth: 1,
            shadow: false
        },
        edges: {
            width: 1,
            color: {
                color: '#848484',
                highlight: '#1E90FF',
                hover: '#1E90FF'
            },
            smooth: false,
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 0.2
                }
            },
            font: {
                align: 'middle',
                size: 10
            },
            // Disable any automatic scaling based on value
            scaling: {
                min: 1,
                max: 1,  // Set max same as min to ensure consistent width
                label: {
                    enabled: false
                }
            }
        },
        physics: physicsOptions,
        // Control autoscaling and fit to window
        autoResize: true,
        height: '100%',
        width: '100%',
        // Disable automatic focus behavior
        interaction: {
            dragNodes: true,
            hideEdgesOnDrag: false,
            hideNodesOnDrag: false,
            navigationButtons: true,
            navigationButtonsEnabled: true,
            keyboard: {
                enabled: true,
                speed: {
                    x: 10,
                    y: 10,
                    zoom: 0.02
                },
                bindToWindow: true
            },
            selectable: true,
            selectConnectedEdges: false,
            zoomView: true, // Allow manual zooming but not auto-zoom
            multiselect: false,
            hover: true
        },
        // Disable automatic zoom on selection
        configure: {
            enabled: false
        }
    };
    
    // Update options with values from config
    function updateVisOptions() {
        if (fullConfig) {
            // Update nodes options
            if (fullConfig.nodes) {
                options.nodes.shape = fullConfig.nodes.shape;
                options.nodes.size = fullConfig.nodes.base_size;
                options.nodes.font.size = fullConfig.nodes.font_size;
                options.nodes.font.face = fullConfig.nodes.font_face;
                options.nodes.borderWidth = fullConfig.nodes.border_width;
                
                if (fullConfig.nodes.scaling) {
                    options.nodes.scaling = {
                        min: fullConfig.nodes.scaling.min,
                        max: fullConfig.nodes.scaling.max,
                        label: fullConfig.nodes.scaling.label
                    };
                }
            }
            
            // Update edges options
            if (fullConfig.edges) {
                // Set basic edge properties
                options.edges.width = fullConfig.edges.default_width;
                options.edges.smooth = fullConfig.edges.smooth;
                
                // Ensure edges don't scale based on value when fixed_width is true
                if (fullConfig.edges.fixed_width) {
                    // Explicitly disable scaling by setting min and max to the same value
                    options.edges.scaling = {
                        min: fullConfig.edges.default_width,
                        max: fullConfig.edges.default_width,
                        label: { enabled: false }
                    };
                } else {
                    // Apply scaling configuration from server
                    if (fullConfig.edges.scaling) {
                        options.edges.scaling = fullConfig.edges.scaling;
                    }
                }
                
                if (fullConfig.edges.color) {
                    options.edges.color.color = fullConfig.edges.color;
                    options.edges.color.highlight = fullConfig.edges.highlight_color;
                    options.edges.color.hover = fullConfig.edges.hover_color;
                }
                
                if (fullConfig.edges.arrows && fullConfig.edges.arrows.to_enabled !== undefined) {
                    options.edges.arrows.to.enabled = fullConfig.edges.arrows.to_enabled;
                    options.edges.arrows.to.scaleFactor = fullConfig.edges.arrows.scale_factor;
                }
                
                if (fullConfig.edges.font) {
                    options.edges.font.align = fullConfig.edges.font.align;
                    options.edges.font.size = fullConfig.edges.font.size;
                }
            }
            
            // Update graph options
            if (fullConfig.graph) {
                options.autoResize = fullConfig.graph.auto_resize;
                
                if (fullConfig.graph.interaction) {
                    options.interaction.dragNodes = fullConfig.graph.interaction.drag_nodes;
                    options.interaction.hideEdgesOnDrag = fullConfig.graph.interaction.hide_edges_on_drag;
                    options.interaction.hideNodesOnDrag = fullConfig.graph.interaction.hide_nodes_on_drag;
                    options.interaction.navigationButtons = fullConfig.graph.interaction.navigation_buttons;
                    
                    // Ensure we never automatically change the view when selecting nodes
                    options.interaction.selectable = true;
                    options.interaction.selectConnectedEdges = false; // Don't auto-select edges
                    options.interaction.zoomView = true; // Allow manual zooming
                    
                    // These can be configured from server
                    options.interaction.multiselect = fullConfig.graph.interaction.multi_select;
                    
                    if (fullConfig.graph.interaction.keyboard_enabled !== undefined) {
                        options.interaction.keyboard.enabled = fullConfig.graph.interaction.keyboard_enabled;
                        
                        if (fullConfig.graph.interaction.keyboard_speed) {
                            options.interaction.keyboard.speed.x = fullConfig.graph.interaction.keyboard_speed.x;
                            options.interaction.keyboard.speed.y = fullConfig.graph.interaction.keyboard_speed.y;
                            options.interaction.keyboard.speed.zoom = fullConfig.graph.interaction.keyboard_speed.zoom;
                        }
                    }
                }
            }
            
            // Update physics options (already done in loadConfiguration)
            
            // If the network exists, update its options
            if (network) {
                // Create a clean copy of options without any potential circular references
                const cleanOptions = JSON.parse(JSON.stringify(options));
                console.log("Updating network options:", cleanOptions);
                network.setOptions(cleanOptions);
            }
        }
    }
    
    // Initialize vis.js Network
    function initNetwork() {
        console.log("Initializing network with data:", { nodes, edges });
        
        if (network !== null) {
            // Clean up any existing animation
            if (animationRequestId) {
                cancelAnimationFrame(animationRequestId);
                animationRequestId = null;
            }
            
            network.destroy();
        }
        
        if (!networkContainer) {
            console.error("Network container element not found!");
            return;
        }
        
        try {
            // Ensure the container size is properly set
            networkContainer.style.width = '100%';
            networkContainer.style.height = '100%';
            
            // Create the network with options that prevent auto-zooming
            network = new vis.Network(networkContainer, { nodes, edges }, options);
            console.log("Network initialized successfully");
            
            // Add event listener for beforeDrawing to ensure nodes don't move unexpectedly
            network.on("beforeDrawing", function(ctx) {
                // This is where we would put any canvas drawings that need to happen before the network is drawn
            });
            
            // Disable automatic focusing when nodes are selected
            network.on("selectNode", function(params) {
                // Prevent automatic zooming/focusing
                // We just want selection without changing the view
                console.log("Node selected:", params.nodes);
            });
            
            // Track node movements to preserve positions during updates
            network.on("dragEnd", function(params) {
                if (params.nodes && params.nodes.length > 0) {
                    // Store positions of moved nodes
                    params.nodes.forEach(nodeId => {
                        const position = network.getPositions([nodeId])[nodeId];
                        nodePositions[nodeId] = { x: position.x, y: position.y };
                        
                        if (fixedPositionsEnabled) {
                            // Update the node in the dataset to ensure position is fixed
                            nodes.update({
                                id: nodeId,
                                x: position.x,
                                y: position.y,
                                fixed: true
                            });
                        }
                    });
                    console.log("Node positions updated:", nodePositions);
                }
            });
            
            // Track positions after stabilization completes (for initial layout)
            network.on("stabilizationIterationsDone", function() {
                // Store all node positions after initial stabilization
                const allNodeIds = nodes.getIds();
                const positions = network.getPositions(allNodeIds);
                
                allNodeIds.forEach(nodeId => {
                    nodePositions[nodeId] = { 
                        x: positions[nodeId].x, 
                        y: positions[nodeId].y 
                    };
                });
                
                console.log("All node positions stored after stabilization");
            });
            
            // If animation was enabled, reinitialize it
            if (animationEnabled) {
                initAnimationDots();
                
                // Ensure the animation event handler is set up
                network.off("afterDrawing"); // Remove any existing handlers
                network.on("afterDrawing", drawAnimationDots);
                
                // Make sure the animation loop is running
                if (!animationRequestId) {
                    animationRequestId = requestAnimationFrame(animateStep);
                }
            }
            
            // Set the initial view to fit all nodes with improved animation
            fitGraphToWindow();
            
            // Network events
            network.on("stabilizationProgress", function(params) {
                const maxIterations = params.total;
                const currentIteration = params.iterations;
                const progress = Math.round((currentIteration / maxIterations) * 100);
                statusDiv.innerHTML = `Stabilizing: ${progress}%`;
            });
            
            network.on("stabilizationIterationsDone", function() {
                statusDiv.innerHTML = "Graph stable";
                
                // Don't automatically disable physics anymore
                // Just update the button text to reflect current state
                updatePhysicsButtonText();
            });
            
            network.on("click", function(params) {
                // We'll still detect clicks on nodes but won't automatically zoom
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    console.log(`Node clicked: ${nodeId}`);
                    
                    // Check if auto focus is enabled in configuration
                    const shouldAutoFocus = fullConfig && 
                                           fullConfig.graph && 
                                           fullConfig.graph.focus && 
                                           fullConfig.graph.focus.auto_focus_on_click === true;
                    
                    if (shouldAutoFocus) {
                        // Only auto-focus if explicitly configured to do so
                        const scale = (fullConfig.graph.focus.scale || 1.0);
                        network.focus(nodeId, {
                            scale: scale,
                            animation: {
                                duration: 500,
                                easingFunction: 'easeInOutQuad'
                            }
                        });
                    } else {
                        // Just select the node without changing the view
                        network.selectNodes([nodeId], false); // false means don't zoom to fit
                    }
                }
            });
        } catch (error) {
            console.error("Error initializing network:", error);
            statusDiv.innerHTML = "Error creating graph visualization";
        }
    }
    
    // Update the graph with new data
    function updateGraph(data) {
        console.log("Updating graph with data:", data);
        
        if (!data || !data.nodes || !data.edges) {
            console.error("Invalid graph data received:", data);
            statusDiv.innerHTML = "Invalid graph data received";
            return;
        }
        
        try {
            // Increment update counter
            updateCounter++;
            
            // Ensure fixed positions are enabled for updates
            // This ensures positions are preserved during scheduler updates
            const wasFixedPositionsEnabled = fixedPositionsEnabled;
            fixedPositionsEnabled = true;
            
            // Get current positions of all nodes before updating
            if (network) {
                const existingNodeIds = nodes.getIds();
                if (existingNodeIds.length > 0) {
                    const positions = network.getPositions(existingNodeIds);
                    existingNodeIds.forEach(nodeId => {
                        nodePositions[nodeId] = {
                            x: positions[nodeId].x,
                            y: positions[nodeId].y
                        };
                        
                        // Also update the node in the dataset to ensure it's fixed
                        nodes.update({
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
                allKnownNodes.set(node.id, { ...node });
                
                // Count edges connected to this node
                const edgeCount = data.edges.filter(edge => 
                    edge.from === node.id || edge.to === node.id
                ).length;
                
                nodeEdgeCounts[node.id] = edgeCount;
                
                // Pre-mark nodes that are filtered out
                node.hidden = nodeFilterSet.has(node.id);
            });
            
            // Store all edges in our global map for future reference
            data.edges.forEach(edge => {
                allKnownEdges.set(edge.id, { ...edge });
            });
            
            // Get the current state of namespace filters
            const namespaceFilterState = {};
            const nsCheckboxes = document.querySelectorAll('.namespace-checkbox');
            nsCheckboxes.forEach(cb => {
                namespaceFilterState[cb.dataset.namespace] = cb.checked;
            });
            
            // Process nodes and edges, keeping track of which ones should be filtered
            nodeFilterSet = new Set(nodeFilters);
            
            // Pre-process nodes to mark those that should be hidden based on namespace filters
            data.nodes.forEach(node => {
                // Extract namespace from node id (format is usually 'namespace/podname')
                const nodeParts = node.id.split('/');
                const nodeNamespace = nodeParts.length > 1 ? nodeParts[0] : node.id;
                
                // Check if this namespace is filtered out
                if (namespaceFilterState[nodeNamespace] === false) {
                    nodeFilterSet.add(node.id);
                }
            });

            // Keep track of existing node IDs 
            const existingNodeIds = nodes.getIds();
            const newNodeIds = data.nodes.map(node => node.id);
            
            // Process nodes to disable physics for nodes with more than 3 edges
            nodeEdgeCounts = {}; // Reset the counts for this update
            
            // Count edges per node
            data.edges.forEach(edge => {
                nodeEdgeCounts[edge.from] = (nodeEdgeCounts[edge.from] || 0) + 1;
                nodeEdgeCounts[edge.to] = (nodeEdgeCounts[edge.to] || 0) + 1;
                
                // Accumulate edge data (connection counts, errors)
                const edgeId = `${edge.from}-${edge.to}`;
                
                // Only accumulate data if tracking is enabled
                if (cumulativeDataEnabled) {
                    // Initialize if not exist
                    if (!cumulativeEdgeData[edgeId]) {
                        cumulativeEdgeData[edgeId] = {
                            connectionCount: 0,
                            errorCounts: {
                                total: 0,
                                '2xx': 0,
                                '3xx': 0,
                                '4xx': 0,
                                '5xx': 0
                            },
                            updates: 0,
                            // Store 5xx example entries across updates
                            five_xx_examples: ""
                        };
                    }
                    
                    // Update cumulative data for this edge
                    cumulativeEdgeData[edgeId].connectionCount += edge.value || 0;
                    cumulativeEdgeData[edgeId].updates++;
                    
                    // Extract HTTP error counts from title if available
                    if (edge.title) {
                        // Parse the title to extract error counts
                        const errorMatch = edge.title.match(/4xx: (\d+), 5xx: (\d+), 3xx: (\d+), 2xx: (\d+)/);
                        if (errorMatch) {
                            cumulativeEdgeData[edgeId].errorCounts['4xx'] += parseInt(errorMatch[1]) || 0;
                            cumulativeEdgeData[edgeId].errorCounts['5xx'] += parseInt(errorMatch[2]) || 0;
                            cumulativeEdgeData[edgeId].errorCounts['3xx'] += parseInt(errorMatch[3]) || 0;
                            cumulativeEdgeData[edgeId].errorCounts['2xx'] += parseInt(errorMatch[4]) || 0;
                            cumulativeEdgeData[edgeId].errorCounts.total += (
                                parseInt(errorMatch[1]) + 
                                parseInt(errorMatch[2]) + 
                                parseInt(errorMatch[3]) + 
                                parseInt(errorMatch[4])
                            ) || 0;
                        }
                        
                        // Preserve 5xx examples if they exist in this update
                        if (edge.title.includes("5xx Error Examples:") && 
                            parseInt(errorMatch ? errorMatch[2] : 0) > 0) {
                            
                            const parts = edge.title.split("5xx Error Examples:");
                            if (parts.length > 1) {
                                const examples = parts[1].split("\n\n--- CUMULATIVE DATA")[0];
                                // Store the 5xx examples for this edge
                                cumulativeEdgeData[edgeId].five_xx_examples = "5xx Error Examples:" + examples;
                            }
                        }
                    }
                    
                    // Update the edge title to include cumulative data
                    const edgeCumulativeData = cumulativeEdgeData[edgeId];
                    let originalTitle = edge.title || '';
                    
                    // Add cumulative data to the tooltip using tooltip manager
                    if (originalTitle && edgeCumulativeData.updates > 1) {
                        updateEdgeTooltip(edge, edgeCumulativeData);
                    }
                }
                
                // Extract HTTP error counts for coloring
                let error4xx = 0;
                let error5xx = 0;
                
                // Use cumulative data for coloring if available and enabled
                if (cumulativeDataEnabled && cumulativeEdgeData[edgeId] && cumulativeEdgeData[edgeId].errorCounts) {
                    // Use the cumulative error counts
                    error4xx = cumulativeEdgeData[edgeId].errorCounts['4xx'] || 0;
                    error5xx = cumulativeEdgeData[edgeId].errorCounts['5xx'] || 0;
                } else if (edge.title) {
                    // Fallback to current data if cumulative data not available
                    const currentErrorMatch = edge.title.split('\n\n')[0].match(/4xx: (\d+), 5xx: (\d+)/);
                    if (currentErrorMatch) {
                        error4xx = parseInt(currentErrorMatch[1]) || 0;
                        error5xx = parseInt(currentErrorMatch[2]) || 0;
                    }
                }
                
                // Set edge color based on error counts
                edge.color = getEdgeColorByErrors(error4xx, error5xx);
                
                // Apply fixed width if configured
                if (fullConfig && fullConfig.edges && fullConfig.edges.fixed_width) {
                    // Force the width to be fixed regardless of the value
                    edge.width = fullConfig.edges.default_width;
                    
                    // Either remove the value property entirely, or set all values to the same value
                    // to prevent vis.js from auto-scaling based on value
                    delete edge.value;  // Remove value property completely
                    
                    // Force scaling to be disabled for this edge
                    edge.scaling = {
                        min: fullConfig.edges.default_width,
                        max: fullConfig.edges.default_width,
                        label: { enabled: false }
                    };
                }
            });
            
            // Accumulate node data
            data.nodes.forEach(node => {
                const nodeId = node.id;
                const connectionsCount = nodeEdgeCounts[nodeId] || 0;
                
                // Only accumulate data if tracking is enabled
                if (cumulativeDataEnabled) {
                    // Initialize if not exists
                    if (!cumulativeNodeData[nodeId]) {
                        cumulativeNodeData[nodeId] = {
                            connectionsCount: 0,
                            updates: 0
                        };
                    }
                    
                    // Update cumulative data
                    cumulativeNodeData[nodeId].connectionsCount += connectionsCount;
                    cumulativeNodeData[nodeId].updates++;
                    
                    // Extract HTTP error/status counts from title if available
                    if (node.title) {
                        const lines = node.title.split('\n');
                        const httpCountsLine = lines.find(line => line.includes('HTTP Status Counts'));
                        
                        if (httpCountsLine) {
                            // Initialize HTTP counts if not exists
                            if (!cumulativeNodeData[nodeId].httpCounts) {
                                cumulativeNodeData[nodeId].httpCounts = {
                                    total: 0,
                                    '2xx': 0,
                                    '3xx': 0,
                                    '4xx': 0,
                                    '5xx': 0
                                };
                            }
                            
                            // Extract counts
                            const countsMatch = node.title.match(/2xx: (\d+), 3xx: (\d+), 4xx: (\d+), 5xx: (\d+)/);
                            if (countsMatch) {
                                cumulativeNodeData[nodeId].httpCounts['2xx'] += parseInt(countsMatch[1]) || 0;
                                cumulativeNodeData[nodeId].httpCounts['3xx'] += parseInt(countsMatch[2]) || 0;
                                cumulativeNodeData[nodeId].httpCounts['4xx'] += parseInt(countsMatch[3]) || 0;
                                cumulativeNodeData[nodeId].httpCounts['5xx'] += parseInt(countsMatch[4]) || 0;
                                cumulativeNodeData[nodeId].httpCounts.total += (
                                    parseInt(countsMatch[1]) + 
                                    parseInt(countsMatch[2]) + 
                                    parseInt(countsMatch[3]) + 
                                    parseInt(countsMatch[4])
                                ) || 0;
                            }
                        }
                    }
                    
                    // Update the node title to include cumulative data
                    const nodeCumulativeData = cumulativeNodeData[nodeId];
                    let originalTitle = node.title || '';
                    
                    if (originalTitle && nodeCumulativeData.updates > 1) {
                        if (!originalTitle.includes("CUMULATIVE DATA")) {
                            let cumulativeInfo = `\n\n--- CUMULATIVE DATA (${nodeCumulativeData.updates} updates) ---` +
                                `\nTotal Connections: ${nodeCumulativeData.connectionsCount}`;
                            
                            if (nodeCumulativeData.httpCounts) {
                                cumulativeInfo += `\nTotal HTTP Requests: ${nodeCumulativeData.httpCounts.total}` +
                                    `\n2xx: ${nodeCumulativeData.httpCounts['2xx']}, ` +
                                    `3xx: ${nodeCumulativeData.httpCounts['3xx']}, ` +
                                    `4xx: ${nodeCumulativeData.httpCounts['4xx']}, ` +
                                    `5xx: ${nodeCumulativeData.httpCounts['5xx']}`;
                            }
                            
                            node.title = originalTitle + cumulativeInfo;
                        }
                    }
                }
                
                // Check if we need fixed width for edges
                if (fullConfig && fullConfig.edges && fullConfig.edges.fixed_width) {
                    // Apply the same width to all edges
                    const fixedWidth = fullConfig.edges.default_width;
                    data.edges.forEach(edge => {
                        // Force the width to be fixed regardless of the value
                        edge.width = fixedWidth;
                        
                        // Either remove the value property entirely, or set all values to the same value
                        // to prevent vis.js from auto-scaling based on value
                        delete edge.value;  // Remove value property completely
                        
                        // Force scaling to be disabled for this edge
                        edge.scaling = {
                            min: fixedWidth,
                            max: fixedWidth,
                            label: { enabled: false }
                        };
                    });
                }
            
                // Apply physics settings and preserve positions for nodes
                const edgeCount = nodeEdgeCounts[node.id] || 0;
                
                // Disable physics for nodes with more than 3 edges
                if (edgeCount > 3) {
                    node.physics = false;
                }
                
                // Always use saved position for this node during updates
                if (nodePositions[node.id]) {
                    node.x = nodePositions[node.id].x;
                    node.y = nodePositions[node.id].y;
                    node.fixed = true;
                }
                
                // Pre-mark nodes that are filtered out
                node.hidden = nodeFilterSet.has(node.id);
            });
            
            // Filter out edges that connect to hidden nodes
            const visibleEdges = data.edges.filter(edge => {
                return !nodeFilterSet.has(edge.from) && !nodeFilterSet.has(edge.to);
            });
            
            // Filter out hidden nodes
            const visibleNodes = data.nodes.filter(node => {
                return !nodeFilterSet.has(node.id);
            });
            
            // Update the datasets without reinitializing the network
            nodes.clear();
            edges.clear();
            nodes.add(visibleNodes);
            edges.add(visibleEdges);
            
            // Apply edge filters
            applyEdgeFilters();
            
            // Update the network with the new data without redrawing
            if (network) {
                network.setData({ nodes, edges });
                
                // Only preserve the current physics state
                network.setOptions({ 
                    physics: { 
                        enabled: physicsEnabled,
                        barnesHut: physicsOptions.barnesHut
                    }
                });
                
                // After updating, fix all node positions to prevent movement
                if (fixedPositionsEnabled) {
                    const allNodeIds = nodes.getIds();
                    const currentPositions = network.getPositions(allNodeIds);
                    
                    allNodeIds.forEach(nodeId => {
                        // Update node positions in the dataset
                        nodes.update({
                            id: nodeId,
                            x: currentPositions[nodeId].x,
                            y: currentPositions[nodeId].y,
                            fixed: true
                        });
                        
                        // Also update our stored positions
                        nodePositions[nodeId] = {
                            x: currentPositions[nodeId].x,
                            y: currentPositions[nodeId].y
                        };
                    });
                }
            } else {
                // Initialize network if it doesn't exist
                initNetwork();
            }
            
            // Restore the original fixed positions setting
            fixedPositionsEnabled = wasFixedPositionsEnabled;
            
            // Update last update time
            const now = new Date();
            lastUpdateDiv.innerHTML = `Last update: ${now.toLocaleTimeString()}`;
            
            // Update namespace filters
            if (data.namespace_colors) {
                updateNamespaceFilters(data.namespace_colors);
            } else {
                console.warn("No namespace colors in data");
            }
            
            // Update node filters (but don't reapply them, as we've already filtered the data)
            updateNodeFilters();
            
            // Store filtered node IDs for future updates
            nodeFilters = nodeFilterSet;
            
            // Update status
            statusDiv.innerHTML = `Graph updated successfully (update #${updateCounter})`;
            
            // Update panel content heights
            updatePanelContentHeights();
            
            // Reinitialize animation if enabled
            if (animationEnabled) {
                initAnimationDots();
                
                // Ensure the animation event handler is set up
                network.off("afterDrawing"); // Remove any existing handlers
                network.on("afterDrawing", drawAnimationDots);
                
                // Make sure the animation loop is running
                if (!animationRequestId) {
                    animationRequestId = requestAnimationFrame(animateStep);
                }
            }
            
            // We no longer need the setTimeout approach since filtering is done before display
        } catch (error) {
            console.error("Error updating graph:", error);
            statusDiv.innerHTML = "Error updating graph: " + error.message;
        }
    }
    
    // Update namespace filters based on namespace colors
    function updateNamespaceFilters(namespaceColors) {
        // This function can be removed entirely
    }
    
    // Filter nodes by namespace
    function filterNodesByNamespace(namespace, show) {
        // This function can be removed entirely
    }
    
    // Apply node filters to the graph
    function applyNodeFilters() {
        if (!network) return;
        
        console.log("Applying node filters: Hiding", nodeFilters.size, "nodes");
        
        // Get all nodes currently in the data set
        const allNodesInDataset = nodes.get();
        const visibleNodeIds = allNodesInDataset.map(node => node.id)
            .filter(nodeId => !nodeFilters.has(nodeId));
        
        // Get nodes that should be visible but aren't in the dataset
        const nodesToAdd = [];
        
        // Check if there are any nodes in allKnownNodes that should be visible
        // but are not in the current dataset
        for (const [nodeId, nodeData] of allKnownNodes.entries()) {
            if (!nodeFilters.has(nodeId) && !visibleNodeIds.includes(nodeId)) {
                // This node should be visible but isn't in the dataset
                console.log(`Adding previously hidden node: ${nodeId}`);
                nodesToAdd.push(nodeData);
            }
        }
        
        // Get all nodes that should be visible (existing + any to add)
        const visibleNodes = allNodesInDataset.filter(node => !nodeFilters.has(node.id))
            .concat(nodesToAdd);
        
        // Get all edges
        const allEdges = edges.get();
        const visibleEdges = allEdges.filter(edge => 
            !nodeFilters.has(edge.from) && !nodeFilters.has(edge.to)
        );
        
        // Update the datasets
        nodes.clear();
        edges.clear();
        nodes.add(visibleNodes);
        edges.add(visibleEdges);
        
        // Update the network
        network.setData({ nodes, edges });
        
        // Update the node filter checkboxes to match the current state
        const nodeCheckboxes = document.querySelectorAll('.node-checkbox');
        nodeCheckboxes.forEach(checkbox => {
            const nodeId = checkbox.dataset.nodeId;
            checkbox.checked = !nodeFilters.has(nodeId);
        });
    }
    
    // Update node filters list in UI
    function updateNodeFilters() {
        console.log("Updating node filters");
        const nodeFiltersContainer = document.getElementById('node-filters');
        
        // Save current filter state
        const currentFilterState = new Map();
        const existingCheckboxes = nodeFiltersContainer.querySelectorAll('.node-checkbox');
        existingCheckboxes.forEach(cb => {
            currentFilterState.set(cb.dataset.nodeId, cb.checked);
        });
        
        // Clear existing filters
        nodeFiltersContainer.innerHTML = '';
        
        if (allKnownNodes.size === 0) {
            nodeFiltersContainer.innerHTML = '<div class="loading">No nodes available</div>';
            return;
        }
        
        // Create a container for filters with scrolling
        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'node-filters-container';
        
        // Get search term
        const searchTerm = nodeSearchInput ? nodeSearchInput.value.toLowerCase() : '';
        
        // Get all nodes from our master list and sort them alphabetically
        const nodeEntries = Array.from(allKnownNodes.entries())
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
                : !nodeFilters.has(nodeId);
            
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
                    nodeFilters.delete(nodeId);
                } else {
                    // Hide node
                    nodeFilters.add(nodeId);
                }
                
                // Apply filters
                applyNodeFilters();
            });
            
            filterDiv.appendChild(checkbox);
            filterDiv.appendChild(label);
            filtersContainer.appendChild(filterDiv);
        });
        
        nodeFiltersContainer.appendChild(filtersContainer);
        
        // Update max-height for parent panel-content if in an expanded section
        const panelContent = nodeFiltersContainer.closest('.panel-content');
        if (panelContent && !panelContent.closest('.panel-section').classList.contains('collapsed')) {
            panelContent.style.maxHeight = panelContent.scrollHeight + 'px';
        }
    }
    
    // Function to highlight all nodes matching the search term
    function highlightMatchingNodes(searchTerm) {
        const visibleNodes = nodes.get();
        const matchingNodes = visibleNodes.filter(node => node.id.toLowerCase().includes(searchTerm.toLowerCase()));

        matchingNodes.forEach(node => {
            // Highlight the node
            const originalColor = node.color || '#848484'; // Default color
            node.color = '#FF0000'; // Highlight color (red)
            
            // Temporarily disable physics for this node
            const originalPhysics = node.physics;
            node.physics = false; // Disable physics temporarily
            nodes.update(node);

            // Reset color and physics state after 1 second
            setTimeout(() => {
                node.color = originalColor;
                node.physics = originalPhysics; // Restore original physics state
                nodes.update(node);
            }, 2000);
        });
    }

    // Event listener for the search button
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const searchTerm = nodeSearchInput.value;
            highlightMatchingNodes(searchTerm);
        });
    }
    
    // Event handlers
    refreshBtn.addEventListener('click', () => {
        statusDiv.innerHTML = "Requesting update...";
        socket.emit('request_update');
    });
    
    togglePhysicsBtn.addEventListener('click', () => {
        togglePhysics();
    });
    
    stabilizeBtn.addEventListener('click', () => {
        statusDiv.innerHTML = "Stabilizing...";
        network.stabilize(1000);
        
        // Store node positions after stabilization
        network.once("stabilizationIterationsDone", function() {
            const allNodeIds = nodes.getIds();
            const positions = network.getPositions(allNodeIds);
            
            allNodeIds.forEach(nodeId => {
                nodePositions[nodeId] = { 
                    x: positions[nodeId].x, 
                    y: positions[nodeId].y 
                };
                
                // If fixed positions are enabled, update nodes to be fixed
                if (fixedPositionsEnabled) {
                    nodes.update({
                        id: nodeId,
                        x: positions[nodeId].x,
                        y: positions[nodeId].y,
                        fixed: true
                    });
                }
            });
            
            statusDiv.innerHTML = "Stabilization complete. Node positions updated.";
        });
    });
    
    resetViewBtn.addEventListener('click', () => {
        network.fit({
            animation: {
                duration: 500,
                easingFunction: 'easeInOutQuad'
            }
        });
    });
    
    setIntervalBtn.addEventListener('click', () => {
        const interval = parseInt(updateIntervalInput.value, 10);
        if (interval < 5) {
            statusDiv.innerHTML = "Interval must be at least 5 seconds";
            return;
        }
        
        // Send the update to the server
        fetch('/update_interval', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ interval })
        }).then(response => response.json())
          .then(data => {
              statusDiv.innerHTML = data.message;
          })
          .catch(error => {
              statusDiv.innerHTML = "Error updating interval";
              console.error('Error:', error);
          });
    });
    
    applyPhysicsBtn.addEventListener('click', () => {
        if (network) {
            // Update physics settings
            // First update our global physics options
            physicsOptions.barnesHut.gravitationalConstant = parseInt(gravityValue.value);
            physicsOptions.barnesHut.springLength = parseInt(springLengthValue.value);
            physicsOptions.barnesHut.springConstant = parseFloat(springStrengthValue.value);
            
            // Then apply to network, but don't change the enabled state
            network.setOptions({
                physics: {
                    barnesHut: {
                        gravitationalConstant: physicsOptions.barnesHut.gravitationalConstant,
                        springLength: physicsOptions.barnesHut.springLength,
                        springConstant: physicsOptions.barnesHut.springConstant
                    }
                }
            });
            
            statusDiv.innerHTML = "Physics settings applied.";
        }
    });
    
    // Toggle fixed positions button
    toggleFixedPositionsBtn.addEventListener('click', () => {
        fixedPositionsEnabled = !fixedPositionsEnabled;
        
        if (network) {
            const nodeIds = nodes.getIds();
            
            if (fixedPositionsEnabled) {
                // Fix nodes at their current positions
                const positions = network.getPositions(nodeIds);
                
                // Update all nodes to fixed positions
                nodeIds.forEach(nodeId => {
                    // Store positions for all nodes to use during updates
                    nodePositions[nodeId] = { 
                        x: positions[nodeId].x, 
                        y: positions[nodeId].y 
                    };
                    
                    // Update the node in the dataset
                    nodes.update({
                        id: nodeId,
                        x: positions[nodeId].x,
                        y: positions[nodeId].y,
                        fixed: true
                    });
                });
                
                statusDiv.innerHTML = "Node positions fixed. Nodes will not move during updates.";
                toggleFixedPositionsBtn.classList.add('active');
            } else {
                // Unfix all nodes to allow movement
                nodeIds.forEach(nodeId => {
                    nodes.update({
                        id: nodeId,
                        fixed: false
                    });
                });
                
                statusDiv.innerHTML = "Positions are now dynamic. Nodes may move during updates.";
                toggleFixedPositionsBtn.classList.remove('active');
            }
        }
    });
    
    // Socket events
    socket.on('connect', () => {
        console.log("Socket connected");
        statusDiv.innerHTML = "Connected to server";
    });
    
    socket.on('disconnect', () => {
        console.log("Socket disconnected");
        statusDiv.innerHTML = "Disconnected from server";
    });
    
    socket.on('graph_update', (data) => {
        console.log("Received graph update via socket:", data);
        updateGraph(data);
    });
    
    // Main initialization function
    function init() {
        console.log("Initializing application");
        
        // Create data objects if they don't exist yet
        if (!nodes) {
            nodes = new vis.DataSet();
        }
        if (!edges) {
            edges = new vis.DataSet();
        }
        
        // Set initial state for toggle buttons and physics text
        if (fixedPositionsEnabled) {
            toggleFixedPositionsBtn.classList.add('active');
        } else {
            toggleFixedPositionsBtn.classList.remove('active');
        }
        
        // Initialize collapsible sections
        initCollapsibleSections();
        
        // Initialize edge filters
        initEdgeFilters();
        
        // Set up search functionality for node filters
        if (nodeSearchInput) {
            nodeSearchInput.addEventListener('input', (e) => {
                updateNodeFilters();
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (nodeSearchInput) {
                    nodeSearchInput.value = '';
                    filterNodesBySearchTerm('');
                }
            });
        }
        
        // Update physics button text
        updatePhysicsButtonText();
        
        // Load configuration from server
        loadConfiguration();
        
        // Initialize physics sliders with default values
        initPhysicsSliders();
        
        // Initialize network
        initNetwork();
        
        // Setup event listeners
        setupEventListeners();
        
        // Request initial data
        requestGraphData();
        
        // Setup automatic refresh
        setupAutoRefresh();
        
        // Update visual options with configuration values once loaded
        setTimeout(() => {
            updateVisOptions();
        }, 500); // Give a short delay to ensure configuration is loaded
        
        console.log("Application initialized");
    }
    
    // Set up event listeners for UI elements
    function setupEventListeners() {
        // Socket events
        socket.on('graph_update', updateGraph);
        
        // Window resize handler
        window.addEventListener('resize', () => {
            // Update panel content heights on resize
            updatePanelContentHeights();
        });
        
        // Clear search button
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (nodeSearchInput) {
                    nodeSearchInput.value = '';
                    filterNodesBySearchTerm('');
                }
            });
        }
        
        // Animation toggle button
        if (toggleAnimationBtn) {
            toggleAnimationBtn.addEventListener('click', toggleAnimation);
        }
    }
    
    // Function to reset cumulative data
    function resetCumulativeData() {
        cumulativeNodeData = {};
        cumulativeEdgeData = {};
        updateCounter = 0;
        
        // Force a graph update to remove cumulative data from tooltips
        if (network) {
            // Remove cumulative data from node tooltips
            nodes.forEach(node => {
                if (node.title) {
                    node.title = removeCumulativeDataFromTooltip(node.title);
                    nodes.update(node);
                }
            });
            
            // Remove cumulative data from edge tooltips and reset colors
            edges.forEach(edge => {
                if (edge.title) {
                    edge.title = removeCumulativeDataFromTooltip(edge.title);
                    
                    // Reset edge color
                    edge.color = { color: "#848484", highlight: "#848484" };
                    edges.update(edge);
                }
            });
            
            // Update status
            updateStatus("Cumulative data reset");
        }
    }
    
    // Function to update the physics button text based on current state
    function updatePhysicsButtonText() {
        if (physicsBtnText) {
            physicsBtnText.textContent = physicsEnabled ? "Disable Physics" : "Enable Physics";
        }
    }
    
    // Toggle physics on/off
    function togglePhysics() {
        // Toggle the physics state
        physicsEnabled = !physicsEnabled;
        
        // Apply the current physics options but with the updated enabled state
        const updatedPhysics = {
            ...physicsOptions,
            enabled: physicsEnabled
        };
        
        // Apply to the network
        if (network) {
            network.setOptions({ physics: updatedPhysics });
        }
        
        // Update button text
        updatePhysicsButtonText();
        
        // Update status
        statusDiv.innerHTML = physicsEnabled ? "Physics enabled" : "Physics disabled";
    }
    
    // Function to determine edge color based on error counts
    function getEdgeColorByErrors(error4xx, error5xx) {
        // Get colors from configuration if available
        let defaultColor = "#848484"; // Default grey
        let warning4xxColor = "#f39c12"; // Default yellow/orange
        let error5xxColor = "#e74c3c"; // Default red
        
        // Use colors from configuration if available
        if (fullConfig && fullConfig.edges) {
            defaultColor = fullConfig.edges.color || defaultColor;
            warning4xxColor = fullConfig.edges.warning_color || warning4xxColor;
            error5xxColor = fullConfig.edges.error_color || error5xxColor;
        }
        
        // Apply color rules
        if (error5xx > 1) {
            return error5xxColor;
        } else if (error4xx > 0) {
            return warning4xxColor;
        } else {
            return defaultColor;
        }
    }
    
    // Initialize collapsible sections
    function initCollapsibleSections() {
        console.log("Initializing collapsible sections");
        
        const panelSections = document.querySelectorAll('.panel-section');
        
        panelSections.forEach(section => {
            const header = section.querySelector('h3');
            const collapseBtn = section.querySelector('.collapse-btn');
            const content = section.querySelector('.panel-content');
            const sectionTitle = header.querySelector('span').textContent.trim();
            
            if (header && content) {
                // Check if this section was previously collapsed
                const sectionKey = 'section_' + sectionTitle.replace(/\s+/g, '_').toLowerCase();
                const isCollapsed = localStorage.getItem(sectionKey) === 'collapsed';
                
                if (isCollapsed) {
                    section.classList.add('collapsed');
                    content.style.maxHeight = '0';
                } else {
                    // Initialize expanded
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
                
                // Add click event listener to the header
                header.addEventListener('click', (e) => {
                    // Only handle clicks on the h3 or collapse button, not on any other elements
                    if (e.target === header || e.target === collapseBtn || e.target.parentNode === collapseBtn || e.target === header.querySelector('span')) {
                        toggleSection(section, content, sectionKey);
                    }
                });
            }
        });
    }
    
    // Toggle section collapse/expand
    function toggleSection(section, content, sectionKey) {
        if (section.classList.contains('collapsed')) {
            // Expand
            section.classList.remove('collapsed');
            content.style.maxHeight = content.scrollHeight + 'px';
            
            // Save to localStorage
            if (sectionKey) {
                localStorage.setItem(sectionKey, 'expanded');
            }
        } else {
            // Collapse
            section.classList.add('collapsed');
            content.style.maxHeight = '0';
            
            // Save to localStorage
            if (sectionKey) {
                localStorage.setItem(sectionKey, 'collapsed');
            }
        }
    }
    
    // Update all panel content heights after data changes
    function updatePanelContentHeights() {
        const panelSections = document.querySelectorAll('.panel-section');
        
        panelSections.forEach(section => {
            if (!section.classList.contains('collapsed')) {
                const content = section.querySelector('.panel-content');
                if (content) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            }
        });
    }
    
    // Initialize animation dots for all edges in the network
    function initAnimationDots() {
        // Clear any existing animation dots
        animationDots = [];
        
        if (!network || !edges) return;
        
        // Get all edges
        const allEdges = edges.get();
        if (!allEdges || allEdges.length === 0) return;
        
        // Create animation dots for each visible edge
        allEdges.forEach(edge => {
            // Skip hidden edges
            if (edge.hidden) return;
            
            const fromNodeId = edge.from;
            const toNodeId = edge.to;
            
            // Only add animation if both nodes exist and are not hidden
            const fromNode = nodes.get(fromNodeId);
            const toNode = nodes.get(toNodeId);

            // Get positions of the nodes
            const fromNodePos = network.getPositions([edge.from])[edge.from];
            const toNodePos = network.getPositions([edge.to])[edge.to];

            // Calculate the Euclidean distance
            const length = Math.sqrt(
                Math.pow(toNodePos.x - fromNodePos.x, 2) +
                Math.pow(toNodePos.y - fromNodePos.y, 2)
            );
            console.log("Length from", edge.from, "to", edge.to, "is", length);
            
            if (fromNode && toNode && !fromNode.hidden && !toNode.hidden) {
                // Add multiple dots per edge with different speeds and starting positions
                let dotsPerEdge = 1;
                if (length > 600) {
                    //dotsPerEdge = 1 + Math.floor(Math.random() * 2); // 1-2 dots per edge
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
                    
                    animationDots.push({
                        edge: edge,
                        fromNodeId: fromNodeId,
                        toNodeId: toNodeId,
                        progress: startProgress,
                        speed: speed
                    });
                }
            }
        });
        
        console.log(`Initialized ${animationDots.length} animation dots for visible edges`);
    }
    
    // Toggle animation on/off
    function toggleAnimation() {
        animationEnabled = !animationEnabled;
        
        if (animationEnabled) {
            // Initialize animation and start
            initAnimationDots();
            
            // Remove any existing animation event handlers
            network.off("afterDrawing");
            
            // Add the animation event handler
            network.on("afterDrawing", drawAnimationDots);
            
            if (!animationRequestId) {
                animationRequestId = requestAnimationFrame(animateStep);
            }
            statusDiv.innerHTML = "Animation enabled";
            toggleAnimationBtn.classList.add('active');
        } else {
            // Stop animation
            if (animationRequestId) {
                cancelAnimationFrame(animationRequestId);
                animationRequestId = null;
            }
            
            // Remove the animation event handler
            network.off("afterDrawing");
            
            // Redraw the network without animation
            network.redraw();
            
            statusDiv.innerHTML = "Animation disabled";
            toggleAnimationBtn.classList.remove('active');
        }
    }
    
    // Load the GIF image
    const animationImage = new Image();
    animationImage.src = 'static/images/animation.gif'; // Update the path if necessary

    // Function to draw animation dots
    function drawAnimationDots(ctx) {
        // Draw each animation dot
        animationDots.forEach(dot => {
            // Get positions of the nodes
            const fromNodePos = network.getPositions([dot.fromNodeId])[dot.fromNodeId];
            const toNodePos = network.getPositions([dot.toNodeId])[dot.toNodeId];
            
            if (!fromNodePos || !toNodePos) return;
            
            // Calculate position along the edge
            const pos = {
                x: fromNodePos.x + dot.progress * (toNodePos.x - fromNodePos.x),
                y: fromNodePos.y + dot.progress * (toNodePos.y - fromNodePos.y)
            };
            
            // Get the center position of the from node
            const fromNode = nodes.get(dot.fromNodeId);
            const toNode = nodes.get(dot.toNodeId);
            
            // Define a threshold distance for hiding the animation
            const rayLengthFromNode = fromNode.size || 16; // Use the node size as the ray length, default to 16 if not defined
            const rayLengthToNode = toNode.size || 16; // Use the node size as the ray length, default to 16 if not defined
            
            // Calculate the distance from the animated dot to the center of the node
            const distanceFromNodeCenter = Math.sqrt(
                Math.pow(pos.x - fromNodePos.x, 2) + 
                Math.pow(pos.y - fromNodePos.y, 2)
            );

            const distanceToNodeCenter = Math.sqrt(
                Math.pow(pos.x - toNodePos.x, 2) + 
                Math.pow(pos.y - toNodePos.y, 2)
            );
            
            // Check if the distance is less than the ray length
            if (distanceFromNodeCenter < rayLengthFromNode || distanceToNodeCenter < rayLengthToNode) {
                // Skip drawing this dot as it's too close to the node center
                return;
            }
            
            // Calculate the angle of rotation and invert it
            const angle = Math.atan2(toNodePos.y - fromNodePos.y, toNodePos.x - fromNodePos.x) + Math.PI; // Invert direction
            
            // Save the current context state
            ctx.save();
            
            // Translate to the position where the image will be drawn
            ctx.translate(pos.x, pos.y);
            
            // Rotate the canvas
            ctx.rotate(angle);
            
            // Draw the GIF image centered at the origin (0, 0)
            ctx.drawImage(animationImage, -12, -12, 24, 24); // Adjust size to 24x24 pixels
            
            // Restore the context to its original state
            ctx.restore();
        });
    }
    
    // Animation step function
    function animateStep() {
        if (!network || !animationEnabled) {
            // Stop animation if disabled
            if (animationRequestId) {
                cancelAnimationFrame(animationRequestId);
                animationRequestId = null;
            }
            return;
        }
        
        // Update positions of animation dots
        for (let i = animationDots.length - 1; i >= 0; i--) {
            const dot = animationDots[i];
            
            // Check if the edge or its connecting nodes have been hidden since the last update
            const edge = edges.get(dot.edge.id);
            const fromNode = nodes.get(dot.fromNodeId);
            const toNode = nodes.get(dot.toNodeId);
            
            if (!edge || edge.hidden || !fromNode || fromNode.hidden || !toNode || toNode.hidden) {
                // Remove this dot as its edge or nodes are now hidden
                animationDots.splice(i, 1);
                continue;
            }
            
            // Update dot position
            dot.progress += dot.speed;
            if (dot.progress > 1) {
                dot.progress = 0; // Reset to start of edge
            }
        }
        
        // Force redraw of network to trigger the afterDrawing event
        network.redraw();
        
        // Request next animation frame
        animationRequestId = requestAnimationFrame(animateStep);
    }
    
    // Function to update a node with cumulative data
    function updateNodeWithCumulativeData(nodeId, data) {
        if (!cumulativeNodeData[nodeId]) {
            cumulativeNodeData[nodeId] = {
                updates: 0,
                totalCommunications: 0
            };
        }
        
        const nodeCumulativeData = cumulativeNodeData[nodeId];
        nodeCumulativeData.updates += 1;
        nodeCumulativeData.totalCommunications += data.totalCommunications || 0;
        
        // Update the node tooltip with cumulative data
        const node = nodes.get(nodeId);
        if (node) {
            // Use tooltip manager to update node tooltip
            updateNodeTooltip(node, nodeCumulativeData);
            nodes.update(node);
        }
    }
    
    // Filter edges by status (no-errors, 4xx, 5xx)
    function filterEdgesByStatus(status, show) {
        if (!edges || !network) {
            console.log("Edges or network not available yet, can't filter", { edges, network });
            return;
        }
        
        console.log(`${show ? 'Showing' : 'Hiding'} edges with status: ${status}`);
        
        // Get all edges currently in the data set
        const currentEdges = edges.get();
        console.log(`Filtering ${currentEdges.length} edges`);
        
        const edgesToFilter = [];
        
        // Get the colors from the configuration
        let defaultColor = "#848484"; // Default grey
        let warning4xxColor = "#f39c12"; // Default yellow/orange
        let error5xxColor = "#e74c3c"; // Default red
        
        // Use colors from configuration if available
        if (fullConfig && fullConfig.edges) {
            defaultColor = fullConfig.edges.color || defaultColor;
            warning4xxColor = fullConfig.edges.warning_color || warning4xxColor;
            error5xxColor = fullConfig.edges.error_color || error5xxColor;
        }
        
        console.log("Using colors for filtering:", { 
            defaultColor, 
            warning4xxColor, 
            error5xxColor 
        });
        
        // Check each edge to see if it matches the status
        currentEdges.forEach(edge => {
            let matchesStatus = false;
            
            // Extract the color from the edge object (could be a string or object)
            let edgeColor = '';
            if (typeof edge.color === 'string') {
                edgeColor = edge.color;
            } else if (edge.color && edge.color.color) {
                edgeColor = edge.color.color;
            } else if (edge.color) {
                edgeColor = edge.color;
            }
            
            // Normalize the color to lowercase for comparison
            const originalEdgeColor = edgeColor;
            edgeColor = edgeColor.toLowerCase();
            defaultColor = defaultColor.toLowerCase();
            warning4xxColor = warning4xxColor.toLowerCase();
            error5xxColor = error5xxColor.toLowerCase();
            
            if (status === 'no-errors' && edgeColor === defaultColor) {
                matchesStatus = true;
            } else if (status === '4xx' && edgeColor === warning4xxColor) {
                matchesStatus = true;
            } else if (status === '5xx' && edgeColor === error5xxColor) {
                matchesStatus = true;
            }
            
            if (matchesStatus) {
                edgesToFilter.push(edge.id);
                console.log(`Edge ${edge.id} (color: ${originalEdgeColor}) matches ${status} status`);
            }
        });
        
        console.log(`Found ${edgesToFilter.length} edges matching status ${status}`);
        
        // Update the filtered set
        edgesToFilter.forEach(edgeId => {
            if (show) {
                edgeFilters.delete(edgeId);
            } else {
                edgeFilters.add(edgeId);
            }
        });
        
        // Apply the filters
        applyEdgeFilters();
    }
    
    // Apply edge filters to the graph
    function applyEdgeFilters() {
        if (!network) {
            console.log("Network not available yet, can't apply edge filters");
            return;
        }
        
        console.log("Applying edge filters: Hiding", edgeFilters.size, "edges");
        
        // Get all edges currently in the data set
        const allEdgesInDataset = edges.get();
        console.log(`Total edges in dataset: ${allEdgesInDataset.length}`);
        
        // Update the 'hidden' property for each edge
        const edgeUpdates = [];
        allEdgesInDataset.forEach(edge => {
            const isHidden = edgeFilters.has(edge.id);
            if (edge.hidden !== isHidden) {
                edgeUpdates.push({
                    id: edge.id,
                    hidden: isHidden
                });
                console.log(`Setting edge ${edge.id} hidden = ${isHidden}`);
            }
        });
        
        // Apply the updates to the edges dataset
        if (edgeUpdates.length > 0) {
            edges.update(edgeUpdates);
            console.log(`Updated ${edgeUpdates.length} edges visibility`);
            
            // Reinitialize animation dots if animation is enabled
            if (animationEnabled) {
                initAnimationDots();
            }
        } else {
            console.log("No edge visibility updates needed");
        }
    }
    
    // Initialize edge filters
    function initEdgeFilters() {
        const edgeCheckboxes = document.querySelectorAll('.edge-checkbox');
        
        edgeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const status = this.dataset.edgeStatus;
                const show = this.checked;
                filterEdgesByStatus(status, show);
            });
        });
        
        console.log("Edge filters initialized");
    }
    
    // Start the application
    init();
}); 