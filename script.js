import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js'; 
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/controls/OrbitControls.js'; 
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/GLTFLoader.js'; 
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/RGBELoader.js'; 
import { RoughnessMipmapper } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/utils/RoughnessMipmapper.js';

//For 3d vis nodehighlight interaction
var selectedNode = null;

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
    document.getElementById('visualize-nodes').addEventListener('click', function() {
        const selectedNodeIds = Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked'))
                                     .map(checkbox => checkbox.dataset.nodeId);
        const selectedDataset = document.getElementById('dataset-selector').value;
        const edgeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Edge_processed.json' : 'Other_Dataset_Edge.json';
    
        fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, function(filteredEdges) {
            createEdges3D(filteredEdges);  // Draw 3D edges
            const context = document.getElementById('canvas2D').getContext('2d');
            console.log("Available node positions before drawing 2D edges:", nodePositions);
            drawEdges2D(filteredEdges, context);

            ///Heatmap Visualization///
            // Update the global set of selected nodes based on the current checkbox state
            selectedNodes.clear();  // Clear the set and add all currently selected nodes
            selectedNodeIds.forEach(id => selectedNodes.add(id));

            const svg = d3.select('#visualization3').select('svg');
            updateHeatmapHighlights(svg);

            //For Parallel Plot
            setupAndDrawParallelPlot(edgeDataPath, selectedNodeIds);

        });
        
    });
    
    
}



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
        switch (selectedDataset) {
            case 'WT_BS':
                clearVisualizationScenes(); // Clears all scenes
                fetchNodesFromJson('WT_BS_Node_3D.json'); // Specific for 3D visualizations
                fetchProcessedEdgeData('WT_BS_Edge_processed.json');
                setupParallelPlotData('WT_BS_Edge_processed.json'); // Parallel plot specific data
                break;
            //case 'Other_Dataset': // Example of another dataset
                //clearVisualizationScenes();
                //fetchNodesFromJson('Other_Dataset_Node_3D.json');
                //setupParallelPlotData('Other_Dataset_Edge_processed.json');
                //break;
            // Add more cases as needed
        }
    });

    function fetchNodesFromJson(filePath) {
        console.log("Flag");
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                //console.log("Data loaded:", data);
                updateNodeDropdown(data); // Update the dropdown with the new data
                //createNodes(data);       // Create nodes for the 3D visualization

                ///For 2d Vis////
                //console.log("Data loaded:", data);
                createNodes(data); // For 3D visualization
                draw2DVisualization(data); // For 2D visualization
                //drawParallelPlot(data);    // New function for parallel plot visualization
            })
            .catch(error => {
                console.error("Error fetching nodes:", error);
            });
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

function fetchAndFilterEdgeData(filePath, selectedNodeIds, callback) {
    d3.json(filePath).then(rawData => {
        // Filter edges based on node selection only
        const filteredEdges = rawData.filter(edge => 
            selectedNodeIds.includes(String(edge.Source)) || selectedNodeIds.includes(String(edge.Target))
        );
        callback(filteredEdges);  // Execute the callback with filtered edges
    }).catch(error => {
        console.error("Error fetching and filtering edge data:", error);
    });
}

    
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////


///////////////////////////////////
///Slider Control for Edge Visibility in 3d and 2d vis///
let maxEdgeWeight = 0;  // Global variable to store the maximum edge weight

function updateEdgeVisibility(value) {
    const selectedNodeIds = Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked'))
                                 .map(checkbox => checkbox.dataset.nodeId);
    const selectedDataset = document.getElementById('dataset-selector').value;
    const edgeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Edge_processed.json' : 'Other_Dataset_Edge.json';
    const nodeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Node_3D.json' : 'Other_Dataset_Node_data.json'; // Correctly define nodeDataPath

    
    fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, function(filteredEdges) {
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
        updateParallelPlot(edgeDataPath, selectedNodeIds, numberOfEdgesToShow);  // Assumes this function is adapted to fetch and filter as needed
    });
}

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



