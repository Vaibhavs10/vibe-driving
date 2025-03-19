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
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 200, 200);
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

        // Initialize decoration chunks
        this.decorationChunks = new Map();
        this.chunkSize = 100;
        this.visibleRange = 300;
        
        // Add initial decorations
        this.updateDecorations();
    }

    getChunkKey(x, z) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        return `${chunkX},${chunkZ}`;
    }

    createDecorationChunk(chunkX, chunkZ) {
        const chunk = new THREE.Group();
        const chunkWorldX = chunkX * this.chunkSize;
        const chunkWorldZ = chunkZ * this.chunkSize;

        // Add trees to chunk
        for (let i = 0; i < 15; i++) {
            const tree = this.createTree(0.5 + Math.random() * 1.5);
            const x = chunkWorldX + Math.random() * this.chunkSize;
            const z = chunkWorldZ + Math.random() * this.chunkSize;
            tree.position.set(x, 0, z);
            tree.rotation.y = Math.random() * Math.PI * 2;
            chunk.add(tree);
        }

        // Add rocks to chunk
        const rockGeometry = new THREE.DodecahedronGeometry(2);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });

        for (let i = 0; i < 8; i++) {
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            const scale = 0.3 + Math.random() * 1;
            rock.scale.set(scale, scale * 0.7, scale);
            const x = chunkWorldX + Math.random() * this.chunkSize;
            const z = chunkWorldZ + Math.random() * this.chunkSize;
            rock.position.set(x, 0, z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.castShadow = true;
            rock.receiveShadow = true;
            chunk.add(rock);
        }

        return chunk;
    }

    createTree(scale = 1) {
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
    }

    updateDecorations() {
        if (!this.truck) return;

        const currentChunkX = Math.floor(this.truck.position.x / this.chunkSize);
        const currentChunkZ = Math.floor(this.truck.position.z / this.chunkSize);
        const range = Math.ceil(this.visibleRange / this.chunkSize);

        // Add new chunks that are in range
        for (let x = currentChunkX - range; x <= currentChunkX + range; x++) {
            for (let z = currentChunkZ - range; z <= currentChunkZ + range; z++) {
                const key = `${x},${z}`;
                if (!this.decorationChunks.has(key)) {
                    const chunk = this.createDecorationChunk(x, z);
                    this.decorationChunks.set(key, chunk);
                    this.scene.add(chunk);
                }
            }
        }

        // Remove chunks that are out of range
        for (const [key, chunk] of this.decorationChunks) {
            const [x, z] = key.split(',').map(Number);
            if (Math.abs(x - currentChunkX) > range || Math.abs(z - currentChunkZ) > range) {
                this.scene.remove(chunk);
                this.decorationChunks.delete(key);
            }
        }
    }

    createMonsterTruck() {
        const truck = new THREE.Group();

        // Enhanced truck body with more details
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

        // Add more detailed cabin
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

        // Add grill
        const grillGeometry = new THREE.BoxGeometry(3.5, 1, 0.3);
        const grillMaterial = new THREE.MeshStandardMaterial({
            color: 0x1A1A1A,
            roughness: 0.5,
            metalness: 0.8
        });
        const grill = new THREE.Mesh(grillGeometry, grillMaterial);
        grill.position.set(0, 2.8, 3);
        truck.add(grill);

        // Add headlights
        const headlightGeometry = new THREE.CircleGeometry(0.3, 16);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            emissive: 0xFFFFFF,
            emissiveIntensity: 0.5
        });
        const headlightPositions = [[-1.2, 2.8, 3.1], [1.2, 2.8, 3.1]];
        headlightPositions.forEach(pos => {
            const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
            headlight.position.set(...pos);
            headlight.rotation.y = Math.PI;
            truck.add(headlight);
        });

        // Add windows with slight tint
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

        // Side windows
        const sideWindowGeometry = new THREE.PlaneGeometry(2, 1.3);
        const leftWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
        leftWindow.position.set(-1.81, 4.5, -1);
        leftWindow.rotation.y = Math.PI * 0.5;
        truck.add(leftWindow);

        const rightWindow = leftWindow.clone();
        rightWindow.position.x = 1.81;
        rightWindow.rotation.y = -Math.PI * 0.5;
        truck.add(rightWindow);

        // Enhanced wheels with more detail
        const wheelGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1.2, 24);
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
            
            // Add detailed wheel hub caps
            const hubGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.21, 8);
            const hubMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xC0C0C0,
                roughness: 0.5,
                metalness: 0.8
            });
            const hub = new THREE.Mesh(hubGeometry, hubMaterial);
            
            // Add hub details
            const hubDetailGeometry = new THREE.BoxGeometry(0.1, 1.22, 0.1);
            for (let i = 0; i < 4; i++) {
                const detail = new THREE.Mesh(hubDetailGeometry, hubMaterial);
                detail.rotation.y = (Math.PI / 2) * i;
                hub.add(detail);
            }
            
            wheel.add(hub);
            truck.add(wheel);
        });

        // Add suspension system
        const suspensionGeometry = new THREE.BoxGeometry(0.3, 2, 0.3);
        const suspensionMaterial = new THREE.MeshStandardMaterial({
            color: 0x4A4A4A,
            roughness: 0.7,
            metalness: 0.5
        });

        wheelPositions.forEach(position => {
            const suspension = new THREE.Mesh(suspensionGeometry, suspensionMaterial);
            suspension.position.set(position[0], position[1] + 1, position[2]);
            truck.add(suspension);
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
            maxSpeed: 0.5,
            // Add key states
            keys: {
                forward: false,
                backward: false,
                left: false,
                right: false
            }
        };

        // Joystick controls
        this.joystick.on('move', (evt, data) => {
            // Fix inversion by removing the negative sign from turn
            const forward = -data.vector.y; // Invert forward/backward
            const turn = data.vector.x;

            this.truckControls.speed = forward * this.truckControls.maxSpeed;
            this.truckControls.rotation = turn * 0.05;
        });

        this.joystick.on('end', () => {
            // Only reset joystick controls, not keyboard
            if (!Object.values(this.truckControls.keys).some(key => key)) {
                this.truckControls.speed = 0;
                this.truckControls.rotation = 0;
            }
        });

        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    this.truckControls.keys.forward = true;
                    break;
                case 's':
                case 'arrowdown':
                    this.truckControls.keys.backward = true;
                    break;
                case 'a':
                case 'arrowleft':
                    this.truckControls.keys.left = true;
                    break;
                case 'd':
                case 'arrowright':
                    this.truckControls.keys.right = true;
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    this.truckControls.keys.forward = false;
                    break;
                case 's':
                case 'arrowdown':
                    this.truckControls.keys.backward = false;
                    break;
                case 'a':
                case 'arrowleft':
                    this.truckControls.keys.left = false;
                    break;
                case 'd':
                case 'arrowright':
                    this.truckControls.keys.right = false;
                    break;
            }
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

        // Handle keyboard input
        if (this.truckControls.keys.forward) {
            this.truckControls.speed = this.truckControls.maxSpeed;
        } else if (this.truckControls.keys.backward) {
            this.truckControls.speed = -this.truckControls.maxSpeed;
        } else if (!this.joystick.active) {
            this.truckControls.speed *= 0.95; // Smooth deceleration
        }

        if (this.truckControls.keys.left) {
            this.truckControls.rotation = -0.05;
        } else if (this.truckControls.keys.right) {
            this.truckControls.rotation = 0.05;
        } else if (!this.joystick.active) {
            this.truckControls.rotation *= 0.95; // Smooth rotation deceleration
        }

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
        this.updateDecorations();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new Game(); 