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
        // Create the main truck body
        const bodyGeometry = new THREE.BoxGeometry(4, 2, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xD48166, // Warm terracotta red
            roughness: 0.7,
            metalness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        this.truckGroup.add(body);
        
        // Add top marker
        const markerGeometry = new THREE.SphereGeometry(1, 16, 16);
        const markerMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000, // Bright red
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.y = 2; // On top of the truck
        this.truckGroup.add(marker);
        
        // Create wheels
        this.createWheels();
        
        // Set initial position
        this.truckGroup.position.set(0, 2, 0);
        
        return this.truckGroup;
    }
    
    createWheels() {
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
        
        // Add wheels at these positions
        const wheelPositions = [
            [-2, 0, -2], // back left
            [2, 0, -2],  // back right
            [-2, 0, 2],  // front left
            [2, 0, 2]    // front right
        ];
        
        wheelPositions.forEach((position, index) => {
            const wheelGroup = new THREE.Group();
            
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);
            
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