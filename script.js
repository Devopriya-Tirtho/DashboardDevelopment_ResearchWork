//Packages 
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js'; 
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/controls/OrbitControls.js'; 
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/GLTFLoader.js'; 
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/RGBELoader.js'; 
import { RoughnessMipmapper } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/utils/RoughnessMipmapper.js';

//For 3d vis nodehighlight interaction
var selectedNode = null;

//For range visualization
let selectedNodeIds = [];
let selectedNodeIdsForRange = [];

// Defining these globally
var scene, camera, renderer, controls;
// Define nodePositions globally
var nodePositions = {};
// This function sets up listeners to manage the dropdown behavior
function setupDropdownToggle() {
    const dropBtn = document.getElementById('node-select-btn');
    const dropdownContent = document.getElementById('node-dropdown');

    dropBtn.addEventListener('click', function(event) {
        dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
        event.stopPropagation(); // Prevent clicks from closing the dropdown
    });

    // Close the dropdown if clicking outside of it
    window.addEventListener('click', function() {
        if (dropdownContent.style.display === 'block') {
            dropdownContent.style.display = 'none';
        }
    });

    // Stop propagation of click events inside the dropdown
    dropdownContent.addEventListener('click', function(event) {
        event.stopPropagation();
    });
}

//Function for dynamic Event Listeners
function addDynamicEventListeners() {
    // Handle "Select All" functionality
    document.getElementById('select-all-nodes').addEventListener('change', function() {
        const allCheckboxes = document.querySelectorAll('#node-checkboxes input[type="checkbox"]:not(#select-all-nodes)');
        allCheckboxes.forEach(checkbox => checkbox.checked = this.checked);
    });

    // Clear button functionality
    document.getElementById('clear-nodes-button').addEventListener('click', function() {
        const allCheckboxes = document.querySelectorAll('#node-checkboxes input[type="checkbox"]');
        allCheckboxes.forEach(checkbox => checkbox.checked = false);
    });

    // Visualize button functionality
// Visualize button functionality
document.getElementById('visualize-nodes').addEventListener('click', function() {
    selectedNodeIdsForRange = []; // Reset the range selection

    // Reset sliders to 100%
    document.getElementById('edgeWeightSlider').value = 100;
    document.getElementById('edgeWeightValue').innerText = '100%';
    document.getElementById('linkOpacitySlider').value = 100;
    document.getElementById('linkOpacityValue').innerText = '100%';

    const selectedNodeIds = Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked'))
                                .map(checkbox => checkbox.dataset.nodeId);
    const selectedDataset = document.getElementById('dataset-selector').value;
    const edgeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Edge_processed_with_interaction.json' : 'Other_Dataset_Edge.json';

    // Get interaction filters
    const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                    .map(checkbox => parseInt(checkbox.value));

    fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, function(filteredEdges) {
        clearEdges3D();
        createEdges3D(filteredEdges);  // Draw 3D edges
        const context = document.getElementById('canvas2D').getContext('2d');
        drawEdges2D(filteredEdges, context);

        // Heatmap Visualization
        selectedNodes.clear();  // Clear the set and add all currently selected nodes
        selectedNodeIds.forEach(id => selectedNodes.add(id));

        const svg = d3.select('#visualization3').select('svg');
        updateHeatmapHighlights(svg, false);  // Pass false to indicate node highlighting

        // For Parallel Plot
        setupAndDrawParallelPlot(edgeDataPath, selectedNodeIds);
    });
});

///For handling the visualize-range option//
document.getElementById('visualize-range').addEventListener('click', function() {
    const fromBin = parseInt(document.getElementById('fromBin').value);
    const toBin = parseInt(document.getElementById('toBin').value);

    if (isNaN(fromBin) || isNaN(toBin) || fromBin > toBin) {
        alert("Please enter a valid range of bin numbers.");
        return;
    }

    // Reset sliders to 100%
    document.getElementById('edgeWeightSlider').value = 100;
    document.getElementById('edgeWeightValue').innerText = '100%';
    document.getElementById('linkOpacitySlider').value = 100;
    document.getElementById('linkOpacityValue').innerText = '100%';

    selectedNodeIdsForRange = [];
    for (let i = fromBin; i <= toBin; i++) {
        selectedNodeIdsForRange.push(i.toString());
    }

    // Update the heatmap
    selectedNodes.clear();  // Clear the set and add all currently selected nodes
    selectedNodeIdsForRange.forEach(id => selectedNodes.add(id));

    const svg = d3.select('#visualization3').select('svg');
    updateHeatmapHighlights(svg, true);  // Pass true to indicate range highlighting

    // Fetch and filter edges, then update the visualizations
    const selectedDataset = document.getElementById('dataset-selector').value;
    const edgeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Edge_processed_with_interaction.json' : 'Other_Dataset_Edge.json';
    const nodeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Node_2D.json' : 'Other_Dataset_Node_data.json';
    
    const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                .map(checkbox => parseInt(checkbox.value));

    fetchAndFilterEdgeData(edgeDataPath, selectedNodeIdsForRange, interactionFilters, function(filteredEdges) {
        clearEdges3D();
        createEdges3D(filteredEdges);

        const canvas = document.getElementById('canvas2D');
        const context = canvas.getContext('2d');
        fetch(nodeDataPath).then(response => response.json()).then(nodeData => {
            clearOnlyEdges2D(context, canvas, nodeData);
            drawEdges2D(filteredEdges, context);
        });

        // Update the parallel plot
        updateParallelPlot(edgeDataPath, selectedNodeIdsForRange, filteredEdges.length);
    });
});

    
//Button for implementation of inter/intra interaction filtering for visualized edges
document.getElementById('apply-interaction').addEventListener('click', function() {
    const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                .map(checkbox => parseInt(checkbox.value));
    
    if (interactionFilters.length === 0) {
        alert("Please select at least one interaction type.");
        return;
    }

    const selectedDataset = document.getElementById('dataset-selector').value;
    const edgeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Edge_processed_with_interaction.json' : 'Other_Dataset_Edge.json';
    const selectedNodeIds = selectedNodeIdsForRange.length > 0 ? selectedNodeIdsForRange : Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked')).map(checkbox => checkbox.dataset.nodeId);
    const nodeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Node_2D.json' : 'Other_Dataset_Node_data.json';

    fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, function(filteredEdges) {
        const edgeWeightSlider = document.getElementById('edgeWeightSlider');
        const value = edgeWeightSlider.value;

        // Calculate the number of edges to show based on the slider percentage
        const numberOfEdgesToShow = Math.ceil(filteredEdges.length * (value / 100));
        document.getElementById('edgeWeightValue').innerText = `${value}% (${numberOfEdgesToShow} edges)`;
        console.log(`Slider value: ${value}% - Showing top ${numberOfEdgesToShow} weighted edges.`);

        // Sort edges by weight in descending order and take the top N based on the slider
        filteredEdges.sort((a, b) => b.Weight - a.Weight);
        const edgesToShow = filteredEdges.slice(0, numberOfEdgesToShow);
        console.log(`Edges to show after filtering: ${edgesToShow.length}`);

        // Clear and update 3D edges
        clearEdges3D();
        createEdges3D(edgesToShow);

        // Clear and update 2D edges
        const canvas = document.getElementById('canvas2D');
        const context = canvas.getContext('2d');
        fetch(nodeDataPath).then(response => response.json()).then(nodeData => {
            clearOnlyEdges2D(context, canvas, nodeData);
            drawEdges2D(edgesToShow, context);
        });

        // Update the parallel plot
        updateParallelPlot(edgeDataPath, selectedNodeIds, numberOfEdgesToShow);
    });
});

    
    
}


