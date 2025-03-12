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

## Fonctionnalités

- Analyse des logs des pods web dans chaque namespace
- Visualisation interactive des communications entre namespaces sous forme de graphe
- Regroupement des services par namespace pour une visualisation simplifiée
- Une seule arête par direction de communication entre namespaces
- Distinction visuelle entre les différents namespaces (couleurs)
- Annotations numériques sur les arêtes indiquant le nombre exact d'appels mesurés
- Visualisation hautement interactive avec PyVis (déplacement des nœuds, zoom, survol)
- Option d'utilisation de Bokeh comme alternative pour la visualisation interactive
- Journalisation détaillée pour le débogage

## Prérequis

- Python 3.6+
- Accès à un cluster Kubernetes (configuration kubectl fonctionnelle)
- Permissions suffisantes pour lire les logs des pods dans les namespaces cibles

## Configuration

### Exclusion de namespaces

Les namespaces à exclure de l'analyse sont définis dans le fichier `excluded-ns.txt`, un par ligne. Par défaut, les namespaces suivants sont exclus:

```
kube-system
default
calico-system
calico-apiserver
cert-manager
```

Vous pouvez modifier ce fichier pour ajouter ou supprimer des namespaces à exclure.

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

## Utilisation

Assurez-vous que kubectl est configuré pour accéder à votre cluster Kubernetes, puis exécutez:

```bash
python graph_k8s_new.py
```

### Options de ligne de commande

Le script accepte les options suivantes:

- `-d`, `--debug`: Niveau de débogage (0=minimal, 1=info, 2=debug). Par défaut: 1
- `-o`, `--output`: Chemin du fichier de sortie. Par défaut: k8s_communications_graph.html
- `--static`: Générer une image statique (.png) au lieu d'une visualisation interactive (.html)
- `--viz`: Bibliothèque de visualisation à utiliser ('pyvis' ou 'bokeh'). Par défaut: pyvis

Exemples:

```bash
# Exécuter avec un niveau de débogage détaillé
python graph_k8s_new.py --debug 2

# Générer une visualisation statique
python graph_k8s_new.py --static

# Utiliser Bokeh au lieu de PyVis pour la visualisation
python graph_k8s_new.py --viz bokeh

# Spécifier un fichier de sortie personnalisé
python graph_k8s_new.py --output mon_graphe.html
```

### Informations de débogage

Le script génère des informations de débogage à deux endroits:

1. Dans la console (sortie standard)
2. Dans un fichier `graph_k8s.log`

Les niveaux de débogage sont:

- **0 (minimal)**: Affiche uniquement les erreurs et avertissements
- **1 (info)**: Affiche également les informations générales sur le processus (par défaut)
- **2 (debug)**: Affiche des informations détaillées pour le débogage

## Visualisation interactive

### PyVis (par défaut)

La visualisation par défaut utilise PyVis et offre une expérience très interactive:

- **Zoom avancé**: Molette de la souris pour agrandir/réduire le graphe avec animation fluide
- **Déplacement du graphe**: Cliquez et faites glisser pour déplacer l'ensemble du graphe
- **Déplacement des nœuds**: Cliquez et faites glisser un nœud pour le repositionner
- **Survol des nœuds**: Affiche la liste des services regroupés dans le namespace
- **Survol des arêtes**: Montre le nombre exact de communications détectées
- **Physique dynamique**: Les nœuds réagissent aux déplacements de manière réaliste
- **Multi-sélection**: Sélectionnez plusieurs nœuds à la fois
- **Outils de contrôle**: Boutons pour ajuster la visualisation

### Bokeh (alternative)

La visualisation avec Bokeh (activée avec `--viz bokeh`) offre une autre perspective:

- **Zoom et déplacement**: Outils dédiés pour naviguer dans le graphe
- **Infobulle au survol**: Informations détaillées sur les namespaces et connections
- **Disposition statique initiale**: Les nœuds conservent leur position initiale

## Simplification du graphe

Le script crée désormais un graphe simplifié avec les caractéristiques suivantes:

- **Un seul nœud par namespace**: Tous les services d'un même namespace sont regroupés
- **Une seule arête par direction**: Les communications multiples entre mêmes namespaces sont consolidées
- **Taille des nœuds proportionnelle**: Plus un namespace contient de services, plus son nœud est grand
- **Épaisseur des arêtes significative**: Proportionnelle au nombre de communications
- **Étiquettes numériques précises**: Le nombre exact de communications est affiché sur chaque arête

## Fonctionnement du script

Le script va:
1. Se connecter au cluster Kubernetes
2. Récupérer la liste des namespaces (hors exclusions)
3. Pour chaque namespace, trouver un pod web et extraire ses logs
4. Analyser les logs pour détecter les communications entre services
5. Créer un graphe détaillé des communications entre services
6. Simplifier le graphe en regroupant par namespace
7. Générer une visualisation interactive avec PyVis (ou Bokeh)
8. Sauvegarder le graphique sous forme de fichier HTML interactif (ou PNG si option --static)

## Interprétation du graphique

- **Nœuds**: Chaque nœud représente un namespace ou "external" pour les services extérieurs
- **Arêtes**: Les flèches représentent la direction des communications entre namespaces
- **Chiffres sur les arêtes**: Nombre total de communications détectées entre ces namespaces
- **Taille des nœuds**: Proportionnelle au nombre de services dans le namespace
- **Infobulle des nœuds**: Liste les services individuels regroupés dans le namespace

## Limitations

- L'analyse est limitée à 100 lignes de logs par pod
- Un seul pod "web" est analysé par namespace
- Les logs doivent être au format JSON défini dans `log_format_nginx.txt`

## Dépannage

Si vous rencontrez des problèmes:

1. Vérifiez que votre configuration kubectl fonctionne correctement
2. Assurez-vous d'avoir les permissions nécessaires pour lire les logs des pods
3. Vérifiez que les logs sont bien au format JSON attendu
4. Utilisez l'option `--debug 2` pour obtenir des informations détaillées sur l'exécution
5. Consultez le fichier `graph_k8s.log` pour voir les messages de journalisation complets
6. Assurez-vous que toutes les dépendances sont installées (`pip install -r requirements.txt`)

## Performance Optimization

This tool uses multithreading to significantly improve log collection and parsing performance, especially for clusters with many namespaces.

For details on the multithreading implementation and tuning options, see [Multithreading Documentation](docs/multithreading.md). 