# Prompts Incrémentaux - Modifications du Visualisateur Kubernetes

Ce document contient les prompts détaillés pour chaque modification incrémentale.

## Phase 1 : Infrastructure et Feature Flags

### Prompt 1.1 : Système de feature flags
**Fichier** : `static/js/modules/feature-flags.js` (CRÉER)
**Contexte** : Architecture modulaire ES6 existante

```javascript
// Créer un module pour gérer les feature flags
export const FEATURE_FLAGS = {
    FOCUS_MODE: 'focus_mode_enabled',
    NODE_GROUPS: 'node_groups_enabled', 
    NODE_ANALYSIS: 'node_analysis_enabled'
};

export function isFeatureEnabled(feature) {
    return localStorage.getItem(feature) === 'true';
}

export function enableFeature(feature) {
    localStorage.setItem(feature, 'true');
}

export function disableFeature(feature) {
    localStorage.setItem(feature, 'false');
}
```

### Prompt 1.2 : Configuration backend
**Fichier** : `config/app_config.py` (MODIFIER)
**Contexte** : Configuration Flask centralisée existante

```python
# Ajouter à la fin du fichier sans modifier l'existant
FEATURES = {
    'FOCUS_MODE_ENABLED': os.getenv('FEATURE_FOCUS_MODE', 'false').lower() == 'true',
    'NODE_GROUPS_ENABLED': os.getenv('FEATURE_NODE_GROUPS', 'false').lower() == 'true',
    'NODE_ANALYSIS_ENABLED': os.getenv('FEATURE_NODE_ANALYSIS', 'false').lower() == 'true'
}
```

## Phase 2 : Mode Focus (HIGH Priority)

### Prompt 2.1 : Module Focus Mode
**Fichier** : `static/js/modules/focus-mode.js` (CRÉER)
**Contexte** : Classes ES6, interaction avec state.js et network.js

```javascript
// Créer une classe pour gérer le mode focus
export class FocusMode {
    constructor() {
        this.enabled = false;
        this.focusedNodes = new Set();
        this.contextNodes = new Set();
    }
    
    enable(nodeIds) {
        this.enabled = true;
        this.focusedNodes = new Set(nodeIds);
        this.updateVisualization();
    }
    
    disable() {
        this.enabled = false;
        this.focusedNodes.clear();
        this.contextNodes.clear();
        this.updateVisualization();
    }
    
    getContextNodes(allKnownNodes, allKnownEdges) {
        // Calculer les nœuds connectés aux nœuds focalisés
        this.contextNodes.clear();
        // Logique de calcul des voisins
    }
}
```

### Prompt 2.2 : Modification du système de filtrage
**Fichier** : `static/js/modules/filters.js` (MODIFIER)
**Contexte** : Fonction critique applyNodeFilters() lignes 158-349

```javascript
// IMPORTANT: Préserver la logique existante
// Ajouter seulement une condition au début de applyNodeFilters()

export function applyNodeFilters() {
    if (!network.instance) return;
    
    // NOUVEAU: Vérification mode focus
    if (config.focusMode && config.focusMode.enabled) {
        return applyFocusFilters();
    }
    
    // EXISTANT: Garder toute la logique actuelle inchangée
    console.log("Applying node filters: Hiding", config.nodeFilters.size, "nodes");
    // ... reste identique
}

// NOUVEAU: Fonction pour mode focus
function applyFocusFilters() {
    // Logique spécifique focus mode
    // Préserver TOUTES les arêtes des nœuds focalisés
}
```

### Prompt 2.3 : Extension de l'état global
**Fichier** : `static/js/modules/state.js` (MODIFIER)
**Contexte** : Objet config global avec Maps/Sets

```javascript
// Ajouter au config existant (sans modifier le reste)
export const config = {
    // ... propriétés existantes ...
    
    // NOUVEAU: État mode focus
    focusMode: {
        enabled: false,
        focusedNodes: new Set(),
        contextNodes: new Set()
    },
    
    nodeGroups: new Map(),
    nodeAnalysis: {
        selectedNode: null,
        cachedAnalysis: new Map()
    }
};
```

### Prompt 2.4 : Interface Focus Mode
**Fichier** : `templates/index.html` (MODIFIER)
**Contexte** : Structure panneaux collapsibles existante

```html
<!-- Ajouter après les panneaux existants -->
<div class="panel-section" id="focus-mode-section">
    <div class="panel-header" data-target="focus-mode-content">
        <span>Focus Mode</span>
        <span class="toggle-icon">▼</span>
    </div>
    <div class="panel-content" id="focus-mode-content">
        <div class="focus-controls">
            <button id="focus-mode-toggle" class="toggle-btn">
                <span id="focus-mode-text">Enable Focus</span>
            </button>
            <div id="focus-selection" style="display: none;">
                <label>Select nodes to focus:</label>
                <div id="focus-node-selector"></div>
                <button id="apply-focus" class="action-btn">Apply Focus</button>
                <button id="clear-focus" class="action-btn secondary">Clear Focus</button>
            </div>
        </div>
    </div>
</div>
```

### Prompt 2.5 : Styles CSS Focus
**Fichier** : `static/css/style.css` (MODIFIER)
**Contexte** : Nomenclature BEM, variables CSS existantes