/////////////////////////////      For responsive design      /////////////////////
window.addEventListener('resize', () => {
    // Adjust 3D visualization size
    renderer.setSize(visualizationContainer.clientWidth, visualizationContainer.clientHeight);
    camera.aspect = visualizationContainer.clientWidth / visualizationContainer.clientHeight;
    camera.updateProjectionMatrix();

    // Adjust 2D canvas size
    const canvas2D = document.getElementById('canvas2D');
    if (canvas2D) {
        canvas2D.width = canvas2D.parentElement.clientWidth;
        canvas2D.height = canvas2D.parentElement.clientHeight;
    }

    // Adjust heatmap size
    const heatmapSVG = d3.select('#visualization3 svg');
    if (!heatmapSVG.empty()) {
        const container = d3.select('#visualization3');
        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;
        heatmapSVG.attr('width', width).attr('height', height);
    }

    // Adjust parallel plot size
    const parallelPlotSVG = d3.select('#visualization4 svg');
    if (!parallelPlotSVG.empty()) {
        const container = d3.select('#visualization4');
        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;
        parallelPlotSVG.attr('width', width).attr('height', height);
    }
});
///////////////////////////////////////

////////////////////////////////////////////////////////////
///////////////////// Start of DOM Content /////////////////
////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', function() {

    //////////////////////////////////////////////////////////////////////////////////
    const slider = document.getElementById('edgeWeightSlider');
    if (slider) {
        slider.addEventListener('input', () => {
            updateEdgeVisibility(slider.value);
        });
    }
 
//////////////////////////////////////////////////////////////////////////////////////

        const datasetSelector = document.getElementById('dataset-selector');
        datasetSelector.addEventListener('change', function() {
            const selectedDataset = datasetSelector.value;

            if (selectedDataset === 'WT_BS') {
                // Show loading spinner and placeholders
                document.getElementById('loadingSpinner').style.display = 'block';
                document.getElementById('placeholder1').style.display = 'block';
                document.getElementById('placeholder2').style.display = 'block';
                document.getElementById('placeholder3').style.display = 'block';
                document.getElementById('placeholder4').style.display = 'block';

                const fetchData = async () => {
                    try {
                        clearVisualizationScenes(); // Clears all scenes
                        await fetchNodesFromJson('WT_BS_Node_3D.json'); // Specific for 3D visualizations
                        await fetchNodesFromJson2D('WT_BS_Node_2D.json'); // Specific for 2D visualizations
                        await fetchProcessedEdgeData('WT_BS_Edge_processed_with_interaction.json');
                        await setupParallelPlotData('WT_BS_Edge_processed_with_interaction.json'); // Parallel plot specific data
                    } catch (error) {
                        console.error("Error loading data:", error);
                    } finally {
                        // Hide loading spinner and placeholders
                        document.getElementById('loadingSpinner').style.display = 'none';
                        document.getElementById('placeholder1').style.display = 'none';
                        document.getElementById('placeholder2').style.display = 'none';
                        document.getElementById('placeholder3').style.display = 'none';
                        document.getElementById('placeholder4').style.display = 'none';
                    }
                };

                fetchData();

                // Fetch gene density data separately
                fetchGeneDensityData('WT_BS_gene_density.json');
            } else {
                // Clear existing visualizations and hide placeholders
                clearVisualizationScenes();
                document.getElementById('placeholder1').style.display = 'none';
                document.getElementById('placeholder2').style.display = 'none';
                document.getElementById('placeholder3').style.display = 'none';
                document.getElementById('placeholder4').style.display = 'none';
            }
        });


    // For Fetching data for 3d Vis
    async function fetchNodesFromJson(filePath) {
        try {
            console.log("Fetching nodes from JSON...");
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log("Nodes data fetched successfully:", data);
            updateNodeDropdown(data); // Update the dropdown with the new data
            createNodes(data); // For 3D visualization
            //draw2DVisualization(data); // For 2D visualization
        } catch (error) {
            console.error("Error fetching nodes:", error);
        }
    }

    // For Fetching data for 2d Vis
    async function fetchNodesFromJson2D(filePath) {
        try {
            console.log("Fetching nodes from JSON...");
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log("Nodes data fetched successfully:", data);
            //updateNodeDropdown(data); // Update the dropdown with the new data
            //createNodes(data); // For 3D visualization
            draw2DVisualization(data); // For 2D visualization
        } catch (error) {
            console.error("Error fetching nodes:", error);
        }
    }

    // For Clicking in 3d Vis
    console.log("Adding event listener to", renderer.domElement);
    renderer.domElement.addEventListener('click', onCanvasClick, false);
    function simpleClickTest(event) {
        console.log("Canvas clicked at", event.clientX, event.clientY);
    }
    
    renderer.domElement.removeEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('click', simpleClickTest, false);


    ///////////////////////////////
    /// This function updates the dropdown menu filling with the nodes or bins available in the dataset ///
    
    function updateNodeDropdown(nodes) {
        const nodeCheckboxesContainer = document.getElementById('node-checkboxes');
        nodeCheckboxesContainer.innerHTML = ''; // Clear existing checkboxes
    
        nodes.forEach((node, index) => {
            const checkboxContainer = document.createElement('div');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `node${index}`;
    
            // Extract only the numeric part of the node ID
            const numericId = node.id.replace(/^\D+/g, ''); // Removes non-digit characters at the start
            checkbox.dataset.nodeId = numericId; // Store only the numeric ID in data attribute
    
            const label = document.createElement('label');
            label.htmlFor = `node${index}`;
            label.textContent = node.id; // Display the original node ID as the label text
    
            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(label);
            nodeCheckboxesContainer.appendChild(checkboxContainer);
        });
    }
    


    
        // Initially call to setup listeners for static elements
       // addDynamicEventListeners();

    addDynamicEventListeners();  // Initialize all event listeners
    setupDropdownToggle();       // Setup dropdown toggle behavior if defined
    addOpacityControl();  // Initialize opacity control

    //End of DomContentLoaded
    });
////////////////////////////////////////////////////////////
///////////////////////   End of DOM Content  /////////////////////////////////////
////////////////////////////////////////////////////////////






