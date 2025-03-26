/**
 * Tooltip Manager for Kubernetes Communications Graph
 * 
 * This module provides functions to handle tooltips in the client-side graph visualization.
 * It centralizes tooltip management for nodes and edges, including cumulative data handling.
 */

/**
 * Modifies a tooltip to include cumulative data
 * 
 * @param {string} originalTitle - The original tooltip text
 * @param {object} cumulativeData - Object containing cumulative data for the entity
 * @param {boolean} isEdge - Whether this is for an edge (true) or node (false)
 * @returns {string} - The modified tooltip text with cumulative data
 */
function addCumulativeDataToTooltip(originalTitle, cumulativeData, isEdge = false) {
    if (!cumulativeData || cumulativeData.updates <= 1) {
        return originalTitle;
    }
    
    // Don't add duplicate cumulative data
    if (originalTitle.includes("CUMULATIVE DATA")) {
        return originalTitle;
    }
    
    // Extract 5xx error examples to preserve them
    let five_xx_examples = "";
    if (isEdge && originalTitle.includes("5xx Error Examples:")) {
        const parts = originalTitle.split("5xx Error Examples:");
        if (parts.length > 1) {
            five_xx_examples = "5xx Error Examples:" + parts[1];
            originalTitle = parts[0];
        }
    }
    
    let cumulativeSection;
    
    if (isEdge) {
        // Edge cumulative data
        cumulativeSection = 
            `\n\n--- CUMULATIVE DATA (${cumulativeData.updates} updates) ---` +
            `\nTotal Connections: ${cumulativeData.connectionCount}` +
            `\nTotal HTTP Requests: ${cumulativeData.errorCounts.total || 0}` +
            `\n2xx: ${cumulativeData.errorCounts['2xx'] || 0}, ` +
            `3xx: ${cumulativeData.errorCounts['3xx'] || 0}, ` +
            `4xx: ${cumulativeData.errorCounts['4xx'] || 0}, ` +
            `5xx: ${cumulativeData.errorCounts['5xx'] || 0}`;
    } else {
        // Node cumulative data
        cumulativeSection = 
            `\n\n--- CUMULATIVE DATA (${cumulativeData.updates} updates) ---` +
            `\nTotal Communications: ${cumulativeData.totalCommunications || 0}`;
    }
    
    // Add back 5xx error examples after the cumulative data if they exist
    if (five_xx_examples) {
        return originalTitle + cumulativeSection + "\n\n" + five_xx_examples;
    } else {
        return originalTitle + cumulativeSection;
    }
}

/**
 * Removes cumulative data section from a tooltip
 * 
 * @param {string} tooltipText - The tooltip text that may contain cumulative data
 * @returns {string} - Tooltip text with cumulative data removed
 */
function removeCumulativeDataFromTooltip(tooltipText) {
    if (!tooltipText) {
        return tooltipText;
    }
    
    // Extract any 5xx error examples to preserve them
    let five_xx_examples = "";
    if (tooltipText.includes("5xx Error Examples:")) {
        const parts = tooltipText.split("5xx Error Examples:");
        if (parts.length > 1) {
            // Extract 5xx examples, but only up to the cumulative data section if present
            const examplesPart = parts[1];
            five_xx_examples = "5xx Error Examples:" + 
                (examplesPart.includes("\n\n--- CUMULATIVE DATA") 
                    ? examplesPart.split("\n\n--- CUMULATIVE DATA")[0] 
                    : examplesPart);
        }
    }
    
    // Split at the cumulative data marker and return just the first part
    const baseTooltip = tooltipText.split('\n\n--- CUMULATIVE DATA')[0];
    
    // Add back the 5xx error examples if they exist
    if (five_xx_examples && !baseTooltip.includes("5xx Error Examples:")) {
        return baseTooltip + "\n\n" + five_xx_examples;
    }
    return baseTooltip;
}

/**
 * Updates edge tooltips with cumulative data
 * 
 * @param {object} edge - The edge object to update
 * @param {object} cumulativeData - The cumulative data for this edge
 */
function updateEdgeTooltip(edge, cumulativeData) {
    const originalTitle = edge.title || '';
    
    // Check for stored 5xx examples in cumulative data
    let modifiedTitle = originalTitle;
    
    // If there are 5xx errors and we have stored examples, make sure they're included
    if (cumulativeData.errorCounts && cumulativeData.errorCounts['5xx'] > 0 && 
        cumulativeData.five_xx_examples && !originalTitle.includes("5xx Error Examples:")) {
        
        // Remove any existing cumulative data first
        modifiedTitle = removeCumulativeDataFromTooltip(originalTitle);
        
        // Add the 5xx examples
        if (!modifiedTitle.includes("5xx Error Examples:")) {
            modifiedTitle += "\n" + cumulativeData.five_xx_examples;
        }
    }
    
    // Add cumulative data to the tooltip
    edge.title = addCumulativeDataToTooltip(modifiedTitle, cumulativeData, true);
}

/**
 * Updates node tooltips with cumulative data
 * 
 * @param {object} node - The node object to update
 * @param {object} cumulativeData - The cumulative data for this node
 */
function updateNodeTooltip(node, cumulativeData) {
    const originalTitle = node.title || '';
    node.title = addCumulativeDataToTooltip(originalTitle, cumulativeData, false);
} 