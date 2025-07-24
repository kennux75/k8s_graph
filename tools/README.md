# K8s Graph Code Analysis Tools

This directory contains tools for analyzing the codebase.

## Code Call Graph Analyzer

The `code_analyzer.py` script analyzes the function calls in the codebase and generates a visual representation of the call graph. It supports both static analysis (using AST) and dynamic analysis (using sys.settrace).

### New Features

- **Entry Point Highlighting**: The main entry point functions (from the root file) are highlighted with larger size and bold borders.
- **Chronological Call Order**: The sequence of function calls is now represented by edge colors (light blue → dark blue) and sequence numbers.

### Prerequisites

The script uses libraries that are already in the project's requirements.txt:
- networkx
- matplotlib
- scipy (for graph layout algorithms)

Optional dependencies for better hierarchical layouts:
- pygraphviz (requires Graphviz development libraries)
- pydot (pure Python alternative)

You can install these optional dependencies with:
```bash
pip install pygraphviz  # Requires graphviz to be installed on your system
# OR
pip install pydot       # Simpler alternative, no external dependencies
```

### Usage

#### Static Analysis

Static analysis examines the code without running it:

```bash
# Basic usage (analyze app.py and generate call_graph.png)
./code_analyzer.py

# Specify a different entry point
./code_analyzer.py --root libs/webapp/app_controller.py

# Choose a different layout algorithm
./code_analyzer.py --layout kamada_kawai

# Use hierarchical layout to show call order/flow
./code_analyzer.py --layout hierarchical

# Specify an output file
./code_analyzer.py --output my_graph.png

# Analyze all Python files in the project
./code_analyzer.py --all-files

# Generate a module-level graph (simpler visualization)
./code_analyzer.py --module-graph

# Customize the module graph output file
./code_analyzer.py --module-graph --module-output modules.png

# Show more detailed submodule connections (set depth to 2 or more)
./code_analyzer.py --module-graph --module-depth 2

# Set module depth to 3 to see even more granular connections
./code_analyzer.py --module-graph --module-depth 3

# Hierarchical layout with module depth 2 for detailed workflow visualization
./code_analyzer.py --module-graph --module-depth 2 --layout hierarchical
```

#### Dynamic Analysis

Dynamic analysis traces function calls at runtime:

```bash
# Run app.py with tracing for 60 seconds
./code_analyzer.py --dynamic

# Run with a different timeout (in seconds)
./code_analyzer.py --dynamic --timeout 30

# Run a specific file with tracing
./code_analyzer.py --dynamic --root libs/webapp/app_controller.py

# Include only specific modules in tracing
./code_analyzer.py --dynamic --include-modules libs.webapp libs.graph

# Use hierarchical layout with dynamic analysis
./code_analyzer.py --dynamic --layout hierarchical
```

### Layout Algorithms

The script supports several layout algorithms for the graph visualization:
- `spring` (default): Force-directed layout that tries to place nodes with similar connections close together
- `kamada_kawai`: Force-directed layout that tries to keep edge lengths consistent
- `circular`: Places nodes in a circle
- `shell`: Places nodes in concentric circles
- `hierarchical`: Arranges nodes in a top-to-bottom flow based on the order of calls

#### Enhanced Hierarchical Layout

The `hierarchical` layout has been significantly enhanced to provide a clear visualization of the execution flow:

- **Explicit Layer Structure**: Functions/modules are organized into distinct layers from top (callers) to bottom (callees)
- **Visual Layer Separation**: Horizontal grid lines and subtle background colors help distinguish between layers
- **Layer Labels**: Each layer is clearly labeled to show the hierarchy
- **Curved Edges**: Connections between nodes use curved lines to emphasize the top-to-bottom flow
- **Increased Vertical Spacing**: Layers are well-separated to make the hierarchical structure more apparent

This layout is particularly useful for visualizing the flow of execution and the order of calls. It arranges nodes in layers, with callers at the top and callees at the bottom. This makes it easier to understand the sequence of function calls and the overall structure of the application.

### Entry Points and Call Sequence

The tool now tracks and visualizes two important aspects of code execution:

1. **Entry Points**: 
   - Functions defined in the root file (typically app.py) are considered entry points
   - Entry points are highlighted with larger node size and black borders
   - This helps identify the starting points of your application

2. **Call Sequence**:
   - Edges are colored on a gradient from light blue (early calls) to dark blue (later calls)
   - Each edge displays a sequence number showing the order in which the function calls occur
   - This helps visualize the chronological flow of execution through your application

These features are particularly effective when combined with the hierarchical layout to show both the structural and temporal aspects of your code's execution flow.

### Filtering

You can include or exclude specific modules in the analysis:

```bash
# Include only specific modules
./code_analyzer.py --include-modules app libs config

# Exclude specific modules
./code_analyzer.py --exclude-modules venv tests
```

### Graph Types

The script can generate two types of graphs:

1. **Function-level graph** (default): Shows each function as a node, with edges representing function calls.
   
2. **Module-level graph** (`--module-graph`): Shows each module as a node, with edges representing inter-module calls. Edge weights indicate the number of calls between modules.

#### Module Depth

You can control the granularity of the module-level graph with the `--module-depth` parameter:

- `--module-depth 1` (default): Shows only top-level modules (e.g., "libs", "config")
- `--module-depth 2`: Shows submodules one level deep (e.g., "libs.webapp", "libs.graph")
- `--module-depth 3`: Shows submodules two levels deep (e.g., "libs.webapp.routes")

Higher depth values show more detailed connections between specific parts of your codebase.

### Output

The script generates:
1. A PNG image of the call graph (function-level by default)
2. A PNG image of the module-level graph (if `--module-graph` is specified)
3. Statistics on the console, including:
   - Number of functions/modules
   - Number of calls
   - Most called functions/modules
   - Functions/modules making the most calls

### Example

```bash
# Generate both function and module graphs with all project files, highlighting entry points and call order
./code_analyzer.py --all-files --module-graph --layout hierarchical

# Generate a detailed module graph showing submodule connections
./code_analyzer.py --all-files --module-graph --module-depth 2

# Generate a hierarchical graph showing execution flow
./code_analyzer.py --all-files --layout hierarchical

# Most detailed view with chronological order and entry points highlighted
./code_analyzer.py --all-files --module-graph --module-depth 3 --layout hierarchical

# Run dynamic analysis with a 120 second timeout
./code_analyzer.py --dynamic --timeout 120 --output dynamic_graph.png

# Generate a simpler module-level graph with a circular layout
./code_analyzer.py --module-graph --layout circular
```

Note: For dynamic analysis, you can press Ctrl+C at any time to stop the tracing and generate the graph immediately. 