//////////////Out of DOM CONTENT LOADED/////////////////////
//Function for filtering edged////
function filterTopWeightedEdges(edges, selectedNodeIds) {
    let nodeEdgeMap = new Map();

    // Gather edges connected to the selected nodes
    edges.forEach(edge => {
        let sourceId = String(edge.Source);
        let targetId = String(edge.Target);
        if (selectedNodeIds.includes(sourceId) || selectedNodeIds.includes(targetId)) {
            if (!nodeEdgeMap.has(sourceId)) {
                nodeEdgeMap.set(sourceId, []);
            }
            if (!nodeEdgeMap.has(targetId)) {
                nodeEdgeMap.set(targetId, []);
            }
            nodeEdgeMap.get(sourceId).push(edge);
            nodeEdgeMap.get(targetId).push(edge);
        }
    });

    let topEdges = [];
    // Apply the top 5% filter uniformly
    nodeEdgeMap.forEach((edges, nodeId) => {
        edges.sort((a, b) => b.Weight - a.Weight); // Sort by weight
        let top5PercentCount = Math.max(1, Math.ceil(edges.length * 0.05)); // Ensure at least one edge is selected
        topEdges.push(...new Set(edges.slice(0, top5PercentCount))); // Select top edges, ensure uniqueness here
    });

    // Return unique edges
    return Array.from(new Set(topEdges));
}



///////////////////////////////////
//Function for Handling Filtered edges////

function fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, callback) {
    fetch(edgeDataPath)
        .then(response => response.json())
        .then(allEdges => {
            let filteredEdges = allEdges.filter(edge => selectedNodeIds.includes(String(edge.Source)) || selectedNodeIds.includes(String(edge.Target)));
            if (interactionFilters && interactionFilters.length > 0) {
                filteredEdges = filteredEdges.filter(edge => interactionFilters.includes(edge.Interaction));
            }
            callback(filteredEdges);
        })
        .catch(error => console.error("Error fetching and filtering edge data:", error));
}



    
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////


///////////////////////////////////
///Slider Control for Edge Visibility in 3d and 2d vis///
let maxEdgeWeight = 0;  // Global variable to store the maximum edge weight

function updateEdgeVisibility(value) {
    const selectedNodeIds = selectedNodeIdsForRange.length > 0 ? selectedNodeIdsForRange : Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked')).map(checkbox => checkbox.dataset.nodeId);
    const selectedDataset = document.getElementById('dataset-selector').value;
    const edgeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Edge_processed_with_interaction.json' : 'Other_Dataset_Edge.json';
    const nodeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Node_2D.json' : 'Other_Dataset_Node_data.json';

    const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                .map(checkbox => parseInt(checkbox.value));

    fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, function(filteredEdges) {
        // Calculate the number of edges to show based on the slider percentage
        const numberOfEdgesToShow = Math.ceil(filteredEdges.length * (value / 100));
        document.getElementById('edgeWeightValue').innerText = `${value}% (${numberOfEdgesToShow} edges)`;
        console.log(`Slider value: ${value}% - Showing top ${numberOfEdgesToShow} weighted edges.`);

        // Sort edges by weight in descending order and take the top N based on the slider
        filteredEdges.sort((a, b) => b.Weight - a.Weight);
        const edgesToShow = filteredEdges.slice(0, numberOfEdgesToShow);
        console.log(`Edges to show after filtering: ${edgesToShow.length}`);

        clearEdges3D();
        createEdges3D(edgesToShow);

        const canvas = document.getElementById('canvas2D');
        const context = canvas.getContext('2d');
        fetch(nodeDataPath).then(response => response.json()).then(nodeData => {
            clearOnlyEdges2D(context, canvas, nodeData);
            drawEdges2D(edgesToShow, context);
        });

        // Update the parallel plot
        updateParallelPlot(edgeDataPath, selectedNodeIds, numberOfEdgesToShow);
    });
}





// Function for updating the parallel plot ///

function updateParallelPlot(edgeDataPath, selectedNodeIds, numberOfEdgesToShow) {
    fetch(edgeDataPath)
        .then(response => response.json())
        .then(data => {
            const filteredData = data.filter(d => selectedNodeIds.includes(d.Source.toString()));
            filteredData.sort((a, b) => b.Weight - a.Weight); // Sort by weight descending
            const edgesToShow = filteredData.slice(0, numberOfEdgesToShow); // Take top N edges based on slider

            // If no SVG exists, initialize it
            const allNodes = {
                sources: [...new Set(data.map(d => d.Source))],
                targets: [...new Set(data.map(d => d.Target))]
            };
            const { svg, sourceScale, targetScale, width, height } = setupSVGandAxes(allNodes);

            drawLinks({ svg, sourceScale, targetScale, data: edgesToShow, width });
        })
        .catch(error => console.error("Error updating parallel plot:", error));
}



function clearEdges3D() {
    // Traverse and remove all lines (edges) from the scene
    const toRemove = [];
    scene.traverse((object) => {
        if (object instanceof THREE.Line) {
            toRemove.push(object);
        }
    });
    toRemove.forEach(object => scene.remove(object));
    edges3D = []; // Clear the edges3D array
}

// Function for drawing edges of selected nodes for 3D visualization
function createEdges3D(edgeData) {
    // Use a light grey color (e.g., #CCCCCC) and set transparency
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xCCCCCC,
        transparent: true,
        opacity: 0.5
    });

    edgeData.forEach(edge => {
        const sourceNode = scene.getObjectByName(String(edge.Source));
        const targetNode = scene.getObjectByName(String(edge.Target));

        if (sourceNode && targetNode) {
            const points = [sourceNode.position.clone(), targetNode.position.clone()];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            scene.add(line);
            edges3D.push(line);  // Push edge into edges3D array
            console.log(`Drawing edge between ${edge.Source} and ${edge.Target}`);
        } else {
            console.log(`Failed to find nodes for edge between ${edge.Source} and ${edge.Target}`);
        }
    });

    renderer.render(scene, camera);
}


    
///////////////////////////////////

//For controlling opacity of edges//
let edges3D = [];
let edges2D = [];
//////////////////////////////////////

//Function for draw edges of selected nodes for 2d vis////


