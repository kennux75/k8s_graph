# Changelog - Kubernetes Communications Graph Visualizer

## Corrections & Améliorations [2024-01-XX]

### 🐛 Corrections Critiques

#### **Préservation des Contraintes de Physique des Nœuds**
- **Problème résolu**: Les contraintes de positions fixes basées sur le nombre d'arêtes étaient perdues lors des clics sur "disable/enable physics" ou "toggle fixed positions"
- **Impact**: Les nœuds avec plus de 3 arêtes (qui doivent avoir `physics: false` pour la clarté d'affichage) bougeaient après usage des boutons de contrôle
- **Solution**: Modification des modules `static/js/modules/physics.js`, `static/js/modules/network.js` et `static/js/modules/filters.js`
  - `togglePhysics()` : Préservation automatique des contraintes `physics: false` pour les nœuds à >3 arêtes
  - `toggleFixedPositions()` : Maintien des contraintes individuelles lors du changement d'état fixed/unfixed
  - `updateGraph()` : Respect de l'état `config.fixedPositionsEnabled` lors de l'application des positions sauvegardées
  - `applyNodeFilters()` : Application conditionnelle de `fixed: true/false` selon l'état du toggle
  - Nouvelle fonction `syncNodeStatesWithToggle()` : Synchronisation des états des nœuds avec le bouton toggle
  - Intégration dans les opérations "Select All", "Deselect All" et "Restore Full Graph"
  - Ajout de logs de débogage pour tracer la préservation des contraintes
- **Résultat**: Les contraintes de positions fixes sont maintenant respectées en permanence, et l'état après "deselect all" / "select all" correspond à celui après un refresh de page

---

## Phase 3 - Nouvelles Fonctionnalités Focus Mode & Filtrage Amélioré [2024-01-XX]

### ✅ Ajouts Majeurs

#### **Système de Feature Flags**
- **Nouveau**: `static/js/modules/feature-flags.js` - Gestionnaire complet des feature flags
  - FeatureFlagsManager classe avec persistance localStorage
  - Système d'événements pour les changements de fonctionnalités
  - Support de l'initialisation depuis le serveur
  - API simple : `isFeatureEnabled()`, `enableFeature()`, `disableFeature()`

- **Modifié**: `config/app_config.py` - Configuration serveur des feature flags
  - Ajout du dictionnaire `FEATURES` avec toutes les fonctionnalités
  - Fonctions utilitaires : `get_features()`, `update_feature()`, `update_features()`

#### **Mode Focus (Focus Mode)**
- **Nouveau**: `static/js/modules/focus-mode.js` - Module de focus complet
  - FocusMode classe avec 3 types de focus :
    - `direct` : Affichage uniquement des nœuds sélectionnés
    - `neighbors` : Inclut les nœuds voisins (profondeur configurable)
    - `path` : Affiche les chemins entre nœuds sélectionnés
  - Interactions utilisateur :
    - Double-clic sur un nœud pour le focus
    - Ctrl+Clic pour ajouter/retirer du focus
  - Algorithmes de graphe intégrés (BFS pour chemins)
  - Système d'événements personnalisés

#### **Améliorations du Système de Filtrage**
- **Modifié**: `static/js/modules/filters.js` - Intégration focus mode
  - Nouvelle fonction `applyFocusFilters()` avec logique conditionnelle
  - Délégation intelligente au focus mode quand activé
  - Préservation de la compatibilité avec le filtrage existant

#### **Interface Utilisateur Focus Mode**
- **Modifié**: `templates/index.html` - Nouveau panneau focus mode
  - Contrôles de focus (Enable/Clear)
  - Sélecteurs de type et profondeur de focus
  - Liste des nœuds focalisés
  - Instructions utilisateur intégrées

- **Modifié**: `static/css/style.css` - Styles focus mode complets
  - Styles cohérents avec le thème existant
  - Animations et transitions fluides
  - États de boutons (actif/désactivé)
  - Indicateurs visuels de focus

#### **État Global Étendu**
- **Modifié**: `static/js/modules/state.js` - Nouvelles variables d'état
  - Objet `focusMode` avec état complet du focus
  - Objet `nodeGroups` pour futures fonctionnalités
  - Variable `originalGraphData` pour restauration
  - Préparation pour les prochaines phases

#### **Filtrage Amélioré avec Communications**
- **Nouveau**: Route `/filtered_graph_data` dans `libs/webapp/routes.py`
  - API POST pour récupérer les nœuds filtrés avec leurs communications
  - Inclusion automatique des nœuds sources communicants
  - Informations détaillées sur les données filtrées

- **Modifié**: `static/js/modules/ui.js` - Bouton "Select Filtered" amélioré
  - Intégration avec l'API `/filtered_graph_data`
  - Affichage des communications entrantes et sortantes
  - Bouton "Restore Full Graph" pour revenir à la vue complète
  - Gestion d'erreur avec fallback vers l'ancien comportement

- **Modifié**: `templates/index.html` - Interface de restauration
  - Bouton "Restore Full Graph" conditionnel
  - Amélioration de l'UX pour le filtrage avancé

#### **Préservation d'État lors du Refresh Automatique**
- **Modifié**: `static/js/modules/network.js` - Refresh intelligent
  - Détection automatique des vues filtrées actives
  - Préservation de l'état de filtrage lors des mises à jour toutes les 60s
  - Fallback gracieux vers le refresh complet si erreur
  - Mise à jour du statut pour indiquer le type de refresh

- **Modifié**: `static/js/modules/state.js` - Stockage état filtrage
  - Variable `originalFilteredNodes` pour préserver les nœuds filtrés originaux
  - Séparation claire entre données originales et état de filtrage

- **Modifié**: `static/js/modules/ui.js` - Gestion état filtrage
  - Stockage des nœuds filtrés originaux lors de l'activation
  - Nettoyage lors de la restauration complète
  - Amélioration de la persistance du filtrage

### 🔧 Modifications Techniques

#### **Architecture Modulaire Renforcée**
- Intégration feature flags dans tous les nouveaux modules
- Système d'événements découplé entre modules
- Préservation de la rétrocompatibilité

#### **Performance et UX**
- Algorithmes de graphe optimisés (BFS, recherche de voisins)
- Persistance locale des préférences utilisateur
- Filtrage intelligent sans rechargement de données

#### **Code Quality**
- Documentation complète des nouvelles fonctionnalités
- Gestion d'erreurs robuste
- Tests de régression pour le filtrage existant

### 📋 Plan de Modifications (Status)

| Fonctionnalité | Status | Résultat |
|---|---|---|
| Feature Flags System | ✅ DONE | Système complet avec persistance et événements |
| Focus Mode Core | ✅ DONE | Implémentation complète avec 3 types de focus |
| Filters Integration | ✅ DONE | Délégation intelligente et compatibilité |
| State Management | ✅ DONE | Variables d'état étendues |
| UI Focus Mode | ✅ DONE | Interface complète et intuitive |
| CSS Styling | ✅ DONE | Styles cohérents et responsifs |
| Enhanced Filtering | ✅ DONE | Filtrage avec communications et nœuds sources |
| Auto-Refresh State | ✅ DONE | Préservation de l'état de filtrage lors des mises à jour |

### 🚀 Prochaines Étapes (Planifiées)

#### **Phase suivante - Node Groups & Analysis**
- Module de gestion des groupes de nœuds
- Panneau d'analyse de nœuds avec métriques
- API backend pour persistance des données
- Module de cache des métriques côté client

#### **Tests & Documentation**
- Tests unitaires JavaScript pour focus mode
- Tests d'intégration API
- Guide utilisateur focus mode
- Documentation développeur

### 🔄 Stratégie de Rollback

Chaque modification peut être annulée individuellement :
- **Feature flags** : Supprimer `FEATURES` dict et le module JS
- **Focus mode** : Supprimer le module et restaurer `filters.js` original
- **UI changes** : Supprimer les sections HTML et CSS focus mode
- **State changes** : Retirer les nouvelles variables d'état

### 🏗️ Impact Technique

#### **Compatibilité**
- ✅ Pas de breaking changes
- ✅ Fonctionnalités existantes préservées
- ✅ Performance maintenue

#### **Extensibilité**
- ✅ Architecture prête pour node groups
- ✅ API feature flags extensible
- ✅ Système d'événements réutilisable

#### **Maintenance**
- ✅ Code modulaire et découplé
- ✅ Configuration centralisée
- ✅ Logging et debugging améliorés 