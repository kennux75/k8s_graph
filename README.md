# Kubernetes Communications Graph Visualizer

This tool visualizes the communication patterns between namespaces in a Kubernetes cluster based on nginx logs analysis. It creates an interactive graph showing the connections and provides metrics about HTTP status codes and request volumes.

## Features

- **Interactive Graph Visualization**: Shows nodes representing namespaces and connections between them
- **Real-time Updates**: Automatically refreshes data at configurable intervals
- **Filtering**: Filter by namespace to focus on specific areas
- **Physics Simulation**: Interactive graph with physics controls for better visualization
- **Error Tracking**: View HTTP status code statistics for connections
- **Multithreaded Processing**: Parallel log collection and parsing for improved performance
- **Customizable**: Adjust refresh rates, physics parameters, and threading settings to suit your needs

## Architecture Overview

The codebase est désormais organisé autour des principes suivants :

1. **Logging centralisé** : un utilitaire unique `libs/common/logging_utils.py` configure le logger racine ; les modules récupèrent leur logger via `get_logger(__name__)`.
2. **Couche d’accès Kubernetes** : toutes les interactions `kubectl` passent par le wrapper `libs/parsing/kube_client.py` (singleton par `(context, kubeconfig)`), ce qui facilite les tests et évite la création répétée de sous-processus.
3. **Couche Repository pour MySQL** : la logique SQL brute est isolée dans `libs/database/repositories.py`. `DatabaseManager` délègue aux repositories, ce qui réduit la duplication et prépare l’introduction d’un ORM ou d’un pool de connexions.
4. **WebApp** : la partie Flask/SocketIO vit dans `libs/webapp/` ; la logique de graph visuel dans `libs/graph/`.
5. **Front-end** : les sources JS se trouvent dans `static/js/modules/`. Les fichiers de sauvegarde ont été retirés ; un futur bundler (esbuild/Vite) pourra regrouper ces modules.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/kubernetes-communications-graph.git
   cd kubernetes-communications-graph
   ```

2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Web Application

Run the web application with:

```bash
python app.py
```

This will start the web server on port 6200. Open your browser and navigate to:

```
http://localhost:6200
```

The web application includes the following features:

- **Control Panel**: Tools to manage the graph visualization
- **Refresh Button**: Manually trigger a data update
- **Physics Controls**: Toggle and adjust the physics simulation
- **Namespace Filters**: Show/hide specific namespaces
- **Update Interval**: Configure how often the graph automatically refreshes

### Command Line Tool

You can also use the command-line version for one-time graph generation:

```bash
python graph_k8s_new.py [options]
```

Options:
- `-d, --debug`: Debug level (0=minimal, 1=info, 2=debug)
- `-o, --output`: Output file path
- `--static`: Generate a static image instead of interactive HTML
- `--viz`: Visualization library to use (bokeh or pyvis)
- `--no-logs`: Skip log extraction and use simplified communication patterns
- `--context`: Specify the kube-context to use

## Requirements

- Python 3.6+
- Kubernetes cluster with kubectl configured
- nginx logs with proper formatting
- Dependencies listed in requirements.txt

## Customization

You can customize the appearance and behavior of the graph by modifying:

- `static/css/style.css`: Styling of the web interface
- `static/js/main.js`: Client-side behavior and graph options
- `app.py`: Server-side logic and data processing

## Troubleshooting

- Ensure your kubectl is properly configured to access your cluster
- Check that your nginx logs are properly formatted
- If the graph doesn't appear, check the browser console for errors

## License

[MIT License](LICENSE)

## Features

- Analyze web pod logs in each namespace
- Interactive visualization of communications between namespaces as a graph
- Grouping services by namespace for simplified visualization
- A single edge per communication direction between namespaces
- Visual distinction between different namespaces (colors)
- Numeric annotations on edges indicating the exact number of calls measured
- Highly interactive visualization with PyVis (node movement, zoom, hover)
- Option to use Bokeh as an alternative for interactive visualization
- Detailed logging for debugging

## Prerequisites

- Python 3.6 or newer
- Access to a Kubernetes cluster with a working **kubectl** configuration
- Sufficient permissions to read pod logs in the target namespaces

## Configuration

### Excluding namespaces

```
kube-system
default
calico-system
calico-apiserver
cert-manager
```

You can modify this file to add or remove namespaces to exclude.

## Project Structure

The project is organized into the following directories:

- `config/`: Contains configuration files and constants
  - `constants.py`: Global constants used throughout the application
  - `excluded-ns.txt`: List of namespaces to exclude from analysis
  - `log_format_nginx.txt`: Example format of nginx logs
  - `log_format_java.txt`: Example format of Java logs

- `libs/`: Contains the main library code
  - `logging.py`: Logging setup and configuration
  - `parsing/`: Modules for parsing logs and Kubernetes resources
    - `logs.py`: Functions for parsing and extracting logs
    - `kubernetes.py`: Functions for interacting with Kubernetes API
  - `graph/`: Modules for building and manipulating graphs
    - `communication_graph.py`: Main class for building the communication graph
    - `graph_builder.py`: Helper functions for graph construction
  - `visualization/`: Modules for visualizing the graph
    - `pyvis_viz.py`: PyVis-based interactive visualization
    - `bokeh_viz.py`: Bokeh-based interactive visualization
    - `matplotlib_viz.py`: Matplotlib-based static visualization

- `static/`: Contains static assets for the web interface
  - `js/`: JavaScript files
  - `css/`: CSS stylesheets

- `outputs/`: Default directory for generated visualizations

## Usage

Ensure kubectl is configured to access your Kubernetes cluster, then run:

```bash
python graph_k8s_new.py
```

### Command Line Options

The script accepts the following options:

- `-d`, `--debug`: Debug level (0=minimal, 1=info, 2=debug). Default: 1
- `-o`, `--output`: Output file path. Default: k8s_communications_graph.html
- `--static`: Generate a static image (.png) instead of an interactive HTML visualization
- `--viz`: Visualization library to use ('pyvis' or 'bokeh'). Default: pyvis

Examples:

```bash
# Run with detailed debug level
python graph_k8s_new.py --debug 2

