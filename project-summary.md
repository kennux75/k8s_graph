# Résumé du Projet - Kubernetes Communications Graph Visualizer

## Vue d'ensemble du projet

Le **Kubernetes Communications Graph Visualizer** est une application web avancée qui analyse et visualise les patterns de communication entre les namespaces dans un cluster Kubernetes. L'outil collecte les logs des pods (principalement nginx et Java), les analyse pour extraire les communications inter-services, et génère une visualisation interactive sous forme de graphe.

## Architecture actuelle

### Architecture générale
L'application suit une architecture modulaire en trois couches :

1. **Couche de collecte et parsing** (`libs/parsing/`)
   - Interaction avec l'API Kubernetes pour récupérer les pods et leurs logs
   - Parsing des logs nginx et Java pour extraire les communications
   - Support multi-contextes Kubernetes

2. **Couche de traitement et graphe** (`libs/graph/`)
   - Construction du graphe de communications avec NetworkX
   - Simplification et agrégation des données par namespace
   - Gestion des métriques et compteurs d'erreurs

3. **Couche de visualisation et web** (`libs/webapp/`, `static/`, `templates/`)
   - Interface web Flask avec Socket.IO pour les mises à jour en temps réel
   - Visualisation interactive avec vis.js, PyVis et Bokeh
   - API REST pour la configuration et les données

### Composants principaux

- **app.py** : Point d'entrée principal qui configure les loggers et lance l'application Flask
- **K8sCommunicationGraph** : Classe principale qui orchestre la collecte et l'analyse
- **Graph Manager** : Gestionnaire des données du graphe avec cache et mise à jour automatique
- **Database Manager** : Gestion de la persistance MySQL pour les métriques et erreurs
- **Tooltip Manager** : Gestion des informations détaillées affichées dans l'interface

## Technologies utilisées

### Backend
- **Python 3.9+** : Langage principal
- **Flask 2.0+** : Framework web
- **Flask-SocketIO 5.1+** : Communication temps réel WebSocket
- **NetworkX 2.5+** : Manipulation des graphes
- **MySQL Connector** : Base de données pour la persistance
- **APScheduler 3.9+** : Planification des tâches de mise à jour
- **Kubernetes Python Client** : Interaction avec l'API Kubernetes

### Frontend
- **vis.js** : Visualisation interactive des graphes (bibliothèque principale)
- **Socket.IO** : Communication temps réel avec le backend
- **JavaScript ES6+** : Logique côté client
- **CSS3** : Styling moderne et responsive

### Visualisation alternative
- **PyVis 0.3+** : Génération de visualisations HTML interactives
- **Bokeh 2.4+** : Visualisations web interactives avancées
- **Matplotlib 3.3+** : Graphiques statiques

### Outils et infrastructure
- **Docker** : Containerisation de l'application
- **kubectl** : Interface avec Kubernetes
- **eventlet** : Serveur web asynchrone

## Structure des fichiers

```
k8s_graph/
├── app.py                          # Point d'entrée principal
├── requirements.txt                # Dépendances Python
├── Dockerfile                      # Configuration Docker
├── config/                         # Configuration centralisée
│   ├── app_config.py              # Configuration Flask
│   ├── constants.py               # Constantes globales
│   ├── database.py                # Configuration MySQL
│   ├── visualization.py           # Paramètres de visualisation
│   ├── custom-rules.yaml          # Règles de parsing personnalisées
│   ├── excluded-ns.txt            # Namespaces exclus
│   └── kube-contexts.txt          # Contextes Kubernetes
├── libs/                          # Bibliothèques principales
│   ├── database/                  # Gestion base de données
│   │   └── db_manager.py         # Manager MySQL
│   ├── graph/                     # Logique des graphes
│   │   ├── communication_graph.py # Classe principale
│   │   └── graph_builder.py      # Construction des graphes
│   ├── parsing/                   # Parsing des données
│   │   ├── kubernetes.py         # API Kubernetes
│   │   └── logs.py               # Parsing des logs
│   ├── visualization/             # Visualisation
│   │   └── tooltip_manager.py    # Gestion des tooltips
│   └── webapp/                    # Application web
│       ├── app_controller.py     # Contrôleur principal
│       ├── routes.py             # Routes Flask
│       ├── socket_handlers.py    # Handlers Socket.IO
│       └── graph_manager.py      # Gestion des données
├── static/                        # Assets statiques
│   ├── css/style.css             # Styles CSS
│   └── js/                       # JavaScript
│       ├── modules/              # Modules JS modulaires
│       │   ├── main.js          # Module principal
│       │   ├── network.js       # Gestion du réseau vis.js
│       │   ├── filters.js       # Filtres et recherche
│       │   ├── animation.js     # Animations
│       │   └── physics.js       # Physique du graphe
│       └── tooltip_manager.js    # Gestion des tooltips côté client
└── templates/                     # Templates HTML
    └── index.html                # Interface principale
```

## Patterns identifiés

### Patterns architecturaux

1. **Modular Architecture** : Séparation claire des responsabilités en modules
2. **Factory Pattern** : Création d'instances de graphes et de visualisateurs
3. **Observer Pattern** : Mise à jour temps réel via Socket.IO
4. **Strategy Pattern** : Multiple stratégies de visualisation (vis.js, PyVis, Bokeh)
5. **Singleton Pattern** : Gestionnaires globaux (Database, Graph Manager)

### Patterns de code

1. **Configuration centralisée** : Tous les paramètres dans le dossier `config/`
2. **Logging standardisé** : Logger partagé entre tous les modules
3. **Gestion d'erreurs robuste** : Try-catch avec logging détaillé
4. **Threading sécurisé** : Utilisation de locks pour la concurrence
5. **API RESTful** : Endpoints clairs et cohérents

### Patterns de données

1. **Agrégation par namespace** : Simplification des communications
2. **Cache en mémoire** : Stockage temporaire des données de graphe
3. **Persistance sélective** : Seules les métriques importantes en BDD
4. **Données cumulatives** : Accumulation des statistiques dans le temps

### Patterns UX/UI

1. **Interface temps réel** : Mises à jour automatiques sans rechargement
2. **Contrôles interactifs** : Sliders, boutons, filtres dynamiques
3. **Feedback visuel** : Indicateurs de statut et timers
4. **Responsive design** : Interface adaptative

## Points remarquables

- **Multi-contextes Kubernetes** : Support de plusieurs clusters simultanément
- **Parsing intelligent** : Reconnaissance automatique des formats de logs
- **Visualisation hybride** : Combinaison de plusieurs bibliothèques selon le besoin
- **Performance optimisée** : Multithreading pour la collecte des logs
- **Extensibilité** : Architecture modulaire permettant l'ajout facile de nouvelles fonctionnalités 