function clearOnlyEdges2D(context, canvas, nodeData) {
    context.clearRect(0, 0, canvas.width, canvas.height); // Clears the entire canvas
    draw2DVisualization(nodeData); // Redraw only nodes to avoid edge deletion
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
}

//Function for draw edges of selected nodes for 3d vis////
function createEdges3D(edgeData) {
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });

    edgeData.forEach(edge => {
        const sourceNode = scene.getObjectByName(String(edge.Source));
        const targetNode = scene.getObjectByName(String(edge.Target));

        if (sourceNode && targetNode) {
            const points = [sourceNode.position.clone(), targetNode.position.clone()];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            scene.add(line);
            console.log(`Drawing edge between ${edge.Source} and ${edge.Target}`);
        } else {
            // Log failure to retrieve nodes
            console.log(`Failed to find nodes for edge between ${edge.Source} and ${edge.Target}`);
        }
    });

    renderer.render(scene, camera);
}


    
///////////////////////////////////
//Function for draw edges of selected nodes for 2d vis////

function drawEdges2D(edgeData, context) {
    console.log("Drawing edges in 2D for edge data:", edgeData);

    context.strokeStyle = '#0000ff';  // Set edge color
    edgeData.forEach(edge => {
        const sourceNode = nodePositions[edge.Source];
        const targetNode = nodePositions[edge.Target];

        if (sourceNode && targetNode) {
            context.beginPath();
            context.moveTo(sourceNode.x, sourceNode.y);
            context.lineTo(targetNode.x, targetNode.y);
            context.stroke();
            console.log(`Edge drawn from ${edge.Source} to ${edge.Target}`);
        } else {
            console.log(`Nodes not found for edge from ${edge.Source} to ${edge.Target}`);
        }
    });
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
            // Filter data to only include edges that have sources or targets in selectedNodeIds
            //const filteredData = data.filter(d => selectedNodeIds.includes(String(d.Source)) || selectedNodeIds.includes(String(d.Target)));
            const filteredData = data.filter(d => selectedNodeIds.includes(String(d.Source)));
            // Check if there is any data to process
            if (filteredData.length === 0) {
                console.log("No data to draw links for selected nodes.");
                return;
            }

            // Construct allNodes from filteredData
            const allNodes = {
                sources: [...new Set(filteredData.map(d => d.Source))].sort((a, b) => a - b),
                targets: [...new Set(filteredData.map(d => d.Target))].sort((a, b) => a - b)
            };

            // Setup SVG and axes
            const { svg, sourceScale, targetScale, width, height } = setupSVGandAxes(allNodes);

            console.log("Filtered data for links:", filteredData);

            // Draw links only for selected nodes
            drawLinks({ svg, sourceScale, targetScale, data: filteredData, width }); 
        })
        .catch(error => console.error("Error setting up parallel plot:", error));
}


// Function to setup and fetch data for the parallel plot

function setupParallelPlotData(filePath) {
    fetch(filePath)
        .then(response => response.json())
        .then(data => {
            maxEdgeWeight = Math.max(...data.map(d => d.Weight));
            console.log("Max weight in original data:", maxEdgeWeight);

            const allNodes = {
                sources: [...new Set(data.map(d => d.Source))],
                targets: [...new Set(data.map(d => d.Target))]
            };

            // Make sure to pass 'allNodes' correctly
            console.log("All Nodes:", allNodes);

            setupSVGandAxes(allNodes); // Now passes 'allNodes'
        })
        .catch(error => console.error("Error fetching parallel plot data:", error));
}


function setupSVGandAxes(allNodes) {
    const container = d3.select("#visualization4");
    const margin = { top: 30, right: 30, bottom: 30, left: 30 },
         totalWidth = 700,
         totalHeight = 630,
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
        .domain(allNodes.sources.sort((a, b) => a - b))
        .range([0, height]);

    const targetScale = d3.scalePoint()
        .domain(allNodes.targets.sort((a, b) => a - b))
        .range([0, height]);

    // Function to select every 10th element for label
    const tickInterval = 10;
    const sourceTicks = allNodes.sources.filter((d, i) => i % tickInterval === 0);
    const targetTicks = allNodes.targets.filter((d, i) => i % tickInterval === 0);

    svg.append("g")
        .call(d3.axisLeft(sourceScale).tickValues(sourceTicks))
        .attr("transform", "translate(0,0)");
    
    svg.append("g")
        .call(d3.axisRight(targetScale).tickValues(targetTicks))
        .attr("transform", `translate(${width},0)`);

    return { svg, sourceScale, targetScale, width, height };
}




