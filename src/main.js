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
        // Create a more detailed ground with procedural textures
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
        
        // Create a custom shader material for detailed ground
        const groundMaterial = new THREE.ShaderMaterial({
            uniforms: {
                grassTexture: { value: null }, // Will be set after texture loading
                gravelTexture: { value: null }, // Will be set after texture loading
                dirtTexture: { value: null }, // Will be set after texture loading
                terrainSize: { value: groundSize / 2 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying float vElevation;
                
                void main() {
                    vUv = uv;
                    vElevation = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D grassTexture;
                uniform sampler2D gravelTexture;
                uniform sampler2D dirtTexture;
                uniform float terrainSize;
                
                varying vec2 vUv;
                varying float vElevation;
                
                void main() {
                    // Scale UVs for proper texture tiling
                    vec2 scaledUv = vUv * terrainSize / 5.0;
                    
                    // Sample textures
                    vec4 grassColor = texture2D(grassTexture, scaledUv);
                    vec4 gravelColor = texture2D(gravelTexture, scaledUv);
                    vec4 dirtColor = texture2D(dirtTexture, scaledUv);
                    
                    // Blend based on elevation
                    float gravelFactor = smoothstep(0.5, 2.0, abs(vElevation));
                    float grassFactor = 1.0 - gravelFactor;
                    
                    // Add dirt patches based on noise pattern
                    float noise = fract(sin(scaledUv.x * 100.0 + scaledUv.y * 43.0) * 1000.0);
                    float dirtFactor = step(0.85, noise) * grassFactor;
                    grassFactor -= dirtFactor;
                    
                    vec4 finalColor = grassColor * grassFactor + gravelColor * gravelFactor + dirtColor * dirtFactor;
                    
                    // Add path effect - worn areas near center
                    vec2 fromCenter = vUv - 0.5;
                    float centerDist = length(fromCenter) * 2.0;
                    float pathFactor = 1.0 - smoothstep(0.0, 0.2, centerDist);
                    
                    // Darken and add more gravel to path
                    finalColor = mix(finalColor, gravelColor * 0.9, pathFactor * 0.7);
                    
                    gl_FragColor = finalColor;
                }
            `,
            side: THREE.FrontSide
        });
        
        // Load textures
        const textureLoader = new THREE.TextureLoader();
        const texturePromises = [
            new Promise(resolve => {
                textureLoader.load(
                    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
                    texture => {
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                        groundMaterial.uniforms.grassTexture.value = texture;
                        resolve();
                    }
                );
            }),
            new Promise(resolve => {
                textureLoader.load(
                    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/backgrounddetailed6.jpg',
                    texture => {
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                        groundMaterial.uniforms.gravelTexture.value = texture;
                        resolve();
                    }
                );
            }),
            new Promise(resolve => {
                textureLoader.load(
                    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
                    texture => {
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                        groundMaterial.uniforms.dirtTexture.value = texture;
                        resolve();
                    }
                );
            })
        ];
        
        // Create ground mesh
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // Create detailed terrain decoration objects
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
        
        // Create grass tufts
        const grassGeometry = new THREE.PlaneGeometry(1, 1);
        const grassMaterial = new THREE.MeshStandardMaterial({
            color: 0x91B156,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            alphaTest: 0.5
        });
        
        // Add some small rocks
        const rockGeometry = new THREE.DodecahedronGeometry(0.5);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Create numerous small grass tufts and rocks
        for (let i = 0; i < 1000; i++) {
            // Determine random position
            const radius = 100 + Math.random() * 150;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Add grass tuft
            if (Math.random() < 0.7) {
                const grass = new THREE.Mesh(grassGeometry, grassMaterial);
                grass.position.set(x, 0.5, z);
                grass.rotation.x = -Math.PI / 2;
                grass.rotation.z = Math.random() * Math.PI;
                detailsGroup.add(grass);
            } 
            // Add small rock
            else {
                const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                const scale = 0.1 + Math.random() * 0.3;
                rock.scale.set(scale, scale * 0.7, scale);
                rock.position.set(x, scale/2, z);
                rock.rotation.y = Math.random() * Math.PI;
                rock.castShadow = true;
                rock.receiveShadow = true;
                detailsGroup.add(rock);
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
        
        // Colors inspired by Ghibli aesthetic
        const mainColor = 0xD15F34;      // Warm orange-red
        const secondaryColor = 0x2B4C7E; // Deep blue
        const metalColor = 0xA3A5A8;     // Subtle silver
        const blackColor = 0x2A2731;     // Soft black

        // Main body - rounder and more stylized
        const bodyGeometry = new THREE.BoxGeometry(4.2, 1.8, 6.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: mainColor,
            roughness: 0.6,
            metalness: 0.2
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 3.2;
        body.castShadow = true;
        
        // Round the edges of the body
        body.geometry.translate(0, 0, 0.2);
        truck.add(body);

        // Add hood with slight slope
        const hoodGeometry = new THREE.BoxGeometry(4, 0.5, 2.5);
        const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
        hood.position.set(0, 4.0, 2);
        hood.rotation.x = -Math.PI * 0.05;
        truck.add(hood);

        // More stylized cabin with curved roof
        const cabinBaseGeometry = new THREE.BoxGeometry(3.8, 1.8, 3);
        const cabinBaseMaterial = new THREE.MeshStandardMaterial({ 
            color: mainColor,
            roughness: 0.6,
            metalness: 0.3
        });
        const cabinBase = new THREE.Mesh(cabinBaseGeometry, cabinBaseMaterial);
        cabinBase.position.set(0, 4.5, -0.8);
        cabinBase.castShadow = true;
        truck.add(cabinBase);
        
        // Curved roof for Ghibli-like appearance
        const roofGeometry = new THREE.CylinderGeometry(1.9, 1.9, 3.8, 16, 1, false, -Math.PI, Math.PI);
        const roofMaterial = new THREE.MeshStandardMaterial({ 
            color: mainColor,
            roughness: 0.7,
            metalness: 0.2
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.rotation.z = Math.PI / 2;
        roof.scale.set(1, 1, 0.6);
        roof.position.set(0, 5.8, -0.8);
        roof.castShadow = true;
        truck.add(roof);

        // Enhanced grill with more detail
        const grillGeometry = new THREE.BoxGeometry(3.8, 1.2, 0.4);
        const grillMaterial = new THREE.MeshStandardMaterial({
            color: blackColor,
            roughness: 0.5,
            metalness: 0.6
        });
        const grill = new THREE.Mesh(grillGeometry, grillMaterial);
        grill.position.set(0, 2.9, 3.2);
        truck.add(grill);
        
        // Add grill detail lines
        for (let i = -1.5; i <= 1.5; i += 0.5) {
            const grillLineGeometry = new THREE.BoxGeometry(0.1, 1, 0.45);
            const grillLine = new THREE.Mesh(grillLineGeometry, new THREE.MeshStandardMaterial({
                color: metalColor,
                roughness: 0.3,
                metalness: 0.8
            }));
            grillLine.position.set(i, 2.9, 3.3);
            truck.add(grillLine);
        }

        // Bumper
        const bumperGeometry = new THREE.BoxGeometry(4.5, 0.8, 0.6);
        const bumperMaterial = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.5,
            metalness: 0.7
        });
        const bumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
        bumper.position.set(0, 2.0, 3.3);
        truck.add(bumper);

        // Enhanced headlights
        const headlightGeometry = new THREE.CircleGeometry(0.45, 16);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFCC9,
            emissive: 0xFFFCC9,
            emissiveIntensity: 0.7
        });
        const headlightPositions = [[-1.4, 3.1, 3.35], [1.4, 3.1, 3.35]];
        headlightPositions.forEach(pos => {
            const headlightGroup = new THREE.Group();
            
            // Outer ring
            const ringGeometry = new THREE.TorusGeometry(0.46, 0.08, 8, 20);
            const ringMaterial = new THREE.MeshStandardMaterial({
                color: metalColor,
                roughness: 0.3,
                metalness: 0.9
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.y = Math.PI / 2;
            headlightGroup.add(ring);
            
            // Light surface
            const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
            headlight.rotation.y = Math.PI;
            headlight.position.z = 0.05;
            headlightGroup.add(headlight);
            
            headlightGroup.position.set(...pos);
            truck.add(headlightGroup);
        });

        // Add side details - characteristic Ghibli curves
        const sideDetailGeometry = new THREE.BoxGeometry(0.2, 0.8, 5);
        const sideDetailMaterial = new THREE.MeshStandardMaterial({
            color: secondaryColor,
            roughness: 0.7,
            metalness: 0.3
        });
        const leftDetail = new THREE.Mesh(sideDetailGeometry, sideDetailMaterial);
        leftDetail.position.set(-2.1, 3.3, 0);
        truck.add(leftDetail);

        const rightDetail = leftDetail.clone();
        rightDetail.position.x = 2.1;
        truck.add(rightDetail);

        // Windows with better styling and slight tint
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x7FBCD2,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.9
        });

        // Front window
        const frontWindowGeometry = new THREE.PlaneGeometry(3.5, 1.6);
        const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.position.set(0, 4.7, 0.72);
        frontWindow.rotation.x = Math.PI * 0.12;
        truck.add(frontWindow);

        // Side windows - make them rounded for Ghibli style
        const sideWindowGeometry = new THREE.PlaneGeometry(2.6, 1.4);
        const leftWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
        leftWindow.position.set(-1.91, 4.7, -0.8);
        leftWindow.rotation.y = Math.PI * 0.5;
        truck.add(leftWindow);

        const rightWindow = leftWindow.clone();
        rightWindow.position.x = 1.91;
        rightWindow.rotation.y = -Math.PI * 0.5;
        truck.add(rightWindow);
        
        // Rear window
        const rearWindowGeometry = new THREE.PlaneGeometry(3.5, 1.3);
        const rearWindow = new THREE.Mesh(rearWindowGeometry, windowMaterial);
        rearWindow.position.set(0, 4.7, -2.3);
        rearWindow.rotation.x = -Math.PI * 0.08;
        rearWindow.rotation.y = Math.PI;
        truck.add(rearWindow);

        // Enhanced wheels with more detail and better tread
        const wheelRadius = 1.4;
        const wheelThickness = 1.0;
        const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 24);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: blackColor,
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Create wheel tread texture
        const treads = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const treadGeo = new THREE.BoxGeometry(0.35, wheelThickness + 0.01, 0.5);
            const tread = new THREE.Mesh(treadGeo, wheelMaterial);
            tread.position.set(Math.sin(angle) * wheelRadius, 0, Math.cos(angle) * wheelRadius);
            tread.rotation.y = angle;
            treads.push(tread);
        }
        
        const wheelPositions = [
            [-2.1, 1.7, -2.1],
            [2.1, 1.7, -2.1],
            [-2.1, 1.7, 2.1],
            [2.1, 1.7, 2.1]
        ];
        
        this.wheels = [];  // Store wheels for animation

        wheelPositions.forEach((position, index) => {
            const wheelGroup = new THREE.Group();
            
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);
            
            // Add treads
            treads.forEach(tread => {
                const treadClone = tread.clone();
                wheel.add(treadClone);
            });
            
            // Add detailed wheel hub caps
            const hubGeometry = new THREE.CylinderGeometry(0.45, 0.45, wheelThickness + 0.1, 16);
            const hubMaterial = new THREE.MeshStandardMaterial({ 
                color: metalColor,
                roughness: 0.3,
                metalness: 0.8
            });
            const hub = new THREE.Mesh(hubGeometry, hubMaterial);
            hub.rotation.z = Math.PI / 2;
            
            // Add hub details
            const hubDetailGeometry = new THREE.BoxGeometry(0.1, wheelThickness + 0.12, 0.1);
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const detailX = Math.sin(angle) * 0.25;
                const detailZ = Math.cos(angle) * 0.25;
                
                const detail = new THREE.Mesh(hubDetailGeometry, hubMaterial);
                detail.position.set(0, 0, 0);
                detail.position.x = detailX;
                detail.position.z = detailZ;
                hub.add(detail);
            }
            
            wheelGroup.add(hub);
            wheelGroup.position.set(...position);
            
            // Store the wheel for animations
            this.wheels.push(wheelGroup);
            
            truck.add(wheelGroup);
        });

        // Add suspension system with more detail
        const suspensionGeometry = new THREE.BoxGeometry(0.3, 1.8, 0.3);
        const suspensionMaterial = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.6,
            metalness: 0.6
        });

        wheelPositions.forEach(position => {
            const suspensionGroup = new THREE.Group();
            
            // Main suspension arm
            const suspension = new THREE.Mesh(suspensionGeometry, suspensionMaterial);
            suspension.position.set(0, 0.9, 0);
            suspensionGroup.add(suspension);
            
            // Add suspension details
            const detailGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.2);
            const detail = new THREE.Mesh(detailGeometry, suspensionMaterial);
            detail.position.set(0, 0, 0);
            suspensionGroup.add(detail);
            
            suspensionGroup.position.set(position[0], position[1] + 1, position[2]);
            truck.add(suspensionGroup);
        });

        // Add exhaust pipes
        const exhaustGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8);
        const exhaustMaterial = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.4,
            metalness: 0.8
        });
        
        const leftExhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
        leftExhaust.rotation.x = Math.PI / 2;
        leftExhaust.position.set(-1.8, 2.4, -3);
        truck.add(leftExhaust);
        
        const rightExhaust = leftExhaust.clone();
        rightExhaust.position.x = 1.8;
        truck.add(rightExhaust);

        // Add small details for character
        const detailGeometries = [
            { type: 'box', size: [0.8, 0.2, 0.6], position: [0, 4.2, -2.8], color: secondaryColor }, // Roof rack
            { type: 'box', size: [3.2, 0.2, 0.8], position: [0, 2.3, -2.8], color: metalColor },    // Tailgate
        ];
        
        detailGeometries.forEach(detail => {
            let geometry;
            let material = new THREE.MeshStandardMaterial({
                color: detail.color,
                roughness: 0.6,
                metalness: 0.4
            });
            
            if (detail.type === 'box') {
                geometry = new THREE.BoxGeometry(...detail.size);
            } else if (detail.type === 'cylinder') {
                geometry = new THREE.CylinderGeometry(...detail.size);
            }
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(...detail.position);
            if (detail.rotation) {
                mesh.rotation.set(...detail.rotation);
            }
            truck.add(mesh);
        });

        // Initialize animation properties
        this.truckAnimation = {
            bounce: 0,
            lean: 0,
            wheelRotation: 0
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
        // Initialize nipplejs
        this.joystick = nipplejs.create({
            zone: document.getElementById('joystick-zone'),
            mode: 'static',
            position: { left: '50px', bottom: '50px' },
            color: 'white',
            size: 120
        });

        // Enhanced physics model for more realistic driving
        this.truckPhysics = {
            // Basic movement
            position: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0),
            acceleration: new THREE.Vector3(0, 0, 0),
            
            // Rotation
            rotation: 0,
            angularVelocity: 0,
            
            // Physics constants
            mass: 1500,                  // kg
            engineForce: 10000,          // N
            brakingForce: 15000,         // N
            rollingResistance: 0.05,     // coefficient
            dragCoefficient: 0.3,        // air resistance
            wheelBase: 4,                // m
            maxSteeringAngle: 0.5,       // rad
            steeringSpeed: 2,            // steering response
            
            // Suspension
            suspensionStiffness: 15000,  // N/m
            suspensionDamping: 3000,     // N·s/m
            suspensionTravel: 0.2,       // m
            suspensionRest: 0.5,         // m
            suspensionCompression: 0,    // current state
            
            // Terrain interaction
            groundContact: true,
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

        // Joystick controls
        this.joystick.on('move', (evt, data) => {
            // Map joystick to physics controls
            const forward = data.vector.y;  
            const turn = data.vector.x;
            
            // Scale input based on magnitude for better control
            const inputMagnitude = Math.min(1.0, data.distance / 50);
            
            this.truckPhysics.targetThrottle = forward > 0 ? forward * inputMagnitude : 0;
            this.truckPhysics.targetBrake = forward < 0 ? -forward * inputMagnitude : 0;
            this.truckPhysics.targetSteering = turn * inputMagnitude;
        });

        this.joystick.on('end', () => {
            // Reset joystick controls but leave keyboard intact
            if (!Object.values(this.truckPhysics.keys).some(key => key)) {
                this.truckPhysics.targetThrottle = 0;
                this.truckPhysics.targetBrake = 0;
                this.truckPhysics.targetSteering = 0;
            }
        });

        // Keyboard controls with improved response
        window.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
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
            }
            this.updatePhysicsFromKeys();
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
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
            }
            this.updatePhysicsFromKeys();
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Track time for physics
        this.lastUpdateTime = performance.now() / 1000;
    }

    updatePhysicsFromKeys() {
        // Map keys to physics controls
        if (this.truckPhysics.keys.forward) {
            this.truckPhysics.targetThrottle = 1;
            this.truckPhysics.targetBrake = 0;
        } else if (this.truckPhysics.keys.backward) {
            this.truckPhysics.targetBrake = 1;
            this.truckPhysics.targetThrottle = 0;
        } else if (!this.joystick.active) {
            this.truckPhysics.targetThrottle = 0;
            this.truckPhysics.targetBrake = 0;
        }

        if (this.truckPhysics.keys.left) {
            this.truckPhysics.targetSteering = -1;
        } else if (this.truckPhysics.keys.right) {
            this.truckPhysics.targetSteering = 1;
        } else if (!this.joystick.active) {
            this.truckPhysics.targetSteering = 0;
        }

        if (this.truckPhysics.keys.brake) {
            this.truckPhysics.targetBrake = 1;
        }
    }

    updateTruck() {
        if (!this.truck) return;

        // Calculate elapsed time
        const currentTime = performance.now() / 1000;
        const deltaTime = Math.min(currentTime - this.lastUpdateTime, 0.1); // Cap to prevent jumps
        this.lastUpdateTime = currentTime;
        
        // Update physics simulation
        this.updateTruckPhysics(deltaTime);
        
        // Update truck position and rotation from physics
        this.truck.position.copy(this.truckPhysics.position);
        this.truck.rotation.y = this.truckPhysics.rotation;
        
        // Apply visual effects
        this.updateTruckVisuals(deltaTime);
        
        // Update camera position with physics-based smoothing
        this.updateCamera();
    }
    
    updateTruckPhysics(deltaTime) {
        const physics = this.truckPhysics;
        
        // Smooth control inputs for realistic response
        physics.throttle += (physics.targetThrottle - physics.throttle) * physics.steeringSpeed * deltaTime;
        physics.brake += (physics.targetBrake - physics.brake) * physics.steeringSpeed * deltaTime;
        physics.steering += (physics.targetSteering - physics.steering) * physics.steeringSpeed * deltaTime;
        
        // Convert steering input to wheel angle (non-linear for better feel)
        const steeringAngle = physics.steering * physics.maxSteeringAngle * (1 - Math.abs(physics.velocity.length() * 0.04));
        
        // Calculate forces in local space
        let tractionForce = 0;
        
        // Engine force (throttle)
        if (physics.throttle > 0) {
            tractionForce = physics.engineForce * physics.throttle;
        }
        
        // Braking force
        if (physics.brake > 0) {
            // Apply stronger braking when moving faster
            const brakingForce = physics.brakingForce * physics.brake * (0.5 + Math.min(1, physics.velocity.length() * 0.2));
            tractionForce -= Math.sign(physics.velocity.z) * brakingForce;
        }
        
        // Calculate resistance forces
        // Rolling resistance
        const rollingResistance = physics.velocity.clone().normalize().multiplyScalar(-physics.rollingResistance * physics.mass);
        
        // Air resistance (increases with square of velocity)
        const speed = physics.velocity.length();
        const dragForce = physics.velocity.clone().normalize().multiplyScalar(-physics.dragCoefficient * speed * speed);
        
        // Convert traction force to vector in world space
        const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        const tractionForceVector = forwardDir.clone().multiplyScalar(tractionForce);
        
        // Sum all forces
        const totalForce = new THREE.Vector3()
            .add(tractionForceVector)
            .add(rollingResistance)
            .add(dragForce);
        
        // F = ma -> a = F/m
        physics.acceleration.copy(totalForce.divideScalar(physics.mass));
        
        // Update velocity
        physics.velocity.add(physics.acceleration.clone().multiplyScalar(deltaTime));
        
        // Apply velocity cap for stability
        const maxSpeed = 40; // m/s (~90 mph)
        if (physics.velocity.length() > maxSpeed) {
            physics.velocity.normalize().multiplyScalar(maxSpeed);
        }
        
        // Calculate angular velocity based on steering and speed
        const angularAcceleration = (steeringAngle * physics.velocity.length() * 0.3) / physics.wheelBase;
        physics.angularVelocity = angularAcceleration;
        
        // Update rotation
        physics.rotation += physics.angularVelocity * deltaTime;
        
        // Update position
        const movement = physics.velocity.clone().multiplyScalar(deltaTime);
        physics.position.add(movement);
        
        // Calculate suspension effects
        this.updateSuspension(deltaTime);
    }
    
    updateSuspension(deltaTime) {
        const physics = this.truckPhysics;
        
        // Simple suspension model
        // In a real game, you would raycast to the ground for each wheel
        
        // Simulate terrain height at truck position
        const x = physics.position.x;
        const z = physics.position.z;
        const terrainHeight = Math.sin(x/20) * Math.cos(z/20) * 1.5;
        
        // Calculate compression force based on speed and terrain
        const speedFactor = Math.min(1, physics.velocity.length() * 0.1);
        const targetCompression = Math.min(
            physics.suspensionTravel,
            Math.max(0, speedFactor * 0.8 + Math.abs(terrainHeight) * 0.2)
        );
        
        // Smooth transition to target compression
        physics.suspensionCompression += (targetCompression - physics.suspensionCompression) * 5 * deltaTime;
        
        // Store this for visual effects
        this.currentTerrainHeight = terrainHeight;
    }
    
    updateTruckVisuals(deltaTime) {
        const physics = this.truckPhysics;
        const anim = this.truckAnimation;
        
        // Apply suspension visualization
        const compression = physics.suspensionCompression;
        
        // Bounce effect
        this.truck.position.y = 3.5 - compression * 0.5;
        
        // Body roll based on steering and acceleration
        const targetLean = physics.steering * 0.08 + physics.acceleration.length() * Math.sign(physics.throttle - physics.brake) * 0.03;
        anim.lean += (targetLean - anim.lean) * 5 * deltaTime;
        this.truck.rotation.z = anim.lean;
        
        // Apply slight pitch based on acceleration/braking
        const targetPitch = (physics.throttle - physics.brake) * 0.04;
        anim.pitch = anim.pitch || 0;
        anim.pitch += (targetPitch - anim.pitch) * 3 * deltaTime;
        this.truck.rotation.x = anim.pitch;
        
        // Wheel rotation
        const speed = physics.velocity.length();
        const wheelRotationSpeed = speed / 0.7; // 0.7m is approx wheel circumference
        
        anim.wheelRotation += wheelRotationSpeed * deltaTime;
        
        // Update wheel visuals
        if (this.wheels) {
            this.wheels.forEach((wheel, index) => {
                // Rotate wheels
                const wheelMesh = wheel.children[0];
                wheelMesh.rotation.x = anim.wheelRotation;
                
                // Apply steering to front wheels
                if (index === 2 || index === 3) { // Front wheels
                    wheel.rotation.y = physics.steering * physics.maxSteeringAngle;
                }
                
                // Apply suspension to each wheel
                const wheelCompression = compression * (1 + Math.sin(anim.wheelRotation * 8 + index) * 0.1);
                wheel.position.y = wheelCompression * 0.3;
            });
        }
    }
    
    updateCamera() {
        if (!this.truck) return;
        
        const physics = this.truckPhysics;
        
        // Dynamic camera based on speed
        const speed = physics.velocity.length();
        const dynamicHeight = 10 + speed * 0.2;
        const dynamicDistance = 15 + speed * 0.5;
        
        // Base camera position with dynamic distance
        const cameraOffset = new THREE.Vector3(0, dynamicHeight, -dynamicDistance);
        
        // Add slight offset in steering direction for better visibility
        cameraOffset.x += physics.steering * 2;
        
        // Apply truck rotation to camera
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        
        // Smooth camera movement
        if (!this.smoothCameraPosition) {
            this.smoothCameraPosition = this.truck.position.clone().add(cameraOffset);
        } else {
            this.smoothCameraPosition.lerp(this.truck.position.clone().add(cameraOffset), 0.05);
        }
        
        this.camera.position.copy(this.smoothCameraPosition);
        
        // Look slightly ahead of the truck based on speed and direction
        const lookAheadDistance = 5 + speed * 0.3;
        const lookAheadDir = new THREE.Vector3(0, 0, lookAheadDistance).applyAxisAngle(new THREE.Vector3(0, 1, 0), physics.rotation);
        const lookTarget = this.truck.position.clone().add(lookAheadDir);
        lookTarget.y = this.truck.position.y + 2; // Look a bit upward
        
        this.camera.lookAt(lookTarget);
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