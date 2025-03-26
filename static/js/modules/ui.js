// K8s Communications Graph Visualizer - UI Module

import { dom, config, network } from './state.js';
import { togglePhysics, applyPhysicsSettings, toggleFixedPositions } from './physics.js';
import { toggleAnimation } from './animation.js';
import { requestGraphData, fitGraphToWindow } from './network.js';
import { applyNodeFilters, filterNodesBySearchTerm, highlightMatchingNodes } from './filters.js';
import { setupAutoRefresh } from './utils.js';

// Initialize UI elements and event listeners
export function initUI() {
    // Initialize DOM element references
    dom.networkContainer = document.getElementById('network');
    dom.refreshBtn = document.getElementById('refresh-btn');
    dom.togglePhysicsBtn = document.getElementById('toggle-physics-btn');
    dom.physicsBtnText = document.getElementById('physics-btn-text');
    dom.resetViewBtn = document.getElementById('reset-view-btn');
    dom.toggleFixedPositionsBtn = document.getElementById('toggle-fixed-positions-btn');
    dom.statusDiv = document.getElementById('status');
    dom.lastUpdateDiv = document.getElementById('last-update');
    dom.updateIntervalInput = document.getElementById('update-interval');
    dom.setIntervalBtn = document.getElementById('set-interval-btn');
    dom.gravityValue = document.getElementById('gravity-value');
    dom.springLengthValue = document.getElementById('spring-length-value');
    dom.springStrengthValue = document.getElementById('spring-strength-value');
    dom.applyPhysicsBtn = document.getElementById('apply-physics-btn');
    dom.nodeSearchInput = document.getElementById('node-search');
    dom.clearSearchBtn = document.getElementById('clear-search-btn');
    dom.nodeFiltersDiv = document.getElementById('node-filters');
    dom.toggleAnimationBtn = document.getElementById('toggle-animation-btn');
    dom.countdownTimerDiv = document.getElementById('countdown-timer');
    dom.maximizeSpacingBtn = document.getElementById('maximize-spacing-btn');
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize collapsible sections
    initCollapsibleSections();
    
    // Initialize edge filters
    initEdgeFilters();
    
    // Set initial state for toggle buttons
    if (config.fixedPositionsEnabled) {
        dom.toggleFixedPositionsBtn.classList.add('active');
    } else {
        dom.toggleFixedPositionsBtn.classList.remove('active');
    }
    
    // Update physics button text and state
    dom.physicsBtnText.textContent = config.physicsEnabled ? "Disable Physics" : "Enable Physics";
    if (config.physicsEnabled) {
        dom.togglePhysicsBtn.classList.add('active');
    } else {
        dom.togglePhysicsBtn.classList.remove('active');
    }
    
    // Start the countdown timer
    startCountdownTimer();
    
    console.log("UI initialized");
}

