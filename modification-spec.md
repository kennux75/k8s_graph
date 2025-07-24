# Spécification des Modifications - Optimisation et Amélioration des Fonctionnalités

## Vue d'ensemble

Cette spécification décrit les modifications nécessaires pour résoudre les problèmes de filtrage des communications et ajouter des fonctionnalités avancées d'analyse des nœuds dans le visualisateur de communications Kubernetes.

## Problèmes identifiés

### 1. Problème principal : Communications manquantes lors du filtrage
- **Symptôme** : Quand un utilisateur sélectionne/filtre des nœuds via la recherche, les communications (arêtes) vers des nœuds cachés disparaissent
- **Cause racine** : Le système actuel filtre les arêtes en supprimant celles qui connectent des nœuds cachés
- **Impact** : Impossibilité d'analyser complètement les communications d'un nœud spécifique

### 2. Manque de fonctionnalités d'analyse avancées
- Pas de regroupement de nœuds par ensembles logiques
- Pas de sauvegarde de recherches/filtres
- Analyse limitée des patterns de communication

## Modifications proposées

### 1. Nouveau mode de filtrage : "Focus Mode"

**Objectif** : Permettre l'analyse complète d'un ou plusieurs nœuds avec toutes leurs communications.

**Fonctionnalités** :
- Mode "Focus" qui affiche un nœud sélectionné + tous ses voisins directs
- Visualisation des nœuds externes (cachés normalement) avec un style différent
- Conservation de toutes les arêtes entrantes/sortantes du nœud focalisé

**Implémentation** :
- Nouveau bouton "Focus Mode" dans l'interface
- Logique de filtrage adaptée qui distingue les nœuds "focus" des nœuds "context"
- Styles visuels différenciés (nœuds externes en gris, plus petits)

### 2. Système de groupes de nœuds

**Objectif** : Permettre la création, sauvegarde et réutilisation de groupes logiques de nœuds.

**Fonctionnalités** :
- Interface de création de groupes avec nom personnalisé
- Sauvegarde locale (localStorage) des groupes créés
- Sélection rapide d'un groupe depuis une liste déroulante
- Gestion des groupes (créer, modifier, supprimer, renommer)

**Implémentation** :
- Nouveau panneau "Node Groups" dans l'interface
- Structure de données pour stocker les groupes
- API pour la persistance des groupes
- Interface de gestion des groupes

### 3. Analyse de nœuds avancée

**Objectif** : Fournir des outils d'analyse détaillée pour un nœud ou un groupe de nœuds.

**Fonctionnalités** :
- Panneau d'analyse avec métriques détaillées
- Visualisation des communications entrantes/sortantes
- Statistiques sur les types de requêtes et codes d'erreur
- Export des données d'analyse

**Implémentation** :
- Nouveau panneau "Node Analysis" 
- Calculs de métriques côté frontend et backend
- Graphiques et tableaux de données
- Fonctionnalité d'export (JSON/CSV)

### 4. Optimisations performance

**Objectif** : Améliorer les performances pour ~100 nœuds avec calculs avancés.

**Fonctionnalités** :
- Cache intelligent des calculs de métriques
- Mise à jour incrémentale des données d'analyse
- Optimisation des requêtes de base de données

## Composants impactés

### Frontend (JavaScript)

#### Nouveaux modules
- `static/js/modules/focus-mode.js` - Gestion du mode focus
- `static/js/modules/node-groups.js` - Gestion des groupes de nœuds  
- `static/js/modules/node-analysis.js` - Analyse avancée des nœuds
- `static/js/modules/local-storage.js` - Utilitaires de persistance locale

#### Modules modifiés
- `static/js/modules/filters.js` - Ajout de la logique de mode focus
- `static/js/modules/ui.js` - Nouveaux éléments d'interface
- `static/js/modules/network.js` - Gestion des nouveaux modes de visualisation
- `static/js/modules/state.js` - Nouvelles variables d'état

### Backend (Python)

