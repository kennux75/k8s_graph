#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Code Call Graph Analyzer

This script analyzes the call graph of a Python codebase starting from a specific file.
It supports both static analysis using AST and dynamic analysis using sys.settrace.
"""

import os
import sys
import ast
import importlib.util
import networkx as nx
import matplotlib.pyplot as plt
from pathlib import Path
import argparse
from typing import Dict, List, Set, Tuple
import inspect
import time
import glob

# Add the parent directory to sys.path to allow imports from the codebase
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

# Try to import pygraphviz (for hierarchical layout)
try:
    import pygraphviz
    HAVE_PYGRAPHVIZ = True
except ImportError:
    HAVE_PYGRAPHVIZ = False

# Try to import pydot (alternative for hierarchical layout)
try:
    import pydot
    HAVE_PYDOT = True
except ImportError:
    HAVE_PYDOT = False


class FunctionCallVisitor(ast.NodeVisitor):
    """AST visitor to find function calls in Python code."""
    
    def __init__(self, current_module: str, current_function: str = None):
        self.current_module = current_module
        self.current_function = current_function
        self.calls = set()  # Store as (caller, callee) tuples
        self.current_functions_stack = []  # Stack to keep track of nested function definitions
        self.imports = {}  # Store module imports as {alias: module_name}
        self.from_imports = {}  # Store from imports as {name: module.name}
        self.defined_functions = set()  # Keep track of functions defined in this module
    
    def visit_FunctionDef(self, node):
        """Visit a function definition."""
        prev_function = self.current_function
        function_name = f"{self.current_module}.{node.name}"
        self.current_function = function_name
        self.current_functions_stack.append(function_name)
        self.defined_functions.add(node.name)
        
        # Visit all nodes in the function body
        for child in node.body:
            self.visit(child)
            
        self.current_functions_stack.pop()
        self.current_function = prev_function
    
    def visit_Call(self, node):
        """Visit a function call."""
        if self.current_function:
            callee = None
            
            # Check if it's a direct attribute access (e.g., module.function())
            if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                module_alias = node.func.value.id
                function_name = node.func.attr
                
                if module_alias in self.imports:
                    callee = f"{self.imports[module_alias]}.{function_name}"
                else:
                    callee = f"{module_alias}.{function_name}"
            
            # Check if it's a direct function call (e.g., function())
            elif isinstance(node.func, ast.Name):
                function_name = node.func.id
                
                if function_name in self.from_imports:
                    callee = self.from_imports[function_name]
                elif function_name in self.defined_functions:
                    callee = f"{self.current_module}.{function_name}"
                else:
                    # Assume it's a function in the current module or a built-in
                    callee = f"{self.current_module}.{function_name}"
            
            if callee:
                self.calls.add((self.current_function, callee))
        
        # Continue visiting children
        self.generic_visit(node)
    
    def visit_Import(self, node):
        """Visit an import statement."""
        for alias in node.names:
            if alias.asname:
                self.imports[alias.asname] = alias.name
            else:
                self.imports[alias.name] = alias.name
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node):
        """Visit a from-import statement."""
        module = node.module or ""
        for alias in node.names:
            if alias.asname:
                self.from_imports[alias.asname] = f"{module}.{alias.name}"
            else:
                self.from_imports[alias.name] = f"{module}.{alias.name}"
        self.generic_visit(node)


class CodeCallGraphAnalyzer:
    """Analyzes the call graph of a Python codebase."""
    
    def __init__(self, root_file: str, include_dirs: List[str] = None):
        self.root_file = os.path.abspath(root_file)
        self.root_dir = os.path.dirname(self.root_file)
        self.include_dirs = include_dirs or [self.root_dir]
        self.processed_files = set()
        self.call_graph = nx.DiGraph()
        self.module_map = {}  # Maps file paths to module names
        self.entry_points = set()  # Track entry point functions
        self.call_order = {}  # Track call order (edge -> sequence number)
        self.call_sequence = 0  # Counter for call sequence
        
        # Automatically add all Python files in the project
        self.python_files = set()
        for include_dir in self.include_dirs:
            for py_file in glob.glob(f"{include_dir}/**/*.py", recursive=True):
                # Skip files in venv directory
                if 'venv/' not in py_file:
                    self.python_files.add(os.path.abspath(py_file))
    
    def _get_module_name(self, file_path: str) -> str:
        """Get the module name for a file."""
        if file_path in self.module_map:
            return self.module_map[file_path]
        
        rel_path = os.path.relpath(file_path, self.root_dir)
        # Handle "__init__.py" specially
        if os.path.basename(file_path) == "__init__.py":
            dir_path = os.path.dirname(rel_path)
            module_name = dir_path.replace(os.path.sep, '.')
        else:
            # Convert path to module name (e.g., libs/webapp/routes.py -> libs.webapp.routes)
            module_name = os.path.splitext(rel_path)[0].replace(os.path.sep, '.')
        
        self.module_map[file_path] = module_name
        return module_name
    
    def _find_file(self, module_name: str) -> str:
        """Find a file corresponding to a module name."""
        # Convert module name to path (e.g., libs.webapp.routes -> libs/webapp/routes.py)
        module_path = module_name.replace('.', os.path.sep)
        
        for include_dir in self.include_dirs:
            # Try direct matching
            file_path = os.path.join(include_dir, f"{module_path}.py")
            if os.path.exists(file_path):
                return os.path.abspath(file_path)
            
            # Try as a directory with __init__.py
            init_path = os.path.join(include_dir, module_path, "__init__.py")
            if os.path.exists(init_path):
                return os.path.abspath(init_path)
        
        # Try to find the module using the python_files set
        for py_file in self.python_files:
            if self._get_module_name(py_file).startswith(module_name):
                return py_file
        
        # If we couldn't find the file, return None
        return None
    
    def _parse_file(self, file_path: str) -> Set[Tuple[str, str]]:
        """Parse a file and extract function calls."""
        if file_path in self.processed_files:
            return set()
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source = f.read()
            
            module_name = self._get_module_name(file_path)
            tree = ast.parse(source, filename=file_path)
            visitor = FunctionCallVisitor(module_name)
            visitor.visit(tree)
            
            self.processed_files.add(file_path)
            return visitor.calls
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return set()
    
    def analyze(self):
        """Analyze the call graph starting from the root file."""
        to_process = [self.root_file]
        
        while to_process:
            file_path = to_process.pop(0)
            
            if file_path not in self.python_files or file_path in self.processed_files:
                continue
            
            try:
                calls = self._parse_file(file_path)
                
                # Mark entry points from the root file
                if file_path == self.root_file:
                    for caller, _ in calls:
                        self.entry_points.add(caller)
                
                for caller, callee in calls:
                    # Add the caller and callee to the call graph
                    if caller and callee:
                        # Track call sequence
                        edge = (caller, callee)
                        if edge not in self.call_order:
                            self.call_sequence += 1
                            self.call_order[edge] = self.call_sequence
                        
                        # Add edge to graph
                        self.call_graph.add_edge(caller, callee, 
                                                 sequence=self.call_order[edge])
                    
                    # Check if we need to process the callee module
                    callee_parts = callee.split('.')
                    if len(callee_parts) > 1:
                        callee_module = callee_parts[0]
                        callee_file = self._find_file(callee_module)
                        
                        if callee_file and callee_file not in self.processed_files:
                            to_process.append(callee_file)
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
        
        # Add a second pass for imported modules that might have been missed
        for file_path in self.python_files:
            if file_path not in self.processed_files:
                try:
                    self._parse_file(file_path)
                except Exception as e:
                    print(f"Error in second pass for {file_path}: {e}")
    
    def analyze_all_files(self):
        """Analyze all Python files in the project."""
        # First, process the root file to identify entry points
        if self.root_file in self.python_files:
            try:
                calls = self._parse_file(self.root_file)
                for caller, _ in calls:
                    self.entry_points.add(caller)
                    
                for caller, callee in calls:
                    if caller and callee:
                        # Track call sequence
                        edge = (caller, callee)
                        if edge not in self.call_order:
                            self.call_sequence += 1
                            self.call_order[edge] = self.call_sequence
                        
                        # Add edge to graph
                        self.call_graph.add_edge(caller, callee, 
                                                 sequence=self.call_order[edge])
            except Exception as e:
                print(f"Error processing root file {self.root_file}: {e}")
        
        # Then process all other files
        for file_path in sorted(self.python_files):
            if file_path == self.root_file or file_path in self.processed_files:
                continue
                
            try:
                calls = self._parse_file(file_path)
                
                for caller, callee in calls:
                    # Add the caller and callee to the call graph
                    if caller and callee:
                        # Track call sequence
                        edge = (caller, callee)
                        if edge not in self.call_order:
                            self.call_sequence += 1
                            self.call_order[edge] = self.call_sequence
                        
                        # Add edge to graph
                        self.call_graph.add_edge(caller, callee, 
                                                 sequence=self.call_order[edge])
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
    
    def filter_graph(self, include_modules=None, exclude_modules=None):
        """Filter the call graph to include only specific modules."""
        if not include_modules and not exclude_modules:
            return
            
        nodes_to_remove = []
        for node in self.call_graph.nodes():
            parts = node.split('.')
            if len(parts) > 0:
                module = parts[0]
                
                # Check if the node should be excluded
                if exclude_modules and any(module.startswith(exc) for exc in exclude_modules):
                    nodes_to_remove.append(node)
                    continue
                
                # Check if the node should be included
                if include_modules and not any(module.startswith(inc) for inc in include_modules):
                    nodes_to_remove.append(node)
        
        # Remove the filtered nodes
        for node in nodes_to_remove:
            self.call_graph.remove_node(node)
    
    def _create_explicit_hierarchical_layout(self, graph):
        """Create an explicit hierarchical layout by organizing nodes in layers based on their position in the call chain."""
        print("Using custom explicit hierarchical layout")
        
        # Identify root nodes (nodes with no incoming edges or entry points)
        roots = [n for n, d in graph.in_degree() if d == 0]
        
        # Ensure the entry points are included as roots
        if self.entry_points:
            roots.extend(self.entry_points)
            roots = list(set(roots))  # Remove duplicates
        
        if not roots:
            # If no roots, use nodes with highest out-degree as roots
            out_degrees = dict(graph.out_degree())
            if out_degrees:
                max_out = max(out_degrees.values())
                roots = [n for n, d in out_degrees.items() if d == max_out]
            else:
                # Fallback: use any node
                roots = list(graph.nodes())[:1]
        
        print(f"Root nodes for explicit hierarchical layout: {roots}")
        
        # Compute node layers using BFS from roots
        layers = {}
        visited = set()
        
        # Initialize layer 0 with roots
        current_layer = 0
        current_nodes = roots
        
        while current_nodes:
            # Assign current nodes to the current layer
            for node in current_nodes:
                if node not in visited:
                    layers[node] = current_layer
                    visited.add(node)
            
            # Get next layer nodes (successors of current layer nodes)
            next_nodes = []
            for node in current_nodes:
                for successor in graph.successors(node):
                    if successor not in visited:
                        next_nodes.append(successor)
            
            # Move to next layer
            current_layer += 1
            current_nodes = next_nodes
        
        # Handle any remaining nodes (not reachable from roots)
        remaining_nodes = set(graph.nodes()) - visited
        if remaining_nodes:
            print(f"Placing {len(remaining_nodes)} unreachable nodes in additional layers")
            for node in remaining_nodes:
                # Try to place based on predecessors if any
                pred_layers = [layers.get(p, -1) for p in graph.predecessors(node)]
                if pred_layers and max(pred_layers) >= 0:
                    layers[node] = max(pred_layers) + 1
                else:
                    # Otherwise, place in a new layer at the bottom
                    layers[node] = current_layer
                    current_layer += 1
        
        # Consolidate layers to reduce the total number (aim for max 10 layers)
        if current_layer > 10:
            print(f"Consolidating {current_layer} layers into fewer layers for better visualization")
            # Map original layers to consolidated layers
            layer_mapping = {}
            consolidated_layer_count = min(10, current_layer // 2)
            for original_layer in range(current_layer):
                # Map original layer to consolidated layer
                consolidated_layer = original_layer * consolidated_layer_count // current_layer
                layer_mapping[original_layer] = consolidated_layer
            
            # Update node layers
            for node in layers:
                layers[node] = layer_mapping[layers[node]]
        
        # Count nodes in each layer
        layer_counts = {}
        for node, layer in layers.items():
            layer_counts[layer] = layer_counts.get(layer, 0) + 1
        
        # Position nodes in a grid: each layer is a row, nodes are spaced evenly in each row
        pos = {}
        for node, layer in layers.items():
            # Get all nodes in this layer
            layer_nodes = [n for n, l in layers.items() if l == layer]
            
            # Sort nodes within layer by out-degree to place important nodes more centrally
            layer_nodes.sort(key=lambda n: graph.out_degree(n), reverse=True)
            
            # Get position within layer
            layer_pos = layer_nodes.index(node)
            layer_count = len(layer_nodes)
            
            # Calculate x position: evenly spaced across the width
            if layer_count > 1:
                # Center nodes with higher out-degree
                center_offset = abs(layer_pos - layer_count // 2) / layer_count
                x = 0.5 + (layer_pos - layer_count // 2) / layer_count * (1 - center_offset * 0.5)
            else:
                x = 0.5
            
            # Y position is based on layer (inverted so layer 0 is at the top)
            # Multiply by 2 to increase vertical separation between layers
            y = -layer * 2
            
            pos[node] = (x, y)
        
        print(f"Created explicit hierarchical layout with {len(set(layers.values()))} layers")
        return pos

    def generate_graph_image(self, output_file, layout_type='spring', k=None, iterations=None):
        """Generate an image of the call graph."""
        if not self.call_graph.nodes():
            print("Error: No functions to visualize in the call graph.")
            return

        # Use a taller figure for hierarchical layout
        if layout_type == 'hierarchical':
            plt.figure(figsize=(14, 10))
        else:
            plt.figure(figsize=(12, 8))
        
        print(f"DEBUG: Using layout type: {layout_type}")
        print(f"DEBUG: Graph has {self.call_graph.number_of_nodes()} nodes and {self.call_graph.number_of_edges()} edges")
        
        # Check for cycles in the graph
        try:
            cycles = list(nx.simple_cycles(self.call_graph))
            if cycles:
                print(f"DEBUG: Graph contains {len(cycles)} cycles. This may affect hierarchical layout.")
                print(f"DEBUG: First few cycles: {cycles[:3]}")
        except Exception as e:
            print(f"DEBUG: Error checking for cycles: {e}")
        
        if layout_type == 'hierarchical':
            try:
                # Try using our explicit hierarchical layout first
                pos = self._create_explicit_hierarchical_layout(self.call_graph)
                print("Using explicit hierarchical layout")
            except Exception as e:
                print(f"Error with explicit hierarchical layout: {e}")
                try:
                    # Fall back to pydot
                    import pydot
                    print("Falling back to pydot for hierarchical layout")
                    
                    # Convert to a pydot graph
                    P = nx.nx_pydot.to_pydot(self.call_graph)
                    P.set_rankdir('TB')  # Top to Bottom layout
                    
                    # Set more options for better hierarchical layout
                    P.set_nodesep('0.5')  # Increase horizontal spacing between nodes
                    P.set_ranksep('1.0')  # Increase vertical spacing between ranks
                    
                    # Add constraints to enforce hierarchical layout
                    for u, v in self.call_graph.edges():
                        edge = pydot.Edge(u, v, constraint='true')
                        P.add_edge(edge)
                    
                    print(f"DEBUG: Set rankdir to TB for top-to-bottom layout")
                    print(f"DEBUG: Set nodesep=0.5 and ranksep=1.0 for better spacing")
                    print(f"DEBUG: Added constraints to enforce hierarchical layout")
                    
                    # Convert back to networkx
                    G = nx.nx_pydot.from_pydot(P)
                    print("Graphviz 'dot' layout applied successfully")
                    
                    # Get positions from the pydot layout
                    pos = nx.nx_pydot.graphviz_layout(self.call_graph, prog='dot')
                    
                    # Scale the y-coordinates to increase vertical separation
                    for node in pos:
                        x, y = pos[node]
                        pos[node] = (x, y * 1.5)  # Multiply y by 1.5 to increase vertical separation
                    
                    print(f"DEBUG: Scaled y-coordinates by 1.5 to enhance hierarchical appearance")
                except ImportError:
                    try:
                        # Fallback to pygraphviz
                        pos = nx.nx_agraph.graphviz_layout(self.call_graph, prog='dot')
                        print("Graphviz 'dot' layout applied successfully")
                    except ImportError:
                        print("Warning: Neither pydot nor pygraphviz is installed.")
                        print("Falling back to spring layout for hierarchical visualization.")
                        pos = nx.spring_layout(self.call_graph, k=k or 0.3, iterations=iterations or 50)
        elif layout_type == 'spring':
            pos = nx.spring_layout(self.call_graph, k=k or 0.3, iterations=iterations or 50)
        elif layout_type == 'kamada_kawai':
            try:
                pos = nx.kamada_kawai_layout(self.call_graph)
            except ImportError:
                print("Warning: scipy not installed, falling back to spring layout.")
                pos = nx.spring_layout(self.call_graph, k=k or 0.3, iterations=iterations or 50)
        elif layout_type == 'circular':
            pos = nx.circular_layout(self.call_graph)
        elif layout_type == 'shell':
            pos = nx.shell_layout(self.call_graph)
        else:
            print(f"Warning: Unknown layout type '{layout_type}'. Using spring layout.")
            pos = nx.spring_layout(self.call_graph, k=k or 0.3, iterations=iterations or 50)

        # Calculate node sizes based on call count (in-degree)
        node_sizes = []
        node_border_width = []
        node_colors = []
        
        for node in self.call_graph.nodes():
            # Base size on in-degree (number of times called)
            in_degree = self.call_graph.in_degree(node)
            base_size = max(300, 100 + in_degree * 100)
            
            # If this is an entry point, make it larger and with a bold border
            if node in self.entry_points:
                node_sizes.append(base_size * 1.5)  # Larger size for entry points
                node_border_width.append(2.0)  # Bold border for entry points
                node_colors.append('#ff9999')  # Light red for entry points
            else:
                node_sizes.append(base_size)
                node_border_width.append(0.5)  # Thin border for regular nodes
                node_colors.append('#66b3ff')  # Light blue for regular nodes

        # For hierarchical layout, add visual cues to emphasize the structure
        if layout_type == 'hierarchical':
            # Find the unique y-coordinates (layers)
            y_coords = sorted(set(y for x, y in pos.values()))
            
            # Draw horizontal lines to separate layers
            for y in y_coords:
                plt.axhline(y=y, color='gray', linestyle='--', alpha=0.3)
                
            # Add layer labels
            for i, y in enumerate(y_coords):
                plt.text(-0.05, y, f"Layer {i}", fontsize=7, 
                         verticalalignment='center', horizontalalignment='right')
                
            # Add a gradient background for each layer
            for i in range(len(y_coords) - 1):
                y_top = y_coords[i]
                y_bottom = y_coords[i+1]
                plt.axhspan(y_top, y_bottom, facecolor=f'C{i % 9}', alpha=0.05)

        # Draw nodes
        nx.draw_networkx_nodes(
            self.call_graph,
            pos,
            node_size=node_sizes,
            node_color=node_colors,
            edgecolors='black',  # Fixed the error by setting a single color for all edges
            linewidths=node_border_width
        )

        # Create a colormap for edges based on call sequence
        edge_colors = []
        max_sequence = max(self.call_order.values()) if self.call_order else 0
        
        # Draw edges
        for u, v, d in self.call_graph.edges(data=True):
            # Get call sequence number
            sequence_num = self.call_order.get((u, v), 0)
            
            # Normalize the sequence number to a value between 0 and 1 for color mapping
            if max_sequence > 0:
                color_intensity = sequence_num / max_sequence
            else:
                color_intensity = 0
                
            # Create color: from light blue (early calls) to dark blue (later calls)
            color = (0.5 - color_intensity * 0.5, 0.5 - color_intensity * 0.3, 0.9)
            edge_colors.append(color)
            
            # Draw edge with different style for hierarchical layout
            if layout_type == 'hierarchical':
                # Use curved edges for hierarchical layout to emphasize flow
                nx.draw_networkx_edges(
                    self.call_graph,
                    pos,
                    edgelist=[(u, v)],
                    width=1.0,
                    edge_color=[color],
                    arrows=True,
                    arrowsize=10,
                    alpha=0.7,
                    connectionstyle='arc3,rad=0.1'  # Curved edges
                )
            else:
                # Regular edges for other layouts
                nx.draw_networkx_edges(
                    self.call_graph,
                    pos,
                    edgelist=[(u, v)],
                    width=1.0,
                    edge_color=[color],
                    arrows=True,
                    arrowsize=10,
                    alpha=0.7
                )
            
            # Add sequence number as edge label if available
            if sequence_num > 0:
                edge_labels = {(u, v): str(sequence_num)}
                nx.draw_networkx_edge_labels(
                    self.call_graph,
                    pos,
                    edge_labels=edge_labels,
                    font_size=6,  # Reduced font size
                    font_color='black',
                    font_family='sans-serif',
                    bbox=dict(facecolor='white', edgecolor='none', alpha=0.7, pad=0.3)
                )

        # Draw node labels with smaller font size for better readability
        # Extract function name from full path for cleaner labels
        node_labels = {}
        for node in self.call_graph.nodes():
            # Get just the function name (last part after the dot)
            parts = node.split('.')
            if len(parts) > 1:
                # For non-entry points, just show the function name
                if node not in self.entry_points:
                    node_labels[node] = parts[-1]
                else:
                    # For entry points, show module.function
                    if len(parts) > 2:
                        node_labels[node] = f"{parts[-2]}.{parts[-1]}"
                    else:
                        node_labels[node] = node
            else:
                node_labels[node] = node
        
        nx.draw_networkx_labels(
            self.call_graph,
            pos,
            labels=node_labels,
            font_size=6,  # Reduced font size
            font_family='sans-serif',
            font_weight='bold'
        )

        # Add a legend to explain graph elements
        entry_point = plt.Line2D([0], [0], marker='o', color='#ff9999', markersize=15, markeredgecolor='black', markeredgewidth=2, linestyle='None')
        regular_func = plt.Line2D([0], [0], marker='o', color='#66b3ff', markersize=10, markeredgecolor='black', markeredgewidth=0.5, linestyle='None')
        early_call = plt.Line2D([0], [0], color=(0.5, 0.5, 0.9), linewidth=1)
        later_call = plt.Line2D([0], [0], color=(0, 0.2, 0.9), linewidth=1)
        
        plt.legend(
            handles=[entry_point, regular_func, early_call, later_call],
            labels=['Entry Point Function', 'Regular Function', 'Early Calls', 'Later Calls'],
            loc='best',
            fontsize=7  # Reduced font size
        )

        # Add title with layout information
        if layout_type == 'hierarchical':
            plt.title("Function Call Graph - Hierarchical Layout (Top to Bottom Flow)", fontsize=12, fontweight='bold')
            # Add subtitle explaining the layout
            plt.figtext(0.5, 0.01, "Functions are arranged in layers from top (callers) to bottom (callees)", 
                      ha='center', fontsize=8, style='italic')
        else:
            plt.title("Function Call Graph", fontsize=12)
            
        plt.axis('off')
        
        # Add grid lines for hierarchical layout to make levels more apparent
        if layout_type == 'hierarchical':
            plt.grid(True, linestyle='--', alpha=0.3)
            
        plt.tight_layout()
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"Call graph image saved to {output_file}")
    
    def print_statistics(self):
        """Print statistics about the call graph."""
        print("\nCall Graph Statistics:")
        print(f"Number of functions: {self.call_graph.number_of_nodes()}")
        print(f"Number of calls: {self.call_graph.number_of_edges()}")
        
        if self.call_graph.number_of_nodes() == 0:
            return
            
        # Find the most called functions
        most_called = sorted([(n, self.call_graph.in_degree(n)) for n in self.call_graph.nodes()], 
                             key=lambda x: x[1], reverse=True)
        
        print("\nMost called functions:")
        for func, count in most_called[:10]:
            print(f"  {func}: {count} calls")
        
        # Find the functions that make the most calls
        most_callers = sorted([(n, self.call_graph.out_degree(n)) for n in self.call_graph.nodes()], 
                              key=lambda x: x[1], reverse=True)
        
        print("\nFunctions making the most calls:")
        for func, count in most_callers[:10]:
            print(f"  {func}: {count} calls")
    
    def create_module_graph(self, module_depth=1):
        """Create a simplified graph where nodes are modules instead of functions.
        
        Args:
            module_depth: The depth of module names to use (1 for top-level only, 
                          2 for one level of submodules, etc.)
        """
        module_graph = nx.DiGraph()
        
        # Identify entry point modules
        entry_point_modules = set()
        for entry_point in self.entry_points:
            parts = entry_point.split('.')
            module_name = '.'.join(parts[:min(module_depth, len(parts))])
            entry_point_modules.add(module_name)
        
        # Collect all edges between modules
        module_edges = set()
        edge_sequences = {}  # Track earliest sequence number for each module edge
        
        for caller, callee in self.call_graph.edges():
            # Extract module names with the specified depth
            caller_parts = caller.split('.')
            callee_parts = callee.split('.')
            
            # Get module name with the specified depth
            caller_module = '.'.join(caller_parts[:min(module_depth, len(caller_parts))])
            callee_module = '.'.join(callee_parts[:min(module_depth, len(callee_parts))])
            
            if caller_module != callee_module:
                module_edges.add((caller_module, callee_module))
                
                # Track earliest sequence number for this module edge
                edge_seq = self.call_order.get((caller, callee), float('inf'))
                current_seq = edge_sequences.get((caller_module, callee_module), float('inf'))
                edge_sequences[(caller_module, callee_module)] = min(edge_seq, current_seq)
        
        # Add edges to the module graph
        for caller_module, callee_module in module_edges:
            if not module_graph.has_edge(caller_module, callee_module):
                # Count the number of function calls between these modules
                call_count = sum(1 for c, cc in self.call_graph.edges() 
                                if '.'.join(c.split('.')[:min(module_depth, len(c.split('.')))]) == caller_module 
                                and '.'.join(cc.split('.')[:min(module_depth, len(cc.split('.')))]) == callee_module)
                
                # Get the sequence number
                sequence = edge_sequences.get((caller_module, callee_module), 0)
                
                module_graph.add_edge(caller_module, callee_module, 
                                     weight=call_count, 
                                     sequence=sequence)
        
        # Add entry point attributes to nodes
        for node in module_graph.nodes():
            module_graph.nodes[node]['is_entry_point'] = node in entry_point_modules
        
        return module_graph, entry_point_modules
    
    def generate_module_graph_image(self, output_file, layout_type='spring', k=None, iterations=None, module_depth=1):
        """Generate an image of the module-level call graph."""
        if len(self.call_graph.nodes()) == 0:
            print("No function calls found. The graph is empty.")
            return

        # Build a module-level graph from the function-level graph
        module_graph = nx.DiGraph()
        edge_weights = {}
        edge_sequences = {}  # Track sequence numbers for module edges
        
        for caller, callee in self.call_graph.edges():
            # Determine module names based on depth
            caller_parts = caller.split('.')
            callee_parts = callee.split('.')
            
            # Extract module name based on depth
            caller_module = '.'.join(caller_parts[:min(module_depth, len(caller_parts))])
            callee_module = '.'.join(callee_parts[:min(module_depth, len(callee_parts))])
            
            # Skip self-loops at the module level
            if caller_module == callee_module:
                continue
            
            # Add the edge if not already present, or update weight
            if module_graph.has_edge(caller_module, callee_module):
                module_graph[caller_module][callee_module]['weight'] += 1
            else:
                module_graph.add_edge(caller_module, callee_module, weight=1)
                
            # Track earliest sequence number for this module edge
            edge_seq = self.call_order.get((caller, callee), float('inf'))
            current_seq = edge_sequences.get((caller_module, callee_module), float('inf'))
            edge_sequences[(caller_module, callee_module)] = min(edge_seq, current_seq)
        
        if len(module_graph.nodes()) == 0:
            print("No module-level calls found. The graph is empty.")
            return
            
        # Use a taller figure for hierarchical layout
        if layout_type == 'hierarchical':
            plt.figure(figsize=(14, 10))
        else:
            plt.figure(figsize=(12, 8))
        
        print(f"DEBUG MODULE: Using layout type: {layout_type}")
        print(f"DEBUG MODULE: Graph has {module_graph.number_of_nodes()} nodes and {module_graph.number_of_edges()} edges")
        
        # Check for cycles in the module graph
        try:
            cycles = list(nx.simple_cycles(module_graph))
            if cycles:
                print(f"DEBUG MODULE: Graph contains {len(cycles)} cycles. This may affect hierarchical layout.")
                print(f"DEBUG MODULE: First few cycles: {cycles[:3]}")
        except Exception as e:
            print(f"DEBUG MODULE: Error checking for cycles: {e}")
        
        # Track if the root file's module is in the graph
        root_module = 'app' if module_depth == 1 else None
        entry_modules = set()
        
        # Identify entry point modules (modules containing entry point functions)
        for entry_point in self.entry_points:
            entry_parts = entry_point.split('.')
            entry_module = '.'.join(entry_parts[:min(module_depth, len(entry_parts))])
            entry_modules.add(entry_module)
            if not root_module and 'app' in entry_module:
                root_module = entry_module
        
        # Get positions based on layout algorithm
        if layout_type == 'hierarchical':
            try:
                # Try using our explicit hierarchical layout first
                pos = self._create_explicit_hierarchical_layout(module_graph)
                print("Using explicit hierarchical layout for module graph")
            except Exception as e:
                print(f"Error with explicit hierarchical layout for module graph: {e}")
                try:
                    # Fall back to pydot
                    import pydot
                    print("Falling back to pydot for hierarchical layout in module graph")
                    
                    # Convert to a pydot graph
                    P = nx.nx_pydot.to_pydot(module_graph)
                    P.set_rankdir('TB')  # Top to Bottom layout
                    
                    # Set more options for better hierarchical layout
                    P.set_nodesep('0.5')  # Increase horizontal spacing between nodes
                    P.set_ranksep('1.0')  # Increase vertical spacing between ranks
                    
                    # Add constraints to enforce hierarchical layout
                    for u, v in module_graph.edges():
                        edge = pydot.Edge(u, v, constraint='true')
                        P.add_edge(edge)
                    
                    print(f"DEBUG MODULE: Set rankdir to TB for top-to-bottom layout")
                    print(f"DEBUG MODULE: Set nodesep=0.5 and ranksep=1.0 for better spacing")
                    print(f"DEBUG MODULE: Added constraints to enforce hierarchical layout")
                    
                    # Convert back to networkx
                    G = nx.nx_pydot.from_pydot(P)
                    print("Graphviz 'dot' layout applied successfully to module graph")
                    
                    # Get positions from the pydot layout
                    pos = nx.nx_pydot.graphviz_layout(module_graph, prog='dot')
                    
                    # Scale the y-coordinates to increase vertical separation
                    for node in pos:
                        x, y = pos[node]
                        pos[node] = (x, y * 1.5)  # Multiply y by 1.5 to increase vertical separation
                    
                    print(f"DEBUG MODULE: Scaled y-coordinates by 1.5 to enhance hierarchical appearance")
                except ImportError:
                    try:
                        # Fallback to pygraphviz
                        pos = nx.nx_agraph.graphviz_layout(module_graph, prog='dot')
                        print("Graphviz 'dot' layout applied successfully to module graph")
                    except ImportError:
                        print("Warning: Neither pydot nor pygraphviz is installed.")
                        print("Falling back to spring layout for hierarchical visualization.")
                        pos = nx.spring_layout(module_graph, k=k or 0.3, iterations=iterations or 50)
        elif layout_type == 'spring':
            pos = nx.spring_layout(module_graph, k=k or 0.3, iterations=iterations or 50)
        elif layout_type == 'kamada_kawai':
            try:
                pos = nx.kamada_kawai_layout(module_graph)
            except ImportError:
                print("Warning: scipy not installed, falling back to spring layout.")
                pos = nx.spring_layout(module_graph, k=k or 0.3, iterations=iterations or 50)
        elif layout_type == 'circular':
            pos = nx.circular_layout(module_graph)
        elif layout_type == 'shell':
            pos = nx.shell_layout(module_graph)
        else:
            print(f"Warning: Unknown layout type '{layout_type}'. Using spring layout.")
            pos = nx.spring_layout(module_graph, k=k or 0.3, iterations=iterations or 50)
            
        # Calculate node sizes based on node degree
        node_sizes = []
        node_colors = []
        node_border_width = []
        
        for node in module_graph.nodes():
            # Base size on total degree (in + out)
            degree = module_graph.degree(node)
            base_size = max(500, 300 + degree * 100)
            
            # Highlight entry modules
            if node in entry_modules:
                node_sizes.append(base_size * 1.5)  # Larger size for entry modules
                node_border_width.append(2.0)  # Bold border for entry modules
                node_colors.append('#ff9999')  # Light red for entry modules
            else:
                node_sizes.append(base_size)
                node_border_width.append(0.5)  # Normal border for regular modules
                node_colors.append('#66b3ff')  # Light blue for regular modules
        
        # For hierarchical layout, add visual cues to emphasize the structure
        if layout_type == 'hierarchical':
            # Find the unique y-coordinates (layers)
            y_coords = sorted(set(y for x, y in pos.values()))
            
            # Draw horizontal lines to separate layers
            for y in y_coords:
                plt.axhline(y=y, color='gray', linestyle='--', alpha=0.3)
                
            # Add layer labels
            for i, y in enumerate(y_coords):
                plt.text(-0.05, y, f"Layer {i}", fontsize=7, 
                         verticalalignment='center', horizontalalignment='right')
                
            # Add a gradient background for each layer
            for i in range(len(y_coords) - 1):
                y_top = y_coords[i]
                y_bottom = y_coords[i+1]
                plt.axhspan(y_top, y_bottom, facecolor=f'C{i % 9}', alpha=0.05)
        
        # Draw nodes
        nx.draw_networkx_nodes(
            module_graph,
            pos,
            node_size=node_sizes,
            node_color=node_colors,
            edgecolors='black',  # Fixed color for all edges
            linewidths=node_border_width
        )
        
        # Draw edges with colors based on call sequence
        for u, v, d in module_graph.edges(data=True):
            # Get sequence number for this module edge
            sequence_num = edge_sequences.get((u, v), 0)
            max_sequence = max(edge_sequences.values()) if edge_sequences else 0
            
            # Determine edge color based on sequence (normalize)
            if max_sequence > 0 and max_sequence != float('inf'):
                color_intensity = sequence_num / max_sequence if sequence_num != float('inf') else 0
            else:
                color_intensity = 0
                
            # Create color: from light blue (early calls) to dark blue (later calls)
            color = (0.5 - color_intensity * 0.5, 0.5 - color_intensity * 0.3, 0.9)
            
            # Edge width based on weight
            width = 0.5 + d['weight'] * 0.5  # Scale the width based on the number of calls
            
            # Draw edge with different style for hierarchical layout
            if layout_type == 'hierarchical':
                # Use curved edges for hierarchical layout to emphasize flow
                nx.draw_networkx_edges(
                    module_graph,
                    pos,
                    edgelist=[(u, v)],
                    width=width,
                    edge_color=[color],
                    arrows=True,
                    arrowsize=10,
                    alpha=0.7,
                    connectionstyle='arc3,rad=0.1'  # Curved edges
                )
            else:
                # Regular edges for other layouts
                nx.draw_networkx_edges(
                    module_graph,
                    pos,
                    edgelist=[(u, v)],
                    width=width,
                    edge_color=[color],
                    arrows=True,
                    arrowsize=10,
                    alpha=0.7
                )
            
            # Add edge label with weight and sequence if available
            if sequence_num != float('inf'):
                label = f"{d['weight']}c, #{sequence_num}"
            else:
                label = f"{d['weight']}c"
                
            edge_labels = {(u, v): label}
            nx.draw_networkx_edge_labels(
                module_graph,
                pos,
                edge_labels=edge_labels,
                font_size=7  # Reduced font size
            )
        
        # Draw labels with smaller font size
        nx.draw_networkx_labels(
            module_graph,
            pos,
            font_size=7,  # Reduced font size
            font_weight='bold'
        )
        
        # Add a legend to explain graph elements
        entry_module = plt.Line2D([0], [0], marker='o', color='#ff9999', markersize=15, markeredgecolor='black', markeredgewidth=2, linestyle='None')
        regular_module = plt.Line2D([0], [0], marker='o', color='#66b3ff', markersize=10, markeredgecolor='black', markeredgewidth=0.5, linestyle='None')
        early_call = plt.Line2D([0], [0], color=(0.5, 0.5, 0.9), linewidth=1)
        later_call = plt.Line2D([0], [0], color=(0, 0.2, 0.9), linewidth=1)
        
        plt.legend(
            handles=[entry_module, regular_module, early_call, later_call],
            labels=['Entry Point Module', 'Regular Module', 'Early Calls', 'Later Calls'],
            loc='best',
            fontsize=7  # Reduced font size
        )
        
        # Add title with layout information
        if layout_type == 'hierarchical':
            plt.title(f"Module Call Graph - Hierarchical Layout (Depth: {module_depth})", fontsize=12, fontweight='bold')
            # Add subtitle explaining the layout
            plt.figtext(0.5, 0.01, "Modules are arranged in layers from top (callers) to bottom (callees)", 
                      ha='center', fontsize=8, style='italic')
        else:
            plt.title(f"Module Call Graph (Depth: {module_depth})", fontsize=12)
            
        plt.axis('off')
        
        # Add grid lines for hierarchical layout to make levels more apparent
        if layout_type == 'hierarchical':
            plt.grid(True, linestyle='--', alpha=0.3)
            
        plt.tight_layout()
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Module-level graph image saved to {output_file}")


class DynamicCallTracer:
    """Traces function calls at runtime using sys.settrace."""
    
    def __init__(self, include_modules=None, exclude_modules=None):
        self.call_graph = nx.DiGraph()
        self.include_modules = include_modules or []
        self.exclude_modules = exclude_modules or ['matplotlib', 'numpy', 'networkx', 'logging', 'flask', 'socketio',
                                                 'werkzeug', 'jinja2', 'itsdangerous', 'click', '_']
        self.call_stack = []
        self.original_trace_function = None
    
    def _should_trace_module(self, module_name):
        """Check if a module should be traced."""
        # Exclude modules in the exclude list
        for exclude in self.exclude_modules:
            if module_name.startswith(exclude):
                return False
        
        # Include only modules in the include list, if specified
        if self.include_modules:
            for include in self.include_modules:
                if module_name.startswith(include):
                    return True
            return False
        
        return True
    
    def _trace_calls(self, frame, event, arg):
        """Trace function calls."""
        if event != 'call':
            return self._trace_calls
        
        # Get caller and callee information
        code = frame.f_code
        func_name = code.co_name
        filename = os.path.basename(code.co_filename)
        module_name = inspect.getmodule(frame).__name__ if inspect.getmodule(frame) else 'unknown'
        
        # Skip __init__ calls (these are usually just initialization, not interesting)
        if func_name == '__init__':
            return self._trace_calls
        
        # Skip if the module is not in the include list or is in the exclude list
        if not self._should_trace_module(module_name):
            return self._trace_calls
        
        # Create a unique name for the function
        callee = f"{module_name}.{func_name}"
        
        # Add the caller-callee relationship to the call graph
        if self.call_stack:
            caller = self.call_stack[-1]
            self.call_graph.add_edge(caller, callee)
        
        # Push the current function onto the call stack
        self.call_stack.append(callee)
        
        # Return the trace function to continue tracing
        return self._trace_exit
    
    def _trace_exit(self, frame, event, arg):
        """Handle function return."""
        if event == 'return' and self.call_stack:
            self.call_stack.pop()
        return self._trace_calls
    
    def start_tracing(self):
        """Start tracing function calls."""
        self.original_trace_function = sys.gettrace()
        sys.settrace(self._trace_calls)
        print("Dynamic tracing started...")
    
    def stop_tracing(self):
        """Stop tracing function calls."""
        sys.settrace(self.original_trace_function)
        print("Dynamic tracing stopped.")
    
    def generate_graph_image(self, output_file='dynamic_call_graph.png', layout='spring'):
        """Generate an image of the dynamic call graph."""
        plt.figure(figsize=(20, 16))
        
        # Select the layout algorithm
        if layout == 'spring':
            pos = nx.spring_layout(self.call_graph, k=0.6, iterations=50)
        elif layout == 'kamada_kawai':
            pos = nx.kamada_kawai_layout(self.call_graph)
        elif layout == 'circular':
            pos = nx.circular_layout(self.call_graph)
        else:
            pos = nx.shell_layout(self.call_graph)
        
        # Group nodes by module for coloring
        module_colors = {}
        color_map = plt.cm.tab20(range(20))  # Use a colormap with 20 distinct colors
        color_idx = 0
        
        for node in self.call_graph.nodes():
            module = node.split('.')[0]
            if module not in module_colors:
                module_colors[module] = color_map[color_idx % 20]
                color_idx += 1
        
        node_colors = [module_colors[node.split('.')[0]] for node in self.call_graph.nodes()]
        
        # Draw the graph
        nx.draw(
            self.call_graph,
            pos,
            with_labels=True,
            node_color=node_colors,
            node_size=1500,
            font_size=8,
            font_weight='bold',
            edge_color='gray',
            arrows=True,
            arrowsize=15,
            connectionstyle='arc3,rad=0.1'
        )
        
        # Add a legend for module colors
        plt.legend(
            handles=[plt.Line2D([0], [0], marker='o', color='w', markerfacecolor=color, markersize=10, label=module) 
                     for module, color in module_colors.items()],
            loc='upper right',
            fontsize=8
        )
        
        plt.tight_layout()
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Dynamic call graph image saved to {output_file}")
    
    def print_statistics(self):
        """Print statistics about the dynamic call graph."""
        print("\nDynamic Call Graph Statistics:")
        print(f"Number of functions: {self.call_graph.number_of_nodes()}")
        print(f"Number of calls: {self.call_graph.number_of_edges()}")
        
        # Find the most called functions
        most_called = sorted([(n, self.call_graph.in_degree(n)) for n in self.call_graph.nodes()], 
                             key=lambda x: x[1], reverse=True)
        
        print("\nMost called functions:")
        for func, count in most_called[:10]:
            print(f"  {func}: {count} calls")
        
        # Find the functions that make the most calls
        most_callers = sorted([(n, self.call_graph.out_degree(n)) for n in self.call_graph.nodes()], 
                             key=lambda x: x[1], reverse=True)
        
        print("\nFunctions making the most calls:")
        for func, count in most_callers[:10]:
            print(f"  {func}: {count} calls")


def run_with_dynamic_tracing(script_path, include_modules=None, output_file='dynamic_call_graph.png',
                            layout='spring', timeout=60):
    """Run a script with dynamic tracing."""
    # Import the script as a module
    spec = importlib.util.spec_from_file_location("target_module", script_path)
    target_module = importlib.util.module_from_spec(spec)
    
    # Create a tracer
    tracer = DynamicCallTracer(include_modules=include_modules)
    
    # Start tracing
    tracer.start_tracing()
    
    try:
        # Execute the script
        print(f"Executing {script_path} with dynamic tracing...")
        print(f"Timeout set to {timeout} seconds. Press Ctrl+C to stop earlier.")
        
        # Set the original sys.argv to the script path
        orig_argv = sys.argv
        sys.argv = [script_path]
        
        # Load the module (this will execute the script)
        spec.loader.exec_module(target_module)
        
        # If the script doesn't exit by itself, wait for the timeout
        start_time = time.time()
        try:
            while time.time() - start_time < timeout:
                time.sleep(1)
                # Print a dot every second to show progress
                print(".", end="", flush=True)
        except KeyboardInterrupt:
            print("\nTracing stopped by user.")
        
    except Exception as e:
        print(f"Error during dynamic tracing: {e}")
    finally:
        # Restore original argv
        sys.argv = orig_argv
        
        # Stop tracing
        tracer.stop_tracing()
        
        # Print statistics and generate the graph image
        tracer.print_statistics()
        tracer.generate_graph_image(output_file, layout)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Analyze Python code call graph')
    parser.add_argument('--root', default='app.py', help='Root file to start analysis from')
    parser.add_argument('--output', default='call_graph.png', help='Output image file')
    parser.add_argument('--layout', default='spring', 
                        choices=['spring', 'kamada_kawai', 'circular', 'shell', 'hierarchical'],
                        help='Layout algorithm for the graph')
    parser.add_argument('--dynamic', action='store_true', help='Use dynamic analysis instead of static analysis')
    parser.add_argument('--timeout', type=int, default=60, help='Timeout for dynamic analysis in seconds')
    parser.add_argument('--include-modules', nargs='+', 
                        default=['app', 'libs', 'config'], 
                        help='Modules to include in analysis')
    parser.add_argument('--exclude-modules', nargs='+',
                        default=['venv', 'numpy', 'pandas', 'matplotlib', 'networkx', 'scipy'],
                        help='Modules to exclude from analysis')
    parser.add_argument('--all-files', action='store_true', help='Analyze all Python files in the project')
    parser.add_argument('--k', type=float, default=0.3, help='Spring layout k parameter (node distance)')
    parser.add_argument('--iterations', type=int, default=50, help='Spring layout iterations')
    parser.add_argument('--module-graph', action='store_true', help='Generate a module-level graph')
    parser.add_argument('--module-output', default='module_graph.png', help='Output file for module graph')
    parser.add_argument('--module-depth', type=int, default=1, 
                        help='Depth of module names to use in module graph (1=top-level only, 2=submodules, etc.)')
    
    args = parser.parse_args()
    
    # Show a message if hierarchical layout is selected but dependencies are missing
    if args.layout == 'hierarchical' and not (HAVE_PYGRAPHVIZ or HAVE_PYDOT):
        print("Note: For optimal hierarchical layout, install pygraphviz or pydot:")
        print("  pip install pygraphviz  # Requires graphviz development libraries")
        print("  pip install pydot       # Pure Python alternative")
        print("Falling back to custom hierarchical layout algorithm.")
    
    if args.dynamic:
        # Use dynamic analysis
        run_with_dynamic_tracing(
            args.root,
            include_modules=args.include_modules,
            output_file=args.output,
            layout=args.layout,
            timeout=args.timeout
        )
    else:
        # Use static analysis
        analyzer = CodeCallGraphAnalyzer(args.root)
        
        print(f"Analyzing call graph starting from {args.root}...")
        if args.all_files:
            analyzer.analyze_all_files()
        else:
            analyzer.analyze()
        
        # Filter the graph to include only the application's modules
        analyzer.filter_graph(include_modules=args.include_modules, exclude_modules=args.exclude_modules)
        
        # Print statistics and generate function-level graph
        analyzer.print_statistics()
        analyzer.generate_graph_image(args.output, args.layout, args.k, args.iterations)
        
        # Generate module-level graph if requested
        if args.module_graph:
            analyzer.generate_module_graph_image(
                args.module_output, 
                args.layout,
                args.k,
                args.iterations,
                args.module_depth
            )


if __name__ == '__main__':
    main() 