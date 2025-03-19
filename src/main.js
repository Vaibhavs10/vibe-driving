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

        // Ghibli-style warm atmosphere
        this.scene.fog = new THREE.FogExp2(0xE6D5AC, 0.008);
        this.scene.background = new THREE.Color(0xE6D5AC);

        this.setupLights();
        this.createTerrain();
        this.createMonsterTruck();
        this.setupControls();
        this.setupEventListeners();

        this.gameLoop();
    }

    setupLights() {
        // Warm ambient light for Ghibli-style atmosphere
        const ambient = new THREE.AmbientLight(0xFFF2E6, 0.7);
        this.scene.add(ambient);

        // Main sunlight with warm tones
        const sunLight = new THREE.DirectionalLight(0xFFE4B5, 1.2);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.bias = -0.0001;
        this.scene.add(sunLight);

        // Secondary fill light for depth
        const fillLight = new THREE.DirectionalLight(0xB4E1FF, 0.4);
        fillLight.position.set(-50, 30, -50);
        this.scene.add(fillLight);
    }

    createTerrain() {
        // Create a more detailed ground with custom texture
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000, 100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x91B156,
            roughness: 0.8,
            metalness: 0.1
        });

        // Add some vertex displacement for gentle hills
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            if (i !== 0) { // Keep center flat for gameplay
                vertices[i + 1] = Math.sin(vertices[i] / 20) * Math.cos(vertices[i + 2] / 20) * 2;
            }
        }

        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Add decorative elements
        this.addDecorations();
    }

    addDecorations() {
        // Ghibli-style trees with more detail
        const createTree = (scale = 1) => {
            const tree = new THREE.Group();
            
            // Multiple layers of foliage for more organic look
            const foliageColors = [0x4A5D23, 0x526B29, 0x5E7B2F];
            const foliageLayers = 3;
            
            for (let i = 0; i < foliageLayers; i++) {
                const height = (8 - i * 1.5) * scale;
                const radius = (2.5 - i * 0.3) * scale;
                const foliageGeo = new THREE.ConeGeometry(radius, height, 8);
                const foliageMat = new THREE.MeshStandardMaterial({ 
                    color: foliageColors[i],
                    roughness: 0.8,
                    metalness: 0.1
                });
                const foliage = new THREE.Mesh(foliageGeo, foliageMat);
                foliage.position.y = (i * 1.5 + 5) * scale;
                foliage.castShadow = true;
                tree.add(foliage);
            }
            
            // Detailed trunk
            const trunkGeo = new THREE.CylinderGeometry(0.5 * scale, 0.7 * scale, 4 * scale, 8);
            const trunkMat = new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.9,
                metalness: 0.1
            });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 2 * scale;
            trunk.castShadow = true;
            tree.add(trunk);
            
            return tree;
        };

        // Add trees with varying sizes
        for (let i = 0; i < 100; i++) {
            const scale = 0.5 + Math.random() * 1.5;
            const tree = createTree(scale);
            
            // Random position with minimum distance from center
            const angle = Math.random() * Math.PI * 2;
            const minDistance = 30;
            const maxDistance = 200;
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            
            tree.position.x = Math.cos(angle) * distance;
            tree.position.z = Math.sin(angle) * distance;
            tree.rotation.y = Math.random() * Math.PI * 2;
            
            this.scene.add(tree);
        }

        // Add some rocks for variety
        const rockGeometry = new THREE.DodecahedronGeometry(2);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });

        for (let i = 0; i < 50; i++) {
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            const scale = 0.3 + Math.random() * 1;
            rock.scale.set(scale, scale * 0.7, scale);
            rock.position.x = (Math.random() - 0.5) * 400;
            rock.position.z = (Math.random() - 0.5) * 400;
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    createMonsterTruck() {
        const truck = new THREE.Group();

        // More detailed truck body with Ghibli-style proportions
        const bodyGeometry = new THREE.BoxGeometry(4, 2.2, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xD44C2E,
            roughness: 0.7,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 3;
        body.castShadow = true;
        truck.add(body);

        // Add cabin
        const cabinGeometry = new THREE.BoxGeometry(3.6, 1.8, 2.5);
        const cabinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xD44C2E,
            roughness: 0.7,
            metalness: 0.3
        });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.set(0, 4.5, -1);
        cabin.castShadow = true;
        truck.add(cabin);

        // Windows with slight tint
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x6A8EAE,
            roughness: 0.2,
            metalness: 0.8
        });

        // Front window
        const frontWindowGeometry = new THREE.PlaneGeometry(3.2, 1.5);
        const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.position.set(0, 4.5, 0.3);
        frontWindow.rotation.x = Math.PI * 0.1;
        truck.add(frontWindow);

        // Enhanced wheels with more detail
        const wheelGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1.2, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1A1A1A,
            roughness: 0.8,
            metalness: 0.2
        });
        
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
            
            // Add wheel hub caps
            const hubGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.21, 8);
            const hubMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xC0C0C0,
                roughness: 0.5,
                metalness: 0.8
            });
            const hub = new THREE.Mesh(hubGeometry, hubMaterial);
            wheel.add(hub);
            
            truck.add(wheel);
        });

        this.truck = truck;
        this.scene.add(truck);

        // Adjust camera for better view
        this.camera.position.set(0, 12, -20);
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