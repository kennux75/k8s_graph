// K8s Communications Graph Visualizer - Global State

// DOM Elements (initialized in ui.js)
export const dom = {
    networkContainer: null,
    refreshBtn: null,
    togglePhysicsBtn: null,
    physicsBtnText: null,
    resetViewBtn: null,
    toggleFixedPositionsBtn: null,
    statusDiv: null,
    lastUpdateDiv: null,
    updateIntervalInput: null,
    setIntervalBtn: null,
    gravityValue: null,
    springLengthValue: null,
    springStrengthValue: null,
    applyPhysicsBtn: null,
    nodeSearchInput: null,
    clearSearchBtn: null,
    nodeFiltersDiv: null,
    toggleAnimationBtn: null,
    countdownTimerDiv: null
};

// Globals for network visualization
export const network = {
    instance: null,
    nodes: new vis.DataSet(),
    edges: new vis.DataSet()
};

// Configuration and settings
export const config = {
    updateInterval: 60,
    updateTimer: null,
    namespaceColors: {},
    physicsEnabled: false,  // Physics disabled by default
    nodeFilters: new Set(),
    edgeFilters: new Set(),
    nodePositions: {},
    fixedPositionsEnabled: true,
    allKnownNodes: new Map(),
    allKnownEdges: new Map(),
    nodeEdgeCounts: {},
    nodeFilterSet: new Set(),
    cumulativeNodeData: {},
    cumulativeEdgeData: {},
    updateCounter: 0,
    cumulativeDataEnabled: true,
    countdownTimer: 60
};

// Animation state
export const animation = {
    enabled: false,
    dots: [],
    requestId: null,
    image: new Image()
};

// Initialize animation image
animation.image.src = '/static/images/animation.gif';

// Physics settings
export const physicsOptions = {
    enabled: false,
    solver: "barnesHut",
    barnesHut: {
        gravitationalConstant: -1000,
        centralGravity: -0.3,
        springConstant: 0.01,
        springLength: 150,
        damping: 0.05,
        avoidOverlap: 1.2
    },
    stabilization: {
        enabled: true,
        iterations: 1000,
        updateInterval: 50,
        onlyDynamicEdges: false,
        fit: true
    },
    adaptiveTimestep: true,
    maxVelocity: 10,
    minVelocity: 1.0,
    timestep: 0.2
};

// Vis.js network options
export const networkOptions = {
    nodes: {
        shape: 'dot',
        size: 16,
        font: {
            size: 12,
            color: '#000000'
        },
        borderWidth: 1,
        shadow: false
    },
    edges: {
        width: 1,
        color: {
            color: '#848484',
            highlight: '#1E90FF',
            hover: '#1E90FF'
        },
        smooth: false,
        arrows: {
            to: {
                enabled: true,
                scaleFactor: 0.2
            }
        },
        font: {
            align: 'middle',
            size: 10
        },
        scaling: {
            min: 1,
            max: 1,
            label: {
                enabled: false
            }
        }
    },
    physics: physicsOptions,
    autoResize: true,
    height: '100%',
    width: '100%',
    interaction: {
        dragNodes: true,
        hideEdgesOnDrag: false,
        hideNodesOnDrag: false,
        navigationButtons: true,
        navigationButtonsEnabled: true,
        keyboard: {
            enabled: true,
            speed: {
                x: 10,
                y: 10,
                zoom: 0.02
            },
            bindToWindow: true
        },
        selectable: true,
        selectConnectedEdges: false,
        zoomView: true,
        multiselect: false,
        hover: true
    },
    configure: {
        enabled: false
    }
}; 