function drawEdges2D(edgeData, context) {
    context.strokeStyle = '#CCCCCC';  // Light grey color for edges
    context.globalAlpha = 0.5;  // 50% opacity for a subtle appearance
    context.lineWidth = 2;  // Slightly thicker line for better visibility
    context.lineCap = 'round';  // Rounded ends for a smoother look
    context.lineJoin = 'round';  // Rounded corners at line joins

    // Setting shadow for a glow effect
    context.shadowColor = '#CCCCCC';
    context.shadowBlur = 10;  // Adjust the blur level for more or less glow

    edges2D = []; // Clear the edges2D array before drawing

    edgeData.forEach(edge => {
        const sourceNode = nodePositions[edge.Source];
        const targetNode = nodePositions[edge.Target];

        if (sourceNode && targetNode) {
            context.beginPath();
            context.moveTo(sourceNode.x, sourceNode.y);
            context.lineTo(targetNode.x, targetNode.y);
            context.stroke();
            edges2D.push({ source: sourceNode, target: targetNode });  // Push edge into edges2D array
            console.log(`Edge drawn from ${edge.Source} to ${edge.Target}`);
        } else {
            console.log(`Nodes not found for edge from ${edge.Source} to ${edge.Target}`);
        }
    });

    // Resetting context properties after drawing
    context.globalAlpha = 1.0;
    context.shadowBlur = 0;  // Remove shadow after drawing edges
}

function clearOnlyEdges2D(context, canvas, nodeData) {
    context.clearRect(0, 0, canvas.width, canvas.height); // Clears the entire canvas
    draw2DVisualization(nodeData); // Redraw only nodes to avoid edge deletion
    edges2D = []; // Clear the edges2D array
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////





///////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////
///For Parallel Plots///


//Function for handling parallel plot after node selection
function setupAndDrawParallelPlot(dataset, selectedNodeIds) {
    fetch(dataset)
        .then(response => response.json())
        .then(data => {
            // Construct allNodes from the full dataset, not just filteredData
            const allNodes = {
                sources: [...new Set(data.map(d => d.Source))].sort((a, b) => a - b),
                targets: [...new Set(data.map(d => d.Target))].sort((a, b) => a - b)
            };

            // Now filter data to only include edges that have sources or targets in selectedNodeIds
            const filteredData = data.filter(d => selectedNodeIds.includes(String(d.Source)));

            if (filteredData.length === 0) {
                console.log("No data to draw links for selected nodes.");
                return;
            }

            // Setup SVG and axes using allNodes to ensure all possible nodes are included
            const { svg, sourceScale, targetScale, width, height } = setupSVGandAxes(allNodes);

            console.log("Filtered data for links:", filteredData);

            // Draw links only for selected nodes using the filtered data
            drawLinks({ svg, sourceScale, targetScale, data: filteredData, width }); 
        })
        .catch(error => console.error("Error setting up parallel plot:", error));
}



// Function to setup and fetch data for the parallel plot

async function setupParallelPlotData(filePath) {
    //To cancel out the existing still picture so that the actual visualization comes up
    document.getElementById('placeholder4').style.display = 'none';
    try {
        console.log("Fetching parallel plot data...");
        const response = await fetch(filePath);
        const data = await response.json();
        console.log("Parallel plot data fetched successfully:", data);
        maxEdgeWeight = Math.max(...data.map(d => d.Weight));
        const allNodes = {
            sources: [...new Set(data.map(d => d.Source))],
            targets: [...new Set(data.map(d => d.Target))]
        };
        setupSVGandAxes(allNodes);
    } catch (error) {
        console.error("Error fetching parallel plot data:", error);
    }
}


function setupSVGandAxes(allNodes) {
    // Combine sources and targets into one set, then convert to sorted array
    const combinedNodes = [...new Set([...allNodes.sources, ...allNodes.targets])].sort((a, b) => a - b);

    const container = d3.select("#visualization4");
    const margin = { top: 30, right: 30, bottom: 50, left: 30 },
         totalWidth = container.node().getBoundingClientRect().width,
         totalHeight = container.node().getBoundingClientRect().height,
         width = totalWidth - margin.left - margin.right,
         height = totalHeight - margin.top - margin.bottom;

    // Remove any existing SVG first
    container.select("svg").remove();

    // Create a new SVG element
    const svg = container.append("svg")
        .attr("width", totalWidth)
        .attr("height", totalHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const sourceScale = d3.scalePoint()
        .domain(combinedNodes)
        .range([0, height]);

    const targetScale = d3.scalePoint()
        .domain(combinedNodes)
        .range([0, height]);

    // Function to select every 10th element for label, using the combined node list
    const tickInterval = 10;
    const ticks = combinedNodes.filter((d, i) => i % tickInterval === 0);

    // Call the function to draw gene density lines first
    drawGeneDensityLinesParallelPlot(svg, width, height, margin, combinedNodes, sourceScale, targetScale);

    // Move the left axis further left
    svg.append("g")
        .call(d3.axisLeft(sourceScale).tickValues(ticks))
        .attr("transform", `translate(${25},0)`);  // Adjusted translation for left axis
    
    // Move the right axis a bit left
    svg.append("g")
        .call(d3.axisRight(targetScale).tickValues(ticks))
        .attr("transform", `translate(${width - 25},0)`);  // Adjusted translation for right axis

    return { svg, sourceScale, targetScale, width, height };
}


///Function for drawing links//////
function drawLinks({ svg, sourceScale, targetScale, data, width, height }) {
    svg.selectAll("path").remove();

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain([...new Set(data.map(d => d.Source))]);

    const links = svg.append("g")
       .selectAll("path")
       .data(data)
       .enter()
       .append("path")
       .attr("d", d => {
           const sourceY = sourceScale(d.Source);
           const targetY = targetScale(d.Target);
           return `M20,${sourceY} L${width - 20},${targetY}`;  // Adjusted to start and end within the margins
       })
       .attr("stroke", d => colorScale(d.Source))
       .attr("stroke-width", 2)
       .attr("opacity", 0.7)
       .attr("fill", "none");

    // Tooltip functionality
    links.on("mouseover", function(event, d) {
        d3.select("#tooltip")
          .style("display", "block")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px")
          .html(`Source: ${d.Source}<br>Target: ${d.Target}<br>Weight: ${d.Weight.toFixed(4)}`);
    })
    .on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
    });

    // Create a legend for color representation of each source
// Create a legend for color representation of each source
const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", "translate(10,355)");  // Adjusted to place at the desired position

const legendItems = legend.selectAll(".legend-item")
    .data(colorScale.domain())
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(${i * 80}, 0)`);  // Adjusted to place items horizontally

legendItems.append("rect")
    .attr("x", 0)
    .attr("width", 12)  // Adjusted width
    .attr("height", 12)  // Adjusted height
    .style("fill", d => colorScale(d));

legendItems.append("text")
    .attr("x", 16)
    .attr("y", 6)
    .attr("dy", "0.35em")
    .text(d => `Source: ${d}`)
    .style("font-size", "10px");  // Adjusted font size

    // Tooltip for legend items
    legendItems.on("mouseover", function(event, d) {
        d3.select("#tooltip")
          .style("display", "block")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px")
          .html(`Source: ${d}<br>Color: ${colorScale(d)}`);
    })
    .on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
    });

    // Add the opacity control slider functionality
    addOpacityControl();
}





//Control Opacity Function for Parallel Plot, 3d and 2d vis
function addOpacityControl() {
    const slider = document.getElementById('linkOpacitySlider');
    const sliderValue = document.getElementById('linkOpacityValue');

    slider.addEventListener('input', function() {
        const opacity = slider.value / 100;
        sliderValue.textContent = `${slider.value}%`;

        // Update opacity for parallel plot
        d3.selectAll('path').attr('opacity', opacity);

        // Update opacity for 2D edges
        const canvas = document.getElementById('canvas2D');
        if (canvas) {
            const context = canvas.getContext('2d');
            //context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
            edges2D.forEach(edge => {
                context.globalAlpha = opacity; // Set new opacity
                context.beginPath();
                context.moveTo(edge.source.x, edge.source.y);
                context.lineTo(edge.target.x, edge.target.y);
                context.stroke();
            });
            context.globalAlpha = 1.0; // Reset to default
        }

        // Update opacity for 3D edges
        edges3D.forEach(line => {
            line.material.opacity = opacity;
        });

        renderer.render(scene, camera); // Re-render the 3D scene
    });
}


///////////////////////////////////////////////////////
function clearVisualizationScenes() {
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
}
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////
////////////            2D Visualization Setup      /////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////
function getColorForChID(chID) {
    if (chID === "1") {
        return "#FF0000";  // Return red for the first chromosome
    } else {
        // Simple hash function to get a color for other chromosomes
        let hash = 0;
        for (let i = 0; i < chID.length; i++) {
            hash = chID.charCodeAt(i) + ((hash << 5) - hash);
        }
        const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return "#" + "00000".substring(0, 6 - color.length) + color;
    }
}



// Then in drawing code:
//context.fillStyle = getColorForChID(String(node.ChID));
//////////////////////////////////////////////////////////////////////////////////
////////////            2D Visualization Setup      /////////////////////////////
const vis2Container = document.getElementById('visualization2');
const canvas2D = document.createElement('canvas');
canvas2D.width = vis2Container.clientWidth;
canvas2D.height = 500; // Set a fixed height or make it responsive
canvas2D.id = 'canvas2D'; // Assign an ID to the canvas for easy reference
vis2Container.appendChild(canvas2D);


function draw2DVisualization(data) {
    const tooltip = document.getElementById('tooltip2D');

    const canvas = document.getElementById('canvas2D');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    const context = canvas.getContext('2d');

    // Adjust canvas size to fit within the parent container
    const container = document.getElementById('visualization2');
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    // Modify scaleX and scaleY calculations to add a buffer for margins
    const nodeRadius = 5;
    const padding = 20; // Padding from the canvas edges

    // Calculate scaling factors based on maximum coordinate ranges including padding
    const scaleX = (canvas.width - 2 * padding) / (getRange(data, 'x'));
    const scaleY = (canvas.height - 2 * padding) / (getRange(data, 'y'));

    // Determine the overall scale factor to fit the nodes within the canvas
    const scaleFactor = 0.8; // Adjust this factor as needed to fit the nodes within the canvas

    context.clearRect(0, 0, canvas.width, canvas.height);
    nodePositions = {}; // Reset positions map each time nodes are drawn

    // Sort nodes by numeric ID
    const sortedData = data.slice().sort((a, b) => parseInt(a.id.replace(/[^\d]/g, '')) - parseInt(b.id.replace(/[^\d]/g, '')));
    const startNode = sortedData[0];
    const endNode = sortedData[sortedData.length - 1];

    data.forEach(node => {
        const numericId = node.id.replace(/[^\d]/g, '');
        // Adjust node positions to include padding and ensure they stay within the canvas
        const x = padding + (node.x - getMin(data, 'x')) * scaleX * scaleFactor;
        const y = padding + (node.y - getMin(data, 'y')) * scaleY * scaleFactor;

        nodePositions[numericId] = { x, y };

        context.beginPath();
        context.arc(x, y, nodeRadius, 0, Math.PI * 2, true);

        // Set color based on whether the node is the start or end node
        if (node === startNode) {
            context.fillStyle = "green"; // Start node color
        } else if (node === endNode) {
            context.fillStyle = "blue"; // End node color
        } else {
            context.fillStyle = "red"; // Default node color
        }

        context.shadowBlur = 0.5;
        context.shadowColor = "rgba(255, 0, 0, 0.5)"; // Red glow
        context.fill();
        context.shadowBlur = 0; // Reset shadow blur for other elements
    });

    // Function to check if a point is inside a node's circle
    function isPointInNode(x, y, nodeX, nodeY, radius) {
        return Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2) < radius;
    }

    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        let foundNode = false;

        //context.clearRect(0, 0, canvas.width, canvas.height); // Clear and redraw for hover effects
        data.forEach(node => {
            const numericId = node.id.replace(/[^\d]/g, '');
            const x = nodePositions[numericId].x;
            const y = nodePositions[numericId].y;
            if (isPointInNode(mouseX, mouseY, x, y, nodeRadius)) { // Node radius is 5
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY + 10}px`;
                tooltip.innerHTML = `Node ID: ${node.id}`;

                // Highlight the node
                context.fillStyle = 'yellow'; // Change color for highlight
                foundNode = true;
            } else {
                // Reset to original color
                if (node === startNode) {
                    context.fillStyle = "green"; // Start node color
                } else if (node === endNode) {
                    context.fillStyle = "blue"; // End node color
                } else {
                    context.fillStyle = "red"; // Default node color
                }
            }
            context.beginPath();
            context.arc(x, y, nodeRadius, 0, Math.PI * 2, true); // Node radius is 5
            context.fill();
        });

        if (!foundNode) {
            tooltip.style.display = 'none';
        }
    });

    canvas.addEventListener('mouseout', function() {
        tooltip.style.display = 'none'; // Hide tooltip when not hovering over canvas
    });
}





