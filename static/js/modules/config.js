// K8s Communications Graph Visualizer - Configuration Module

import { config, physicsOptions, networkOptions, network } from './state.js';
import { updatePhysicsButtonText } from './physics.js';

// Initialize configuration from window.appConfig
export function initConfig() {
    // Check if window.appConfig exists and initialize configuration
    if (window.appConfig) {
        config.updateInterval = window.appConfig.updateInterval || 60;
        config.countdownTimer = config.updateInterval;
        
        // Set physics enabled state from config (default to false)
        if (window.appConfig.physics) {
            config.physicsEnabled = window.appConfig.physics.enabled || false;
            
            // If physics configuration exists, update physics options
            physicsOptions.barnesHut.gravitationalConstant = window.appConfig.physics.gravity || -1000;
            physicsOptions.barnesHut.springLength = window.appConfig.physics.springLength || 150;
            physicsOptions.barnesHut.springStrength = window.appConfig.physics.springStrength || 0.01;
        }
    }
    
    console.log("Configuration initialized:", config);
}

// Load full configuration from server API
export async function loadConfiguration() {
    try {
        const response = await fetch('/config');
        const configData = await response.json();
        console.log("Loaded configuration from server:", configData);
        
        // Store full configuration
        config.fullConfig = configData;
        
        // Update physics options with values from server config
        if (config.fullConfig && config.fullConfig.physics) {
            const physicsConfig = config.fullConfig.physics;
            
            // Only set the initial physics enabled state if this is the first load
            if (config.updateCounter === 0) {
                config.physicsEnabled = physicsConfig.enabled || false;
                // Update button text right away
                updatePhysicsButtonText();
            }
            
            physicsOptions.solver = physicsConfig.solver || "barnesHut";
            
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
        }
        
        // Update network options based on configuration
        updateNetworkOptions();
        
        // If the network exists, update its options
        if (network.instance) {
            // Apply updated physics settings while preserving the enabled state
            const updatedPhysics = {
                ...physicsOptions,
                enabled: config.physicsEnabled // Keep current enabled state
            };
            network.instance.setOptions({ physics: updatedPhysics });
        }
        
        return config.fullConfig;
    } catch (error) {
        console.error("Error loading configuration:", error);
        return null;
    }
}

// Update vis.js network options based on loaded configuration
export function updateNetworkOptions() {
    if (config.fullConfig) {
        // Update nodes options
        if (config.fullConfig.nodes) {
            networkOptions.nodes.shape = config.fullConfig.nodes.shape;
            networkOptions.nodes.size = config.fullConfig.nodes.base_size;
            networkOptions.nodes.font.size = config.fullConfig.nodes.font_size;
            networkOptions.nodes.font.face = config.fullConfig.nodes.font_face;
            networkOptions.nodes.borderWidth = config.fullConfig.nodes.border_width;
            
            if (config.fullConfig.nodes.scaling) {
                networkOptions.nodes.scaling = {
                    min: config.fullConfig.nodes.scaling.min,
                    max: config.fullConfig.nodes.scaling.max,
                    label: config.fullConfig.nodes.scaling.label
                };
            }
        }
        
        // Update edges options
        if (config.fullConfig.edges) {
            // Set basic edge properties
            networkOptions.edges.width = config.fullConfig.edges.default_width;
            networkOptions.edges.smooth = config.fullConfig.edges.smooth;
            
            // Ensure edges don't scale based on value when fixed_width is true
            if (config.fullConfig.edges.fixed_width) {
                // Explicitly disable scaling by setting min and max to the same value
                networkOptions.edges.scaling = {
                    min: config.fullConfig.edges.default_width,
                    max: config.fullConfig.edges.default_width,
                    label: { enabled: false }
                };
            } else {
                // Apply scaling configuration from server
                if (config.fullConfig.edges.scaling) {
                    networkOptions.edges.scaling = config.fullConfig.edges.scaling;
                }
            }
            
            if (config.fullConfig.edges.color) {
                networkOptions.edges.color.color = config.fullConfig.edges.color;
                networkOptions.edges.color.highlight = config.fullConfig.edges.highlight_color;
                networkOptions.edges.color.hover = config.fullConfig.edges.hover_color;
            }
            
            if (config.fullConfig.edges.arrows && config.fullConfig.edges.arrows.to_enabled !== undefined) {
                networkOptions.edges.arrows.to.enabled = config.fullConfig.edges.arrows.to_enabled;
                networkOptions.edges.arrows.to.scaleFactor = config.fullConfig.edges.arrows.scale_factor;
            }
            
            if (config.fullConfig.edges.font) {
                networkOptions.edges.font.align = config.fullConfig.edges.font.align;
                networkOptions.edges.font.size = config.fullConfig.edges.font.size;
            }
        }
        
        // Update graph options
        if (config.fullConfig.graph) {
            networkOptions.autoResize = config.fullConfig.graph.auto_resize;
            
            if (config.fullConfig.graph.interaction) {
                networkOptions.interaction.dragNodes = config.fullConfig.graph.interaction.drag_nodes;
                networkOptions.interaction.hideEdgesOnDrag = config.fullConfig.graph.interaction.hide_edges_on_drag;
                networkOptions.interaction.hideNodesOnDrag = config.fullConfig.graph.interaction.hide_nodes_on_drag;
                networkOptions.interaction.navigationButtons = config.fullConfig.graph.interaction.navigation_buttons;
                
                // Ensure we never automatically change the view when selecting nodes
                networkOptions.interaction.selectable = true;
                networkOptions.interaction.selectConnectedEdges = false;
                networkOptions.interaction.zoomView = true;
                
                // These can be configured from server
                networkOptions.interaction.multiselect = config.fullConfig.graph.interaction.multi_select;
                
                if (config.fullConfig.graph.interaction.keyboard_enabled !== undefined) {
                    networkOptions.interaction.keyboard.enabled = config.fullConfig.graph.interaction.keyboard_enabled;
                    
                    if (config.fullConfig.graph.interaction.keyboard_speed) {
                        networkOptions.interaction.keyboard.speed.x = config.fullConfig.graph.interaction.keyboard_speed.x;
                        networkOptions.interaction.keyboard.speed.y = config.fullConfig.graph.interaction.keyboard_speed.y;
                        networkOptions.interaction.keyboard.speed.zoom = config.fullConfig.graph.interaction.keyboard_speed.zoom;
                    }
                }
            }
        }
        
        // If the network exists, update its options
        if (network.instance) {
            // Create a clean copy of options without any potential circular references
            const cleanOptions = JSON.parse(JSON.stringify(networkOptions));
            console.log("Updating network options:", cleanOptions);
            network.instance.setOptions(cleanOptions);
        }
    }
} 