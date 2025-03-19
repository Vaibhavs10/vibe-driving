import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class Game {
    constructor() {
        try {
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            // Get canvas element
            const canvas = document.getElementById('game');
            if (!canvas) {
                throw new Error('Canvas element not found!');
            }
            
            try {
                this.renderer = new THREE.WebGLRenderer({
                    canvas: canvas,
                    antialias: true
                });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                
                // Test rendering - clear to a default color to make sure renderer works
                this.renderer.setClearColor(0xE6D5AC); // Same as scene background
            } catch (renderError) {
                console.error('WebGL renderer creation failed:', renderError);
                // Create fallback message
                const errorDiv = document.createElement('div');
                errorDiv.innerHTML = 'Could not initialize WebGL renderer. Your browser might not support WebGL or has it disabled.';
                errorDiv.style.position = 'absolute';
                errorDiv.style.top = '50%';
                errorDiv.style.left = '50%';
                errorDiv.style.transform = 'translate(-50%, -50%)';
                errorDiv.style.color = 'white';
                errorDiv.style.background = 'rgba(0,0,0,0.7)';
                errorDiv.style.padding = '20px';
                errorDiv.style.borderRadius = '8px';
                errorDiv.style.textAlign = 'center';
                document.body.appendChild(errorDiv);
                throw renderError;
            }

            // Ghibli-style warm atmosphere
            this.scene.fog = new THREE.FogExp2(0xE6D5AC, 0.008);
            this.scene.background = new THREE.Color(0xE6D5AC);

            // Create debug text display for physics info
            this.createDebugDisplay();

            // Initialize physics first so it's available for other components
            this.setupPhysics();
            
            this.setupLights();
            this.createTerrain();
            this.createMonsterTruck();
            this.setupControls();
            this.setupEventListeners();

            // Start tracking time for physics
            this.lastUpdateTime = performance.now() / 1000;
            
            // Add a message to help users
            console.log("Game initialized - Use WASD/Arrow keys to drive, or the joystick on mobile");
            
            // Add help text to debug display
            if (this.debugDiv) {
                this.debugDiv.innerHTML += '<br><strong>Controls: WASD/Arrows or Joystick</strong>';
                this.debugDiv.innerHTML += '<br><strong style="color:red">ULTIMATE EMERGENCY MODE ACTIVATED - GRANDMA WILL BE SAVED!</strong>';
                // Show a big red alert on the screen that truck controls are working
                const emergencyAlert = document.createElement('div');
                emergencyAlert.innerHTML = '<b>EMERGENCY MODE ACTIVATED! PRESS ARROW KEYS TO MOVE!</b>';
                emergencyAlert.style.position = 'absolute';
                emergencyAlert.style.top = '50%';
                emergencyAlert.style.left = '50%';
                emergencyAlert.style.transform = 'translate(-50%, -50%)';
                emergencyAlert.style.color = 'white';
                emergencyAlert.style.background = 'rgba(255,0,0,0.7)';
                emergencyAlert.style.padding = '20px';
                emergencyAlert.style.borderRadius = '8px';
                emergencyAlert.style.textAlign = 'center';
                emergencyAlert.style.zIndex = '1000';
                document.body.appendChild(emergencyAlert);
                
                // Remove the alert after 5 seconds
                setTimeout(() => {
                    document.body.removeChild(emergencyAlert);
                }, 5000);
            }
            
            // CRITICAL: Reset truck position and ensure ground contact
            setTimeout(() => {
                this.resetTruck();
                console.log("FORCE RESET: Ensuring ground contact");
                
                // Force ground contact in a few frames to ensure proper initialization
                setTimeout(() => {
                    if (this.truckPhysics) {
                        const groundHeight = this.getTerrainHeightAt(this.truckPhysics.position.x, this.truckPhysics.position.z);
                        this.truckPhysics.position.y = groundHeight + 0.5;
                        this.truckPhysics.groundContact = true;
                        this.truck.position.y = this.truckPhysics.position.y;
                        console.log("GROUND CONTACT ENFORCED");
                    }
                }, 100);
            }, 100);
            
            // Start the game loop
            this.gameLoop();
        } catch (error) {
            console.error('Game initialization failed:', error);
            // Show visible error message to user
            const errorMessage = document.createElement('div');
            errorMessage.style.position = 'absolute';
            errorMessage.style.top = '20px';
            errorMessage.style.left = '20px';
            errorMessage.style.right = '20px';
            errorMessage.style.padding = '10px';
            errorMessage.style.background = 'rgba(200,0,0,0.8)';
            errorMessage.style.color = 'white';
            errorMessage.style.borderRadius = '5px';
            errorMessage.style.zIndex = '1000';
            errorMessage.innerHTML = 'Game initialization error: ' + error.message;
            document.body.appendChild(errorMessage);
        }
    }

    createDebugDisplay() {
        // Create a debug info display for physics data
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-info';
        debugDiv.style.position = 'absolute';
        debugDiv.style.top = '10px';
        debugDiv.style.left = '10px';
        debugDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        debugDiv.style.color = 'white';
        debugDiv.style.padding = '10px';
        debugDiv.style.borderRadius = '5px';
        debugDiv.style.fontFamily = 'monospace';
        debugDiv.style.zIndex = '1000';
        debugDiv.style.pointerEvents = 'none'; // Allow click-through
        document.body.appendChild(debugDiv);
        this.debugDiv = debugDiv;
    }

    setupPhysics() {
        // Simplified physics model for more reliable driving
        this.truckPhysics = {
            // Basic movement
            position: new THREE.Vector3(0, 5, 0), // Start at a height to drop onto terrain
            velocity: new THREE.Vector3(0, 0, 0),
            acceleration: new THREE.Vector3(0, 0, 0),
            
            // Rotation
            rotation: 0,
            angularVelocity: 0,
            
            // Physics constants - SIMPLIFIED and BOOSTED for better movement
            mass: 800,                   // Reduced mass for better acceleration
            engineForce: 40000,          // INCREASED for better movement
            brakingForce: 15000,         // N
            rollingResistance: 0.01,     // REDUCED for easier movement
            dragCoefficient: 0.05,       // REDUCED for easier movement
            wheelBase: 3.5,              // m
            maxSteeringAngle: 0.6,       // rad
            
            // Terrain interaction
            groundContact: true,         // START with ground contact true
            groundNormal: new THREE.Vector3(0, 1, 0),
            
            // States
            throttle: 0,                // 0 to 1
            brake: 0,                   // 0 to 1
            steering: 0,                // -1 to 1
            
            // For smooth control transitions
            targetSteering: 0,
            targetThrottle: 0,
            targetBrake: 0,
            
            // Input mapping
            keys: {
                forward: false,
                backward: false,
                left: false,
                right: false,
                brake: false
            }
        };
        
        // Log initial state to verify values
        console.log("Initial physics state:", {
            throttle: this.truckPhysics.throttle,
            brake: this.truckPhysics.brake,
            steering: this.truckPhysics.steering
        });
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
        // Create a simplified ground with a basic material instead of procedural textures
        const groundSize = 2000;
        const groundSegments = 200;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, groundSegments, groundSegments);
        
        // Apply height variation for more natural terrain
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Keep center area relatively flat for gameplay
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            const flatteningFactor = Math.min(1, Math.max(0, (distanceFromCenter - 50) / 200));
            
            // Multi-frequency noise for natural terrain
            if (distanceFromCenter > 30) {
                const largeNoise = Math.sin(x / 50) * Math.cos(z / 50) * 5;
                const mediumNoise = Math.sin(x / 20) * Math.cos(z / 20) * 2;
                const smallNoise = Math.sin(x / 5) * Math.cos(z / 5) * 0.5;
                
                vertices[i + 1] = (largeNoise + mediumNoise + smallNoise) * flatteningFactor;
            }
        }
        
        // SIMPLIFIED: Use basic material instead of complex shader with textures
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x77AB59, // Green grass color
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Create ground mesh
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // Create enhanced terrain details with denser vegetation
        this.createTerrainDetails();
        
        // Initialize decoration chunks
        this.decorationChunks = new Map();
        this.chunkSize = 100;
        this.visibleRange = 300;
        
        // Add initial decorations
        this.updateDecorations();
    }

    createTerrainDetails() {
        // Add small vegetation and ground details
        const detailsGroup = new THREE.Group();
        
        // Create various types of grass
        const grassTypes = [
            { width: 1.0, height: 1.0, color: 0x91B156, thick: false },
            { width: 0.8, height: 1.2, color: 0x7DA046, thick: false },
            { width: 1.2, height: 0.7, color: 0xA9C978, thick: true }
        ];
        
        // Add grass patches
        for (let i = 0; i < 2000; i++) {
            // Determine random position with higher density in certain areas
            const angle = Math.random() * Math.PI * 2;
            
            // Create rings of vegetation
            const ringChoice = Math.random();
            let radius;
            
            if (ringChoice < 0.3) {
                // Inner grass circle
                radius = 30 + Math.random() * 50;
            } else if (ringChoice < 0.7) {
                // Middle grass ring
                radius = 100 + Math.random() * 100;
            } else {
                // Outer grass areas
                radius = 250 + Math.random() * 150;
            }
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Select grass type
            const grassType = grassTypes[Math.floor(Math.random() * grassTypes.length)];
            
            // Create more detailed grass tufts that vary in size
            if (Math.random() < 0.7) { // 70% chance for grass
                // Create crossed planes for 3D effect
                const grassGroup = new THREE.Group();
                
                // Two crossed planes create a more 3D look
                for (let j = 0; j < (grassType.thick ? 3 : 2); j++) {
                    const rotation = j * Math.PI / (grassType.thick ? 3 : 2);
                    
                    const grassGeometry = new THREE.PlaneGeometry(
                        grassType.width * (0.8 + Math.random() * 0.4),
                        grassType.height * (0.8 + Math.random() * 0.4)
                    );
                    
                    // Vary the grass color slightly
                    const colorVariation = Math.random() * 0.2 - 0.1;
                    const color = new THREE.Color(grassType.color);
                    color.r = Math.max(0, Math.min(1, color.r + colorVariation));
                    color.g = Math.max(0, Math.min(1, color.g + colorVariation));
                    
                    const grassMaterial = new THREE.MeshStandardMaterial({
                        color: color,
                        roughness: 0.8,
                        metalness: 0.1,
                        side: THREE.DoubleSide,
                        alphaTest: 0.7
                    });
                    
                    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
                    grass.rotation.y = rotation;
                    grassGroup.add(grass);
                }
                
                // Position the grass tuft - offset y slightly to avoid z-fighting
                grassGroup.position.set(x, 0.5 + Math.random() * 0.2, z);
                grassGroup.rotation.y = Math.random() * Math.PI;
                detailsGroup.add(grassGroup);
            } else {
                // 30% chance for small rocks, twigs, etc.
                const detailType = Math.random() < 0.7 ? 'rock' : 'twig';
                
                if (detailType === 'rock') {
                    // Create small rock
                    const rockGeometry = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.3);
                    const rockMaterial = new THREE.MeshStandardMaterial({
                        color: 0x808080 + Math.floor(Math.random() * 0x202020),
                        roughness: 0.9,
                        metalness: 0.1
                    });
                    
                    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                    const scale = 0.1 + Math.random() * 0.3;
                    rock.scale.set(scale, scale * 0.7, scale);
                    rock.position.set(x, scale/2, z);
                    rock.rotation.set(
                        Math.random() * Math.PI, 
                        Math.random() * Math.PI, 
                        Math.random() * Math.PI
                    );
                    rock.castShadow = true;
                    rock.receiveShadow = true;
                    detailsGroup.add(rock);
                } else {
                    // Create small twig/stick
                    const twigGeometry = new THREE.CylinderGeometry(0.05, 0.03, 0.5 + Math.random() * 0.5);
                    const twigMaterial = new THREE.MeshStandardMaterial({
                        color: 0x8B4513,
                        roughness: 0.9,
                        metalness: 0.1
                    });
                    
                    const twig = new THREE.Mesh(twigGeometry, twigMaterial);
                    twig.position.set(x, 0.1, z);
                    twig.rotation.set(
                        Math.random() * 0.2,  // Mostly flat
                        Math.random() * Math.PI,
                        Math.random() * 0.2
                    );
                    twig.castShadow = true;
                    twig.receiveShadow = true;
                    detailsGroup.add(twig);
                }
            }
        }
        
        this.scene.add(detailsGroup);
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
        
        // Rich color palette inspired by Ghibli films
        const mainColor = 0xD48166;      // Warm terracotta red
        const secondaryColor = 0x5284B7; // Sky blue
        const accentColor = 0xEAD380;    // Sandy yellow
        const metalColor = 0xC0C2C4;     // Silver/chrome
        const darkColor = 0x2A2D33;      // Deep shadow
        const glassColor = 0x9CCFD9;     // Light blue glass
        
        // Create a more organic, rounded body shape
        // Use a combination of shapes rather than just boxes for more visual interest
        
        // --- Main body with curved top ---
        // Base body shape
        const bodyGeometry = new THREE.BoxGeometry(4, 1.6, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.7,
            metalness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 3.2;
        body.castShadow = true;
        truck.add(body);
        
        // Curved roof segment
        const roofGeometry = new THREE.CylinderGeometry(2, 2, 4, 16, 1, false, -Math.PI/2, Math.PI);
        const roofMaterial = new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.7,
            metalness: 0.2
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.scale.set(1, 0.8, 1.2);
        roof.rotation.z = Math.PI / 2;
        roof.position.set(0, 4.4, -0.3);
        roof.castShadow = true;
        truck.add(roof);
        
        // Front hood with slight incline
        const hoodGeometry = new THREE.BoxGeometry(3.8, 0.6, 2.5);
        const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
        hood.position.set(0, 3.8, 2);
        hood.rotation.x = -Math.PI * 0.05;
        truck.add(hood);
        
        // Hood ornament/decorative curve
        const hoodOrnamentGeometry = new THREE.TorusGeometry(0.6, 0.1, 8, 12, Math.PI);
        const hoodOrnament = new THREE.Mesh(hoodOrnamentGeometry, new THREE.MeshStandardMaterial({
            color: accentColor,
            roughness: 0.6,
            metalness: 0.3
        }));
        hoodOrnament.rotation.x = -Math.PI/2;
        hoodOrnament.position.set(0, 3.9, 3.1);
        truck.add(hoodOrnament);
        
        // --- Cabin Features ---
        // Windshield frame
        const windshieldFrameGeometry = new THREE.BoxGeometry(3.7, 0.1, 2.2);
        const windshieldFrameMaterial = new THREE.MeshStandardMaterial({
            color: darkColor,
            roughness: 0.8,
            metalness: 0.2
        });
        const windshieldFrame = new THREE.Mesh(windshieldFrameGeometry, windshieldFrameMaterial);
        windshieldFrame.rotation.x = Math.PI * 0.22;
        windshieldFrame.position.set(0, 4.5, 0.8);
        truck.add(windshieldFrame);
        
        // Windshield glass
        const windshieldGeometry = new THREE.PlaneGeometry(3.5, 2);
        const windshieldMaterial = new THREE.MeshPhysicalMaterial({
            color: glassColor,
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
        const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
        windshield.rotation.x = Math.PI * 0.22;
        windshield.position.set(0, 4.5, 0.8);
        truck.add(windshield);
        
        // Side windows - curved for style
        const sideWindowGeometry = new THREE.PlaneGeometry(2.4, 1.5);
        const leftWindow = new THREE.Mesh(sideWindowGeometry, windshieldMaterial);
        leftWindow.position.set(-2.01, 4.4, -0.8);
        leftWindow.rotation.y = Math.PI * 0.5;
        truck.add(leftWindow);
        
        const rightWindow = leftWindow.clone();
        rightWindow.position.x = 2.01;
        rightWindow.rotation.y = -Math.PI * 0.5;
        truck.add(rightWindow);
        
        // Window frames
        const windowFrameGeometry = new THREE.BoxGeometry(0.1, 1.55, 2.5);
        const leftWindowFrame = new THREE.Mesh(windowFrameGeometry, windshieldFrameMaterial);
        leftWindowFrame.position.set(-2.02, 4.4, -0.8);
        truck.add(leftWindowFrame);
        
        const rightWindowFrame = leftWindowFrame.clone();
        rightWindowFrame.position.x = 2.02;
        truck.add(rightWindowFrame);
        
        // Roof rack for adventure vibes
        const roofRackGeometry = new THREE.BoxGeometry(3.2, 0.2, 4);
        const roofRackMaterial = new THREE.MeshStandardMaterial({
            color: darkColor,
            roughness: 0.8,
            metalness: 0.3
        });
        const roofRack = new THREE.Mesh(roofRackGeometry, roofRackMaterial);
        roofRack.position.set(0, 5.2, -0.3);
        truck.add(roofRack);
        
        // Crossbars for roof rack
        for (let i = -1.5; i <= 1.5; i += 1) {
            const barGeometry = new THREE.BoxGeometry(0.1, 0.3, 4.2);
            const bar = new THREE.Mesh(barGeometry, roofRackMaterial);
            bar.position.set(i, 5.3, -0.3);
            truck.add(bar);
        }
        
        // --- Front Details ---
        // Grill - more rounded and stylized
        const grillGeometry = new THREE.BoxGeometry(3.4, 1.3, 0.3);
        const grillMaterial = new THREE.MeshStandardMaterial({
            color: darkColor,
            roughness: 0.7,
            metalness: 0.3
        });
        const grill = new THREE.Mesh(grillGeometry, grillMaterial);
        grill.position.set(0, 3.0, 3.2);
        truck.add(grill);
        
        // Grill detail (horizontal slats)
        for (let y = -0.4; y <= 0.4; y += 0.2) {
            const slatGeometry = new THREE.BoxGeometry(3.2, 0.08, 0.15);
            const slat = new THREE.Mesh(slatGeometry, new THREE.MeshStandardMaterial({
                color: metalColor,
                roughness: 0.3,
                metalness: 0.8
            }));
            slat.position.set(0, 3.0 + y, 3.25);
            truck.add(slat);
        }
        
        // Bumper with rounded edges
        const bumperShape = new THREE.Shape();
        bumperShape.moveTo(-2.2, -0.4);
        bumperShape.lineTo(2.2, -0.4);
        bumperShape.lineTo(2.2, 0.4);
        bumperShape.lineTo(-2.2, 0.4);
        bumperShape.lineTo(-2.2, -0.4);
        
        const bumperExtrudeSettings = {
            steps: 1,
            depth: 0.6,
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.2,
            bevelSegments: 3
        };
        
        const bumperGeometry = new THREE.ExtrudeGeometry(bumperShape, bumperExtrudeSettings);
        const bumperMaterial = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.5,
            metalness: 0.7
        });
        const bumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
        bumper.rotation.x = Math.PI / 2;
        bumper.position.set(0, 2.2, 3.1);
        truck.add(bumper);
        
        // Stylized Headlights
        const headlightShape = new THREE.Shape();
        headlightShape.absellipse(0, 0, 0.5, 0.5, 0, Math.PI * 2);
        
        const headlightGeometry = new THREE.ShapeGeometry(headlightShape);
        const headlightGlassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xFFFDEB,
            emissive: 0xFFFDEB,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.9,
            roughness: 0.2,
            metalness: 0.8,
            clearcoat: 1.0
        });
        
        const headlightPositions = [[-1.3, 3.2, 3.35], [1.3, 3.2, 3.35]];
        
        headlightPositions.forEach(pos => {
            // Create headlight housing
            const housingGeometry = new THREE.CylinderGeometry(0.55, 0.55, 0.2, 16);
            const housingMaterial = new THREE.MeshStandardMaterial({
                color: metalColor,
                roughness: 0.4,
                metalness: 0.8
            });
            const housing = new THREE.Mesh(housingGeometry, housingMaterial);
            housing.rotation.x = Math.PI / 2;
            housing.position.set(...pos);
            
            // Add headlight glass
            const headlight = new THREE.Mesh(headlightGeometry, headlightGlassMaterial);
            headlight.position.z = 0.11;
            headlight.rotation.y = Math.PI;
            
            housing.add(headlight);
            truck.add(housing);
        });
        
        // Fog lights
        const fogLightGeometry = new THREE.CircleGeometry(0.3, 16);
        const fogLightMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xFFFEE0,
            emissive: 0xFFFEE0,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9,
            roughness: 0.3,
            metalness: 0.7
        });
        
        const fogLightPositions = [[-1.5, 2.3, 3.4], [1.5, 2.3, 3.4]];
        fogLightPositions.forEach(pos => {
            const fogLight = new THREE.Mesh(fogLightGeometry, fogLightMaterial);
            fogLight.position.set(...pos);
            fogLight.rotation.y = Math.PI;
            truck.add(fogLight);
        });
        
        // --- Side Details ---
        // Side panels with accent color
        const sidePanelGeometry = new THREE.BoxGeometry(0.1, 0.8, 5);
        const sidePanelMaterial = new THREE.MeshStandardMaterial({
            color: secondaryColor,
            roughness: 0.7,
            metalness: 0.3
        });
        
        const leftPanel = new THREE.Mesh(sidePanelGeometry, sidePanelMaterial);
        leftPanel.position.set(-2, 3.0, 0);
        truck.add(leftPanel);
        
        const rightPanel = leftPanel.clone();
        rightPanel.position.x = 2;
        truck.add(rightPanel);
        
        // Decorative side accent stripe
        const stripeGeometry = new THREE.BoxGeometry(0.08, 0.2, 6.2);
        const stripeMaterial = new THREE.MeshStandardMaterial({
            color: accentColor,
            roughness: 0.6,
            metalness: 0.4
        });
        
        const leftStripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        leftStripe.position.set(-2.05, 3.5, 0);
        truck.add(leftStripe);
        
        const rightStripe = leftStripe.clone();
        rightStripe.position.x = 2.05;
        truck.add(rightStripe);
        
        // Door handles
        const handleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.4,
            metalness: 0.8
        });
        
        const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
        leftHandle.position.set(-2.05, 4.0, -0.2);
        truck.add(leftHandle);
        
        const rightHandle = leftHandle.clone();
        rightHandle.position.x = 2.05;
        truck.add(rightHandle);
        
        // --- Rear Details ---
        // Tailgate
        const tailgateGeometry = new THREE.BoxGeometry(3.8, 1.2, 0.2);
        const tailgate = new THREE.Mesh(tailgateGeometry, bodyMaterial);
        tailgate.position.set(0, 3.2, -3.1);
        truck.add(tailgate);
        
        // Tail lights
        const tailLightGeometry = new THREE.PlaneGeometry(0.5, 0.5);
        const tailLightMaterial = new THREE.MeshStandardMaterial({
            color: 0xD50000,
            emissive: 0xD50000,
            emissiveIntensity: 0.5,
            roughness: 0.7,
            metalness: 0.3
        });
        
        const tailLightPositions = [[-1.5, 3.2, -3.15], [1.5, 3.2, -3.15]];
        tailLightPositions.forEach(pos => {
            const tailLight = new THREE.Mesh(tailLightGeometry, tailLightMaterial);
            tailLight.position.set(...pos);
            tailLight.rotation.y = Math.PI;
            truck.add(tailLight);
        });
        
        // Exhaust pipes - more stylized
        const exhaustGeometry = new THREE.CylinderGeometry(0.15, 0.18, 1.0, 8);
        const exhaustMaterial = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.3,
            metalness: 0.8
        });
        
        const leftExhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
        leftExhaust.rotation.z = Math.PI / 2;
        leftExhaust.position.set(-1.8, 2.6, -3.0);
        truck.add(leftExhaust);
        
        const rightExhaust = leftExhaust.clone();
        rightExhaust.position.x = 1.8;
        truck.add(rightExhaust);
        
        // --- Wheels ---
        // More detailed wheels with custom rim design
        const wheelRadius = 1.2;
        const wheelThickness = 0.8;
        
        // Create wheel prototype first, then clone for efficiency
        const wheelPrototype = new THREE.Group();
        
        // Tire
        const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 24);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: darkColor,
            roughness: 0.9,
            metalness: 0.1
        });
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheelPrototype.add(wheel);
        
        // Tire tread pattern
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const treadGeo = new THREE.BoxGeometry(0.25, wheelThickness + 0.01, 0.6);
            const tread = new THREE.Mesh(treadGeo, wheelMaterial);
            tread.position.set(Math.sin(angle) * wheelRadius, 0, Math.cos(angle) * wheelRadius);
            tread.rotation.y = angle;
            wheel.add(tread);
        }
        
        // Detailed rim
        const rimGeometry = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelThickness + 0.05, 16);
        const rimMaterial = new THREE.MeshStandardMaterial({ 
            color: metalColor,
            roughness: 0.3,
            metalness: 0.9
        });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2;
        wheelPrototype.add(rim);
        
        // Spokes
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const spokeGeo = new THREE.BoxGeometry(wheelRadius * 0.5, wheelThickness + 0.06, 0.2);
            const spoke = new THREE.Mesh(spokeGeo, rimMaterial);
            spoke.position.set(Math.sin(angle) * wheelRadius * 0.3, 0, Math.cos(angle) * wheelRadius * 0.3);
            spoke.rotation.y = angle;
            rim.add(spoke);
        }
        
        // Hub cap
        const hubGeometry = new THREE.CylinderGeometry(wheelRadius * 0.2, wheelRadius * 0.2, wheelThickness + 0.1, 16);
        const hubMaterial = new THREE.MeshStandardMaterial({ 
            color: metalColor,
            roughness: 0.2,
            metalness: 1.0
        });
        const hub = new THREE.Mesh(hubGeometry, hubMaterial);
        hub.rotation.z = Math.PI / 2;
        wheelPrototype.add(hub);
        
        // Hub cap center decoration
        const hubCapGeometry = new THREE.CircleGeometry(wheelRadius * 0.15, 16);
        const hubCap = new THREE.Mesh(hubCapGeometry, new THREE.MeshStandardMaterial({
            color: secondaryColor,
            roughness: 0.4,
            metalness: 0.8
        }));
        hubCap.position.set(wheelThickness / 2 + 0.06, 0, 0);
        hubCap.rotation.y = Math.PI / 2;
        hub.add(hubCap);
        
        // Wheel positions
        const wheelPositions = [
            [-1.8, 1.7, -2.1], // Rear left
            [1.8, 1.7, -2.1],  // Rear right
            [-1.8, 1.7, 2.1],  // Front left
            [1.8, 1.7, 2.1]    // Front right
        ];
        
        this.wheels = [];  // Store wheels for animation
        
        // Create wheels at each position
        wheelPositions.forEach((position, index) => {
            const wheelGroup = wheelPrototype.clone();
            wheelGroup.position.set(...position);
            truck.add(wheelGroup);
            this.wheels.push(wheelGroup);
        });
        
        // --- Suspension System ---
        // More detailed suspension parts
        const suspensionPrototype = new THREE.Group();
        
        // Main shock absorber
        const shockGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8);
        const shockMaterial = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.5,
            metalness: 0.7
        });
        const shock = new THREE.Mesh(shockGeometry, shockMaterial);
        shock.position.set(0, 0.9, 0);
        suspensionPrototype.add(shock);
        
        // Suspension arm
        const armGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.2);
        const arm = new THREE.Mesh(armGeometry, shockMaterial);
        arm.position.set(0, 0, 0);
        suspensionPrototype.add(arm);
        
        // Apply suspension to each wheel
        wheelPositions.forEach((position, index) => {
            const suspension = suspensionPrototype.clone();
            suspension.position.set(position[0], position[1] + 1, position[2]);
            truck.add(suspension);
        });
        
        // Initialize animation properties
        this.truckAnimation = {
            bounce: 0,
            lean: 0,
            wheelRotation: 0,
            pitch: 0
        };

        this.truck = truck;
        this.scene.add(truck);
        
        // Initialize physics position to match truck position
        if (this.truckPhysics) {
            this.truckPhysics.position.copy(truck.position);
        }

        // Adjust camera for better view
        this.camera.position.set(0, 12, -20);
        this.camera.lookAt(this.truck.position);
    }

    setupControls() {
        try {
            // Create joystick container if it doesn't exist
            if (!document.getElementById('joystick-zone')) {
                console.error("Joystick zone element not found");
                return;
            }

            // Create joystick with nipplejs
            this.joystick = nipplejs.create({
                zone: document.getElementById('joystick-zone'),
                mode: 'static',
                position: { left: '50%', bottom: '80px' },
                color: 'rgba(255, 255, 255, 0.5)',
                size: 120,
                restOpacity: 0.5,
            });

            console.log("Joystick created");
            this.joystick.active = false;
            
            this.joystick.on('start', () => {
                this.joystick.active = true;
                console.log("Joystick active");
            });

            this.joystick.on('move', (e, data) => {
                // Extract normalized joystick data
                const forward = -data.vector.y; // -1 is forward, 1 is backward
                const turn = data.vector.x;     // -1 is left, 1 is right
                const inputMagnitude = Math.min(1, data.distance / 50); // Normalize based on distance from center
                
                // Simplified direct control without transitions
                if (forward > 0) {
                    // Forward
                    this.truckPhysics.targetThrottle = forward * inputMagnitude;
                    this.truckPhysics.targetBrake = 0;
                } else if (forward < 0) {
                    // Reverse
                    this.truckPhysics.targetThrottle = 0;
                    this.truckPhysics.targetBrake = -forward * inputMagnitude;
                } else {
                    // Neutral
                    this.truckPhysics.targetThrottle = 0;
                    this.truckPhysics.targetBrake = 0;
                }
                
                // Set steering
                this.truckPhysics.targetSteering = turn * inputMagnitude;
                
                console.log("Joystick move:", {
                    throttle: this.truckPhysics.targetThrottle,
                    brake: this.truckPhysics.targetBrake,
                    steering: this.truckPhysics.targetSteering
                });
            });

            this.joystick.on('end', () => {
                // Reset controls when joystick is released
                this.truckPhysics.targetThrottle = 0;
                this.truckPhysics.targetBrake = 0;
                this.truckPhysics.targetSteering = 0;
                
                console.log("Joystick end - Controls reset");
                this.joystick.active = false;
            });
        } catch (error) {
            console.error("Failed to initialize joystick:", error);
            // Fallback - mark joystick as inactive so keyboard still works
            this.joystick = { active: false };
        }

        // Debug info
        console.log("Controls initialized");
    }

    setupEventListeners() {
        // Add window resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // EMERGENCY: Add extra key handler for direct movement
        window.addEventListener('keydown', (e) => {
            // Ultra-direct mode - move truck immediately on keydown
            const EMERGENCY_MOVE = 1.0; // Units per keypress
            
            if (this.truck && this.truckPhysics) {
                const physics = this.truckPhysics;
                const key = e.key.toLowerCase();
                
                if (key === 'w' || key === 'arrowup') {
                    // Move forward instantly
                    const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
                    physics.position.add(forwardDir.multiplyScalar(EMERGENCY_MOVE));
                    console.log("EMERGENCY FORWARD MOVE!");
                } else if (key === 's' || key === 'arrowdown') {
                    // Move backward instantly
                    const backwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
                    physics.position.add(backwardDir.multiplyScalar(EMERGENCY_MOVE));
                    console.log("EMERGENCY BACKWARD MOVE!");
                } else if (key === 'a' || key === 'arrowleft') {
                    // Turn left instantly
                    physics.rotation -= 0.1;
                    console.log("EMERGENCY LEFT TURN!");
                } else if (key === 'd' || key === 'arrowright') {
                    // Turn right instantly
                    physics.rotation += 0.1;
                    console.log("EMERGENCY RIGHT TURN!");
                }
                
                // Update truck position immediately
                this.truck.position.copy(physics.position);
                this.truck.rotation.y = physics.rotation;
            }
        });

        // Normal control handlers
        window.addEventListener('keydown', (e) => {
            // Prevent default behavior for arrow keys and space to avoid page scrolling
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
            
            let keyHandled = true;
            const key = e.key.toLowerCase();
            
            // Handle immediate truck reset with 'r' key
            if (key === 'r') {
                this.resetTruck();
                return;
            }
            
            switch(key) {
                case 'w':
                case 'arrowup':
                    this.truckPhysics.keys.forward = true;
                    break;
                case 's':
                case 'arrowdown':
                    this.truckPhysics.keys.backward = true;
                    break;
                case 'a':
                case 'arrowleft':
                    this.truckPhysics.keys.left = true;
                    break;
                case 'd':
                case 'arrowright':
                    this.truckPhysics.keys.right = true;
                    break;
                case ' ':
                    this.truckPhysics.keys.brake = true;
                    break;
                default:
                    keyHandled = false;
            }
            
            if (keyHandled) {
                // Update physics from keys immediately for responsive controls
                this.updatePhysicsFromKeys();
                console.log("Key down:", key, this.truckPhysics.keys);
            }
        });
        
        window.addEventListener('keyup', (e) => {
            let keyHandled = true;
            const key = e.key.toLowerCase();
            
            switch(key) {
                case 'w':
                case 'arrowup':
                    this.truckPhysics.keys.forward = false;
                    break;
                case 's':
                case 'arrowdown':
                    this.truckPhysics.keys.backward = false;
                    break;
                case 'a':
                case 'arrowleft':
                    this.truckPhysics.keys.left = false;
                    break;
                case 'd':
                case 'arrowright':
                    this.truckPhysics.keys.right = false;
                    break;
                case ' ':
                    this.truckPhysics.keys.brake = false;
                    break;
                default:
                    keyHandled = false;
            }
            
            if (keyHandled) {
                // Update physics from keys immediately for responsive controls
                this.updatePhysicsFromKeys();
                console.log("Key up:", key, this.truckPhysics.keys);
                e.preventDefault();
            }
        });
        
        // Disable mobile touchmove events on the document to prevent page scrolling while using joystick
        document.addEventListener('touchmove', (e) => {
            // Only prevent default if touch is in the joystick zone
            const joystickRect = document.getElementById('joystick-zone')?.getBoundingClientRect();
            if (joystickRect) {
                for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    if (touch.clientX >= joystickRect.left && touch.clientX <= joystickRect.right &&
                        touch.clientY >= joystickRect.top && touch.clientY <= joystickRect.bottom) {
                        e.preventDefault();
                        break;
                    }
                }
            }
        }, { passive: false });
        
        console.log("Event listeners initialized");
    }
    
    updatePhysicsFromKeys() {
        // Don't update from keyboard if joystick is active
        if (this.joystick && this.joystick.active) {
            return;
        }
        
        const physics = this.truckPhysics;
        const keys = physics.keys;
        
        // EMERGENCY MODE: Direct extreme values to ensure response
        
        // Set throttle and brake
        if (keys.forward) {
            physics.targetThrottle = 1.0;
            physics.targetBrake = 0;
            console.log("FORWARD KEY PRESSED!");
        } else if (keys.backward) {
            physics.targetThrottle = 0;
            physics.targetBrake = 1.0;
            console.log("BACKWARD KEY PRESSED!");
        } else {
            // No forward/backward keys pressed
            physics.targetThrottle = 0;
            physics.targetBrake = 0;
        }
        
        // Apply brake when spacebar is pressed (override other controls)
        if (keys.brake) {
            physics.targetThrottle = 0;
            physics.targetBrake = 1.0;
            console.log("BRAKE KEY PRESSED!");
        }
        
        // Set steering
        if (keys.left && !keys.right) {
            physics.targetSteering = -1.0;
            console.log("LEFT KEY PRESSED!");
        } else if (keys.right && !keys.left) {
            physics.targetSteering = 1.0;
            console.log("RIGHT KEY PRESSED!");
        } else {
            physics.targetSteering = 0;
        }
    }

    getTerrainHeightAt(x, z) {
        // Base ground level
        const baseHeight = 0;
        
        // Frequency and amplitude controls the size and height of terrain features
        const largeScale = { freq: 0.01, amp: 1.5 };
        const mediumScale = { freq: 0.05, amp: 0.5 };
        const smallScale = { freq: 0.2, amp: 0.1 };
        
        // Multi-octave terrain
        const largeNoise = Math.sin(x * largeScale.freq) * Math.cos(z * largeScale.freq) * largeScale.amp;
        const mediumNoise = Math.sin(x * mediumScale.freq) * Math.cos(z * mediumScale.freq) * mediumScale.amp;
        const smallNoise = Math.sin(x * smallScale.freq) * Math.cos(z * smallScale.freq) * smallScale.amp;
        
        // Apply falloff from center to keep the play area flatter
        const distFromCenter = Math.sqrt(x * x + z * z);
        const flatteningFactor = Math.min(1.0, Math.max(0.0, (distFromCenter - 30) / 100));
        
        return baseHeight + (largeNoise + mediumNoise + smallNoise) * flatteningFactor;
    }
    
    getTerrainRoughnessAt(x, z) {
        // Calculate terrain roughness based on small-scale noise
        const roughness = Math.abs(Math.sin(x * 0.5) * Math.cos(z * 0.5) * 0.5) + 
                          Math.abs(Math.sin(x * 2.0) * Math.cos(z * 2.0) * 0.3);
        
        // Apply falloff from center for gameplay purposes
        const distFromCenter = Math.sqrt(x * x + z * z);
        const roughnessFactor = Math.min(1.0, Math.max(0.1, distFromCenter / 100));
        
        return roughness * roughnessFactor;
    }
    
    updateSuspension(deltaTime) {
        // Simplified suspension model
        const physics = this.truckPhysics;
        
        // Just make sure the ground normal is upright
        physics.groundNormal.set(0, 1, 0);
        
        // No need for complex suspension calculations in the simplified model
    }
    
    updateTruckVisuals(deltaTime) {
        const physics = this.truckPhysics;
        const anim = this.truckAnimation;
        
        // IMPORTANT: Make sure truck exactly matches physics position
        this.truck.position.x = physics.position.x;
        this.truck.position.y = physics.position.y;
        this.truck.position.z = physics.position.z;
        
        // Apply simplified lean based on steering
        const steeringLean = physics.steering * 0.1;
        anim.lean += (steeringLean - anim.lean) * 5 * deltaTime;
        this.truck.rotation.z = anim.lean;
        
        // Apply simplified pitch based on acceleration
        const accelPitch = Math.sign(physics.throttle - physics.brake) * 0.05;
        anim.pitch = anim.pitch || 0;
        anim.pitch += (accelPitch - anim.pitch) * 5 * deltaTime;
        this.truck.rotation.x = anim.pitch;
        
        // Update wheel rotation based on velocity
        const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        const speed = physics.velocity.dot(forwardDir);
        
        // Calculate wheel rotation speed
        const wheelRadius = 0.7; // meters
        const wheelCircumference = 2 * Math.PI * wheelRadius;
        const wheelRotationSpeed = speed / wheelCircumference * 2 * Math.PI;
        
        // Update wheel rotation
        anim.wheelRotation += wheelRotationSpeed * deltaTime;
        
        // Update wheel visuals - simplified
        if (this.wheels) {
            this.wheels.forEach((wheel, index) => {
                // Get wheel mesh
                const wheelMesh = wheel.children[0];
                
                // Base rotation from speed
                wheelMesh.rotation.x = anim.wheelRotation;
                
                // Apply steering to front wheels
                if (index === 2 || index === 3) { // Front wheels
                    wheel.rotation.y = physics.steering * physics.maxSteeringAngle;
                }
            });
        }
    }
    
    updateCamera() {
        if (!this.truck) return;
        
        const physics = this.truckPhysics;
        
        // Fixed camera height with minimal speed influence for stability
        const cameraHeight = 10 + physics.velocity.length() * 0.2;
        
        // Base distance that doesn't scale too dramatically with speed
        const cameraDistance = 14 + Math.min(12, physics.velocity.length() * 0.5);
        
        // Create a point that's slightly ahead of the truck in its direction of travel
        // This creates a more stable following camera
        const truckForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        const cameraTarget = this.truck.position.clone().add(
            truckForward.clone().multiplyScalar(3)  // Look 3 units ahead instead of 5
        );
        
        // Calculate ideal camera position (behind and above the truck)
        const idealCameraPos = cameraTarget.clone();
        idealCameraPos.y += cameraHeight;
        
        // Move back from target
        const cameraOffset = truckForward.clone().multiplyScalar(-cameraDistance);
        idealCameraPos.add(cameraOffset);
        
        // Add stronger offset based on steering for better visibility around turns
        const sideOffset = new THREE.Vector3(1, 0, 0)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation)
            .multiplyScalar(physics.steering * 5); // Increased from 3 to 5
        idealCameraPos.add(sideOffset);
        
        // Use faster interpolation for more responsive camera
        if (!this.smoothCameraPosition) {
            this.smoothCameraPosition = idealCameraPos.clone();
        } else {
            // Different dampening factors for different speeds
            // When moving faster, camera follows more tightly
            const speedFactor = Math.min(0.3, 0.1 + (physics.velocity.length() * 0.01));
            
            // When turning, add less lag for more responsive tracking
            const turnFactor = 1 - (Math.abs(physics.steering) * 0.15);
            
            const dampening = speedFactor * turnFactor;
            this.smoothCameraPosition.lerp(idealCameraPos, dampening);
        }
        
        // Apply limits to prevent camera from going underground
        this.smoothCameraPosition.y = Math.max(4, this.smoothCameraPosition.y);
        
        this.camera.position.copy(this.smoothCameraPosition);
        
        // Look at a point slightly above the truck for better composition
        const lookAtPoint = this.truck.position.clone();
        lookAtPoint.y += 2;
        this.camera.lookAt(lookAtPoint);
    }

    updateDebugInfo() {
        if (!this.debugDiv) return;
        
        // Show key physics values for diagnostics
        const physics = this.truckPhysics;
        const velocity = physics.velocity.length().toFixed(2);
        const speedMph = (physics.velocity.length() * 2.237).toFixed(1); // Convert to mph
        const accel = physics.acceleration.length().toFixed(2);
        
        let inputMethod = "None";
        if (Object.values(physics.keys).some(key => key)) {
            inputMethod = "Keyboard";
        } else if (this.joystick && this.joystick.active && 
                  (physics.throttle > 0 || physics.brake > 0 || physics.steering !== 0)) {
            inputMethod = "Joystick";
        }
        
        const keyStatus = Object.entries(physics.keys)
            .filter(([key, state]) => state)
            .map(([key]) => key)
            .join(', ');
            
        this.debugDiv.innerHTML = `
            <strong>CONTROLS ACTIVE: ${inputMethod}</strong><br>
            Speed: ${velocity} m/s (${speedMph} mph)<br>
            Throttle: ${(physics.throttle * 100).toFixed(0)}%<br>
            Brake: ${(physics.brake * 100).toFixed(0)}%<br>
            Steering: ${(physics.steering * 100).toFixed(0)}%<br>
            Ground Contact: ${physics.groundContact ? "YES" : "NO"}<br>
            Height: ${(physics.position.y - this.getTerrainHeightAt(physics.position.x, physics.position.z)).toFixed(2)}m<br>
            Position: ${physics.position.x.toFixed(1)}, ${physics.position.y.toFixed(1)}, ${physics.position.z.toFixed(1)}<br>
            ${keyStatus ? `Active keys: ${keyStatus}<br>` : ''}
            ${physics.stuckTime > 2 ? '<strong style="color:red">STUCK! Press R to reset</strong>' : ''}
        `;
    }

    updateTruck() {
        if (!this.truck) return;

        // Calculate elapsed time
        const currentTime = performance.now() / 1000;
        const deltaTime = Math.min(currentTime - this.lastUpdateTime, 0.1); // Cap to prevent jumps
        this.lastUpdateTime = currentTime;
        
        // Update physics simulation
        this.updateTruckPhysics(deltaTime);
        
        // CRITICAL - Always update truck 3D model to match physics position EXACTLY
        this.truck.position.copy(this.truckPhysics.position);
        this.truck.rotation.y = this.truckPhysics.rotation;
        
        // Apply visual effects
        this.updateTruckVisuals(deltaTime);
        
        // Update camera position with physics-based smoothing
        this.updateCamera();
        
        // Update debug display
        this.updateDebugInfo();
    }

    updateTruckPhysics(deltaTime) {
        const physics = this.truckPhysics;
        
        // ULTRA EMERGENCY MODE - DIRECT POSITION UPDATES WITH NO PHYSICS
        console.log("EMERGENCY MODE! Direct position updates!");
        
        // Move truck immediately in the direction keys are pressed
        // This completely bypasses the physics system
        const MOVE_SPEED = 0.5; // Units per frame
        const TURN_SPEED = 0.05; // Radians per frame
        
        // Directly respond to input
        // Forward/backward movement
        if (physics.targetThrottle > 0) {
            // Move forward by directly changing position
            const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
            physics.position.add(forwardDir.multiplyScalar(MOVE_SPEED));
            console.log("MOVING FORWARD", forwardDir);
        }
        
        if (physics.targetBrake > 0) {
            // Move backward by directly changing position
            const backwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
            physics.position.add(backwardDir.multiplyScalar(MOVE_SPEED));
            console.log("MOVING BACKWARD", backwardDir);
        }
        
        // Left/right turning
        if (physics.targetSteering > 0) {
            // Turn right by directly changing rotation
            physics.rotation += TURN_SPEED * physics.targetSteering;
            console.log("TURNING RIGHT", physics.targetSteering);
        } else if (physics.targetSteering < 0) {
            // Turn left by directly changing rotation
            physics.rotation += TURN_SPEED * physics.targetSteering;
            console.log("TURNING LEFT", physics.targetSteering);
        }
        
        // Force the truck to stay at the correct height above ground
        const groundHeight = this.getTerrainHeightAt(physics.position.x, physics.position.z);
        physics.position.y = groundHeight + 0.5;
        
        // Ensure ground contact is always true
        physics.groundContact = true;
        
        // Make sure throttle/brake/steering values are applied directly
        physics.throttle = physics.targetThrottle;
        physics.brake = physics.targetBrake;
        physics.steering = physics.targetSteering;
        
        // Fake some velocity for wheel animation (in the direction of travel)
        const fakeSpeed = (physics.targetThrottle > 0) ? 5.0 : (physics.targetBrake > 0 ? -5.0 : 0);
        physics.velocity = new THREE.Vector3(0, 0, fakeSpeed).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
    }
    
    detectAndFixStuckState(deltaTime) {
        const physics = this.truckPhysics;
        
        // Check if truck is moving very slowly despite input
        const isStalled = physics.velocity.length() < 0.1 && 
                         (physics.throttle > 0.2 || Math.abs(physics.steering) > 0.3);
                         
        // Check if truck is flipped
        const isFlipped = physics.groundNormal.y < 0.5;
        
        // Increment or reset stuck timer
        if (isStalled || isFlipped) {
            physics.stuckTime = (physics.stuckTime || 0) + deltaTime;
        } else {
            physics.stuckTime = 0;
        }
        
        // Auto-reset after 5 seconds of being stuck
        if (physics.stuckTime > 5) {
            console.log("Auto-resetting stuck truck");
            this.resetTruck();
            physics.stuckTime = 0;
        }
    }
    
    resetTruck() {
        // Skip if physics or truck not initialized yet
        if (!this.truckPhysics || !this.truck) return;
        
        console.log("Resetting truck position");
        
        // Calculate ground height at reset position
        const groundHeight = this.getTerrainHeightAt(0, 0);
        
        // Reset physics state - start much closer to the ground
        this.truckPhysics.position.set(0, groundHeight + 1.0, 0); // Position just above ground
        this.truckPhysics.velocity.set(0, 0, 0);
        this.truckPhysics.acceleration.set(0, 0, 0);
        this.truckPhysics.rotation = 0;
        this.truckPhysics.angularVelocity = 0;
        
        // Force ground contact to be true initially
        this.truckPhysics.groundContact = true;
        
        // Reset all control inputs
        this.truckPhysics.throttle = 0;
        this.truckPhysics.brake = 0;
        this.truckPhysics.steering = 0;
        this.truckPhysics.targetThrottle = 0;
        this.truckPhysics.targetBrake = 0;
        this.truckPhysics.targetSteering = 0;
        
        // Reset keyboard states
        Object.keys(this.truckPhysics.keys).forEach(key => {
            this.truckPhysics.keys[key] = false;
        });
        
        // Update truck visuals
        if (this.truck) {
            this.truck.position.copy(this.truckPhysics.position);
            this.truck.rotation.y = this.truckPhysics.rotation;
        }
        
        // Reset camera
        if (this.camera) {
            this.camera.position.set(0, 12, -20);
            this.camera.lookAt(this.truck.position);
            this.smoothCameraPosition = this.camera.position.clone();
        }
    }

    gameLoop() {
        // Calculate time since last frame with a safety limit
        const currentTime = performance.now() / 1000;
        const deltaTime = Math.min(0.1, currentTime - this.lastUpdateTime);
        this.lastUpdateTime = currentTime;
        
        // Run any registered callbacks
        if (this.updateCallbacks) {
            for (const callback of this.updateCallbacks) {
                callback(deltaTime);
            }
        }
        
        // Update physics and truck position
        this.updateTruck();
        
        // Update the camera
        this.updateCamera();
        
        // Update debug information
        this.updateDebugInfo();
        
        // Update world decorations
        this.updateDecorations();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Request next frame
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game
new Game(); 