// Helper functions to get the range and minimum value of nodes
function getRange(data, coord) {
    return Math.max(...data.map(node => node[coord])) - Math.min(...data.map(node => node[coord]));
}

function getMin(data, coord) {
    return Math.min(...data.map(node => node[coord]));
}

//////////////////////////////////////
async function fetchProcessedEdgeData(filePath) {
    try {
        console.log("Fetching processed edge data...");
        const rawData = await d3.json(filePath);
        console.log("Edge data fetched successfully:", rawData);
        const processedData = preprocessDataForHeatmap(rawData);
        createHeatmap(processedData);
    } catch (error) {
        console.error("Error fetching processed edge data:", error);
    }
}
  
function preprocessDataForHeatmap(rawData) {
    // Create a new array that will contain both halves of the matrix
    const processedData = [];
  
    // Iterate over each entry in the original data array
    rawData.forEach(entry => {
      // Add the original entry
      processedData.push({
        Source: (entry.Source),
        Target: (entry.Target),
        Weight: entry.Weight
      });
      // Add the mirrored entry if it's not the diagonal
      if (entry.Source !== entry.Target) {
        processedData.push({
          Source: (entry.Target), // Note the switch here
          Target: (entry.Source), // Source becomes Target and vice versa
          Weight: entry.Weight // The weight is the same
        });
      }
    });
    
    return processedData;
  }
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////
///////////////////////Heatmap Setting//////////////////////////////////////////////  
//For Zoom Functionality//
function createHeatmap(data) {
    const tooltip = d3.select("#tooltipHeatmap");
    const container = d3.select('#visualization3');
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    // Clear any existing content in the container
    container.selectAll('*').remove();

    // Define a color scale for the heatmap with a domain centered around the median weight
    const maxWeight = d3.max(data, d => d.Weight);
    const minWeight = d3.min(data, d => d.Weight);

    // Define a custom color interpolator that will make the colors darker
    const colorInterpolator = t => {
        const start = 0.1; // Starting at 10% will make the colors generally darker
        return d3.interpolateReds(start + t * (1 - start));
    };

    // Define a continuous color scale using the custom interpolator
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([minWeight, maxWeight]);

    // Create an SVG element inside the container for the heatmap
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

    // Define a clip path to confine the heatmap within the axes
    svg.append('defs').append('clipPath')
        .attr('id', 'clip')
        .append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('x', 0)
        .attr('y', 0);

    const heatmapGroup = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`)
        .attr('clip-path', 'url(#clip)');

    // Initial log of the transformation values
    console.log("Initial Transform: translate(", margin.left, ",", margin.top, ")");

    // Find the maximum value for both Source and Target in the data to set up dynamic domain
    const maxDataValue = d3.max(data, d => Math.max(d.Source, d.Target));

    const xScale = d3.scaleLinear()
        .domain([0, maxDataValue])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, maxDataValue])
        .range([height, 0]);

    // Append the axes inside the main SVG (not the heatmapGroup)
    const xAxisGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top + height})`)
        .call(d3.axisBottom(xScale).tickFormat(d => `Bin ${d}`));

    const yAxisGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .call(d3.axisLeft(yScale).tickFormat(d => `Bin ${d}`));

    // Create heatmap squares without stroke to mimic the Python visualization
    heatmapGroup.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.Source)) // Use the xScale for positioning
        .attr('y', d => yScale(d.Target)) // Use the yScale for positioning
        .attr('width', width / maxDataValue) // Set width to gridSizeX
        .attr('height', height / maxDataValue) // Set height to gridSizeY
        .style('fill', d => colorScale(d.Weight))
        .style('stroke-width', 0) // No stroke for a seamless appearance
        .on('mouseover', function(e, d) {
            tooltip.style('display', 'block');
            tooltip.html(`Source: ${d.Source}<br>Target: ${d.Target}<br>Weight: ${d.Weight.toFixed(6)}`);
        })
        .on('mousemove', function(e) {
            tooltip.style('left', (e.pageX + 10) + 'px')
                .style('top', (e.pageY - 20) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('display', 'none');
        });

    // Call the function to draw gene density lines
    drawGeneDensityLines(svg, width, height, margin, xScale, yScale);

    // Store the initial scales for resetting the zoom
    const initialXScale = xScale.copy();
    const initialYScale = yScale.copy();

    // Set up zoom functionality
    const zoom = d3.zoom()
        .scaleExtent([1, 10])  // Limit zooming between 1x and 10x
        .translateExtent([[0, 0], [width, height]]) // Constrain panning and zooming within the visualization area
        .extent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            // Log the transformation values
            console.log("Zoom Transform:", event.transform);

            // Apply transformation to the heatmap group
            if (event.transform.k === 1) {
                // Reset transformation to initial state when zoom level is at minimum
                heatmapGroup.attr('transform', `translate(${margin.left},${margin.top})`);
                xAxisGroup.call(d3.axisBottom(initialXScale).tickFormat(d => `Bin ${d}`));
                yAxisGroup.call(d3.axisLeft(initialYScale).tickFormat(d => `Bin ${d}`));
            } else {
                // Apply the zoom transformation
                heatmapGroup.attr('transform', event.transform);
                heatmapGroup.attr('stroke-width', 1 / event.transform.k);

                // Update the axes based on the zoom level
                const newXScale = event.transform.rescaleX(xScale);
                const newYScale = event.transform.rescaleY(yScale);
                xAxisGroup.call(d3.axisBottom(newXScale).tickFormat(d => `Bin ${d}`));
                yAxisGroup.call(d3.axisLeft(newYScale).tickFormat(d => `Bin ${d}`));
            }
        });

    svg.call(zoom);
    
}