// Set up event listeners for UI components
function setupEventListeners() {
    // Main control buttons
    if (dom.refreshBtn) {
        dom.refreshBtn.addEventListener('click', () => {
            dom.statusDiv.innerHTML = "Requesting update...";
            requestGraphData();
        });
    }
    
    if (dom.togglePhysicsBtn) {
        dom.togglePhysicsBtn.addEventListener('click', togglePhysics);
    }
    
    if (dom.resetViewBtn) {
        dom.resetViewBtn.addEventListener('click', fitGraphToWindow);
    }
    
    if (dom.maximizeSpacingBtn) {
        dom.maximizeSpacingBtn.addEventListener('click', maximizeNodeSpacing);
    }
    
    if (dom.toggleFixedPositionsBtn) {
        dom.toggleFixedPositionsBtn.addEventListener('click', toggleFixedPositions);
    }
    
    if (dom.toggleAnimationBtn) {
        dom.toggleAnimationBtn.addEventListener('click', toggleAnimation);
    }
    
    // Update interval
    if (dom.setIntervalBtn && dom.updateIntervalInput) {
        dom.setIntervalBtn.addEventListener('click', () => {
            const interval = parseInt(dom.updateIntervalInput.value, 10);
            if (interval < 5) {
                dom.statusDiv.innerHTML = "Interval must be at least 5 seconds";
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
                  dom.statusDiv.innerHTML = data.message;
                  config.updateInterval = interval;
                  config.countdownTimer = interval;
                  
                  // Reset the auto-refresh with the new interval
                  setupAutoRefresh();
              })
              .catch(error => {
                  dom.statusDiv.innerHTML = "Error updating interval";
                  console.error('Error:', error);
              });
        });
    }
    
    // Physics settings
    if (dom.applyPhysicsBtn) {
        dom.applyPhysicsBtn.addEventListener('click', applyPhysicsSettings);
    }
    
    // Node search
    if (dom.nodeSearchInput) {
        dom.nodeSearchInput.addEventListener('input', () => {
            filterNodesBySearchTerm(dom.nodeSearchInput.value);
        });
    }
    
    if (dom.clearSearchBtn) {
        dom.clearSearchBtn.addEventListener('click', () => {
            if (dom.nodeSearchInput) {
                dom.nodeSearchInput.value = '';
                filterNodesBySearchTerm('');
            }
        });
    }
    
    // Search button for highlighting nodes
    const searchButton = document.getElementById('search-button');
    if (searchButton && dom.nodeSearchInput) {
        searchButton.addEventListener('click', () => {
            const searchTerm = dom.nodeSearchInput.value;
            highlightMatchingNodes(searchTerm);
        });
    }
    
    // Select All and Deselect All buttons for nodes
    const selectAllBtn = document.getElementById('select-all-nodes');
    const deselectAllBtn = document.getElementById('deselect-all-nodes');
    const selectFilteredBtn = document.getElementById('select-filtered-nodes');
    const deselectFilteredBtn = document.getElementById('deselect-filtered-nodes');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            // Clear all node filters
            config.nodeFilters.clear();
            // Update checkboxes to show all nodes as selected
            const checkboxes = document.querySelectorAll('.node-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
            // Apply the filters (which will show all nodes)
            applyNodeFilters();
        });
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            // Add all nodes to filters
            const allNodeIds = Array.from(config.allKnownNodes.keys());
            allNodeIds.forEach(nodeId => {
                config.nodeFilters.add(nodeId);
            });
            // Update checkboxes to show all nodes as deselected
            const checkboxes = document.querySelectorAll('.node-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            // Apply the filters (which will hide all nodes)
            applyNodeFilters();
        });
    }
    
    // Select and deselect filtered nodes
    if (selectFilteredBtn) {
        selectFilteredBtn.addEventListener('click', () => {
            // Get current search term
            const searchTerm = dom.nodeSearchInput ? dom.nodeSearchInput.value.toLowerCase() : '';
            if (!searchTerm) return; // Do nothing if no search term
            
            // Get all node checkboxes currently visible in the filter
            const visibleCheckboxes = document.querySelectorAll('.node-checkbox');
            
            // Process each checkbox
            visibleCheckboxes.forEach(checkbox => {
                const nodeId = checkbox.dataset.nodeId;
                if (nodeId.toLowerCase().includes(searchTerm)) {
                    // Remove this node from filters (show it)
                    config.nodeFilters.delete(nodeId);
                    // Update checkbox
                    checkbox.checked = true;
                }
            });
            
            // Apply the updated filters
            applyNodeFilters();
            dom.statusDiv.innerHTML = `Selected all nodes matching "${searchTerm}"`;
        });
    }
    
    if (deselectFilteredBtn) {
        deselectFilteredBtn.addEventListener('click', () => {
            // Get current search term
            const searchTerm = dom.nodeSearchInput ? dom.nodeSearchInput.value.toLowerCase() : '';
            if (!searchTerm) return; // Do nothing if no search term
            
            // Get all node checkboxes currently visible in the filter
            const visibleCheckboxes = document.querySelectorAll('.node-checkbox');
            
            // Process each checkbox
            visibleCheckboxes.forEach(checkbox => {
                const nodeId = checkbox.dataset.nodeId;
                if (nodeId.toLowerCase().includes(searchTerm)) {
                    // Add this node to filters (hide it)
                    config.nodeFilters.add(nodeId);
                    // Update checkbox
                    checkbox.checked = false;
                }
            });
            
            // Apply the updated filters
            applyNodeFilters();
            dom.statusDiv.innerHTML = `Deselected all nodes matching "${searchTerm}"`;
        });
    }
    
    // Window resize event
    window.addEventListener('resize', updatePanelContentHeights);
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

// Filter edges by HTTP status (no-errors, 4xx, 5xx)
function filterEdgesByStatus(status, show) {
    if (!network.edges || !network.instance) {
        console.log("Edges or network not available yet, can't filter", { edges: network.edges, network: network.instance });
        return;
    }
    
    console.log(`${show ? 'Showing' : 'Hiding'} edges with status: ${status}`);
    
    // Get all edges currently in the data set
    const currentEdges = network.edges.get();
    console.log(`Filtering ${currentEdges.length} edges`);
    
    const edgesToFilter = [];
    
    // Get the colors from the configuration
    let defaultColor = "#848484"; // Default grey
    let warning4xxColor = "#f39c12"; // Default yellow/orange
    let error5xxColor = "#e74c3c"; // Default red
    
    // Use colors from configuration if available
    if (config.fullConfig && config.fullConfig.edges) {
        defaultColor = config.fullConfig.edges.color || defaultColor;
        warning4xxColor = config.fullConfig.edges.warning_color || warning4xxColor;
        error5xxColor = config.fullConfig.edges.error_color || error5xxColor;
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
            config.edgeFilters.delete(edgeId);
        } else {
            config.edgeFilters.add(edgeId);
        }
    });
    
    // Apply the filters
    applyEdgeFilters();
}

