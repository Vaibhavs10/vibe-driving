import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Ghibli-style fog
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);
        this.scene.background = new THREE.Color(0x87CEEB);

        this.setupLights();
        this.createTerrain();
        this.createMonsterTruck();
        this.setupControls();
        this.setupEventListeners();

        this.gameLoop();
    }

    setupLights() {
        // Ambient light for overall scene brightness
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        // Directional light for shadows
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sunLight.position.set(50, 50, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);
    }

    createTerrain() {
        // Create an infinite ground plane
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x90EE90,
            roughness: 0.8,
            metalness: 0.2
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Add some decorative elements (trees, rocks)
        this.addDecorations();
    }

    addDecorations() {
        // Simple tree geometry
        const treeGeometry = new THREE.ConeGeometry(2, 8, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

        // Add multiple trees
        for (let i = 0; i < 50; i++) {
            const tree = new THREE.Group();
            
            const leaves = new THREE.Mesh(treeGeometry, treeMaterial);
            leaves.position.y = 5;
            leaves.castShadow = true;
            
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 1;
            trunk.castShadow = true;

            tree.add(leaves);
            tree.add(trunk);

            // Random position
            tree.position.x = (Math.random() - 0.5) * 200;
            tree.position.z = (Math.random() - 0.5) * 200;
            
            this.scene.add(tree);
        }
    }

    createMonsterTruck() {
        // Create a simple monster truck model
        const truck = new THREE.Group();

        // Truck body
        const bodyGeometry = new THREE.BoxGeometry(4, 2, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 3;
        body.castShadow = true;
        truck.add(body);

        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const wheelPositions = [
            [-2, 1.5, -2],
            [2, 1.5, -2],
            [-2, 1.5, 2],
            [2, 1.5, 2]
        ];

        wheelPositions.forEach(position => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(...position);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            truck.add(wheel);
        });

        this.truck = truck;
        this.scene.add(truck);

        // Set up camera position
        this.camera.position.set(0, 10, -15);
        this.camera.lookAt(this.truck.position);
    }

    setupControls() {
        // Initialize nipplejs
        this.joystick = nipplejs.create({
            zone: document.getElementById('joystick-zone'),
            mode: 'static',
            position: { left: '50px', bottom: '50px' },
            color: 'white',
            size: 120
        });

        this.truckControls = {
            speed: 0,
            rotation: 0,
            maxSpeed: 0.5
        };

        this.joystick.on('move', (evt, data) => {
            const forward = data.vector.y;
            const turn = data.vector.x;

            this.truckControls.speed = forward * this.truckControls.maxSpeed;
            this.truckControls.rotation = -turn * 0.05;
        });

        this.joystick.on('end', () => {
            this.truckControls.speed = 0;
            this.truckControls.rotation = 0;
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    updateTruck() {
        if (!this.truck) return;

        // Update truck position and rotation
        this.truck.rotation.y += this.truckControls.rotation;
        
        const movement = new THREE.Vector3(
            -Math.sin(this.truck.rotation.y) * this.truckControls.speed,
            0,
            -Math.cos(this.truck.rotation.y) * this.truckControls.speed
        );
        
        this.truck.position.add(movement);

        // Update camera position
        const cameraOffset = new THREE.Vector3(0, 10, -15);
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.truck.rotation.y);
        
        this.camera.position.copy(this.truck.position).add(cameraOffset);
        this.camera.lookAt(this.truck.position);
    }

    gameLoop() {
        requestAnimationFrame(() => this.gameLoop());
        
        this.updateTruck();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new Game(); 