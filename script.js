import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js'; 
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/controls/OrbitControls.js'; 
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/GLTFLoader.js'; 
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/RGBELoader.js'; 
import { RoughnessMipmapper } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/utils/RoughnessMipmapper.js';

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
        const selectedNodes = Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked'))
                                    .map(checkbox => checkbox.dataset.nodeName);
        const selectedDataset = document.getElementById('dataset-selector').value;
        const edgeDataPath = selectedDataset === 'WT_BS' ? 'WT_BS_Edge_processed.json' : 'Other_Dataset_Edge.json';
    
        fetchAndFilterEdgeData(edgeDataPath, selectedNodes).then(filteredEdges => {
            createEdges3D(filteredEdges);  // Draw 3D edges
            const context = document.getElementById('canvas2D').getContext('2d');
            drawEdges2D(filteredEdges, context);  // Draw 2D edges
        }).catch(error => {
            console.error("Error processing edge data:", error);
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {


    //////////////////////////////////////////////////////////////////////////////////
    ////////////            3D Visualization Setup      /////////////////////////////
    // Setup Three.js scene, camera, renderer, and controls
    var scene = new THREE.Scene();
    // Adjust renderer size to match the visualization container
    const visualizationContainer = document.getElementById('visualization1');
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    // Inside your resize event and DOMContentLoaded
    renderer.setSize(visualizationContainer.clientWidth, visualizationContainer.clientHeight);
    visualizationContainer.appendChild(renderer.domElement);
    // Adjust the camera setup to ensure it's correctly positioned
    // Setup camera with initial position
    var camera = new THREE.PerspectiveCamera(45, visualizationContainer.clientWidth / visualizationContainer.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 50); // Closer to the origin
    // After setting the camera position
    camera.lookAt(new THREE.Vector3(0, 0, 0)); // Adjust if your nodes are centered elsewhere
    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    // Add ambient light to the scene
    var ambientLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambientLight);
    // Add point light to the scene
    var light = new THREE.PointLight(0xffffff, 1);
    light.position.set(50, 50, 50);
    scene.add(light); // Make sure to add the light to the scene
    var controls = new OrbitControls(camera,  renderer.domElement);
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

// Then in your drawing code:
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
    const canvas = document.getElementById('canvas2D');
    const context = canvas.getContext('2d');
    const scaleX = canvas.width / (getRange(data, 'x') + 1); // Add 1 to avoid division by zero
    const scaleY = canvas.height / (getRange(data, 'y') + 1);
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    data.forEach(node => {
        const x = (node.x - getMin(data, 'x')) * scaleX;
        const y = (node.y - getMin(data, 'y')) * scaleY;
        context.beginPath();
        context.arc(x, y, 10, 0, Math.PI * 2, true); // Increase radius to make nodes larger
        context.fillStyle = getColorForChID(String(node.ChID));
        context.fill();
    });
}

// Helper functions to get the range and minimum value of nodes
function getRange(data, coord) {
    return Math.max(...data.map(node => node[coord])) - Math.min(...data.map(node => node[coord]));
}

function getMin(data, coord) {
    return Math.min(...data.map(node => node[coord]));
}

//setup2DCanvas();

//////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////
    // Inside your resize event and after you set up the renderer
    function onWindowResize() {
        camera.aspect = visualizationContainer.clientWidth / visualizationContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(visualizationContainer.clientWidth, visualizationContainer.clientHeight);
    }

    // Call this function to set the initial size based on the container
    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);
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
//////////////////////////////////////////////////////////////////////////////////////

    // Existing dataset selection code (unchanged)
    const datasetSelector = document.getElementById('dataset-selector');
    datasetSelector.addEventListener('change', function() {
        const selectedDataset = datasetSelector.value;
        if (selectedDataset === 'WT_BS') {
            // Clear the existing scene, then load and visualize new node data
            while(scene.children.length > 0){ 
                scene.remove(scene.children[0]); 
            }
            //console.log("Flag");
            fetchNodesFromJson('WT_BS_Node_3D.json');
            fetchProcessedEdgeData('WT_BS_Edge_processed.json');
        }
        // ... any other dataset conditions
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
            })
            .catch(error => {
                console.error("Error fetching nodes:", error);
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
      

      function createHeatmap(data) {
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
        .style('stroke-width', 0); // No stroke for a seamless appearance
}
    


      
    
    // Function to create nodes based on loaded data
    function createNodes(nodeData) {

        // Clear the scene
        while(scene.children.length > 0){ 
            scene.remove(scene.children[0]); 
        }

        // Define a generic material for all nodes, you can customize this later
        //const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const scale = 100; // Adjust scale as necessary

        nodeData.forEach(node => {
            // In createNodes function
            const color = getColorForChID(String(node.ChID)); // Get color based on ChID
            const nodeMaterial = new THREE.MeshBasicMaterial({ color: color });
            const scale = 0.1; // Scale factor if your nodes are too spread out
            const geometry = new THREE.SphereGeometry(1, 32, 32); // Adjust the size as needed
            const sphere = new THREE.Mesh(geometry, nodeMaterial);
            sphere.position.set(node.x * scale, node.y * scale, node.z * scale);
            sphere.name = node.id;
            scene.add(sphere);
        });

        console.log(scene.children); // Log out the scene's children to ensure nodes are present


        // Update controls and re-render the scene
        controls.update();
        renderer.render(scene, camera);
    }

    // Detect clicks on the canvas and check if a node was clicked
    renderer.domElement.addEventListener('click', onCanvasClick, false);

    function onCanvasClick(event) {
        // Calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components
        var mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        var raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // Calculate objects intersecting the picking ray
        var intersects = raycaster.intersectObjects(scene.children);

        for (var i = 0; i < intersects.length; i++) {
            // intersects[i].object is the object (node) that was clicked
            console.log("Clicked on node: " + intersects[i].object.name); // This is the node ID
            // Here you can add the logic to highlight the node or pass its ID to other visualizations
        }
    }
    



    function updateNodeDropdown(nodes) {
        const nodeCheckboxesContainer = document.getElementById('node-checkboxes');
        nodeCheckboxesContainer.innerHTML = ''; // Clear existing checkboxes
    
        nodes.forEach((node, index) => {
            const checkboxContainer = document.createElement('div');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `node${index}`;
            checkbox.dataset.nodeName = node.id; // Store node ID in data attribute
    
            const label = document.createElement('label');
            label.htmlFor = `node${index}`;
            label.textContent = node.id; // This is where you set the node ID as the label text
    
            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(label);
            nodeCheckboxesContainer.appendChild(checkboxContainer);
        });
    }


    
        // Initially call to setup listeners for static elements
       // addDynamicEventListeners();

///////////////////////////////////
//Function for filtering edged////
function filterTopWeightedEdges(edges, selectedNodeIds) {
    let nodeEdgeMap = new Map();

    // Filter edges to include only those connected to selected nodes
    edges.forEach(edge => {
        if (selectedNodeIds.includes(edge.Source) || selectedNodeIds.includes(edge.Target)) {
            if (!nodeEdgeMap.has(edge.Source)) {
                nodeEdgeMap.set(edge.Source, []);
            }
            if (!nodeEdgeMap.has(edge.Target)) {
                nodeEdgeMap.set(edge.Target, []);
            }
            nodeEdgeMap.get(edge.Source).push(edge);
            nodeEdgeMap.get(edge.Target).push(edge);
        }
    });

    // Now refine each node's edges to include only the top 5%
    let topEdges = [];
    nodeEdgeMap.forEach((edges, nodeId) => {
        edges.sort((a, b) => b.Weight - a.Weight); // Sort edges by weight in descending order
        let top5PercentCount = Math.ceil(edges.length * 0.05); // Calculate top 5% of edges
        topEdges.push(...edges.slice(0, top5PercentCount)); // Add top 5% edges to the final list
    });

    // Remove duplicates before returning
    return Array.from(new Set(topEdges));
}

///////////////////////////////////
//Function for Handling Filtered edges////

    function fetchAndFilterEdgeData(filePath, selectedNodeIds) {
        d3.json(filePath).then(rawData => {
            const filteredEdges = filterTopWeightedEdges(rawData, selectedNodeIds);
            update3DVisualizationWithEdges(filteredEdges); // Update your 3D visualization
            // Add any other visualization updates here
        }).catch(error => {
            console.error("Error fetching and filtering edge data:", error);
        });
    }
    
///////////////////////////////////
//Function for draw edges of selected nodes for 3d vis////
    function createEdges3D(edgeData) {
        // Assuming edgeData is an array of edges with properties Source, Target, and Weight
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
        edgeData.forEach(edge => {
            const sourceNode = scene.getObjectByName(edge.Source);
            const targetNode = scene.getObjectByName(edge.Target);
    
            if (sourceNode && targetNode) {
                const points = [];
                points.push(sourceNode.position);
                points.push(targetNode.position);
    
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMaterial);
                scene.add(line);
            }
        });
    }
    
///////////////////////////////////
//Function for draw edges of selected nodes for 2d vis////

    function drawEdges2D(edgeData, context) {
        context.strokeStyle = '#0000ff';  // Edge color
        edgeData.forEach(edge => {
            const sourceNode = document.getElementById(`node2D-${edge.Source}`);
            const targetNode = document.getElementById(`node2D-${edge.Target}`);
    
            if (sourceNode && targetNode) {
                context.beginPath();
                context.moveTo(sourceNode.cx.baseVal.value, sourceNode.cy.baseVal.value);
                context.lineTo(targetNode.cx.baseVal.value, targetNode.cy.baseVal.value);
                context.stroke();
            }
        });
    }
    addDynamicEventListeners();  // Initialize all event listeners
    setupDropdownToggle();       // Setup dropdown toggle behavior if defined
    });

