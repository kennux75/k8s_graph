// K8s Communications Graph Visualizer - Animation Module

import { animation, network, config, dom } from './state.js';
import { initAnimationDots } from './network.js';

// Toggle animation on/off
export function toggleAnimation() {
    animation.enabled = !animation.enabled;
    
    if (animation.enabled) {
        // Initialize animation and start
        initAnimationDots();
        
        // Remove any existing animation event handlers
        network.instance.off("afterDrawing");
        
        // Add the animation event handler
        network.instance.on("afterDrawing", drawAnimationDots);
        
        if (!animation.requestId) {
            animation.requestId = requestAnimationFrame(animateStep);
        }
        
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Animation enabled";
        }
        dom.toggleAnimationBtn.classList.add('active');
    } else {
        // Stop animation
        if (animation.requestId) {
            cancelAnimationFrame(animation.requestId);
            animation.requestId = null;
        }
        
        // Remove the animation event handler
        network.instance.off("afterDrawing");
        
        // Redraw the network without animation
        network.instance.redraw();
        
        if (dom.statusDiv) {
            dom.statusDiv.innerHTML = "Animation disabled";
        }
        dom.toggleAnimationBtn.classList.remove('active');
    }
}

// Animation step function to update dot positions
export function animateStep() {
    if (!network.instance || !animation.enabled) {
        // Stop animation if disabled
        if (animation.requestId) {
            cancelAnimationFrame(animation.requestId);
            animation.requestId = null;
        }
        return;
    }
    
    // Update positions of animation dots
    for (let i = animation.dots.length - 1; i >= 0; i--) {
        const dot = animation.dots[i];
        
        // Check if the edge or its connecting nodes have been hidden since the last update
        const edge = network.edges.get(dot.edge.id);
        const fromNode = network.nodes.get(dot.fromNodeId);
        const toNode = network.nodes.get(dot.toNodeId);
        
        if (!edge || edge.hidden || !fromNode || fromNode.hidden || !toNode || toNode.hidden) {
            // Remove this dot as its edge or nodes are now hidden
            animation.dots.splice(i, 1);
            continue;
        }
        
        // Update dot position
        dot.progress += dot.speed;
        if (dot.progress > 1) {
            dot.progress = 0; // Reset to start of edge
        }
    }
    
    // Force redraw of network to trigger the afterDrawing event
    network.instance.redraw();
    
    // Request next animation frame
    animation.requestId = requestAnimationFrame(animateStep);
}

// Draw animation dots on the network canvas
export function drawAnimationDots(ctx) {
    // Draw each animation dot
    animation.dots.forEach(dot => {
        // Get positions of the nodes
        const fromNodePos = network.instance.getPositions([dot.fromNodeId])[dot.fromNodeId];
        const toNodePos = network.instance.getPositions([dot.toNodeId])[dot.toNodeId];
        
        if (!fromNodePos || !toNodePos) return;
        
        // Calculate position along the edge
        const pos = {
            x: fromNodePos.x + dot.progress * (toNodePos.x - fromNodePos.x),
            y: fromNodePos.y + dot.progress * (toNodePos.y - fromNodePos.y)
        };
        
        // Get the center position of the from node
        const fromNode = network.nodes.get(dot.fromNodeId);
        const toNode = network.nodes.get(dot.toNodeId);
        
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
        ctx.drawImage(animation.image, -12, -12, 24, 24); // Adjust size to 24x24 pixels
        
        // Restore the context to its original state
        ctx.restore();
    });
} 