# Generate a static visualization
python graph_k8s_new.py --static

# Use Bokeh instead of PyVis for visualization
python graph_k8s_new.py --viz bokeh

# Specify a custom output file
python graph_k8s_new.py --output mon_graphe.html
```

### Debug Information

The script generates debug information in two places:

1. In the console (standard output)
2. In a file `graph_k8s.log`

Debug levels are:

- **0 (minimal)**: Shows only errors and warnings
- **1 (info)**: Also shows general process information (default)
- **2 (debug)**: Shows detailed debug information

## Interactive Visualization

### PyVis (default)

The default visualization uses PyVis and offers a very interactive experience:

- **Advanced Zoom**: Mouse wheel to zoom in/out with smooth animation
- **Graph Movement**: Click and drag to move the entire graph
- **Node Movement**: Click and drag a node to reposition it
- **Node Hover**: Shows the list of services grouped in the namespace
- **Edge Hover**: Shows the exact number of communications detected
- **Dynamic Physics**: Nodes react realistically to movements
- **Multi-selection**: Select multiple nodes at once
- **Control Tools**: Buttons to adjust the visualization

### Bokeh (alternative)

The visualization with Bokeh (enabled with `--viz bokeh`) offers a different perspective:

- **Zoom and Movement**: Dedicated tools for navigating the graph
- **Hover Info**: Detailed information about namespaces and connections
- **Initial Static Layout**: Nodes maintain their initial position

## Simplified Graph

The script now creates a simplified graph with the following characteristics:

- **Single node per namespace**: All services in the same namespace are grouped
- **Single edge per direction**: Multiple communications between the same namespaces are consolidated
- **Node Size Proportional**: The larger the namespace, the larger its node
- **Edge Thickness Significant**: Proportional to the number of communications
- **Precise Numeric Labels**: The exact number of communications is displayed on each edge

## Script Operation

The script will:
1. Connect to the Kubernetes cluster
2. Retrieve the list of namespaces (excluding exclusions)
3. For each namespace, find a web pod and extract its logs
4. Analyze logs to detect communications between services
5. Create a detailed communication graph between services
6. Simplify the graph by grouping by namespace
7. Generate an interactive visualization with PyVis (or Bokeh)
8. Save the graph as an interactive HTML file (or PNG if option --static)

## Graph Interpretation

- **Nodes**: Each node represents a namespace or "external" for external services
- **Edges**: Arrows represent the direction of communications between namespaces
- **Numbers on edges**: Total number of communications detected between these namespaces
- **Node Size**: Proportional to the number of services in the namespace
- **Node Tooltips**: List the individual services grouped in the namespace

## Limitations

- The analysis is limited to 100 lines of logs per pod
- Only one "web" pod is analyzed per namespace
- Logs must be in the JSON format defined in `log_format_nginx.txt`

## Troubleshooting

If you encounter issues:

1. Ensure your kubectl configuration is correct
2. Ensure you have sufficient permissions to read pod logs
3. Ensure logs are in the expected JSON format
4. Use the `--debug 2` option to get detailed execution information
5. Check the `graph_k8s.log` file to see full logging messages
6. Ensure all dependencies are installed (`pip install -r requirements.txt`)

## Performance Optimization

This tool uses multithreading to significantly improve log collection and parsing performance, especially for clusters with many namespaces.

For details on the multithreading implementation and tuning options, see [Multithreading Documentation](docs/multithreading.md). 

## Database Setup

The application uses MariaDB to store node error counts. To set up the database:

1. Install MariaDB if not already installed:
   ```bash
   # On macOS with Homebrew
   brew install mariadb
   
   # On Ubuntu/Debian
   sudo apt-get install mariadb-server
   ```

2. Start the MariaDB service:
   ```bash
   # On macOS
   brew services start mariadb
   
   # On Ubuntu/Debian
   sudo systemctl start mariadb
   ```

3. Configure the database connection:
   - Edit `config/database.py` to set your database credentials:
     ```python
     DB_CONFIG = {
         'host': 'localhost',
         'user': 'your_username',
         'password': 'your_password',
         'database': 'k8s_graph'
     }
     ```

4. The database and tables will be automatically created when you first run the application.