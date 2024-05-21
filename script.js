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

            // Heatmap Visualization
            selectedNodes.clear();  // Clear the set and add all currently selected nodes
            selectedNodeIds.forEach(id => selectedNodes.add(id));

            const svg = d3.select('#visualization3').select('svg');
            updateHeatmapHighlights(svg);

            // For Parallel Plot
            setupAndDrawParallelPlot(edgeDataPath, selectedNodeIds);
        });
    });

    // Visualize Range button functionality (only updates heatmap)
    document.getElementById('visualize-range').addEventListener('click', function() {
        const fromBin = parseInt(document.getElementById('fromBin').value);
        const toBin = parseInt(document.getElementById('toBin').value);

        if (isNaN(fromBin) || isNaN(toBin) || fromBin > toBin) {
            alert("Please enter a valid range of bin numbers.");
            return;
        }

        const selectedNodeIds = [];
        for (let i = fromBin; i <= toBin; i++) {
            selectedNodeIds.push(i.toString());
        }

        // Update the heatmap
        selectedNodes.clear();  // Clear the set and add all currently selected nodes
        selectedNodeIds.forEach(id => selectedNodes.add(id));

        const svg = d3.select('#visualization3').select('svg');
        updateHeatmapHighlights(svg);
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
                fetchGeneDensityData('WT_BS_gene_density.json'); // Fetch gene density data
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
            console.log(`Drawing edge between ${edge.Source} and ${edge.Target}`);
        } else {
            console.log(`Failed to find nodes for edge between ${edge.Source} and ${edge.Target}`);
        }
    });

    renderer.render(scene, camera);
}



    
///////////////////////////////////
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

    // Resetting context properties after drawing
    context.globalAlpha = 1.0;
    context.shadowBlur = 0;  // Remove shadow after drawing edges
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
    // Combine sources and targets into one set, then convert to sorted array
    const combinedNodes = [...new Set([...allNodes.sources, ...allNodes.targets])].sort((a, b) => a - b);

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
        .domain(combinedNodes)
        .range([0, height]);

    const targetScale = d3.scalePoint()
        .domain(combinedNodes)
        .range([0, height]);

    // Function to select every 10th element for label, using the combined node list
    const tickInterval = 10;
    const ticks = combinedNodes.filter((d, i) => i % tickInterval === 0);

    svg.append("g")
        .call(d3.axisLeft(sourceScale).tickValues(ticks))
        .attr("transform", "translate(0,0)");
    
    svg.append("g")
        .call(d3.axisRight(targetScale).tickValues(ticks))
        .attr("transform", `translate(${width},0)`);

    // Call the function to draw gene density lines
    drawGeneDensityLinesParallelPlot(svg, width, height, margin, combinedNodes, sourceScale, targetScale);

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

    // Create a legend for color representation of each source
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(10,10)");

    const legendItems = legend.selectAll(".legend-item")
        .data(colorScale.domain())
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendItems.append("rect")
        .attr("x", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", d => colorScale(d));

    legendItems.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .text(d => `Source: ${d}`)
        .style("font-size", "12px");

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

//Control Opacity Function for Parallel Plot
function addOpacityControl() {
    const slider = document.getElementById('linkOpacitySlider');
    const sliderValue = document.getElementById('linkOpacityValue');

    slider.addEventListener('input', function() {
        const opacity = slider.value / 100;
        sliderValue.textContent = `${slider.value}%`;
        d3.selectAll('path').attr('opacity', opacity);
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

    ////

    const canvas = document.getElementById('canvas2D');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    const context = canvas.getContext('2d');

    // Modify scaleX and scaleY calculations to add a buffer for margins
    // Define constants for canvas dimensions and node radius
    const nodeRadius = 5;
    const padding = 20; // Padding from the canvas edges

    // Calculate scaling factors based on maximum coordinate ranges including padding
    const scaleX = (canvas.width - 2 * padding) / (getRange(data, 'x'));
    const scaleY = (canvas.height - 2 * padding) / (getRange(data, 'y'));

    context.clearRect(0, 0, canvas.width, canvas.height);
    nodePositions = {}; // Reset positions map each time nodes are drawn

    data.forEach(node => {
        const numericId = node.id.replace(/[^\d]/g, '');
        // Adjust node positions to include padding and ensure they stay within the canvas
        const x = padding + (node.x - getMin(data, 'x')) * scaleX;
        const y = padding + (node.y - getMin(data, 'y')) * scaleY;
    
        nodePositions[numericId] = { x, y };
    
        context.beginPath();
        context.arc(x, y, nodeRadius, 0, Math.PI * 2, true);
        context.shadowBlur = 0.5;
        context.shadowColor = "rgba(255, 0, 0, 0.5)"; // Red glow
        context.fillStyle = "red"; // Node color
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
            context.arc(x, y, nodeRadius, 0, Math.PI * 2, true); // Node radius is 10
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
                xAxisGroup.attr('transform', `translate(${margin.left},${margin.top + height})`);
                yAxisGroup.attr('transform', `translate(${margin.left},${margin.top})`);
            } else {
                // Apply the zoom transformation
                heatmapGroup.attr('transform', event.transform);
                heatmapGroup.attr('stroke-width', 1 / event.transform.k);

                // Update the axes based on the zoom level
                const newXScale = event.transform.rescaleX(xScale);
                const newYScale = event.transform.rescaleY(yScale);
                xAxisGroup.call(d3.axisBottom(newXScale).tickFormat(d => `Bin ${d}`));
                yAxisGroup.call(d3.axisLeft(newYScale).tickFormat(d => `Bin ${d}`));

                // Update the gene density lines based on the zoom level
                updateGeneDensityLines(svg, width, height, margin, newXScale, event.transform.k);
            }
        });

    svg.call(zoom);
}














//////Function for Highlighting the Heatmap based on node selection/////
// Set to track selected nodes
let selectedNodes = new Set();

function updateHeatmapHighlights(svg) {
    // Define a vibrant stroke color and increased stroke width
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

    // Reapply highlights for all selected nodes
    selectedNodes.forEach(nodeId => {
        svg.selectAll('rect')
            .filter(d => d && (d.Source == nodeId || d.Target == nodeId))
            .style('stroke', highlightColor)
            .style('stroke-width', highlightWidth)
            .style("filter", "url(#glow-filter)")  // Apply the glow effect
            .style('opacity', 0.5);  // Set opacity to make the highlight transparent
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
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); // Transparent background
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

    //For Creating Nodes for 3d Visualization
    function createNodes(nodeData) {
        while(scene.children.length > 0) { 
            scene.remove(scene.children[0]); 
        }
    
        nodeData.forEach(node => {
            const numericId = node.id.replace(/[^\d]/g, ''); // Assumes node.id is like 'Node1'
            const color = getColorForChID(String(node.ChID));
            // Set up the material with a glowing red color
            const nodeMaterial = new THREE.MeshStandardMaterial({
                color: 0xFF5733, // A vibrant red color
                emissive: 0xFF5733, // Same color for emissive to create a glow effect
                emissiveIntensity: 1, // Increased emissive intensity
                roughness: 0.1, // A low roughness to make the material shinier
                metalness: 0.5  // Increased metalness for a metallic sheen
            });
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
        function fetchGeneDensityData(filePath) {
            fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Store the gene density data for later use
                    window.geneDensityData = data;
                })
                .catch(error => {
                    console.error("Error fetching gene density data:", error);
                });
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
                .attr('y', height + margin.bottom / 4) // Slightly above the x-axis
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
        
        function updateGeneDensityLines(svg, width, height, margin, newXScale, zoomLevel) {
            // Ensure gene density data is available
            if (!window.geneDensityData) {
                console.error("Gene density data not available");
                return;
            }
        
            const colorScale = d3.scaleSequential(d3.interpolateReds)
                .domain([0, d3.max(window.geneDensityData, d => d.density)]);
        
            // Update the gene density line at the bottom based on the zoom level
            svg.selectAll('.density-line-bottom')
                .data(window.geneDensityData)
                .attr('x', d => newXScale(d.node))
                .attr('width', zoomLevel === 1 ? width / window.geneDensityData.length : newXScale(d.node + 1) - newXScale(d.node));
        }
        
        
        
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
        
            // Draw gene density line along the left axis
            svg.selectAll(".density-line-left")
                .data(window.geneDensityData)
                .enter()
                .append("rect")
                .attr("class", "density-line-left")
                .attr("x", -margin.left / 2)
                .attr("y", d => sourceScale(d.node))
                .attr("width", margin.left / 2)
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
        
            // Draw gene density line along the right axis
            svg.selectAll(".density-line-right")
                .data(window.geneDensityData)
                .enter()
                .append("rect")
                .attr("class", "density-line-right")
                .attr("x", width)
                .attr("y", d => targetScale(d.node))
                .attr("width", margin.right / 2)
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
        
            // Clear other selections and controls if any
            // Reset slider value
            const edgeWeightSlider = document.getElementById('edgeWeightSlider');
            edgeWeightSlider.value = 100;
            document.getElementById('edgeWeightValue').textContent = '100%';
        
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
        