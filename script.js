import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js'; 

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/controls/OrbitControls.js'; 
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/GLTFLoader.js'; 
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/RGBELoader.js'; 
import { RoughnessMipmapper } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/utils/RoughnessMipmapper.js';
document.addEventListener('DOMContentLoaded', function() {
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


    // Inside your resize event and after you set up the renderer
    function onWindowResize() {
        camera.aspect = visualizationContainer.clientWidth / visualizationContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(visualizationContainer.clientWidth, visualizationContainer.clientHeight);
    }

    // Call this function to set the initial size based on the container
    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);
    

    // Scene background color
    scene.background = new THREE.Color(0xf0f0f0);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // Needed if controls.enableDamping or controls.autoRotate are set to true
        renderer.render(scene, camera);
    }
    animate();


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
                console.log("Data loaded:", data);
                updateNodeDropdown(data); // Update the dropdown with the new data
                createNodes(data);       // Create nodes for the 3D visualization
            })
            .catch(error => {
                console.error("Error fetching nodes:", error);
            });
    }
    

    // Function to create nodes based on loaded data
    function createNodes(nodeData) {

        // Clear the scene
        while(scene.children.length > 0){ 
            scene.remove(scene.children[0]); 
        }

        // Define a generic material for all nodes, you can customize this later
        const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const scale = 100; // Adjust scale as necessary

        nodeData.forEach(node => {
            // In createNodes function
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

    function addDynamicEventListeners() {
        // Handle "Select All" functionality
        document.getElementById('select-all-nodes').addEventListener('change', function() {
            const allCheckboxes = nodeDropdown.querySelectorAll('input[type="checkbox"]:not(#select-all-nodes)');
            allCheckboxes.forEach(checkbox => checkbox.checked = this.checked);
        });

        // Clear button functionality
        // clearNodesButton.addEventListener('click', function() {
        //     const allCheckboxes = nodeDropdown.querySelectorAll('input[type="checkbox"]');
        //     allCheckboxes.forEach(checkbox => checkbox.checked = false);
        // });

        // Confirm (OK) button functionality
        // confirmNodesButton.addEventListener('click', function() {
        //     // Placeholder for further action
        //     alert('Nodes confirmed');
        // });
    }
    // When visualize is clicked
    document.getElementById('visualize-nodes').addEventListener('click', function() {
        const selectedNodes = Array.from(nodeCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked'))
                                .map(checkbox => checkbox.dataset.nodeName);
        // Now you have an array of selected node IDs
        // You can proceed to use this array for visualization
        console.log(selectedNodes);
        // Trigger the visualization update function with selectedNodes as the parameter
    });
        // Initially call to setup listeners for static elements
        addDynamicEventListeners();

    });