// Apply edge filters to the network
export function applyEdgeFilters() {
    if (!network.instance) {
        console.log("Network not available yet, can't apply edge filters");
        return;
    }
    
    console.log("Applying edge filters: Hiding", config.edgeFilters.size, "edges");
    
    // Get all edges currently in the data set
    const allEdgesInDataset = network.edges.get();
    console.log(`Total edges in dataset: ${allEdgesInDataset.length}`);
    
    // Update the 'hidden' property for each edge
    const edgeUpdates = [];
    allEdgesInDataset.forEach(edge => {
        const isHidden = config.edgeFilters.has(edge.id);
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
        network.edges.update(edgeUpdates);
        console.log(`Updated ${edgeUpdates.length} edges visibility`);
    } else {
        console.log("No edge visibility updates needed");
    }
}

// Update all panel content heights after data changes
export function updatePanelContentHeights() {
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

// Start the countdown timer
function startCountdownTimer() {
    setInterval(() => {
        if (config.countdownTimer > 0) {
            config.countdownTimer--;
            if (dom.countdownTimerDiv) {
                dom.countdownTimerDiv.innerHTML = `Next update in: ${config.countdownTimer} seconds`;
            }
        } else {
            config.countdownTimer = config.updateInterval; // Reset the timer
        }
    }, 1000);
}

// Maximize spacing between nodes
async function maximizeNodeSpacing() {
    if (!network.instance || !network.nodes || !network.edges) {
        console.log("Network not available yet");
        return;
    }

    // Store current physics settings
    const originalPhysics = network.instance.physics.options;
    
    // Temporarily disable physics
    network.instance.setOptions({ physics: { enabled: false } });
    
    // Get the container dimensions
    const container = dom.networkContainer;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Get all nodes and edges
    const nodes = network.nodes.get();
    const edges = network.edges.get();
    const nodeCount = nodes.length;
    
    if (nodeCount === 0) {
        console.log("No nodes to position");
        return;
    }

    // Calculate edge count per node
    const edgeCounts = new Map();
    nodes.forEach(node => {
        edgeCounts.set(node.id, 0);
    });
    
    edges.forEach(edge => {
        edgeCounts.set(edge.from, (edgeCounts.get(edge.from) || 0) + 1);
        edgeCounts.set(edge.to, (edgeCounts.get(edge.to) || 0) + 1);
    });

    // Find max edge count for normalization
    const maxEdgeCount = Math.max(...edgeCounts.values());
    
    // Group nodes by edge count
    const nodeGroups = new Map();
    nodes.forEach(node => {
        const count = edgeCounts.get(node.id);
        if (!nodeGroups.has(count)) {
            nodeGroups.set(count, []);
        }
        nodeGroups.get(count).push(node);
    });

    // Sort groups by edge count (ascending - fewer edges first)
    const sortedGroups = Array.from(nodeGroups.entries())
        .sort(([a], [b]) => a - b);

    // Calculate positions
    const updates = [];
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Calculate maximum radius based on container size
    const maxRadius = Math.min(width, height) * 0.45;
    
    // Calculate minimum radius to ensure no overlap with center
    const minRadius = maxRadius * 0.2; // Reduced to allow more central nodes
    
    // Calculate minimum angle between nodes to prevent overlap
    const nodeSize = 70; // 50px node + 20px margin
    const minAngle = (2 * Math.asin(nodeSize / (2 * maxRadius))) * (180 / Math.PI);
    
    // Position nodes in concentric circles based on edge count
    sortedGroups.forEach(([edgeCount, groupNodes], groupIndex) => {
        const groupSize = groupNodes.length;
        
        // Reverse the radius calculation - more edges = closer to center
        const normalizedEdgeCount = edgeCount / maxEdgeCount;
        const radius = maxRadius - (maxRadius - minRadius) * normalizedEdgeCount;
        
        // Calculate angle step ensuring minimum angle between nodes
        const angleStep = Math.max(
            (2 * Math.PI) / groupSize,
            (minAngle * Math.PI) / 180
        );
        
        // Add offset between groups to prevent overlap
        const groupOffset = groupIndex * (Math.PI / 6);
        
        groupNodes.forEach((node, index) => {
            const angle = index * angleStep + groupOffset;
            updates.push({
                id: node.id,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                fixed: true
            });
        });
    });
    
    // Apply the new positions
    network.nodes.update(updates);
    
    // Update fixed positions state and button
    config.fixedPositionsEnabled = true;
    if (dom.toggleFixedPositionsBtn) {
        dom.toggleFixedPositionsBtn.classList.add('active');
    }
    
    // Fit the view to show all nodes with some padding
    network.instance.fit({
        animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad'
        },
        padding: 50
    });
    
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Restore original physics settings
    network.instance.setOptions({ physics: originalPhysics });
    
    // Update status
    if (dom.statusDiv) {
        dom.statusDiv.innerHTML = "Nodes arranged with highly connected nodes in center";
    }
} 