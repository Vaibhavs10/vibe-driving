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
    }

    build() {
        // Create a Ghibli-inspired truck base with rounded edges
        const bodyWidth = 4.2;
        const bodyHeight = 2.2;
        const bodyLength = 6.5;
        
        // Main body - more rounded box
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
        
        // Warm Ghibli-inspired color for main body
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xE7A287, // Softer, warmer terracotta red
            roughness: 0.6,
            metalness: 0.1
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.truckGroup.add(body);
        
        // Add cabin/hood section
        const cabinGeometry = new THREE.BoxGeometry(bodyWidth * 0.85, bodyHeight * 1.1, bodyLength * 0.45);
        // Round the cabin too
        const cabinPositions = cabinGeometry.attributes.position.array;
        for (let i = 0; i < cabinPositions.length; i += 3) {
            const x = cabinPositions[i];
            const y = cabinPositions[i + 1];
            const z = cabinPositions[i + 2];
            
            // Round corners by moving vertices slightly inward
            const magnitude = 0.2;
            if (Math.abs(x) > bodyWidth * 0.85/2 - 0.1) {
                cabinPositions[i] = Math.sign(x) * (Math.abs(x) - magnitude);
            }
            if (Math.abs(y) > bodyHeight * 1.1/2 - 0.1) {
                cabinPositions[i + 1] = Math.sign(y) * (Math.abs(y) - magnitude);
            }
            if (Math.abs(z) > bodyLength * 0.45/2 - 0.1) {
                cabinPositions[i + 2] = Math.sign(z) * (Math.abs(z) - magnitude);
            }
        }
        cabinGeometry.attributes.position.needsUpdate = true;
        cabinGeometry.computeVertexNormals();
        
        const cabinMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFF0DB, // Warm cream color
            roughness: 0.5,
            metalness: 0.2
        });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.set(0, bodyHeight * 0.4, bodyLength * 0.15);
        cabin.castShadow = true;
        this.truckGroup.add(cabin);
        
        // Add windows with slight blue tint
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0xADD8E6, // Light blue
            roughness: 0.2,
            metalness: 0.5,
            transparent: true,
            opacity: 0.9
        });
        
        // Front window
        const frontWindowGeometry = new THREE.BoxGeometry(bodyWidth * 0.7, bodyHeight * 0.5, 0.1);
        const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.position.set(0, bodyHeight * 0.6, bodyLength * 0.38);
        frontWindow.castShadow = false;
        this.truckGroup.add(frontWindow);
        
        // Add headlights
        const headlightGeometry = new THREE.CircleGeometry(0.3, 16);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFC8,
            emissive: 0xFFFFC8,
            emissiveIntensity: 0.4
        });
        
        const headlightLeft = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightLeft.position.set(-bodyWidth * 0.3, 0, bodyLength * 0.49);
        headlightLeft.rotation.y = Math.PI;
        this.truckGroup.add(headlightLeft);
        
        const headlightRight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightRight.position.set(bodyWidth * 0.3, 0, bodyLength * 0.49);
        headlightRight.rotation.y = Math.PI;
        this.truckGroup.add(headlightRight);
        
        // Whimsical marker on top
        const markerGeometry = new THREE.SphereGeometry(0.8, 16, 16);
        const markerMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF5555, // Softer red
            emissive: 0xFF5555,
            emissiveIntensity: 0.3
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.y = bodyHeight * 1.0 + 0.8;
        marker.position.z = 0;
        this.truckGroup.add(marker);
        
        // Create wheels
        this.createWheels();
        
        // Set initial position - slightly higher for Ghibli look
        this.truckGroup.position.set(0, 2.2, 0);
        
        return this.truckGroup;
    }
    
    createWheels() {
        // Ghibli-style wheels - larger and more cartoonish
        const wheelRadius = 1.3;
        const wheelThickness = 0.85;
        
        // Create wheel prototype with more detail
        const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 20);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,  // Slightly lighter black
            roughness: 0.8,
            metalness: 0.2
        });
        
        // Hub cap material
        const hubMaterial = new THREE.MeshStandardMaterial({
            color: 0xCCCCCC, // Silver
            roughness: 0.4,
            metalness: 0.8
        });
        
        // Adjust wheel positions for the new body shape
        const wheelPositions = [
            [-2.1, -0.4, -2.6], // back left
            [2.1, -0.4, -2.6],  // back right
            [-2.1, -0.4, 2.6],  // front left
            [2.1, -0.4, 2.6]    // front right
        ];
        
        wheelPositions.forEach((position, index) => {
            const wheelGroup = new THREE.Group();
            
            // Main wheel tire
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);
            
            // Add hub cap to each wheel
            const hubGeometry = new THREE.CylinderGeometry(wheelRadius * 0.4, wheelRadius * 0.4, wheelThickness + 0.05, 16);
            const hub = new THREE.Mesh(hubGeometry, hubMaterial);
            hub.rotation.z = Math.PI / 2;
            wheelGroup.add(hub);
            
            wheelGroup.position.set(...position);
            this.truckGroup.add(wheelGroup);
            
            // Store front wheels separately for steering
            if (index >= 2) {
                wheel.isFrontWheel = true;
            }
            
            this.wheels.push(wheelGroup);
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
    }
    
    updateAnimations(deltaTime, steeringAngle, speed, groundNormal) {
        // Calculate lean while turning (roll)
        const targetLean = -steeringAngle * 0.03 * Math.min(1, speed / 5);
        this.animation.lean += (targetLean - this.animation.lean) * Math.min(1, deltaTime * 5);
        
        // Calculate pitch based on acceleration/deceleration
        const acceleration = speed - this.animation.prevSpeed;
        const targetPitch = -acceleration * 0.01;
        this.animation.pitch += (targetPitch - this.animation.pitch) * Math.min(1, deltaTime * 3);
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
            
            // Steer only front wheels (index 2,3)
            if (index >= 2) {
                wheel.rotation.y = steeringAngle;
            }
        });
    }
    
    reset(position) {
        // Reset position and rotation
        this.truckGroup.position.copy(position || new THREE.Vector3(0, 2, 0));
        this.truckGroup.rotation.set(0, 0, 0);
        
        // Reset animation properties
        this.animation.lean = 0;
        this.animation.pitch = 0;
        this.animation.wheelRotation = 0;
        this.animation.prevSpeed = 0;
        
        // Reset wheel steering
        this.wheels.forEach(wheel => {
            wheel.rotation.y = 0;
        });
    }
} 