```css
/* Ajouter à la fin du fichier */
.focus-controls {
    padding: 10px 0;
}

.focus-controls .control-group {
    margin-bottom: 15px;
}

#focus-node-selector {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
    margin: 8px 0;
}

.node-focused {
    border: 3px solid #007bff !important;
    box-shadow: 0 0 10px rgba(0, 123, 255, 0.5) !important;
}

.node-context {
    opacity: 0.6 !important;
    border: 1px dashed #666 !important;
}
```

## Phase 3 : Système de Groupes (MEDIUM Priority)

### Prompt 3.1 : LocalStorage Manager
**Fichier** : `static/js/modules/local-storage.js` (CRÉER)

```javascript
export class LocalStorageManager {
    constructor(prefix = 'k8s-graph') {
        this.prefix = prefix;
        this.version = '1.0';
    }
    
    save(key, data) {
        try {
            const prefixedKey = `${this.prefix}.${key}`;
            const wrappedData = { version: this.version, data };
            localStorage.setItem(prefixedKey, JSON.stringify(wrappedData));
        } catch (e) {
            console.error('LocalStorage save error:', e);
        }
    }
    
    load(key) {
        try {
            const prefixedKey = `${this.prefix}.${key}`;
            const stored = localStorage.getItem(prefixedKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.data;
            }
        } catch (e) {
            console.error('LocalStorage load error:', e);
        }
        return null;
    }
}
```

### Prompt 3.2 : Node Groups Manager
**Fichier** : `static/js/modules/node-groups.js` (CRÉER)

```javascript
import { LocalStorageManager } from './local-storage.js';

export class NodeGroupManager {
    constructor() {
        this.storage = new LocalStorageManager();
        this.groups = new Map();
        this.loadFromStorage();
    }
    
    createGroup(name, nodeIds, description = '') {
        const group = {
            id: this.generateId(),
            name,
            description,
            nodes: [...nodeIds],
            color: this.generateColor(),
            created_at: new Date().toISOString()
        };
        
        this.groups.set(group.id, group);
        this.saveToStorage();
        return group;
    }
    
    generateId() {
        return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}
```

## Phase 4 : Analyse de Nœuds (MEDIUM Priority)

### Prompt 4.1 : Node Analyzer Backend
**Fichier** : `libs/analysis/node_analyzer.py` (CRÉER)

```python
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

class NodeAnalyzer:
    """Analyze individual nodes and their communication patterns."""
    
    def __init__(self, db_manager):
        """Initialize with database manager dependency."""
        self.db_manager = db_manager
        
    def analyze_node(self, node_id, hours=24):
        """
        Perform comprehensive analysis of a node.
        
        Args:
            node_id (str): The node identifier to analyze
            hours (int): Number of hours to look back for analysis
            
        Returns:
            dict: Complete analysis data structure
        """
        try:
            analysis = {
                'node_id': node_id,
                'incoming_connections': self._get_incoming_stats(node_id, hours),
                'outgoing_connections': self._get_outgoing_stats(node_id, hours),
                'error_rates': self._get_error_rates(node_id, hours),
                'request_volume': self._get_request_volume(node_id, hours)
            }
            return analysis
        except Exception as e:
            logger.error(f"Error analyzing node {node_id}: {e}")
            raise
```

### Prompt 4.2 : API Routes Extension
**Fichier** : `libs/webapp/routes.py` (MODIFIER)

```python
# Ajouter les imports
from libs.analysis.node_analyzer import NodeAnalyzer

# Ajouter les nouvelles routes
@app.route('/api/node-analysis/<node_id>')
def get_node_analysis(node_id):
    """Get detailed analysis for a specific node."""
    try:
        hours = request.args.get('hours', 24, type=int)
        
        if hours < 1 or hours > 168:
            return jsonify({'error': 'Hours must be between 1 and 168'}), 400
            
        analyzer = NodeAnalyzer(db_manager)
        analysis = analyzer.analyze_node(node_id, hours)
        
        return jsonify(analysis)
        
    except Exception as e:
        logger.error(f"Error analyzing node {node_id}: {e}")
        return jsonify({'error': str(e)}), 500
```

## Tests de Régression Critiques

### Test Focus Mode
```javascript
// Vérifier que le problème principal est résolu
describe('Focus Mode Resolution Test', () => {
    it('should show ALL communications for focused nodes', () => {
        // 1. Sélectionner un nœud
        // 2. Activer focus mode
        // 3. Vérifier que toutes les arêtes sont visibles
        // 4. Y compris vers des nœuds normalement cachés
    });
});
```

### Test Régression Filtres
```javascript
// Vérifier que le mode normal fonctionne exactement comme avant
describe('Filters Regression Test', () => {
    it('should work exactly like before in normal mode', () => {
        // Test exhaustif du comportement existant
    });
});
```

## Stratégies de Rollback

1. **Feature Flags** : Désactiver via localStorage ou variables d'env
2. **Fichiers nouveaux** : Supprimer les fichiers créés
3. **Modifications** : Restaurer les fonctions modifiées
4. **CSS/HTML** : Supprimer les sections ajoutées

## Validation des Besoins Utilisateur

✅ **Problème résolu** : "Communications manquantes lors du filtrage"
- Le mode focus préserve toutes les arêtes des nœuds sélectionnés

✅ **Groupes de nœuds** : "Regroupement par groupe (ex: payment)"
- Création, sauvegarde et réutilisation de groupes personnalisés

✅ **Analyse de nœuds** : "Analyser un nœud et toutes ses communications"
- Panneau d'analyse détaillée avec métriques complètes 