function drawLinks({ svg, sourceScale, targetScale, data, width }) {
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
           return `M0,${sourceY} L${width},${targetY}`;
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
}


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
    // Simple hash function to get a color
    let hash = 0;
    for (let i = 0; i < chID.length; i++) {
        hash = chID.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
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
    const scaleX = canvas.width / (getRange(data, 'x') + 1);
    const scaleY = canvas.height / (getRange(data, 'y') + 1);

    context.clearRect(0, 0, canvas.width, canvas.height);
    nodePositions = {}; // Reset positions map each time nodes are drawn

    data.forEach(node => {
        const numericId = node.id.replace(/[^\d]/g, '');
        const x = (node.x - getMin(data, 'x')) * scaleX;
        const y = (node.y - getMin(data, 'y')) * scaleY;

        nodePositions[numericId] = { x, y };

        context.beginPath();
        context.arc(x, y, 10, 0, Math.PI * 2, true);
        context.fillStyle = getColorForChID(String(node.ChID));
        context.fill();
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
            if (isPointInNode(mouseX, mouseY, x, y, 10)) { // Node radius is 10
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY + 10}px`;
                tooltip.innerHTML = `Node ID: ${node.id}`;

                // Highlight the node
                context.fillStyle = 'yellow'; // Change color for highlight
                foundNode = true;
            } else {
                context.fillStyle = getColorForChID(String(node.ChID));
            }
            context.beginPath();
            context.arc(x, y, 10, 0, Math.PI * 2, true); // Node radius is 10
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
function fetchProcessedEdgeData(filePath) {
    // Fetch and process the edge data for heatmap and other visualizations
    d3.json(filePath).then(rawData => {
      // Preprocess data to include both halves for a full heatmap
      const processedData = preprocessDataForHeatmap(rawData);
      // Pass the processed data to the function that creates the heatmap
      createHeatmap(processedData);
      // If you have other visualizations that use this data, call those functions here too
    }).catch(error => {
      console.error("Error fetching processed edge data:", error);
    });
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

  function createHeatmap(data) {
    const tooltip = d3.select("#tooltipHeatmap");
    // Select the visualization container and set up dimensions
    const container = d3.select('#visualization3');
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    // Clear any existing content in the container
    container.selectAll('*').remove();

    // Define a color scale for the heatmap with a domain centered around the median weight
    // Find the maximum weight value for scaling color intensity
    const maxWeight = d3.max(data, d => d.Weight);
    const minWeight = d3.min(data, d => d.Weight); // Assuming minWeight is the minimum weight in your data

    // Define a custom color interpolator that will make the colors darker
    const colorInterpolator = t => {
        // This function takes a value t between 0 and 1 and returns a color
        // If you want to make the colors darker, you can adjust the range below
        const start = 0.1; // Starting at 50% will make the colors generally darker
        return d3.interpolateReds(start + t * (1 - start));
    };

// Define a continuous color scale using the custom interpolator
const colorScale = d3.scaleSequential(colorInterpolator)
    .domain([minWeight, maxWeight]);


    // Create an SVG element inside the container for the heatmap
    const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

    const heatmapGroup = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Find the maximum value for both Source and Target in the data to set up dynamic domain
    const maxDataValue = d3.max(data, d => Math.max(d.Source, d.Target));

    const xScale = d3.scaleLinear()
        .domain([0, maxDataValue])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, maxDataValue])
        .range([height, 0]);

    // Calculate the size of the grid based on the new scale
    // The grid size is dynamically determined by the maximum value
    const gridSizeX = width / (maxDataValue + 1); // plus 1 to include the last grid at the end
    const gridSizeY = height / (maxDataValue + 1); // plus 1 for the same reason
// ...

    // Append the axes inside the heatmapGroup
    heatmapGroup.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d => `${d}MB`));

    heatmapGroup.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => `${d}MB`));

// Calculate the size of the grid squares - make them square based on the smaller dimension
const gridSize = Math.min(width / d3.max(data, d => d.Source + 1), height / d3.max(data, d => d.Target + 1));

// Create heatmap squares without stroke to mimic the Python visualization
// Create heatmap squares
heatmapGroup.selectAll('rect')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', d => xScale(d.Source)) // Use the xScale for positioning
    .attr('y', d => yScale(d.Target)) // Use the yScale for positioning
    .attr('width', gridSizeX) // Set width to gridSizeX
    .attr('height', gridSizeY) // Set height to gridSizeY
    .style('fill', d => colorScale(d.Weight))
    .style('stroke-width', 0) // No stroke for a seamless appearance
    .on('mouseover', function(e, d) {
        tooltip.style('display', 'block');
        tooltip.html(`Source: ${d.Source}<br>Target: ${d.Target}<br>Weight: ${d.Weight.toFixed(6)}`);
    })
    .on('mousemove', function(e) {
        tooltip.style('left', (e.pageX + 10) + 'px')
               .style('top', (e.pageY + 10) + 'px');
    })
    .on('mouseout', function() {
        tooltip.style('display', 'none');
    });
}

//////Function for Highlighting the Heatmap based on node selection/////
// Set to track selected nodes
let selectedNodes = new Set();

function updateHeatmapHighlights(svg) {
    // Clear all highlights
    svg.selectAll('rect')
        .style('stroke', null)
        .style('stroke-width', 0);

    // Reapply highlights for all selected nodes
    selectedNodes.forEach(nodeId => {
        svg.selectAll('rect')
            .filter(d => d.Source == nodeId || d.Target == nodeId)
            .style('stroke', 'black')
            .style('stroke-width', 2);
    });
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
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(visualizationContainer.clientWidth, visualizationContainer.clientHeight);
    console.log("Renderer dimensions:", visualizationContainer.clientWidth, visualizationContainer.clientHeight);
    visualizationContainer.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(45, visualizationContainer.clientWidth / visualizationContainer.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 50);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    camera.updateProjectionMatrix();

    var ambientLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambientLight);

    var light = new THREE.PointLight(0xffffff, 1);
    light.position.set(50, 50, 50);
    scene.add(light);

    controls = new OrbitControls(camera, renderer.domElement);

//setup2DCanvas();

//////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////
function onWindowResize() {
    camera.aspect = visualizationContainer.clientWidth / visualizationContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(visualizationContainer.clientWidth, visualizationContainer.clientHeight);
}

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();  // Call initially to set size.
 //////////////////////////////////////////////////////////////////////////////////////   

    // Scene background color
    scene.background = new THREE.Color(0xf0f0f0);
//////////////////////////////////////////////////////////////////////////////////////
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // Needed if controls.enableDamping or controls.autoRotate are set to true
        renderer.render(scene, camera);
    }
    animate();

    function createNodes(nodeData) {
        while(scene.children.length > 0) { 
            scene.remove(scene.children[0]); 
        }
    
        nodeData.forEach(node => {
            const numericId = node.id.replace(/[^\d]/g, ''); // Assumes node.id is like 'Node1'
            const color = getColorForChID(String(node.ChID));
            const nodeMaterial = new THREE.MeshPhongMaterial({ 
                color: color, 
                emissive: 0x000000,  // Initial emissive color set to black
                emissiveIntensity: 0.5
            });
            const geometry = new THREE.SphereGeometry(1, 32, 32);
            const sphere = new THREE.Mesh(geometry, nodeMaterial);
            sphere.position.set(node.x * 0.1, node.y * 0.1, node.z * 0.1);
            sphere.name = numericId;
            scene.add(sphere);
        });
    
        renderer.render(scene, camera);
    }
    
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
        