# Web Application Module Documentation

The webapp module contains the Flask web application components that serve the interactive visualization interface. This module bridges the backend graph processing with the frontend visualization.

## Files

### app_controller.py

The main controller for initializing and running the Flask application.

#### Key Functions:

- `create_app()`: Creates and configures the Flask application
- `init_app(app, socketio, logger_instance)`: Initializes the application with routes and handlers
- `run_app(app, socketio)`: Runs the Flask application with SocketIO
- `reschedule_update_job(interval)`: Reschedules the background job that updates the graph

This file also manages the background scheduler that periodically updates the graph data.

### graph_manager.py

Manages the graph data and updates for the web interface.

#### Key Functions:

- `build_graph_data()`: Builds the graph data for visualization
- `get_graph_data()`: Returns the current graph data
- `get_simplified_graph_data()`: Returns the simplified graph data
- `update_graph_data(graph_data)`: Updates the graph data
- `get_exclusion_list()`: Gets the list of excluded namespaces
- `update_exclusion_list(exclusions)`: Updates the exclusion list

This file acts as an interface between the graph processing backend and the web frontend, preparing data in the format expected by the visualization library.

### routes.py

Defines the HTTP routes for the web application.

#### Key Routes:

- `/`: Main application page
- `/data`: Returns the current graph data as JSON
- `/simplified`: Returns the simplified graph data as JSON
- `/exclusions`: Manages the namespace exclusion list
- `/update_interval`: Updates the graph refresh interval

This file handles HTTP requests and serves both HTML pages and JSON data.

### socket_handlers.py

Handles WebSocket connections for real-time updates.

#### Key Events:

- `connect`: Handles client connection
- `disconnect`: Handles client disconnection
- `request_update`: Handles requests for graph updates
- `update_exclusions`: Handles updates to the exclusion list
- `update_interval`: Handles updates to the refresh interval

This file provides real-time communication between the client and server.

### app_utils.py

Utility functions for the web application.

#### Key Functions:

- `read_file(filepath)`: Safely reads a file
- `write_file(filepath, content)`: Safely writes to a file
- `format_graph_data(graph_data)`: Formats graph data for visualization
- `sanitize_input(input_data)`: Sanitizes user input

This file provides common utility functions used across the webapp module.

## Application Flow

1. The `app_controller.py` initializes the Flask application and sets up scheduled tasks
2. The `routes.py` defines endpoints that clients can access
3. The `socket_handlers.py` establishes WebSocket connections for real-time updates
4. The `graph_manager.py` manages the graph data and provides it to the routes and socket handlers

## Technologies Used

- **Flask**: Web framework
- **Flask-SocketIO**: WebSocket integration
- **APScheduler**: Background job scheduling
- **JSON**: Data interchange format

## Integration with Frontend

The webapp module serves:
1. HTML templates from the `/templates` directory
2. Static assets (CSS, JavaScript) from the `/static` directory
3. JSON data through HTTP endpoints and WebSocket events

The frontend uses JavaScript to render the graph visualization using the data provided by these endpoints.

## Configuration

The webapp behavior can be configured through the `config/app_config.py` file, which includes settings for:
- Update intervals
- Server host and port
- Debug mode
- Security settings 