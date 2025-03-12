# Templates Directory Documentation

This directory contains HTML templates for the Kubernetes Communications Graph Visualizer web application. These templates are rendered by the Flask backend and serve as the foundation for the web interface.

## Files

### index.html

The main (and currently only) template file for the application. It serves as the entry point for the web interface and contains:

- HTML structure for the application
- Links to CSS stylesheets
- Script tags for JavaScript libraries and application code
- Base layout and containers for dynamic content
- Elements for user controls and interaction
- Container for the graph visualization

## Template Structure

The template follows a structured approach:

1. **Head section**:
   - Meta tags for responsive design
   - Title and favicon
   - CSS stylesheet links
   - References to third-party libraries

2. **Body section**:
   - Navigation and header elements
   - Control panels for application settings
   - Container for the graph visualization
   - UI elements for filtering and search
   - Status indicators for backend operations

3. **Script section**:
   - JavaScript libraries (jQuery, Socket.IO, visualization libraries)
   - Application-specific JavaScript for graph rendering
   - Event handlers for user interactions
   - WebSocket initialization and event binding

## Integration with Backend

The template integrates with the Flask backend through:

1. **Jinja2 Template Variables**:
   - Dynamic content inserted by the Flask application
   - Configuration settings passed from the backend
   - Initial data for graph visualization

2. **API Endpoints**:
   - JavaScript code that interacts with backend API routes
   - AJAX calls to retrieve updated graph data
   - Form submissions for configuration changes

3. **WebSocket Communication**:
   - Real-time updates for graph visualization
   - Event-based communication with the backend

## Customization

If you need to modify the template:

1. Ensure that you maintain the core structure required by the visualization library
2. Keep the DOM element IDs consistent with the JavaScript code that references them
3. Preserve WebSocket initialization and event bindings
4. Maintain responsive design elements for different screen sizes

## Relationship with Static Assets

The template references static assets from the `/static` directory:
- CSS stylesheets for styling
- JavaScript files for client-side functionality
- Images and icons for the user interface

Ensure that references to these assets are maintained when modifying the template. 