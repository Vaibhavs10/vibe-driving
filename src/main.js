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

            // Ghibli-style warm atmosphere with softer, dreamy quality
            const skyColor = new THREE.Color(0xCAE4F1); // Soft blue sky
            const horizonColor = new THREE.Color(0xF5E9CF); // Warm horizon glow
            
            // Create scene with beautiful gradient sky background
            this.scene.fog = new THREE.FogExp2(horizonColor, 0.006); // Gentler fog for dreamier distance effect
            this.scene.background = skyColor;
            
            // Add subtle ambient light color to match the sky
            const ambientLight = new THREE.AmbientLight(0xE1EBF2, 0.5);
            this.scene.add(ambientLight);
            
            // Create a subtle sky/atmosphere gradient effect
            const skyDome = new THREE.Mesh(
                new THREE.SphereGeometry(900, 32, 32),
                new THREE.ShaderMaterial({
                    uniforms: {
                        topColor: { value: skyColor },
                        bottomColor: { value: horizonColor },
                        offset: { value: 400 },
                        exponent: { value: 0.6 }
                    },
                    vertexShader: `
                        varying vec3 vWorldPosition;
                        void main() {
                            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                            vWorldPosition = worldPosition.xyz;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 topColor;
                        uniform vec3 bottomColor;
                        uniform float offset;
                        uniform float exponent;
                        varying vec3 vWorldPosition;
                        void main() {
                            float h = normalize(vWorldPosition + offset).y;
                            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(h, exponent), 0.0)), 1.0);
                        }
                    `,
                    side: THREE.BackSide
                })
            );
            this.scene.add(skyDome);

            // Create debug text display for physics info
            this.createDebugDisplay();

            // Initialize decoration chunk system parameters first
            this.chunkSize = 100; // Size of each decoration chunk
            this.visibleRange = 350; // How far decorations should be visible
            this.decorationChunks = new Map(); // Store active decoration chunks
            
            // Set up the scene basics
            this.setupLights();
            this.createTerrain();
            
            // COMPLETELY REBUILD THE TRUCK CREATION SEQUENCE
            // Initialize a complete, simple physics system first
            this.setupSimplePhysics();
            
            // Create the truck AFTER physics is initialized
            this.createTruck();
            
            // Verify truck creation worked
            if (!this.truck) {
                throw new Error("Truck creation failed - object is null or undefined!");
            }
            
            // Log truck position for debugging
            console.log("Initial truck position:", this.truck.position);
            
            // Display truck position on screen to confirm it was created
            const truckInfoDiv = document.createElement('div');
            truckInfoDiv.innerHTML = `Truck created at position: (${this.truck.position.x.toFixed(2)}, ${this.truck.position.y.toFixed(2)}, ${this.truck.position.z.toFixed(2)})`;
            truckInfoDiv.style.position = 'absolute';
            truckInfoDiv.style.top = '10px';
            truckInfoDiv.style.right = '10px';
            truckInfoDiv.style.background = 'rgba(0,0,0,0.7)';
            truckInfoDiv.style.color = 'white';
            truckInfoDiv.style.padding = '10px';
            truckInfoDiv.style.borderRadius = '5px';
            truckInfoDiv.style.zIndex = '1000';
            document.body.appendChild(truckInfoDiv);
            setTimeout(() => document.body.removeChild(truckInfoDiv), 10000);
            
            // Set up controls after truck is created
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
    
    // SIMPLIFIED PHYSICS SETUP - no more smoothing issues
    setupSimplePhysics() {
        this.truckPhysics = {
            // Basic movement
            position: new THREE.Vector3(0, 2, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            acceleration: new THREE.Vector3(0, 0, 0),
            
            // Rotation
            rotation: 0,
            angularVelocity: 0,
            
            // Physics constants for more reliable driving
            mass: 800,
            engineForce: 40000,
            brakingForce: 15000,
            rollingResistance: 0.01,
            dragCoefficient: 0.05,
            wheelBase: 3.5,
            maxSteeringAngle: 0.6,
            
            // Terrain interaction
            groundContact: true,
            groundNormal: new THREE.Vector3(0, 1, 0),
            
            // States
            throttle: 0,
            brake: 0,
            steering: 0,
            
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
        
        console.log("Physics initialized with position:", this.truckPhysics.position);
    }
    
    // COMPLETELY REWRITTEN TRUCK CREATION
    createTruck() {
        // Create a truck group to hold all parts
        const truck = new THREE.Group();
        
        // SIMPLER TRUCK DESIGN - just a visible box for debugging
        const bodyGeometry = new THREE.BoxGeometry(4, 2, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xD48166, // Warm terracotta red
            roughness: 0.7,
            metalness: 0.2,
            emissive: 0x331a14, // Slight glow to make more visible
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        truck.add(body);
        
        // Add very visible marker on top
        const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
        const markerMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000, // Bright red
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.y = 2; // On top of the truck
        truck.add(marker);
        
        // Simple wheel representation
        const wheelRadius = 1.2;
        const wheelThickness = 0.8;
        
        // Create wheel prototype
        const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x202020,
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Add wheels
        const wheelPositions = [
            [-2, 0, -2], // back left
            [2, 0, -2],  // back right
            [-2, 0, 2],  // front left
            [2, 0, 2]    // front right
        ];
        
        this.wheels = [];
        
        wheelPositions.forEach((position, index) => {
            const wheelGroup = new THREE.Group();
            
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);
            
            wheelGroup.position.set(...position);
            truck.add(wheelGroup);
            
            this.wheels.push(wheelGroup);
        });
        
        // Initialize animation properties
        this.truckAnimation = {
            lean: 0,
            pitch: 0,
            wheelRotation: 0,
            prevSpeed: 0
        };
        
        // CRITICAL - Set the initial truck position to match physics
        if (this.truckPhysics) {
            truck.position.copy(this.truckPhysics.position);
        } else {
            truck.position.set(0, 2, 0); // Default position if physics not yet initialized
        }
        
        // No smoothing position - direct position updates only
        this.smoothedTruckPosition = null; // Remove the smoothed position for now
        
        // Store the truck and add to scene
        this.truck = truck;
        this.scene.add(truck);
        
        // Adjust camera for better view
        if (this.camera) {
            this.camera.position.set(0, 12, -20);
            this.camera.lookAt(truck.position);
        }
        
        console.log("Truck created and added to scene at position:", truck.position);
    }
    
    updateTruck() {
        if (!this.truck) {
            console.error("No truck object found!");
            return;
        }

        // Get current deltaTime
        const deltaTime = this.currentFrameDeltaTime || 0.016;
        
        // Update physics simulation
        this.updateTruckPhysics(deltaTime);
        
        // SIMPLIFIED POSITION UPDATE - no smoothing for now
        // Direct copy of physics position to visual model
        this.truck.position.copy(this.truckPhysics.position);
        this.truck.rotation.y = this.truckPhysics.rotation;
        
        // Apply visual effects (wheels, suspension)
        this.updateTruckVisuals(deltaTime);
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
        
        // Apply height variation for more natural terrain with smoother transitions
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Keep center area very flat and even for gameplay
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            
            // More gradual transition from flat to varied terrain
            const flatteningFactor = Math.min(1, Math.max(0, Math.pow((distanceFromCenter - 80) / 250, 2)));
            
            // Use smoother noise functions for more natural looking terrain
            if (distanceFromCenter > 40) {
                // Use smoother sine/cosine functions with different phases for more natural patterns
                const largeNoise = Math.sin(x / 60 + 0.5) * Math.cos(z / 60 + 0.3) * 4;
                const mediumNoise = Math.sin(x / 25 + 0.2) * Math.cos(z / 25 + 0.1) * 1.5;
                const smallNoise = Math.sin(x / 8 + 0.7) * Math.cos(z / 8 + 0.9) * 0.3;
                
                // Apply smoothing to avoid harsh transitions
                vertices[i + 1] = (largeNoise + mediumNoise + smallNoise) * flatteningFactor * 
                                  (0.5 + 0.5 * Math.sin(distanceFromCenter / 100));
            } else {
                // Make the central area perfectly flat with minimal height variation
                vertices[i + 1] = 0;
            }
        }
        
        // Create a more visually appealing ground material with texture patterns
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x8BC34A, // Brighter, more vibrant grass color
            roughness: 0.85,
            metalness: 0.05,
            flatShading: false, // Smooth shading for more even look
        });
        
        // Create ground mesh
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        
        // Add subtle ambient occlusion effect for more depth and subtle texture patterns
        groundMaterial.onBeforeCompile = (shader) => {
            // Add noise functions to create procedural texture
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                
                // Simple noise functions for texture variation
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(123.45, 678.91))) * 43758.5453);
                }
                
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    
                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));
                    
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }
                
                float fbm(vec2 p) {
                    float f = 0.0;
                    f += 0.5000 * noise(p * 1.0);
                    f += 0.2500 * noise(p * 2.0);
                    f += 0.1250 * noise(p * 4.0);
                    f += 0.0625 * noise(p * 8.0);
                    return f;
                }
                
                // Define variables for use across shader stages
                vec3 worldPos;
                float grassPattern;
                `
            );
            
            // Initialize our world position variable after view position is set
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <clipping_planes_fragment>',
                `
                #include <clipping_planes_fragment>
                // Calculate world position for use in multiple shader stages
                worldPos = vViewPosition + cameraPosition;
                // Calculate grass pattern once for reuse
                grassPattern = fbm(worldPos.xz * 0.05);
                `
            );
            
            // Use worldPosition that's already available in the shader
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <aomap_fragment>',
                `
                #include <aomap_fragment>
                #ifdef USE_AOMAP
                // Default aomap handling
                #else
                // Create a simple distance-based ambient occlusion
                float distanceFromCenter = length(worldPos.xz);
                float aoFactor = smoothstep(20.0, 100.0, distanceFromCenter) * 0.2;
                reflectedLight.indirectDiffuse *= 1.0 - aoFactor;
                #endif
                `
            );
            
            // Add texture variation to the diffuse color
            shader.fragmentShader = shader.fragmentShader.replace(
                'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
                `
                // Create subtle grass texture patterns - using precomputed pattern
                
                // Vary the grass color based on the pattern
                vec3 darkGrass = vec3(0.4, 0.53, 0.22);  // Darker shade for variation
                vec3 lightGrass = vec3(0.58, 0.73, 0.33); // Lighter shade for highlights
                vec3 grassVariation = mix(darkGrass, lightGrass, grassPattern);
                
                // Apply color variation subtly to diffuse light
                vec3 totalDiffuse = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * 
                                    mix(vec3(1.0), grassVariation, 0.35);
                `
            );
        };
        
        this.scene.add(this.ground);
        
        // Create enhanced terrain details with denser vegetation
        this.createTerrainDetails();
        
        // Initialize decoration chunks
        this.decorationChunks = new Map();
        this.updateDecorations();
    }

    createTerrainDetails() {
        // Add small vegetation and ground details
        const detailsGroup = new THREE.Group();
        
        // Create various types of grass with more varied and vibrant colors
        const grassTypes = [
            { width: 1.0, height: 1.0, color: 0xA4D269, thick: false },
            { width: 0.8, height: 1.2, color: 0x8BC34A, thick: false },
            { width: 1.2, height: 0.7, color: 0xC5E1A5, thick: true },
            { width: 0.9, height: 1.4, color: 0x7CB342, thick: true },
            { width: 1.0, height: 0.8, color: 0x9CCC65, thick: false }
        ];
        
        // Add more dense and evenly distributed grass patches
        for (let i = 0; i < 3000; i++) { // Increased from 2000 to 3000
            // Determine random position with higher density in certain areas
            const angle = Math.random() * Math.PI * 2;
            
            // Create more natural distribution patterns
            const ringChoice = Math.random();
            let radius;
            
            if (ringChoice < 0.4) { // Increased inner circle probability
                // Inner grass circle - denser and more even
                radius = 20 + Math.random() * 60;
            } else if (ringChoice < 0.75) {
                // Middle grass ring
                radius = 90 + Math.random() * 120;
            } else {
                // Outer grass areas
                radius = 220 + Math.random() * 180;
            }
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Select grass type
            const grassType = grassTypes[Math.floor(Math.random() * grassTypes.length)];
            
            // Create more detailed grass tufts that vary in size
            if (Math.random() < 0.8) { // 80% chance for grass (increased from 70%)
                // Create crossed planes for 3D effect
                const grassGroup = new THREE.Group();
                
                // Create more dense grass tufts
                const planeCount = grassType.thick ? 4 : 3; // Increased from 3/2
                for (let j = 0; j < planeCount; j++) {
                    const rotation = j * Math.PI / planeCount;
                    
                    const grassGeometry = new THREE.PlaneGeometry(
                        grassType.width * (0.8 + Math.random() * 0.4),
                        grassType.height * (0.8 + Math.random() * 0.4)
                    );
                    
                    // More natural color variation
                    const colorVariation = Math.random() * 0.15 - 0.075; // Reduced variation for more consistent look
                    const color = new THREE.Color(grassType.color);
                    color.r = Math.max(0, Math.min(1, color.r + colorVariation));
                    color.g = Math.max(0, Math.min(1, color.g + colorVariation));
                    color.b = Math.max(0, Math.min(1, color.b + colorVariation * 0.5)); // Subtle blue variation
                    
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
                
                // Position the grass tuft - more consistent height for even appearance
                const heightVariation = Math.random() * 0.1; // Reduced variation for more even look
                grassGroup.position.set(x, 0.4 + heightVariation, z);
                grassGroup.rotation.y = Math.random() * Math.PI;
                detailsGroup.add(grassGroup);
            } else {
                // 20% chance for small rocks, twigs, etc.
                const detailType = Math.random() < 0.6 ? 'rock' : 'twig'; // Slightly reduced rock probability
                
                if (detailType === 'rock') {
                    // Create small rock with more consistent sizes
                    const rockGeometry = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.2);
                    const rockMaterial = new THREE.MeshStandardMaterial({
                        color: 0x909090 + Math.floor(Math.random() * 0x101010), // More consistent color
                        roughness: 0.9,
                        metalness: 0.05
                    });
                    
                    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                    const scale = 0.1 + Math.random() * 0.2; // Smaller, more consistent rocks
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
                    const twigGeometry = new THREE.CylinderGeometry(0.04, 0.02, 0.4 + Math.random() * 0.4); // Slightly smaller
                    const twigMaterial = new THREE.MeshStandardMaterial({
                        color: 0x8B4513,
                        roughness: 0.9,
                        metalness: 0.1
                    });
                    
                    const twig = new THREE.Mesh(twigGeometry, twigMaterial);
                    twig.position.set(x, 0.05, z); // Lower position for more even ground appearance
                    twig.rotation.set(
                        Math.random() * 0.15,  // Mostly flat
                        Math.random() * Math.PI,
                        Math.random() * 0.15
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
        
        // Distance from center to control decoration density
        const chunkCenterX = chunkWorldX + this.chunkSize / 2;
        const chunkCenterZ = chunkWorldZ + this.chunkSize / 2;
        const distanceFromCenter = Math.sqrt(chunkCenterX * chunkCenterX + chunkCenterZ * chunkCenterZ);
        
        // Determine density based on distance (more sparse further out, denser and more varied near player)
        let treeDensity = 15;
        let rockDensity = 8;
        let flowerDensity = 12;
        let cloudDensity = 3;
        
        if (distanceFromCenter > 500) {
            treeDensity = 18; // More trees in the distance
            rockDensity = 10;
            flowerDensity = 8;
        } else if (distanceFromCenter < 200) {
            // More varied and detailed decorations near player
            flowerDensity = 15;
            cloudDensity = 4;
        }

        // Add Ghibli-style trees to chunk
        for (let i = 0; i < treeDensity; i++) {
            const tree = this.createTree(0.5 + Math.random() * 1.5);
            const x = chunkWorldX + Math.random() * this.chunkSize;
            const z = chunkWorldZ + Math.random() * this.chunkSize;
            
            // Apply height variation from terrain
            const y = this.getTerrainHeightAt(x, z);
            tree.position.set(x, y, z);
            tree.rotation.y = Math.random() * Math.PI * 2;
            chunk.add(tree);
        }

        // Add Ghibli-style rocks to chunk
        for (let i = 0; i < rockDensity; i++) {
            const rockScale = 0.4 + Math.random() * 1.5;
            const rock = this.createGhibliRock(rockScale);
            
            const x = chunkWorldX + Math.random() * this.chunkSize;
            const z = chunkWorldZ + Math.random() * this.chunkSize;
            const y = this.getTerrainHeightAt(x, z);
            
            rock.position.set(x, y, z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            chunk.add(rock);
        }
        
        // Add Ghibli-style flower patches 
        for (let i = 0; i < flowerDensity; i++) {
            const flowerPatch = this.createFlowerPatch(0.8 + Math.random() * 1.2);
            
            const x = chunkWorldX + Math.random() * this.chunkSize;
            const z = chunkWorldZ + Math.random() * this.chunkSize;
            const y = this.getTerrainHeightAt(x, z);
            
            flowerPatch.position.set(x, y, z);
            chunk.add(flowerPatch);
        }
        
        // Add some clouds at a distance from center area
        if (distanceFromCenter > 150) {
            for (let i = 0; i < cloudDensity; i++) {
                const cloud = this.createCloud(1 + Math.random() * 2);
                
                const x = chunkWorldX + Math.random() * this.chunkSize;
                const z = chunkWorldZ + Math.random() * this.chunkSize;
                
                // Clouds should be high in the sky
                const baseHeight = 40 + Math.random() * 30;
                
                cloud.position.set(x, baseHeight, z);
                chunk.add(cloud);
            }
        }

        return chunk;
    }

    createTree(scale = 1) {
        const tree = new THREE.Group();
        
        // Ghibli-style trees have softer, more organic silhouettes with rounded, puffy foliage
        // Use more vibrant, painterly colors for the foliage
        const foliageColors = [
            0x7AAC39, // Bright yellowish green
            0x5E9732, // Medium green
            0x4A7929  // Darker green
        ];
        
        // Create cloud-like foliage clusters
        const foliageClusters = Math.floor(2 + Math.random() * 3); // 2-4 clusters
        
        for (let i = 0; i < foliageClusters; i++) {
            // Create organic cloud-like foliage 
            const foliageGroup = new THREE.Group();
            
            // Create multiple spheres clustered together for each foliage section
            const sphereCount = 3 + Math.floor(Math.random() * 4); // 3-6 spheres per cluster
            const baseSize = (1.3 + Math.random() * 0.7) * scale;
            const colorIndex = Math.floor(Math.random() * foliageColors.length);
            
            for (let j = 0; j < sphereCount; j++) {
                const size = baseSize * (0.7 + Math.random() * 0.6);
                const foliageGeo = new THREE.SphereGeometry(size, 8, 6);
                
                // Add slight color variation within the same cluster
                const colorVariation = Math.random() * 0.1 - 0.05;
                const color = new THREE.Color(foliageColors[colorIndex]);
                color.r = Math.max(0, Math.min(1, color.r + colorVariation));
                color.g = Math.max(0, Math.min(1, color.g + colorVariation));
                color.b = Math.max(0, Math.min(1, color.b + colorVariation * 0.5));
                
                const foliageMat = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.8,
                    metalness: 0.1
                });
                
                const foliage = new THREE.Mesh(foliageGeo, foliageMat);
                
                // Position spheres in cluster with slight offsets
                const offsetX = (Math.random() - 0.5) * baseSize * 1.2;
                const offsetY = (Math.random() - 0.5) * baseSize * 0.8;
                const offsetZ = (Math.random() - 0.5) * baseSize * 1.2;
                
                foliage.position.set(offsetX, offsetY, offsetZ);
                foliage.castShadow = true;
                foliageGroup.add(foliage);
            }
            
            // Position the foliage cluster at different heights
            const posY = (5 + i * 2.5 + Math.random()) * scale;
            const posX = (Math.random() - 0.5) * scale * 1.5;
            const posZ = (Math.random() - 0.5) * scale * 1.5;
            foliageGroup.position.set(posX, posY, posZ);
            
            tree.add(foliageGroup);
        }
        
        // More interesting trunk with gentle curves
        const trunkGroup = new THREE.Group();
        
        // Main trunk
        const trunkHeight = 5 * scale;
        const trunkGeo = new THREE.CylinderGeometry(0.4 * scale, 0.7 * scale, trunkHeight, 8);
        
        // Add slight curve to trunk by manipulating vertices (Ghibli trees often have character)
        const trunkVertices = trunkGeo.attributes.position.array;
        const bendFactor = 0.15 * scale;
        
        for (let i = 0; i < trunkVertices.length; i += 3) {
            const y = trunkVertices[i + 1];
            const normalizedY = (y / trunkHeight + 0.5); // 0 to 1 from bottom to top
            
            // Create gentle S-curve
            const bendX = Math.sin(normalizedY * Math.PI) * bendFactor;
            const bendZ = Math.cos(normalizedY * Math.PI * 0.5) * bendFactor * 0.5;
            
            trunkVertices[i] += bendX;
            trunkVertices[i + 2] += bendZ;
        }
        
        trunkGeo.attributes.position.needsUpdate = true;
        trunkGeo.computeVertexNormals();
        
        // Warm brown colors for trunk - Ghibli trees often have richer colors
        const trunkMat = new THREE.MeshStandardMaterial({ 
            color: 0x8A5C3C, // Warmer brown
            roughness: 0.9,
            metalness: 0.1
        });
        
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunkGroup.add(trunk);
        
        // Add some smaller branches
        const branchCount = Math.floor(2 + Math.random() * 3);
        for (let i = 0; i < branchCount; i++) {
            const branchHeight = (0.6 + Math.random() * 1.2) * scale;
            const branchGeo = new THREE.CylinderGeometry(0.1 * scale, 0.25 * scale, branchHeight, 5);
            const branch = new THREE.Mesh(branchGeo, trunkMat);
            
            // Position branch at different heights along trunk
            const yPos = (1 + i * 1.5 + Math.random()) * scale;
            const angle = Math.random() * Math.PI * 2;
            const distance = 0.4 * scale;
            
            branch.position.set(
                Math.cos(angle) * distance,
                yPos,
                Math.sin(angle) * distance
            );
            
            // Rotate branch outward
            branch.rotation.z = (Math.random() - 0.5) * 0.8;
            branch.rotation.x = (Math.random() - 0.5) * 0.8;
            
            trunkGroup.add(branch);
        }
        
        tree.add(trunkGroup);
        
        return tree;
    }
    
    createGhibliRock(scale = 1) {
        // Ghibli-style rocks are often rounded and slightly exaggerated in shape
        const rockGroup = new THREE.Group();
        
        // Create main rock shape with a more organic form
        const complexity = 2 + Math.floor(Math.random() * 3); // How many sub-shapes to use
        
        // Rock colors - Ghibli rocks often have subtle color variations
        const rockColors = [
            0x808080, // Medium gray
            0x707070, // Darker gray
            0x909090, // Lighter gray
            0x808575, // Gray with slight green tint
            0x807D75  // Gray with warm tint
        ];
        
        for (let i = 0; i < complexity; i++) {
            let rockGeo;
            
            // Use different geometry types for variety
            const geoType = Math.random();
            if (geoType < 0.4) {
                rockGeo = new THREE.DodecahedronGeometry((0.7 + Math.random() * 0.8) * scale);
            } else if (geoType < 0.7) {
                rockGeo = new THREE.IcosahedronGeometry((0.6 + Math.random() * 0.9) * scale, 1);
            } else {
                rockGeo = new THREE.SphereGeometry((0.6 + Math.random() * 0.9) * scale, 8, 6);
            }
            
            // Add irregularity to rock shapes
            const vertices = rockGeo.attributes.position.array;
            for (let j = 0; j < vertices.length; j += 3) {
                vertices[j] *= 0.8 + Math.random() * 0.4;
                vertices[j + 1] *= 0.8 + Math.random() * 0.4;
                vertices[j + 2] *= 0.8 + Math.random() * 0.4;
            }
            rockGeo.attributes.position.needsUpdate = true;
            rockGeo.computeVertexNormals();
            
            // Random color from our palette
            const colorIndex = Math.floor(Math.random() * rockColors.length);
            const rockMaterial = new THREE.MeshStandardMaterial({
                color: rockColors[colorIndex],
                roughness: 0.9,
                metalness: 0.1
            });
            
            const rockMesh = new THREE.Mesh(rockGeo, rockMaterial);
            
            // Position each shape with slight offsets to create compound rock
            rockMesh.position.set(
                (Math.random() - 0.5) * scale * 0.5,
                (Math.random() * 0.3) * scale,
                (Math.random() - 0.5) * scale * 0.5
            );
            
            rockMesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            rockMesh.castShadow = true;
            rockMesh.receiveShadow = true;
            rockGroup.add(rockMesh);
        }
        
        // Sometimes add moss or vegetation on top for character (Ghibli-style detail)
        if (Math.random() < 0.4) {
            const mossSize = (0.4 + Math.random() * 0.3) * scale;
            const mossGeo = new THREE.SphereGeometry(mossSize, 6, 4);
            const mossColor = 0x56793E; // Deep green
            const mossMaterial = new THREE.MeshStandardMaterial({
                color: mossColor,
                roughness: 0.9,
                metalness: 0.0
            });
            
            const moss = new THREE.Mesh(mossGeo, mossMaterial);
            moss.scale.y = 0.4;
            moss.position.y = scale * 0.8;
            rockGroup.add(moss);
        }
        
        return rockGroup;
    }
    
    createFlowerPatch(scale = 1) {
        // Create Ghibli-style colorful flower patch
        const flowerGroup = new THREE.Group();
        
        // Vibrant Ghibli palette for flowers
        const flowerColors = [
            0xFF5252, // Red
            0xFFEB3B, // Yellow
            0xE91E63, // Pink
            0x7E57C2, // Purple
            0x2196F3, // Blue
            0xFFFFFF  // White
        ];
        
        const stemColor = 0x558B2F; // Green stem
        
        // Create multiple flowers in a small area
        const flowerCount = Math.floor(3 + Math.random() * 5);
        
        for (let i = 0; i < flowerCount; i++) {
            const flowerSubGroup = new THREE.Group();
            
            // Create stem
            const stemHeight = (0.3 + Math.random() * 0.4) * scale;
            const stemGeo = new THREE.CylinderGeometry(0.02 * scale, 0.03 * scale, stemHeight, 5);
            const stemMat = new THREE.MeshStandardMaterial({
                color: stemColor,
                roughness: 0.8,
                metalness: 0.1
            });
            
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.y = stemHeight / 2;
            flowerSubGroup.add(stem);
            
            // Create flower head
            const colorIndex = Math.floor(Math.random() * flowerColors.length);
            const flowerSize = (0.08 + Math.random() * 0.1) * scale;
            
            // Different flower types
            const flowerType = Math.random();
            
            if (flowerType < 0.4) {
                // Daisy-like flower with petals
                const centerGeo = new THREE.SphereGeometry(flowerSize * 0.5, 6, 6);
                const centerMat = new THREE.MeshStandardMaterial({
                    color: 0xFFF59D, // Yellow center
                    roughness: 0.8,
                    metalness: 0.1
                });
                
                const center = new THREE.Mesh(centerGeo, centerMat);
                center.position.y = stemHeight;
                flowerSubGroup.add(center);
                
                // Add petals
                const petalCount = 5 + Math.floor(Math.random() * 4);
                const petalMat = new THREE.MeshStandardMaterial({
                    color: flowerColors[colorIndex],
                    roughness: 0.8,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                });
                
                for (let j = 0; j < petalCount; j++) {
                    const petalGeo = new THREE.PlaneGeometry(flowerSize * 2, flowerSize * 1.2);
                    const petal = new THREE.Mesh(petalGeo, petalMat);
                    
                    const angle = (j / petalCount) * Math.PI * 2;
                    petal.position.set(
                        Math.cos(angle) * flowerSize * 0.8,
                        stemHeight,
                        Math.sin(angle) * flowerSize * 0.8
                    );
                    
                    petal.rotation.x = -Math.PI / 2;
                    petal.rotation.z = angle;
                    flowerSubGroup.add(petal);
                }
            } else {
                // Simple flower with clustered spheres
                const flowerGeo = new THREE.SphereGeometry(flowerSize, 6, 6);
                const flowerMat = new THREE.MeshStandardMaterial({
                    color: flowerColors[colorIndex],
                    roughness: 0.8,
                    metalness: 0.1
                });
                
                const flowerHead = new THREE.Mesh(flowerGeo, flowerMat);
                flowerHead.position.y = stemHeight;
                flowerSubGroup.add(flowerHead);
                
                // Add smaller spheres for texture
                const detailCount = 3 + Math.floor(Math.random() * 3);
                for (let j = 0; j < detailCount; j++) {
                    const detailGeo = new THREE.SphereGeometry(flowerSize * 0.4, 4, 4);
                    const detail = new THREE.Mesh(detailGeo, flowerMat);
                    
                    const angle = (j / detailCount) * Math.PI * 2;
                    const radius = flowerSize * 0.7;
                    
                    detail.position.set(
                        Math.cos(angle) * radius,
                        stemHeight + Math.sin(angle) * radius * 0.3,
                        Math.sin(angle) * radius
                    );
                    
                    flowerSubGroup.add(detail);
                }
            }
            
            // Position flower within patch
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * scale * 0.5;
            flowerSubGroup.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
            
            // Add slight random rotation for natural look
            flowerSubGroup.rotation.y = Math.random() * Math.PI * 2;
            flowerSubGroup.rotation.x = (Math.random() - 0.5) * 0.2;
            flowerSubGroup.rotation.z = (Math.random() - 0.5) * 0.2;
            
            flowerGroup.add(flowerSubGroup);
        }
        
        return flowerGroup;
    }
    
    createCloud(scale = 1) {
        // Create Ghibli-style fluffy cloud
        const cloud = new THREE.Group();
        
        // Soft white color with slight blue tint
        const cloudMaterial = new THREE.MeshStandardMaterial({
            color: 0xF8F9FF,
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.95
        });
        
        // Create cloud with multiple overlapping spheres
        const sphereCount = 5 + Math.floor(Math.random() * 4);
        const baseSize = (2 + Math.random() * 1.5) * scale;
        
        // Main sphere in center
        const mainSphere = new THREE.Mesh(
            new THREE.SphereGeometry(baseSize, 8, 8),
            cloudMaterial
        );
        cloud.add(mainSphere);
        
        // Add surrounding spheres
        for (let i = 0; i < sphereCount; i++) {
            const size = baseSize * (0.6 + Math.random() * 0.6);
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(size, 7, 7),
                cloudMaterial
            );
            
            // Position around main sphere
            const angle = (i / sphereCount) * Math.PI * 2;
            const height = (Math.random() - 0.5) * baseSize * 0.4;
            const distance = baseSize * 0.7;
            
            sphere.position.set(
                Math.cos(angle) * distance,
                height,
                Math.sin(angle) * distance
            );
            
            cloud.add(sphere);
        }
        
        // Add some smaller spheres for detail
        for (let i = 0; i < 8; i++) {
            const size = baseSize * (0.3 + Math.random() * 0.4);
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(size, 6, 6),
                cloudMaterial
            );
            
            // Position randomly
            sphere.position.set(
                (Math.random() - 0.5) * baseSize * 2,
                (Math.random() - 0.5) * baseSize * 0.7,
                (Math.random() - 0.5) * baseSize * 2
            );
            
            cloud.add(sphere);
        }
        
        return cloud;
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
        // Updated to match the smoother terrain created in createTerrain
        const largeScale = { freq: 1/60, amp: 4.0 };
        const mediumScale = { freq: 1/25, amp: 1.5 };
        const smallScale = { freq: 1/8, amp: 0.3 };
        
        // Multi-octave terrain with phase shifts for more natural look
        const largeNoise = Math.sin(x * largeScale.freq + 0.5) * Math.cos(z * largeScale.freq + 0.3) * largeScale.amp;
        const mediumNoise = Math.sin(x * mediumScale.freq + 0.2) * Math.cos(z * mediumScale.freq + 0.1) * mediumScale.amp;
        const smallNoise = Math.sin(x * smallScale.freq + 0.7) * Math.cos(z * smallScale.freq + 0.9) * smallScale.amp;
        
        // Apply falloff from center to keep the play area flatter
        const distFromCenter = Math.sqrt(x * x + z * z);
        
        // More gradual transition from flat to varied terrain matching createTerrain
        const flatteningFactor = Math.min(1.0, Math.max(0.0, Math.pow((distFromCenter - 80) / 250, 2)));
        
        // Add smooth transition with distance
        const heightWithDistance = (largeNoise + mediumNoise + smallNoise) * flatteningFactor * 
                                   (0.5 + 0.5 * Math.sin(distFromCenter / 100));
        
        // Keep central area perfectly flat
        if (distFromCenter <= 40) {
            return baseHeight;
        }
        
        return baseHeight + heightWithDistance;
    }
    
    getTerrainRoughnessAt(x, z) {
        // Calculate terrain roughness based on small-scale noise
        // Reduced roughness values for a smoother feeling terrain
        const smallScaleRoughness = Math.abs(Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.3) + 
                                   Math.abs(Math.sin(x * 1.5) * Math.cos(z * 1.5) * 0.2);
        
        // Apply distance-based smoothing - center is smoother
        const distFromCenter = Math.sqrt(x * x + z * z);
        
        // Reduce roughness in central play area
        const roughnessFactor = Math.min(1.0, Math.max(0.2, (distFromCenter - 60) / 200));
        
        return smallScaleRoughness * roughnessFactor;
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
        
        // Initialize animation values if needed
        if (!this.truckAnimation) {
            this.truckAnimation = {
                lean: 0,
                pitch: 0,
                wheelRotation: 0,
                prevSpeed: 0
            };
        }
        
        const anim = this.truckAnimation;
        
        // Apply smoother lean based on steering and velocity
        // Lean amount should depend on speed - faster = more lean
        const speedFactor = Math.min(1.0, physics.velocity.length() * 0.05);
        const steeringLean = physics.steering * 0.12 * speedFactor;
        
        // Use stronger smoothing for more stability
        const leanSmoothFactor = Math.min(1.0, 3.0 * deltaTime);
        anim.lean += (steeringLean - anim.lean) * leanSmoothFactor;
        
        // Apply lean with a soft limit to prevent extreme values
        this.truck.rotation.z = anim.lean;
        
        // Apply pitch based on acceleration change, not direct throttle
        // Calculate acceleration by comparing current and previous speed
        const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        const currentSpeed = physics.velocity.dot(forwardDir);
        
        // Only measure significant acceleration for visual effect
        const acceleration = (currentSpeed - anim.prevSpeed) / deltaTime;
        const accelPitch = -Math.sign(acceleration) * Math.min(0.05, Math.abs(acceleration) * 0.001);
        
        // Apply smoother pitch with stronger damping
        const pitchSmoothFactor = Math.min(1.0, 2.0 * deltaTime);
        anim.pitch += (accelPitch - anim.pitch) * pitchSmoothFactor;
        
        // Apply pitch with soft limits
        this.truck.rotation.x = Math.max(-0.08, Math.min(0.08, anim.pitch));
        
        // Store current speed for next frame
        anim.prevSpeed = currentSpeed;
        
        // Update wheel rotation based on velocity with smoother calculation
        // Calculate desired wheel rotation based on actual forward speed
        const wheelRadius = 0.7; // meters
        const wheelCircumference = 2 * Math.PI * wheelRadius;
        
        // Actual wheel rotation speed based on ground speed
        const wheelRotationSpeed = currentSpeed / wheelCircumference * 2 * Math.PI;
        
        // Update wheel rotation with smooth transition when speed changes direction
        if (Math.sign(wheelRotationSpeed) !== Math.sign(anim.currentWheelRotationSpeed || 0)) {
            // When changing direction, ease the transition
            anim.currentWheelRotationSpeed = wheelRotationSpeed * 0.3; // Softer start when reversing
        } else {
            // Smooth approach to target speed
            anim.currentWheelRotationSpeed = anim.currentWheelRotationSpeed || 0;
            anim.currentWheelRotationSpeed += (wheelRotationSpeed - anim.currentWheelRotationSpeed) * 
                                               Math.min(1.0, 5.0 * deltaTime);
        }
        
        // Apply wheel rotation
        anim.wheelRotation += anim.currentWheelRotationSpeed * deltaTime;
        
        // Update wheel visuals with smoother steering transitions
        if (this.wheels) {
            this.wheels.forEach((wheel, index) => {
                // Get wheel mesh
                const wheelMesh = wheel.children[0];
                
                // Smoother wheel rotation
                wheelMesh.rotation.x = anim.wheelRotation;
                
                // Apply steering to front wheels with smoothing
                if (index === 2 || index === 3) { // Front wheels
                    // Calculate target steering angle
                    const targetSteeringAngle = physics.steering * physics.maxSteeringAngle;
                    
                    // Initialize current steering if needed
                    if (wheel.currentSteering === undefined) {
                        wheel.currentSteering = 0;
                    }
                    
                    // Smoothly interpolate steering angle
                    wheel.currentSteering += (targetSteeringAngle - wheel.currentSteering) * 
                                              Math.min(1.0, 10.0 * deltaTime);
                    
                    // Apply smoothed steering
                    wheel.rotation.y = wheel.currentSteering;
                }
            });
        }
    }
    
    updateCamera() {
        if (!this.truck) return;
        
        const physics = this.truckPhysics;
        const deltaTime = this.currentFrameDeltaTime || 0.016; // Use frame delta or fallback
        
        // Create more stable camera metrics for consistent feel
        
        // Fixed camera height with minimal speed influence for stability
        const speedMagnitude = Math.min(40, physics.velocity.length());
        
        // Smoother height adjustment based on speed
        const targetCameraHeight = 10 + Math.pow(speedMagnitude * 0.1, 2);
        
        // Slow, predictable distance changes
        const targetCameraDistance = 14 + Math.min(10, Math.pow(speedMagnitude * 0.08, 2));
        
        // Create a point that's slightly ahead of the truck in its direction of travel
        // For more stability, use a consistent lookAhead distance that changes slowly
        const truckForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        
        // Calculate a weighted average point that takes into account current velocity
        // This creates smoother transition when changing directions
        const velocityWeight = Math.min(1, physics.velocity.length() * 0.1);
        const normalizedVelocity = physics.velocity.clone().normalize();
        
        // Blend between facing direction and velocity direction for smoother turns
        const blendedDirection = new THREE.Vector3()
            .addScaledVector(truckForward, 1 - velocityWeight)
            .addScaledVector(normalizedVelocity, velocityWeight)
            .normalize();
        
        // Use truck position as base, with slight lookahead
        const cameraTarget = this.truck.position.clone().add(
            blendedDirection.clone().multiplyScalar(2)
        );
        
        // Calculate ideal camera position (behind and above the truck)
        const idealCameraPos = cameraTarget.clone();
        
        // Use separate height target with its own smooth adjustment
        if (!this.currentCameraHeight) {
            this.currentCameraHeight = targetCameraHeight;
        } else {
            // Smooth height changes for stability
            this.currentCameraHeight += (targetCameraHeight - this.currentCameraHeight) * 
                                         Math.min(1, 1.5 * deltaTime);
        }
        idealCameraPos.y += this.currentCameraHeight;
        
        // Similarly, smooth distance changes
        if (!this.currentCameraDistance) {
            this.currentCameraDistance = targetCameraDistance;
        } else {
            this.currentCameraDistance += (targetCameraDistance - this.currentCameraDistance) * 
                                           Math.min(1, 1.2 * deltaTime);
        }
        
        // Move back from target with smoothed distance
        const cameraOffset = blendedDirection.clone().multiplyScalar(-this.currentCameraDistance);
        idealCameraPos.add(cameraOffset);
        
        // Add minimal steering offset - too much causes jitter in turns
        const sideOffset = new THREE.Vector3(1, 0, 0)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation)
            .multiplyScalar(physics.steering * 3);
        idealCameraPos.add(sideOffset);
        
        // Initialize smoothed position if needed
        if (!this.smoothCameraPosition) {
            this.smoothCameraPosition = idealCameraPos.clone();
        } else {
            // Adaptive smoothing - faster for general following, slower for fine movements
            
            // Calculate base follow rate based on speed for consistent feel
            let followRate = 2.0 * deltaTime;
            
            // Make camera more responsive when speed changes significantly
            const speedChangeThreshold = 5.0;
            if (Math.abs(this.lastSpeedMagnitude - speedMagnitude) > speedChangeThreshold) {
                followRate *= 1.5; // Faster response to large speed changes
            }
            
            // Apply smoothing with adaptive rate
            this.smoothCameraPosition.lerp(idealCameraPos, Math.min(0.9, followRate));
        }
        
        // Store current speed for next frame comparison
        this.lastSpeedMagnitude = speedMagnitude;
        
        // Apply limits to prevent camera from going underground
        this.smoothCameraPosition.y = Math.max(4, this.smoothCameraPosition.y);
        
        // Apply a slight delay when moving camera up (for more natural feel)
        if (this.smoothCameraPosition.y > this.camera.position.y) {
            this.camera.position.y += (this.smoothCameraPosition.y - this.camera.position.y) * 0.3;
        } else {
            this.camera.position.y = this.smoothCameraPosition.y;
        }
        
        // Apply x/z position directly
        this.camera.position.x = this.smoothCameraPosition.x;
        this.camera.position.z = this.smoothCameraPosition.z;
        
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

    updateTruckPhysics(deltaTime) {
        const physics = this.truckPhysics;
        
        // SMOOTHED PHYSICS MOVEMENT - No more emergency mode direct updates
        // Use proper interpolation and smoothing for jitter-free driving
        
        // Use consistent, predictable values for movement
        const MOVE_SPEED = 20.0; // Units per second (more consistent with framerate)
        const TURN_SPEED = 1.2; // Radians per second
        
        // Apply smooth acceleration and deceleration
        // Target velocity based on input
        let targetSpeed = 0;
        
        if (physics.targetThrottle > 0) {
            targetSpeed = MOVE_SPEED * physics.targetThrottle;
        } else if (physics.targetBrake > 0) {
            targetSpeed = -MOVE_SPEED * physics.targetBrake * 0.6; // Slower reverse
        }
        
        // Current forward speed (along truck's direction)
        const truckForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        let currentSpeed = physics.velocity.dot(truckForward);
        
        // Smoothly adjust current speed towards target speed
        // Use different acceleration/deceleration rates for more realistic feel
        const accelerationRate = (targetSpeed > currentSpeed) ? 8.0 : 12.0; // Faster deceleration
        currentSpeed += (targetSpeed - currentSpeed) * Math.min(1.0, accelerationRate * deltaTime);
        
        // Calculate new velocity vector
        physics.velocity = truckForward.multiplyScalar(currentSpeed);
        
        // Smooth steering with proper interpolation
        const targetSteeringAngle = physics.targetSteering * physics.maxSteeringAngle;
        
        // Gradually approach target steering angle (less immediate, more car-like)
        // Make steering more responsive at lower speeds for better handling
        const steeringRate = 5.0 - Math.min(4.0, Math.abs(currentSpeed) * 0.2);
        physics.steering += (physics.targetSteering - physics.steering) * 
                            Math.min(1.0, steeringRate * deltaTime);
        
        // Apply steering to rotation based on speed
        // Less steering effect at high speeds for stability
        const speedFactor = 1.0 / (1.0 + Math.abs(currentSpeed) * 0.05);
        const rotationDelta = TURN_SPEED * physics.steering * deltaTime * speedFactor;
        physics.rotation += rotationDelta;
        
        // Update position using velocity and delta time for frame-rate independence
        const positionDelta = physics.velocity.clone().multiplyScalar(deltaTime);
        physics.position.add(positionDelta);
        
        // Apply terrain height with smoothing to prevent jittering
        // Store previous height for interpolation
        if (!physics.prevGroundHeight) {
            physics.prevGroundHeight = physics.position.y;
        }
        
        // Get current terrain height
        const groundHeight = this.getTerrainHeightAt(physics.position.x, physics.position.z);
        const targetHeight = groundHeight + 0.5; // Desired height above ground
        
        // Smoothly interpolate height changes
        const heightSmoothingFactor = Math.min(1.0, 10.0 * deltaTime);
        physics.position.y += (targetHeight - physics.position.y) * heightSmoothingFactor;
        
        // Store current height for next frame
        physics.prevGroundHeight = physics.position.y;
        
        // Keep ground contact status for animations
        physics.groundContact = true;
        
        // Update throttle/brake values with smoothing
        physics.throttle += (physics.targetThrottle - physics.throttle) * Math.min(1.0, 5.0 * deltaTime);
        physics.brake += (physics.targetBrake - physics.brake) * Math.min(1.0, 5.0 * deltaTime);
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
        
        // CRITICAL: Also reset the smoothed position to match the physics position
        // This ensures the truck model is immediately visible at the reset position
        this.smoothedTruckPosition = this.truckPhysics.position.clone();
        
        // Update truck visuals to match physics state exactly
        if (this.truck) {
            this.truck.position.copy(this.truckPhysics.position);
            this.truck.rotation.y = this.truckPhysics.rotation;
            
            // Reset truck animation state to prevent visual artifacts
            if (this.truckAnimation) {
                this.truckAnimation.lean = 0;
                this.truckAnimation.pitch = 0;
                this.truckAnimation.wheelRotation = 0;
                this.truckAnimation.currentWheelRotationSpeed = 0;
                this.truckAnimation.prevSpeed = 0;
            }
            
            // Also reset wheel steering
            if (this.wheels) {
                this.wheels.forEach(wheel => {
                    if (wheel.currentSteering !== undefined) {
                        wheel.currentSteering = 0;
                        wheel.rotation.y = 0;
                    }
                });
            }
        }
        
        // Reset camera
        if (this.camera) {
            this.camera.position.set(0, 12, -20);
            this.camera.lookAt(this.truck.position);
            this.smoothCameraPosition = this.camera.position.clone();
            
            // Reset camera height/distance tracking
            this.currentCameraHeight = 10;
            this.currentCameraDistance = 14;
        }
        
        console.log("Truck reset complete - new position:", this.truck.position);
    }

    gameLoop() {
        // Use requestAnimationFrame timestamp for more precise timing
        const updateLoop = (timestamp) => {
            // Convert to seconds
            const currentTime = timestamp / 1000;
            
            // If this is the first frame, just initialize and request next frame
            if (!this.lastUpdateTime) {
                this.lastUpdateTime = currentTime;
                requestAnimationFrame(updateLoop);
                return;
            }
            
            // Calculate time since last frame with a safety limit
            // Limit maximum delta time to prevent large jumps after tab switches/inactivity
            const deltaTime = Math.min(0.1, currentTime - this.lastUpdateTime);
            this.lastUpdateTime = currentTime;
            
            // Store current delta time for other methods
            this.currentFrameDeltaTime = deltaTime;
            
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
            
            // Update world decorations - limit frequency for performance
            // Only update every 10 frames or when distance changes significantly
            this.decorationUpdateCounter = (this.decorationUpdateCounter || 0) + 1;
            if (this.decorationUpdateCounter >= 10) {
                this.updateDecorations();
                this.decorationUpdateCounter = 0;
            }
            
            // Render the scene
            this.renderer.render(this.scene, this.camera);
            
            // Request next frame
            requestAnimationFrame(updateLoop);
        };
        
        // Start the loop
        requestAnimationFrame(updateLoop);
    }
}

// Start the game
new Game(); 