//////Function for Highlighting the Heatmap based on node selection/////
// Set to track selected nodes
let selectedNodes = new Set();


function updateHeatmapHighlights(svg, isRangeHighlight = false) {
    const highlightColor = '#ff5722';  // Example: bright orange
    const highlightWidth = 2;  // Stroke width for better visibility

    // Optional: Define and append an SVG filter for a glow effect
    let filter = svg.select("#glow-filter");
    if (filter.empty()) {
        const defs = svg.append("defs");
        filter = defs.append("filter")
            .attr("id", "glow-filter")
            .attr("width", "200%")
            .attr("height", "200%");
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 2.5)
            .attr("result", "blur");
        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 0)
            .attr("dy", 0)
            .attr("result", "offsetBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode")
            .attr("in", "offsetBlur");
        feMerge.append("feMergeNode")
            .attr("in", "SourceGraphic");
    }

    // Clear all previous highlights
    svg.selectAll('rect')
        .style('stroke', null)
        .style('stroke-width', 0)
        .style("filter", null)
        .style('opacity', 1);  // Reset opacity

    if (isRangeHighlight) {
        const rangeStart = Math.min(...selectedNodeIdsForRange);
        const rangeEnd = Math.max(...selectedNodeIdsForRange);

        // Highlight the entire rows and columns for rangeStart and rangeEnd
        svg.selectAll('rect')
            .filter(d => d && (d.Source == rangeStart || d.Target == rangeStart || d.Source == rangeEnd || d.Target == rangeEnd))
            .style('stroke', highlightColor)
            .style('stroke-width', highlightWidth)
            .style("filter", "url(#glow-filter)");  // Apply the glow effect
    } else {
        selectedNodes.forEach(nodeId => {
            svg.selectAll('rect')
                .filter(d => d && (d.Source == nodeId || d.Target == nodeId))
                .style('stroke', highlightColor)
                .style('stroke-width', highlightWidth)
                .style("filter", "url(#glow-filter)")  // Apply the glow effect
                .style('opacity', 0.1);  // Set opacity to make the highlight transparent
        });
    }
}





