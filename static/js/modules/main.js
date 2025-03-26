// K8s Communications Graph Visualizer - Main Module

import { initConfig, loadConfiguration } from './config.js';
import { initNetwork, requestGraphData, fitGraphToWindow } from './network.js';
import { initUI } from './ui.js';
import { initFilters } from './filters.js';
import { setupAutoRefresh } from './utils.js';

// Main initialization function
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM content loaded");
    
    // Initialize global state and configuration
    await initConfig();
    
    // Load configuration from server
    await loadConfiguration();
    
    // Initialize UI components and event handlers
    initUI();
    
    // Initialize filters
    initFilters();
    
    // Initialize network visualization
    initNetwork();
    
    // Request initial graph data
    requestGraphData();
    
    // Setup automatic refresh
    setupAutoRefresh();
    
    // Set the initial view to fit all nodes
    setTimeout(() => {
        fitGraphToWindow();
    }, 1000);
    
    console.log("Application initialized");
}); 