#### Nouveaux fichiers
- `libs/analysis/node_analyzer.py` - Analyse avancée des nœuds
- `libs/analysis/metrics_calculator.py` - Calculs de métriques
- `libs/storage/group_manager.py` - Gestion des groupes (optionnel, si persistance serveur)

#### Modules modifiés
- `libs/webapp/routes.py` - Nouvelles routes API
- `libs/webapp/graph_manager.py` - Support des nouvelles fonctionnalités
- `libs/database/db_manager.py` - Requêtes optimisées pour l'analyse

### Templates et CSS

#### Modifiés
- `templates/index.html` - Nouveaux panneaux d'interface
- `static/css/style.css` - Styles pour les nouvelles fonctionnalités

## Nouvelles API REST

### `/api/node-analysis/<node_id>`
- **Méthode** : GET
- **Fonction** : Retourne l'analyse détaillée d'un nœud
- **Réponse** : JSON avec métriques, communications, erreurs

### `/api/node-groups`
- **Méthode** : GET, POST, PUT, DELETE
- **Fonction** : CRUD des groupes de nœuds
- **Données** : Nom, liste des nœuds, métadonnées

### `/api/focus-mode`
- **Méthode** : POST
- **Fonction** : Active le mode focus pour un ensemble de nœuds
- **Données** : Liste des nœuds à focaliser
- **Réponse** : Données du graphe en mode focus

## Structure des données

### Groupe de nœuds
```javascript
{
  "id": "payment-services",
  "name": "Payment Services", 
  "description": "Services related to payment processing",
  "nodes": ["payment-api", "payment-db", "billing-service"],
  "color": "#ff6b6b",
  "created_at": "2024-01-15T10:30:00Z",
  "modified_at": "2024-01-15T11:45:00Z"
}
```

### Données d'analyse de nœud
```javascript
{
  "node_id": "payment-api",
  "incoming_connections": {
    "total": 45,
    "sources": ["web-frontend", "mobile-api", "admin-panel"],
    "by_source": {...}
  },
  "outgoing_connections": {
    "total": 23, 
    "targets": ["payment-db", "notification-service"],
    "by_target": {...}
  },
  "error_rates": {
    "4xx": 0.02,
    "5xx": 0.001
  },
  "request_volume": {
    "total": 1500,
    "per_minute": 25
  }
}
```

## Interface utilisateur

### Nouveau panneau "Node Groups"
- Liste déroulante des groupes existants
- Boutons : "Create Group", "Edit", "Delete"
- Recherche dans les groupes

### Nouveau panneau "Focus Mode"  
- Toggle "Enable Focus Mode"
- Sélection multiple de nœuds pour le focus
- Slider pour le niveau de "contexte" (nœuds voisins à afficher)

### Nouveau panneau "Node Analysis"
- Sélection du nœud à analyser
- Onglets : "Overview", "Connections", "Errors", "Performance"
- Bouton "Export Analysis"

## Compatibilité

### Rétrocompatibilité
- Toutes les fonctionnalités existantes restent inchangées
- Les modes de filtrage classiques continuent de fonctionner
- L'API existante reste compatible

### Migration des données
- Aucune migration de base de données requise
- Les configurations existantes restent valides
- Ajout optionnel de tables pour la persistance serveur des groupes

## Tests

### Tests unitaires requis
- Tests des nouveaux modules JavaScript
- Tests des nouvelles routes API
- Tests des calculs de métriques

### Tests d'intégration
- Test du mode focus avec différents ensembles de nœuds
- Test de la persistance et restauration des groupes
- Test des performances avec ~100 nœuds

### Tests utilisateur
- Validation de l'UX des nouvelles fonctionnalités
- Test de l'ergonomie des nouveaux panneaux
- Validation des workflows d'analyse

## Métriques de succès

1. **Résolution du problème principal** : 100% des communications d'un nœud focalisé sont visibles
2. **Fonctionnalités de groupes** : Création et utilisation de groupes personnalisés
3. **Performance** : Temps de réponse < 2s pour l'analyse d'un nœud
4. **Utilisabilité** : Interface intuitive validée par tests utilisateur 