////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////
/////////////////////////For 3d Vis////////////////////////


   //////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////
    ////////////            3D Visualization Setup      /////////////////////////////
    // Setup Three.js scene, camera, renderer, and controls
        scene = new THREE.Scene();

        const visualizationContainer = document.getElementById('visualization1');
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0); // Transparent background
        
        const margin = { top: 10, right: 10, bottom: 30, left: 10 }; // Adjust margin values as needed
        
        renderer.setSize(visualizationContainer.clientWidth - margin.left - margin.right, visualizationContainer.clientHeight - margin.top - margin.bottom);
        console.log("Renderer dimensions:", visualizationContainer.clientWidth - margin.left - margin.right, visualizationContainer.clientHeight - margin.top - margin.bottom);
        visualizationContainer.appendChild(renderer.domElement);
        
        camera = new THREE.PerspectiveCamera(45, (visualizationContainer.clientWidth - margin.left - margin.right) / (visualizationContainer.clientHeight - margin.top - margin.bottom), 0.1, 1000);
        camera.position.set(0, 0, 100); // Move the camera further away
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        camera.updateProjectionMatrix();
        
        var ambientLight = new THREE.AmbientLight(0xaaaaaa);
        scene.add(ambientLight);
        
        var light = new THREE.PointLight(0xffffff, 1);
        light.position.set(50, 50, 50);
        scene.add(light);
        
        controls = new OrbitControls(camera, renderer.domElement);
        
        function onWindowResize() {
            camera.aspect = (visualizationContainer.clientWidth - margin.left - margin.right) / (visualizationContainer.clientHeight - margin.top - margin.bottom);
            camera.updateProjectionMatrix();
            renderer.setSize(visualizationContainer.clientWidth - margin.left - margin.right, visualizationContainer.clientHeight - margin.top - margin.bottom);
        }
        
        window.addEventListener('resize', onWindowResize, false);
        onWindowResize();  // Call initially to set size.
        
        scene.background = new THREE.Color(0xf0f0f0);
        
        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            controls.update(); // Needed if controls.enableDamping or controls.autoRotate are set to true
            renderer.render(scene, camera);
        }
        animate();
    

    //For Creating Nodes for 3d Visualization
    function createNodes(nodeData) {
        // Clear existing nodes in the scene
        while(scene.children.length > 0) { 
            scene.remove(scene.children[0]); 
        }
    
        // Sort nodes by numeric ID
        const sortedData = nodeData.slice().sort((a, b) => parseInt(a.id.replace(/[^\d]/g, '')) - parseInt(b.id.replace(/[^\d]/g, '')));
        const startNode = sortedData[0];
        const endNode = sortedData[sortedData.length - 1];
    
        nodeData.forEach(node => {
            const numericId = node.id.replace(/[^\d]/g, ''); // Assumes node.id is like 'Node1'
            const color = getColorForChID(String(node.ChID));
    
            let nodeMaterial;
    
            // Set up the material with different colors for start and end nodes
            if (node === startNode) {
                nodeMaterial = new THREE.MeshStandardMaterial({
                    color: 0x00FF00, // Green color for start node
                    emissive: 0x00FF00, // Same color for emissive to create a glow effect
                    emissiveIntensity: 1,
                    roughness: 0.1,
                    metalness: 0.5
                });
            } else if (node === endNode) {
                nodeMaterial = new THREE.MeshStandardMaterial({
                    color: 0x0000FF, // Blue color for end node
                    emissive: 0x0000FF,
                    emissiveIntensity: 1,
                    roughness: 0.1,
                    metalness: 0.5
                });
            } else {
                nodeMaterial = new THREE.MeshStandardMaterial({
                    color: 0xFF0000, // Red color for other nodes
                    emissive: 0xFF0000,
                    emissiveIntensity: 1,
                    roughness: 0.1,
                    metalness: 0.5
                });
            }
    
            // Reduce the node size
            const geometry = new THREE.SphereGeometry(0.5, 32, 32); // Node radius set to 0.5
            const sphere = new THREE.Mesh(geometry, nodeMaterial);
            sphere.position.set(node.x * 0.1, node.y * 0.1, node.z * 0.1);
            sphere.name = numericId;
            scene.add(sphere);
        });
    
        renderer.render(scene, camera);
    }
    
    
    //Updating Tooltip for 3d Visualization
    function updateTooltip(event, node) {
        const tooltip = document.getElementById('tooltip3D');
        if (node) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${event.clientX + 10}px`;
            tooltip.style.top = `${event.clientY + 10}px`;
            tooltip.innerHTML = `Node ID: ${node.name}`;
        } else {
            tooltip.style.display = 'none';
        }
    }
    

    //Function for mouse hover on 3d visualization
    renderer.domElement.addEventListener('mousemove', function(event) {
        var rect = renderer.domElement.getBoundingClientRect();  // Get the bounding rectangle of renderer
    
        // Convert mouse position to NDC
        var mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
        // Update the picking ray with the camera and mouse position
        var raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
    
        // Perform raycasting
        var intersects = raycaster.intersectObjects(scene.children);
    
        if (intersects.length > 0) {
            let hoveredNode = intersects[0].object;
            hoveredNode.material.emissive.setHex(0xffff00); // Highlight the node
            updateTooltip(event, hoveredNode);
        } else {
            scene.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    child.material.emissive.setHex(child.material.color.getHex()); // Reset glow to original color
                }
            });
            updateTooltip(event, null); // Hide tooltip when not hovering over any node
        }
    });
    
    
    // For Mouse Click Function- Must have; It control the mouse click in the node selection dropdown menu as well
        function onCanvasClick(event) {
            var mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
        
            console.log("Mouse NDC Position:", mouse.x, mouse.y); // Debug mouse positions
        
            var raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
        
            var intersects = raycaster.intersectObjects(scene.children);
            console.log("Intersections found:", intersects.length); // Debug number of intersections
        
            if (intersects.length > 0) {
                if (selectedNode) {
                    selectedNode.material.emissive.setHex(0x000000);
                }
        
                selectedNode = intersects[0].object;
                selectedNode.material.emissive.setHex(0xff0000);
                console.log("Clicked on node: " + selectedNode.name); // Should log when a node is clicked
            }
        }
        
        //// Gene Density Function///
        async function fetchGeneDensityData(filePath) {
            try {
                console.log("Fetching gene density data...");
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                console.log("Gene density data fetched successfully:", data);
                window.geneDensityData = data;
            } catch (error) {
                console.error("Error fetching gene density data:", error);
            }
        }
        
        function drawGeneDensityLines(svg, width, height, margin, xScale, yScale) {
            // Ensure gene density data is available
            if (!window.geneDensityData) {
                console.error("Gene density data not available");
                return;
            }
        
            const colorScale = d3.scaleSequential(d3.interpolateReds)
                .domain([0, d3.max(window.geneDensityData, d => d.density)]);
        
            // Create a group for the gene density lines
            const geneDensityGroup = svg.append('g')
                .attr('class', 'gene-density-group')
                .attr('transform', `translate(${margin.left},${margin.top})`);
        
            // Add a tooltip div. Initially hidden.
            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('padding', '6px')
                .style('background', 'lightgray')
                .style('border', '1px solid #333')
                .style('border-radius', '4px')
                .style('pointer-events', 'none')
                .style('display', 'none');
        
            // Draw the gene density line at the bottom
            geneDensityGroup.selectAll('.density-line-bottom')
                .data(window.geneDensityData)
                .enter()
                .append('rect')
                .attr('class', 'density-line-bottom')
                .attr('x', d => xScale(d.node))
                .attr('y', height + margin.bottom / 2) // Slightly above the x-axis
                .attr('width', width / window.geneDensityData.length) // Adjust width to fit within the x-axis
                .attr('height', margin.bottom / 4) // Height of the density line
                .attr('fill', d => colorScale(d.density))
                .on('mouseover', function(e, d) {
                    tooltip.style('display', 'block');
                    tooltip.html(`Node: ${d.node}<br>Density: ${d.density}`);
                })
                .on('mousemove', function(e) {
                    tooltip.style('left', (e.pageX + 10) + 'px')
                        .style('top', (e.pageY - 20) + 'px');
                })
                .on('mouseout', function() {
                    tooltip.style('display', 'none');
                });
        }

        
        ///////////////////////////////////////////////////////////////////////////////////////
        // Function for updating gene density line with zoom in or out in heatmap visualization

        // function updateGeneDensityLines(svg, width, height, margin, newXScale, zoomLevel) {
        //     // Ensure gene density data is available
        //     if (!window.geneDensityData) {
        //         console.error("Gene density data not available");
        //         return;
        //     }
        
        //     const colorScale = d3.scaleSequential(d3.interpolateReds)
        //         .domain([0, d3.max(window.geneDensityData, d => d.density)]);
        
        //     // Update the gene density line at the bottom based on the zoom level
        //     svg.selectAll('.density-line-bottom')
        //         .data(window.geneDensityData)
        //         .attr('x', d => newXScale(d.node))
        //         .attr('width', zoomLevel === 1 ? width / window.geneDensityData.length : newXScale(d.node + 1) - newXScale(d.node));
        // }
        
        /////////////////////////////////////////////////////////////////////////////////////////////////////
        
        ///////////Gene density drawing for Parallel Plot/////////////
        function drawGeneDensityLinesParallelPlot(svg, width, height, margin, combinedNodes, sourceScale, targetScale) {
            // Ensure gene density data is available
            if (!window.geneDensityData) {
                console.error("Gene density data not available");
                return;
            }
        
            const colorScale = d3.scaleSequential(d3.interpolateReds)
                .domain([0, d3.max(window.geneDensityData, d => d.density)]);
        
            const tooltip = d3.select("#tooltipParallelPlot");
        
            // Draw gene density line along the left axis (shifted left)
            svg.selectAll(".density-line-left")
                .data(window.geneDensityData)
                .enter()
                .append("rect")
                .attr("class", "density-line-left")
                .attr("x", -20) // Position it outside the left margin
                .attr("y", d => sourceScale(d.node))
                .attr("width", 20)
                .attr("height", height / combinedNodes.length)
                .style("fill", d => colorScale(d.density))
                .on('mouseover', function (e, d) {
                    tooltip.style('display', 'block')
                           .html(`Node: ${d.node}<br>Density: ${d.density}`);
                })
                .on('mousemove', function (e) {
                    tooltip.style('left', (e.pageX + 10) + 'px')
                           .style('top', (e.pageY - 20) + 'px');
                })
                .on('mouseout', function () {
                    tooltip.style('display', 'none');
                });
        
            // Draw gene density line along the right axis (shifted right)
            svg.selectAll(".density-line-right")
                .data(window.geneDensityData)
                .enter()
                .append("rect")
                .attr("class", "density-line-right")
                .attr("x", width) // Position it at the right edge of the plot
                .attr("y", d => targetScale(d.node))
                .attr("width", 10)
                .attr("height", height / combinedNodes.length)
                .style("fill", d => colorScale(d.density))
                .on('mouseover', function (e, d) {
                    tooltip.style('display', 'block')
                           .html(`Node: ${d.node}<br>Density: ${d.density}`);
                })
                .on('mousemove', function (e) {
                    tooltip.style('left', (e.pageX + 10) + 'px')
                           .style('top', (e.pageY - 20) + 'px');
                })
                .on('mouseout', function () {
                    tooltip.style('display', 'none');
                });
        }
        
        ///////////Functionality for Clear Button/////
        function clearVisualizations() {
            // Clear 3D scene
            while (scene.children.length > 0) { 
                scene.remove(scene.children[0]); 
            }
            renderer.render(scene, camera);
        
            // Clear 2D canvas
            const canvas2D = document.getElementById('canvas2D');
            if (canvas2D) {
                const context = canvas2D.getContext('2d');
                context.clearRect(0, 0, canvas2D.width, canvas2D.height);
            }
        
            // Clear heatmap visualization
            const heatmapSVG = d3.select('#visualization3').select('svg');
            if (!heatmapSVG.empty()) {
                heatmapSVG.selectAll('*').remove();
            }
        
            // Clear parallel plot visualization
            const parallelPlotSVG = d3.select('#visualization4').select('svg');
            if (!parallelPlotSVG.empty()) {
                parallelPlotSVG.selectAll('*').remove();
            }
        
            // Reset dataset selector
            document.getElementById('dataset-selector').value = '';
        
            // Reset node checkboxes
            const nodeCheckboxes = document.querySelectorAll('#node-checkboxes input[type="checkbox"]');
            nodeCheckboxes.forEach(checkbox => checkbox.checked = false);

            //Disselect for interaction checkboxes
            const interactionCheckboxes = document.querySelectorAll('input[name="interaction"]');
            interactionCheckboxes.forEach(checkbox => checkbox.checked = false);


            // Clear other selections and controls if any
            // Reset edge weight slider value
            const edgeWeightSlider = document.getElementById('edgeWeightSlider');
            edgeWeightSlider.value = 100;
            document.getElementById('edgeWeightValue').textContent = '100%';
        
            // Reset opacity slider value
            const linkOpacitySlider = document.getElementById('linkOpacitySlider');
            linkOpacitySlider.value = 100; // Assuming the initial value is 70%
            document.getElementById('linkOpacityValue').textContent = '100%';
            d3.selectAll('path').attr('opacity', 1.0); // Reset the opacity of links
        
            // Reset bin range inputs
            document.getElementById('fromBin').value = '';
            document.getElementById('toBin').value = '';
        
            // Clear any remaining tooltip
            const tooltips = document.querySelectorAll('.tooltip');
            tooltips.forEach(tooltip => tooltip.style.display = 'none');
        
            // Optionally, reinitialize nodes (without edges)
            // fetchNodesFromJson('WT_BS_Node_3D.json'); // Uncomment if you want to reload nodes
        }
        
        document.getElementById('clear-visualizations').addEventListener('click', clearVisualizations);
        
        