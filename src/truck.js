import * as THREE from 'three';

export class Truck {
    constructor() {
        this.truckGroup = new THREE.Group();
        this.wheels = [];
        this.animation = {
            lean: 0,
            pitch: 0,
            wheelRotation: 0,
            prevSpeed: 0
        };
        
        // Create exhaust flame objects for nitro effect
        this.exhaustFlames = [];
    }

    build() {
        // Create a cartoon monster truck base with exaggerated proportions
        const bodyWidth = 4.5;
        const bodyHeight = 2.5;
        const bodyLength = 7;
        
        // Main body - rounded box with more height for monster truck look
        const bodyGeometry = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength, 1, 1, 1);
        // Slightly round the edges by moving vertices
        const bodyPositions = bodyGeometry.attributes.position.array;
        for (let i = 0; i < bodyPositions.length; i += 3) {
            const x = bodyPositions[i];
            const y = bodyPositions[i + 1];
            const z = bodyPositions[i + 2];
            
            // Round corners by moving vertices slightly inward
            const magnitude = 0.15;
            if (Math.abs(x) > bodyWidth/2 - 0.1) {
                bodyPositions[i] = Math.sign(x) * (Math.abs(x) - magnitude * Math.abs(y/bodyHeight) * Math.abs(z/bodyLength));
            }
            if (Math.abs(y) > bodyHeight/2 - 0.1) {
                bodyPositions[i + 1] = Math.sign(y) * (Math.abs(y) - magnitude * Math.abs(x/bodyWidth) * Math.abs(z/bodyLength));
            }
            if (Math.abs(z) > bodyLength/2 - 0.1) {
                bodyPositions[i + 2] = Math.sign(z) * (Math.abs(z) - magnitude * Math.abs(x/bodyWidth) * Math.abs(y/bodyHeight));
            }
        }
        bodyGeometry.attributes.position.needsUpdate = true;
        bodyGeometry.computeVertexNormals();
        
        // Vibrant cartoon monster truck color
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x4CAF50, // Bright green
            roughness: 0.6,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.truckGroup.add(body);
        
        // Add raised cabin section
        const cabinGeometry = new THREE.BoxGeometry(bodyWidth * 0.8, bodyHeight * 0.9, bodyLength * 0.4);
        // Round the cabin too
        const cabinPositions = cabinGeometry.attributes.position.array;
        for (let i = 0; i < cabinPositions.length; i += 3) {
            const x = cabinPositions[i];
            const y = cabinPositions[i + 1];
            const z = cabinPositions[i + 2];
            
            // Round corners by moving vertices slightly inward
            const magnitude = 0.2;
            if (Math.abs(x) > bodyWidth * 0.8/2 - 0.1) {
                cabinPositions[i] = Math.sign(x) * (Math.abs(x) - magnitude);
            }
            if (Math.abs(y) > bodyHeight * 0.9/2 - 0.1) {
                cabinPositions[i + 1] = Math.sign(y) * (Math.abs(y) - magnitude);
            }
            if (Math.abs(z) > bodyLength * 0.4/2 - 0.1) {
                cabinPositions[i + 2] = Math.sign(z) * (Math.abs(z) - magnitude);
            }
        }
        cabinGeometry.attributes.position.needsUpdate = true;
        cabinGeometry.computeVertexNormals();
        
