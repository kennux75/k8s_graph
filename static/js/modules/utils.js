// K8s Communications Graph Visualizer - Utils Module

import { config } from './state.js';
import { requestGraphData } from './network.js';

// Set up automatic refresh of graph data
export function setupAutoRefresh() {
    // Clear any existing timer
    if (config.updateTimer) {
        clearInterval(config.updateTimer);
    }
    
    // Set up new timer for automatic updates
    config.updateTimer = setInterval(() => {
        console.log(`Auto-refreshing graph data (interval: ${config.updateInterval} seconds)`);
        requestGraphData();
        config.countdownTimer = config.updateInterval; // Reset countdown timer on data request
    }, config.updateInterval * 1000);
    
    console.log(`Auto-refresh set up with interval: ${config.updateInterval} seconds`);
}

// Remove cumulative data from tooltip text
export function removeCumulativeDataFromTooltip(tooltipText) {
    if (!tooltipText) return tooltipText;
    
    // Find the section that starts with "--- CUMULATIVE DATA" and remove it and everything after
    const cumulativeDataIndex = tooltipText.indexOf("\n\n--- CUMULATIVE DATA");
    if (cumulativeDataIndex !== -1) {
        return tooltipText.substring(0, cumulativeDataIndex);
    }
    
    return tooltipText;
}

// Reset cumulative data tracking
export function resetCumulativeData() {
    config.cumulativeNodeData = {};
    config.cumulativeEdgeData = {};
    config.updateCounter = 0;
    
    return true;
}

// Update status message
export function updateStatus(message) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.innerHTML = message;
    }
} 