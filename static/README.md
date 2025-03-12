# Static Assets Directory Documentation

This directory contains static assets for the Kubernetes Communications Graph Visualizer web application. These assets are served directly by the Flask application and provide the styling, client-side functionality, and visual elements for the web interface.

## Directory Structure

### /css

Contains CSS stylesheets for the application.

- **style.css**: Main stylesheet that defines the visual appearance of the application, including:
  - Layout and positioning
  - Colors and typography
  - Component styling
  - Responsive design rules
  - Animation and transition effects

### /js

Contains JavaScript files for client-side functionality.

- **main.js**: Primary JavaScript file that handles:
  - Graph visualization rendering
  - User interaction handling
  - WebSocket communication with the backend
  - Dynamic UI updates
  - Data processing and transformation

- **tooltip_manager.js**: Handles the creation and display of tooltips for graph elements:
  - Formats tooltip content
  - Positions tooltips relative to graph elements
  - Manages tooltip visibility and interactions

### /images

Contains images and icons used in the application interface.

## Integration with Templates

The static assets are referenced from the HTML templates in the `/templates` directory. The main integration points are:

1. CSS stylesheets are linked in the `<head>` section of the templates
2. JavaScript files are included at the end of the `<body>` section
3. Images are referenced in both CSS and HTML as needed

## Client-Side Architecture

The client-side code follows a modular architecture:

1. **Initialization**: Sets up the visualization environment and establishes connections
2. **Data Handling**: Processes graph data received from the backend
3. **Visualization**: Renders the graph using visualization libraries
4. **Interaction**: Handles user interactions and updates the visualization
5. **Communication**: Manages WebSocket and HTTP communication with the backend

## Customization

When modifying the static assets:

1. Maintain the core functionality required by the application
2. Test changes across different browsers and screen sizes
3. Ensure that JavaScript functions referenced in the templates are preserved
4. Follow the established naming conventions and code organization

## Dependencies

The client-side code depends on several third-party libraries that are loaded from CDNs in the templates:

- Visualization libraries for graph rendering
- jQuery for DOM manipulation
- Socket.IO client for WebSocket communication
- Other utility libraries as needed

These dependencies are referenced in the HTML templates rather than being included in the static directory. 