        const cabinMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333, // Dark gray
            roughness: 0.5,
            metalness: 0.2
        });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.set(0, bodyHeight * 0.5, bodyLength * 0.15);
        cabin.castShadow = true;
        this.truckGroup.add(cabin);
        
        // Add cartoon-style windows with blue tint
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x00BFFF, // Deeper blue
            roughness: 0.2,
            metalness: 0.5,
            transparent: true,
            opacity: 0.8
        });
        
        // Front window
        const frontWindowGeometry = new THREE.BoxGeometry(bodyWidth * 0.65, bodyHeight * 0.45, 0.1);
        const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.position.set(0, bodyHeight * 0.7, bodyLength * 0.36);
        frontWindow.castShadow = false;
        this.truckGroup.add(frontWindow);
        
        // Add exaggerated headlights
        const headlightGeometry = new THREE.CircleGeometry(0.45, 16);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFC8,
            emissive: 0xFFFFC8,
            emissiveIntensity: 0.6
        });
        
        const headlightLeft = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightLeft.position.set(-bodyWidth * 0.3, bodyHeight * 0.1, bodyLength * 0.49);
        headlightLeft.rotation.y = Math.PI;
        this.truckGroup.add(headlightLeft);
        
        const headlightRight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightRight.position.set(bodyWidth * 0.3, bodyHeight * 0.1, bodyLength * 0.49);
        headlightRight.rotation.y = Math.PI;
        this.truckGroup.add(headlightRight);
        
        // Add monster truck rollbar/cage on top
        this.addRollCage(bodyWidth, bodyHeight, bodyLength);
        
        // Add exhaust pipes
        this.addExhaustPipes(bodyWidth, bodyHeight, bodyLength);
        
        // Add flame decals to the sides
        this.addFlameDecals(bodyWidth, bodyHeight, bodyLength);
        
        // Create monster truck oversized wheels
        this.createWheels();
        
        // Set initial position - adjusted to be closer to the ground
        this.truckGroup.position.set(0, 0.5, 0);
        
        return this.truckGroup;
    }
    
    addRollCage(bodyWidth, bodyHeight, bodyLength) {
        const barMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFD700, // Gold color
            roughness: 0.5,
            metalness: 0.7
        });
        
        // Main roll cage bars (6 vertical posts)
        const barRadius = 0.2;
        const barHeight = 2.5;
        
        // Vertical bars positions (3 on each side)
        const barPositions = [
            [-bodyWidth * 0.35, bodyHeight * 0.5, -bodyLength * 0.2],
            [-bodyWidth * 0.35, bodyHeight * 0.5, 0],
            [-bodyWidth * 0.35, bodyHeight * 0.5, bodyLength * 0.2],
            [bodyWidth * 0.35, bodyHeight * 0.5, -bodyLength * 0.2],
            [bodyWidth * 0.35, bodyHeight * 0.5, 0],
            [bodyWidth * 0.35, bodyHeight * 0.5, bodyLength * 0.2]
        ];
        
        barPositions.forEach(position => {
            const barGeometry = new THREE.CylinderGeometry(barRadius, barRadius, barHeight, 8);
            const bar = new THREE.Mesh(barGeometry, barMaterial);
            bar.position.set(...position);
            bar.position.y += barHeight * 0.5;
            this.truckGroup.add(bar);
        });
        
        // Horizontal connecting bars (3 pairs)
        for (let i = 0; i < 3; i++) {
            const horizontalBarGeometry = new THREE.CylinderGeometry(barRadius, barRadius, bodyWidth * 0.7, 8);
            const horizontalBar = new THREE.Mesh(horizontalBarGeometry, barMaterial);
            horizontalBar.rotation.z = Math.PI / 2;
            horizontalBar.position.set(0, bodyHeight * 0.5 + barHeight, barPositions[i][2]);
            this.truckGroup.add(horizontalBar);
        }
    }
    
    addExhaustPipes(bodyWidth, bodyHeight, bodyLength) {
        const exhaustMaterial = new THREE.MeshStandardMaterial({
            color: 0xCCCCCC, // Chrome silver
            roughness: 0.2,
            metalness: 0.9
        });
        
        // Two exhaust pipes on either side
        const exhaustRadius = 0.25;
        const exhaustHeight = 3.5;
        
        // Create two exhaust pipes
        [-1, 1].forEach(side => {
            const exhaustGeometry = new THREE.CylinderGeometry(exhaustRadius, exhaustRadius, exhaustHeight, 8);
            const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
            exhaust.position.set(side * bodyWidth * 0.4, bodyHeight * 0.6, -bodyLength * 0.3);
            exhaust.rotation.x = Math.PI / 12; // Slight angle
            this.truckGroup.add(exhaust);
            
            // Add exhaust tip
            const exhaustTipGeometry = new THREE.CylinderGeometry(exhaustRadius * 1.3, exhaustRadius, 0.5, 8);
            const exhaustTip = new THREE.Mesh(exhaustTipGeometry, exhaustMaterial);
            exhaustTip.position.set(side * bodyWidth * 0.4, bodyHeight * 0.6 + exhaustHeight * 0.5 + 0.25, -bodyLength * 0.3 - exhaustHeight * 0.08);
            exhaustTip.rotation.x = Math.PI / 12; // Match the exhaust angle
            this.truckGroup.add(exhaustTip);
            
            // Add nitro flame (initially invisible)
            const flameGeometry = new THREE.ConeGeometry(exhaustRadius * 1.5, 2.0, 8);
            const flameMaterial = new THREE.MeshStandardMaterial({
                color: 0x00BFFF, // Blue flame
                emissive: 0x00BFFF,
                emissiveIntensity: 1.0,
                transparent: true,
                opacity: 0.8
            });
            
            const flame = new THREE.Mesh(flameGeometry, flameMaterial);
            flame.position.set(
                side * bodyWidth * 0.4,
                bodyHeight * 0.6 + exhaustHeight * 0.5 + 0.5, 
                -bodyLength * 0.3 - exhaustHeight * 0.15
            );
            flame.rotation.x = Math.PI / 12 + Math.PI; // Match exhaust angle but point outward
            flame.visible = false; // Initially hidden
            this.truckGroup.add(flame);
            this.exhaustFlames.push(flame); // Store reference
        });
    }
    
    addFlameDecals(bodyWidth, bodyHeight, bodyLength) {
        // Create flame decal texture
        const flameGeometry = new THREE.PlaneGeometry(bodyLength * 0.6, bodyHeight * 0.6);
        const flameMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF4500, // Orange-red
            emissive: 0xFF4500,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        // Add flame to each side of truck
        [-1, 1].forEach(side => {
            const flame = new THREE.Mesh(flameGeometry, flameMaterial);
            flame.position.set(side * (bodyWidth * 0.5 + 0.05), bodyHeight * 0.1, 0);
            flame.rotation.y = side * Math.PI / 2;
            this.truckGroup.add(flame);
        });
    }
    
    createWheels() {
        // Cartoon monster truck wheels - much larger and exaggerated
        const wheelRadius = 2.2;
        const wheelThickness = 1.2;
        
        // Create wheel prototype with more detail
        const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 20);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x111111,  // Deep black
            roughness: 0.8,
            metalness: 0.2
        });
        
        // Treaded tire texture
        const treadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333, // Dark gray
            roughness: 0.9,
            metalness: 0.1
        });
        
        // Hub cap material
        const hubMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFA500, // Orange
            roughness: 0.4,
            metalness: 0.8
        });
        
        // Adjust wheel positions for monster truck - closer to the ground
        const wheelPositions = [
            [-2.2, -1.3, -2.8], // back left - lowered y value
            [2.2, -1.3, -2.8],  // back right - lowered y value
            [-2.2, -1.3, 2.8],  // front left - lowered y value
            [2.2, -1.3, 2.8]    // front right - lowered y value
        ];
        
        wheelPositions.forEach((position, index) => {
            const wheelGroup = new THREE.Group();
            
            // Main wheel tire
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);
            
            // Add oversized hub cap to each wheel
            const hubGeometry = new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, wheelThickness + 0.05, 16);
            const hub = new THREE.Mesh(hubGeometry, hubMaterial);
            hub.rotation.z = Math.PI / 2;
            wheelGroup.add(hub);
            
            // Add spokes to hub caps
            for (let i = 0; i < 6; i++) {
                const spokeGeometry = new THREE.BoxGeometry(wheelRadius * 0.8, 0.15, 0.15);
                const spoke = new THREE.Mesh(spokeGeometry, hubMaterial);
                spoke.rotation.z = (i / 6) * Math.PI * 2;
                hub.add(spoke);
            }
            
            wheelGroup.position.set(...position);
            this.truckGroup.add(wheelGroup);
            
            // Store front wheels separately for steering
            if (index >= 2) {
                wheel.isFrontWheel = true;
            }
            
            this.wheels.push(wheelGroup);
        });
        
        // Add suspension elements
        this.addSuspension(wheelPositions, wheelRadius);
    }
    
    addSuspension(wheelPositions, wheelRadius) {
        const suspensionMaterial = new THREE.MeshStandardMaterial({
            color: 0x4169E1, // Royal blue
            roughness: 0.6,
            metalness: 0.4
        });
        
        // Add shock absorbers to each wheel
        wheelPositions.forEach((position, index) => {
            // Create shock absorber cylinder
            const shockGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 8);
            const shock = new THREE.Mesh(shockGeometry, suspensionMaterial);
            
            // Position shock slightly above wheel
            const shockX = position[0] * 0.7;
            const shockY = position[1] + 1.5;
            const shockZ = position[2];
            
            shock.position.set(shockX, shockY, shockZ);
            shock.rotation.z = 0.2 * Math.sign(position[0]); // Slight angle
            this.truckGroup.add(shock);
            
            // Create suspension arm
            const armGeometry = new THREE.BoxGeometry(Math.abs(position[0] - shockX), 0.3, 0.3);
            const arm = new THREE.Mesh(armGeometry, suspensionMaterial);
            arm.position.set((position[0] + shockX) / 2, position[1] + 0.5, position[2]);
            this.truckGroup.add(arm);
        });
    }
    
    updateVisuals(physicsResult, deltaTime) {
        const { position, rotation, groundNormal, speed, wheelRotationSpeed, steeringAngle } = physicsResult;
        
        // Update position and rotation
        this.truckGroup.position.copy(position);
        this.truckGroup.rotation.y = rotation;
        
        // Calculate smoothed truck animations
        this.updateAnimations(deltaTime, steeringAngle, speed, groundNormal);
        
        // Apply animation properties
        this.truckGroup.rotation.z = this.animation.lean;
        this.truckGroup.rotation.x = this.animation.pitch;
        
        // Update wheel rotation and steering
        this.updateWheels(deltaTime, wheelRotationSpeed, steeringAngle);
        
        // Update nitro visual effects
        this.updateNitroEffects(physicsResult.nitroActive, deltaTime);
    }
    
    updateAnimations(deltaTime, steeringAngle, speed, groundNormal) {
        // Calculate lean while turning (roll) - more noticeable for better feedback
        const targetLean = -steeringAngle * 0.05 * Math.min(1, speed / 5); // Increased from 0.03 for more visible lean
        this.animation.lean += (targetLean - this.animation.lean) * Math.min(1, deltaTime * 3.0); // Increased from 2.5 for faster response
        
        // Calculate pitch based on acceleration/deceleration - more noticeable
        const acceleration = speed - this.animation.prevSpeed;
        const targetPitch = -acceleration * 0.01; // Increased from 0.008 for more feedback
        this.animation.pitch += (targetPitch - this.animation.pitch) * Math.min(1, deltaTime * 2.0); // Increased from 1.8
        this.animation.prevSpeed = speed;
    }
    
    updateWheels(deltaTime, wheelRotationSpeed, steeringAngle) {
        // Update wheel rotation based on speed
        this.animation.wheelRotation += wheelRotationSpeed * deltaTime * 2;
        
        // Apply rotation and steering to wheels
        this.wheels.forEach((wheel, index) => {
            // Rotate all wheels
            const wheelMesh = wheel.children[0];
            if (wheelMesh) {
                wheelMesh.rotation.x = this.animation.wheelRotation;
            }
            
            // Steer only front wheels (index 2,3) - more dramatic for better visual feedback
            if (index >= 2) {
                wheel.rotation.y = steeringAngle * 1.2; // Increased from 1.0 for more dramatic steering visuals
            }
        });
    }
    
    // New method to update nitro visual effects
    updateNitroEffects(nitroActive, deltaTime) {
        // Show/hide flames based on nitro state
        this.exhaustFlames.forEach((flame, index) => {
            flame.visible = nitroActive;
            
            if (nitroActive) {
                // Animate flame size for flickering effect
                const pulseRate = 10 + Math.sin(Date.now() / 100) * 5;
                const scaleY = 1.0 + Math.sin(Date.now() / pulseRate) * 0.2;
                flame.scale.y = scaleY;
                
                // Slightly randomize the flame rotation for more dynamic effect
                flame.rotation.z = Math.sin(Date.now() / 120 + index) * 0.1;
            }
        });
    }
    
    reset(position) {
        // Reset position and rotation
        this.truckGroup.position.copy(position || new THREE.Vector3(0, 0.5, 0));
        this.truckGroup.rotation.set(0, 0, 0);
        
        // Reset animation properties
        this.animation.lean = 0;
        this.animation.pitch = 0;
        this.animation.wheelRotation = 0;
        this.animation.prevSpeed = 0;
    }
} 