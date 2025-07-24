// K8s Communications Graph Visualizer - Feature Flags Management

/**
 * Feature Flags Management System
 * Provides centralized control over feature activation/deactivation
 */

// Default feature flags configuration
const DEFAULT_FEATURES = {
    focusMode: false,           // Focus mode functionality
    nodeGroups: false,          // Node groups management
    nodeAnalysis: false,        // Node analysis panel
    advancedFilters: false,     // Advanced filtering options
    realTimeUpdates: true,      // Real-time updates via WebSocket
    cumulativeData: true,       // Cumulative data tracking
    exportFeatures: false,      // Export/import functionality
    darkMode: false,            // Dark mode theme
    performanceMode: false,     // Performance optimizations
    debugMode: false            // Debug console and tools
};

// Current feature flags state
let currentFeatures = { ...DEFAULT_FEATURES };

/**
 * Feature Flags Manager Class
 */
export class FeatureFlagsManager {
    constructor() {
        this.features = { ...DEFAULT_FEATURES };
        this.listeners = new Map(); // Event listeners for feature changes
        this.initialized = false;
    }

    /**
     * Initialize feature flags from server configuration
     * @param {Object} serverConfig - Configuration from server
     */
    async initialize(serverConfig = {}) {
        try {
            // Merge with server configuration if available
            if (serverConfig && serverConfig.features) {
                this.features = { ...DEFAULT_FEATURES, ...serverConfig.features };
            }

            // Load from localStorage if available
            const storedFeatures = this.loadFromStorage();
            if (storedFeatures) {
                this.features = { ...this.features, ...storedFeatures };
            }

            currentFeatures = { ...this.features };
            this.initialized = true;

            console.log('Feature flags initialized:', this.features);
            this.notifyListeners('initialized', this.features);
        } catch (error) {
            console.error('Failed to initialize feature flags:', error);
        }
    }

    /**
     * Check if a feature is enabled
     * @param {string} featureName - Name of the feature
     * @returns {boolean} - True if feature is enabled
     */
    isEnabled(featureName) {
        if (!this.initialized) {
            console.warn('Feature flags not initialized, using default values');
        }
        return this.features[featureName] ?? false;
    }

    /**
     * Enable a feature
     * @param {string} featureName - Name of the feature
     * @param {boolean} persist - Whether to persist to localStorage
     */
    enable(featureName, persist = true) {
        if (!(featureName in DEFAULT_FEATURES)) {
            console.warn(`Unknown feature flag: ${featureName}`);
            return false;
        }

        const previousValue = this.features[featureName];
        this.features[featureName] = true;
        currentFeatures[featureName] = true;

        if (persist) {
            this.saveToStorage();
        }

        console.log(`Feature '${featureName}' enabled`);
        this.notifyListeners('featureChanged', {
            feature: featureName,
            enabled: true,
            previousValue
        });

        return true;
    }

    /**
     * Disable a feature
     * @param {string} featureName - Name of the feature
     * @param {boolean} persist - Whether to persist to localStorage
     */
    disable(featureName, persist = true) {
        if (!(featureName in DEFAULT_FEATURES)) {
            console.warn(`Unknown feature flag: ${featureName}`);
            return false;
        }

        const previousValue = this.features[featureName];
        this.features[featureName] = false;
        currentFeatures[featureName] = false;

        if (persist) {
            this.saveToStorage();
        }

        console.log(`Feature '${featureName}' disabled`);
        this.notifyListeners('featureChanged', {
            feature: featureName,
            enabled: false,
            previousValue
        });

        return true;
    }

    /**
     * Toggle a feature
     * @param {string} featureName - Name of the feature
     * @param {boolean} persist - Whether to persist to localStorage
     */
    toggle(featureName, persist = true) {
        if (this.isEnabled(featureName)) {
            return this.disable(featureName, persist);
        } else {
            return this.enable(featureName, persist);
        }
    }

    /**
     * Get all feature flags
     * @returns {Object} - All feature flags with their current state
     */
    getAll() {
        return { ...this.features };
    }

    /**
     * Get all enabled features
     * @returns {Array} - Array of enabled feature names
     */
    getEnabled() {
        return Object.keys(this.features).filter(feature => this.features[feature]);
    }

    /**
     * Get all disabled features
     * @returns {Array} - Array of disabled feature names
     */
    getDisabled() {
        return Object.keys(this.features).filter(feature => !this.features[feature]);
    }

    /**
     * Reset all features to default values
     * @param {boolean} persist - Whether to persist to localStorage
     */
    reset(persist = true) {
        const previousFeatures = { ...this.features };
        this.features = { ...DEFAULT_FEATURES };
        currentFeatures = { ...DEFAULT_FEATURES };

        if (persist) {
            this.saveToStorage();
        }

        console.log('Feature flags reset to defaults');
        this.notifyListeners('featuresReset', {
            previousFeatures,
            currentFeatures: this.features
        });
    }

    /**
     * Bulk update features
     * @param {Object} features - Object with feature names and their values
     * @param {boolean} persist - Whether to persist to localStorage
     */
    updateFeatures(features, persist = true) {
        const previousFeatures = { ...this.features };
        const validFeatures = {};

        // Validate and filter features
        Object.keys(features).forEach(featureName => {
            if (featureName in DEFAULT_FEATURES) {
                validFeatures[featureName] = Boolean(features[featureName]);
            } else {
                console.warn(`Unknown feature flag: ${featureName}`);
            }
        });

        // Update features
        this.features = { ...this.features, ...validFeatures };
        currentFeatures = { ...this.features };

        if (persist) {
            this.saveToStorage();
        }

        console.log('Features updated:', validFeatures);
        this.notifyListeners('featuresUpdated', {
            previousFeatures,
            updatedFeatures: validFeatures,
            currentFeatures: this.features
        });
    }

    /**
     * Add event listener for feature changes
     * @param {string} event - Event type ('featureChanged', 'featuresReset', 'featuresUpdated', 'initialized')
     * @param {Function} callback - Callback function
     */
    addEventListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event type
     * @param {Function} callback - Callback function
     */
    removeEventListener(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Notify listeners of feature changes
     * @private
     */
    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in feature flag listener for '${event}':`, error);
                }
            });
        }
    }

    /**
     * Save features to localStorage
     * @private
     */
    saveToStorage() {
        try {
            const nonDefaultFeatures = {};
            Object.keys(this.features).forEach(feature => {
                if (this.features[feature] !== DEFAULT_FEATURES[feature]) {
                    nonDefaultFeatures[feature] = this.features[feature];
                }
            });
            
            if (Object.keys(nonDefaultFeatures).length > 0) {
                localStorage.setItem('k8s-graph-features', JSON.stringify(nonDefaultFeatures));
            } else {
                localStorage.removeItem('k8s-graph-features');
            }
        } catch (error) {
            console.error('Failed to save features to localStorage:', error);
        }
    }

    /**
     * Load features from localStorage
     * @private
     * @returns {Object|null} - Stored features or null
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('k8s-graph-features');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Failed to load features from localStorage:', error);
            return null;
        }
    }
}

// Export singleton instance
export const featureFlags = new FeatureFlagsManager();

// Export utility functions for direct access
export const isFeatureEnabled = (featureName) => featureFlags.isEnabled(featureName);
export const enableFeature = (featureName, persist = true) => featureFlags.enable(featureName, persist);
export const disableFeature = (featureName, persist = true) => featureFlags.disable(featureName, persist);
export const toggleFeature = (featureName, persist = true) => featureFlags.toggle(featureName, persist);

// Export default features for reference
export { DEFAULT_FEATURES }; 