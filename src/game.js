import * as THREE from 'three';
import { TruckPhysics } from './physics.js';
import { Truck } from './truck.js';
import { Terrain } from './terrain.js';
import { InputHandler } from './input.js';
import { GameCamera } from './camera.js';
import { DebugDisplay } from './debug.js';

export class Game {
    constructor() {
        // Set up basic scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Get canvas element
        const canvas = document.getElementById('game');
        if (!canvas) {
            throw new Error('Canvas element not found!');
        }
        
        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Set sky color - enhanced to a more vibrant blue
        const skyColor = new THREE.Color(0x87CEEB); // Brighter sky blue
        this.renderer.setClearColor(skyColor);
        this.scene.background = skyColor;
        
        // Create fog for distance fading - more subtle and atmospheric
        const horizonColor = new THREE.Color(0xF8E8D8); // Warmer horizon color
        this.scene.fog = new THREE.FogExp2(horizonColor, 0.005); // Slightly reduced fog density
        
        // Add ambient light - increased intensity for better illumination
        const ambientLight = new THREE.AmbientLight(0xE8F1FF, 0.6); // Increased from 0.5 to 0.6
        this.scene.add(ambientLight);
        
        // Time tracking
        this.lastUpdateTime = 0;
        this.currentFrameDeltaTime = 0;
        this.frames = 0;
        this.timeAccumulator = 0;
        this.fps = 0;
        
        // Initialize game modules
        this.debug = new DebugDisplay();
        this.input = new InputHandler();
        
        // Create skybox/skyGradient
        this.createSkybox();
        
        // Create lights before terrain (for shadows)
        this.setupLights();
        
        // Create terrain (needs scene access for adding mesh)
        this.terrain = new Terrain(this.scene);
        
        // Create physics simulation
        this.physics = new TruckPhysics();
        
        // Create truck visual
        this.truck = new Truck();
        
        // Create camera controller
        this.camera.position.set(0, 10, -15);
        this.cameraController = new GameCamera(this.camera);
    }
    
    initialize() {
        try {
            // Initialize debug display
            this.debug.initialize();
            
            // Build terrain
            this.terrain.build();
            
            // Build truck and add to scene
            const truckModel = this.truck.build();
            this.scene.add(truckModel);
            
            // Set up camera
            this.cameraController.setTarget(truckModel);
            
            // Set up input and connect to physics
            this.input.setup();
            this.input.onInputChange((keys) => {
                this.physics.applyUserInput(keys);
            });
            
            // Set up window resize handler
            window.addEventListener('resize', this.handleResize.bind(this));
            
            // Reset key - press 'R' to reset truck position
            window.addEventListener('keydown', (e) => {
                if (e.code === 'KeyR') {
                    this.resetTruck();
                }
            });
            
            // Show controls help
            this.debug.showControlsHelp();
            
            // Start game loop
            this.gameLoop();
            
            console.log('Game initialized successfully');
        } catch (error) {
            console.error('Game initialization failed:', error);
            this.debug.showMessage(`Error: ${error.message}`, 10000);
        }
    }
    
    createSkybox() {
        // Create a sky gradient using a large sphere with enhanced colors
        const skyDome = new THREE.Mesh(
            new THREE.SphereGeometry(900, 32, 32),
            new THREE.ShaderMaterial({
                uniforms: {
                    topColor: { value: new THREE.Color(0x5D9FE4) }, // Rich sky blue 
                    bottomColor: { value: new THREE.Color(0xFFE9CF) }, // Warmer horizon
                    offset: { value: 400 },
                    exponent: { value: 0.7 } // Increased from 0.6 for more distinct gradient
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
    }
    
    setupLights() {
        // Main directional light (sun) - enhanced colors and intensity
        const sunLight = new THREE.DirectionalLight(0xFFF0D6, 1.4); // Warmer and brighter (from 1.2 to 1.4)
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.bias = -0.0001;
        
        // Set shadow camera dimensions - increased for better coverage
        const shadowSize = 120; // Increased from 100 to 120
        sunLight.shadow.camera.left = -shadowSize;
        sunLight.shadow.camera.right = shadowSize;
        sunLight.shadow.camera.top = shadowSize;
        sunLight.shadow.camera.bottom = -shadowSize;
        
        this.scene.add(sunLight);
        
        // Fill light to soften shadows - enhanced
        const fillLight = new THREE.DirectionalLight(0xC4E8FF, 0.5); // Increased from 0.4 to 0.5
        fillLight.position.set(-50, 30, -50);
        this.scene.add(fillLight);
        
        // Add a subtle ground bounce light for more depth
        const bounceLight = new THREE.HemisphereLight(0xFFE8D0, 0x80A0CC, 0.4);
        this.scene.add(bounceLight);
    }
    
    handleResize() {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    resetTruck() {
        // Reset physics
        const resetPosition = this.physics.reset();
        
        // Reset truck visuals
        this.truck.reset(resetPosition);
        
        // Reset camera
        this.cameraController.reset();
        
        // Show message
        this.debug.showMessage('Truck position reset!');
    }
    
    updateTruck(deltaTime) {
        // Update physics with terrain data
        const physicsResult = this.physics.update(
            deltaTime,
            (x, z) => this.terrain.getHeightAt(x, z),
            (x, z) => this.terrain.getRoughnessAt(x, z)
        );
        
        // Update truck visuals with physics result
        this.truck.updateVisuals(physicsResult, deltaTime);
        
        // Return physics data for camera and debug
        return physicsResult;
    }
    
    gameLoop() {
        const updateLoop = (timestamp) => {
            // Convert to seconds
            const currentTime = timestamp / 1000;
            
            // Initialize time or calculate delta
            if (!this.lastUpdateTime) {
                this.lastUpdateTime = currentTime;
                requestAnimationFrame(updateLoop);
                return;
            }
            
            // Calculate time since last frame with a safety limit
            const deltaTime = Math.min(0.1, currentTime - this.lastUpdateTime);
            this.lastUpdateTime = currentTime;
            this.currentFrameDeltaTime = deltaTime;
            
            // Update FPS counter
            this.frames++;
            this.timeAccumulator += deltaTime;
            if (this.timeAccumulator >= 1) {
                this.fps = this.frames / this.timeAccumulator;
                this.frames = 0;
                this.timeAccumulator = 0;
            }
            
            // Update truck physics and visuals
            const physicsResult = this.updateTruck(deltaTime);
            
            // Update camera
            this.cameraController.update(deltaTime, physicsResult.speed);
            
            // Update terrain decorations
            this.terrain.updateDecorations(this.truck.truckGroup.position);
            
            // Update debug display
            const terrainHeight = this.terrain.getHeightAt(
                physicsResult.position.x,
                physicsResult.position.z
            );
            
            this.debug.update({
                position: physicsResult.position,
                rotation: physicsResult.rotation,
                speed: physicsResult.speed,
                controls: this.input.getInputState(),
                fps: this.fps,
                terrainHeight: terrainHeight,
                groundContact: this.physics.groundContact
            });
            
            // Render scene
            this.renderer.render(this.scene, this.camera);
            
            // Request next frame
            requestAnimationFrame(updateLoop);
        };
        
        // Start the loop
        requestAnimationFrame(updateLoop);
    }
} 