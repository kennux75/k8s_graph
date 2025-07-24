// K8s Communications Graph Visualizer - Physics Module

import { config, physicsOptions, network, dom } from './state.js';

// Update the physics button text based on current state
export function updatePhysicsButtonText() {
    if (dom.physicsBtnText) {
        dom.physicsBtnText.textContent = config.physicsEnabled ? "Disable Physics" : "Enable Physics";
    }
}

// Toggle physics on/off
export function togglePhysics() {
    // Toggle the physics state
    config.physicsEnabled = !config.physicsEnabled;
    
    // Apply the current physics options but with the updated enabled state
    const updatedPhysics = {
        ...physicsOptions,
        enabled: config.physicsEnabled
    };
    
    // Apply to the network
    if (network.instance) {
        network.instance.setOptions({ physics: updatedPhysics });
        
        // IMPORTANT: After changing global physics, we need to preserve individual node constraints
        // Re-apply physics constraints for nodes with more than 3 edges
        if (config.physicsEnabled) {
            const nodeIds = network.nodes.getIds();
            const nodesToUpdate = [];
            
            nodeIds.forEach(nodeId => {
                const edgeCount = config.nodeEdgeCounts[nodeId] || 0;
                
                // Nodes with more than 3 edges should keep physics disabled
                if (edgeCount > 3) {
                    nodesToUpdate.push({
                        id: nodeId,
                        physics: false
                    });
                }
            });
            
            // Update nodes that need physics disabled
            if (nodesToUpdate.length > 0) {
                network.nodes.update(nodesToUpdate);
                console.log(`Preserved physics constraints for ${nodesToUpdate.length} nodes with >3 edges`);
            }
        }
    }
    
    // Update button text and state
    if (dom.physicsBtnText) {
        dom.physicsBtnText.textContent = config.physicsEnabled ? "Disable Physics" : "Enable Physics";
    }
    
    // Update button active state
    if (dom.togglePhysicsBtn) {
        if (config.physicsEnabled) {
            dom.togglePhysicsBtn.classList.add('active');
        } else {
            dom.togglePhysicsBtn.classList.remove('active');
        }
    }
    
    // Update status
    if (dom.statusDiv) {
        dom.statusDiv.innerHTML = config.physicsEnabled ? "Physics enabled" : "Physics disabled";
    }
}

// Apply current physics settings to the network
export function applyPhysicsSettings() {
    if (network.instance) {
        // Update physics settings from UI inputs
        if (dom.gravityValue && dom.springLengthValue && dom.springStrengthValue) {
            physicsOptions.barnesHut.gravitationalConstant = parseInt(dom.gravityValue.value);
            physicsOptions.barnesHut.springLength = parseInt(dom.springLengthValue.value);
            physicsOptions.barnesHut.springConstant = parseFloat(dom.springStrengthValue.value);
        }
        
        // Apply to network, but don't change the enabled state
        network.instance.setOptions({
            physics: {
                barnesHut: {
                    gravitationalConstant: physicsOptions.barnesHut.gravitationalConstant,
                    springLength: physicsOptions.barnesHut.springLength,
                    springConstant: physicsOptions.barnesHut.springConstant
                }
            }
        });
        
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Physics settings applied.";
        }
    }
}

// Toggle fixed positions
export function toggleFixedPositions() {
    if (!network.instance || !network.nodes) {
        console.log("Network not available yet");
        return;
    }

    const nodeIds = network.nodes.getIds();
    
    // Toggle the fixed positions state
    config.fixedPositionsEnabled = !config.fixedPositionsEnabled;
    
    if (config.fixedPositionsEnabled) {
        // Fix nodes at their current positions
        const positions = network.instance.getPositions(nodeIds);
        
        // Update all nodes to fixed positions, preserving physics constraints
        const nodesToUpdate = [];
        nodeIds.forEach(nodeId => {
            // Store positions for all nodes to use during updates
            config.nodePositions[nodeId] = { 
                x: positions[nodeId].x, 
                y: positions[nodeId].y 
            };
            
            const edgeCount = config.nodeEdgeCounts[nodeId] || 0;
            
            // Create update object with position and fixed state
            const nodeUpdate = {
                id: nodeId,
                x: positions[nodeId].x,
                y: positions[nodeId].y,
                fixed: true
            };
            
            // IMPORTANT: Preserve physics constraints for nodes with more than 3 edges
            if (edgeCount > 3) {
                nodeUpdate.physics = false;
            }
            
            nodesToUpdate.push(nodeUpdate);
        });
        
        // Update all nodes at once
        network.nodes.update(nodesToUpdate);
        
        // Log the preservation of physics constraints
        const physicsDisabledCount = nodesToUpdate.filter(node => node.physics === false).length;
        if (physicsDisabledCount > 0) {
            console.log(`Fixed positions: Preserved physics constraints for ${physicsDisabledCount} nodes with >3 edges`);
        }
        
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Node positions fixed.";
        }
    } else {
        // Unfix all nodes to allow movement, but preserve physics constraints
        const nodesToUpdate = [];
        nodeIds.forEach(nodeId => {
            const edgeCount = config.nodeEdgeCounts[nodeId] || 0;
            
            const nodeUpdate = {
                id: nodeId,
                fixed: false
            };
            
            // IMPORTANT: Preserve physics constraints for nodes with more than 3 edges
            if (edgeCount > 3) {
                nodeUpdate.physics = false;
            }
            
            nodesToUpdate.push(nodeUpdate);
        });
        
        // Update all nodes at once
        network.nodes.update(nodesToUpdate);
        
        // Log the preservation of physics constraints
        const physicsDisabledCount = nodesToUpdate.filter(node => node.physics === false).length;
        if (physicsDisabledCount > 0) {
            console.log(`Unfixed positions: Preserved physics constraints for ${physicsDisabledCount} nodes with >3 edges`);
        }
        
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Positions are now dynamic.";
        }
    }
    
    // Update button state based on actual node states
    if (dom.toggleFixedPositionsBtn) {
        const allNodes = network.nodes.get();
        const hasFixedNodes = allNodes.some(node => node.fixed);
        if (hasFixedNodes) {
            dom.toggleFixedPositionsBtn.classList.add('active');
        } else {
            dom.toggleFixedPositionsBtn.classList.remove('active');
        }
    }
}

// Get edge color based on error counts
export function getEdgeColorByErrors(error4xx, error5xx) {
    // Get colors from configuration if available
    let defaultColor = "#848484"; // Default grey
    let warning4xxColor = "#f39c12"; // Default yellow/orange
    let error5xxColor = "#e74c3c"; // Default red
    
    // Use colors from configuration if available
    if (config.fullConfig && config.fullConfig.edges) {
        defaultColor = config.fullConfig.edges.color || defaultColor;
        warning4xxColor = config.fullConfig.edges.warning_color || warning4xxColor;
        error5xxColor = config.fullConfig.edges.error_color || error5xxColor;
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