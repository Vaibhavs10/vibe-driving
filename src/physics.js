import * as THREE from 'three';

export class TruckPhysics {
    constructor() {
        // Basic movement
        this.position = new THREE.Vector3(0, 2, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        
        // Rotation
        this.rotation = 0;
        this.angularVelocity = 0;
        
        // Physics constants
        this.mass = 800;
        this.engineForce = 40000;
        this.brakingForce = 25000;
        this.rollingResistance = 0.01;
        this.dragCoefficient = 0.05;
        this.wheelBase = 3.5;
        this.maxSteeringAngle = 0.6;
        this.maxSpeedKmh = 120;
        
        // Terrain interaction
        this.groundContact = true;
        this.groundNormal = new THREE.Vector3(0, 1, 0);
        
        // States
        this.throttle = 0;
        this.brake = 0;
        this.steering = 0;
        
        // For smooth control transitions
        this.targetSteering = 0;
        this.targetThrottle = 0;
        this.targetBrake = 0;
        
        // Input mapping
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };
    }

    update(deltaTime, getTerrainHeightAt, getTerrainRoughnessAt) {
        // Update steering with smooth interpolation
        this.steering += (this.targetSteering - this.steering) * Math.min(1, deltaTime * 5);
        
        // Update throttle and brake with smooth interpolation
        this.throttle += (this.targetThrottle - this.throttle) * Math.min(1, deltaTime * 3);
        this.brake += (this.targetBrake - this.brake) * Math.min(1, deltaTime * 4);
        
        // Calculate forward direction based on rotation
        const forwardDir = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        const rightDir = new THREE.Vector3(Math.cos(this.rotation), 0, -Math.sin(this.rotation));
        
        // Reset acceleration
        this.acceleration.set(0, -9.8, 0); // Gravity
        
        // Calculate engine force and apply as acceleration
        const engineAccel = forwardDir.clone().multiplyScalar(this.throttle * this.engineForce / this.mass);
        this.acceleration.add(engineAccel);
        
        // Calculate braking force and apply as acceleration
        if (this.brake > 0) {
            // Get velocity magnitude in forward direction
            const velInForwardDir = this.velocity.dot(forwardDir);
            // Only apply braking in the direction of motion
            if (Math.abs(velInForwardDir) > 0.1) {
                const brakeDir = forwardDir.clone().multiplyScalar(-Math.sign(velInForwardDir));
                const brakeAccel = brakeDir.multiplyScalar(this.brake * this.brakingForce / this.mass);
                this.acceleration.add(brakeAccel);
            }
        }
        
        // Calculate drag
        const speedSq = this.velocity.lengthSq();
        if (speedSq > 0) {
            const dragMag = this.dragCoefficient * speedSq;
            const dragDir = this.velocity.clone().normalize().negate();
            const dragAccel = dragDir.multiplyScalar(dragMag / this.mass);
            this.acceleration.add(dragAccel);
        }
        
        // Calculate rolling resistance
        if (this.groundContact && speedSq > 0.01) {
            const rollResistMag = this.rollingResistance * this.mass * 9.8; // Proportional to normal force
            const rollResistDir = this.velocity.clone().normalize().negate();
            const rollResistAccel = rollResistDir.multiplyScalar(rollResistMag / this.mass);
            this.acceleration.add(rollResistAccel);
        }
        
        // Apply speed limit if velocity exceeds maximum speed
        const speed = Math.sqrt(speedSq);
        const speedKmh = speed * 3.6; // Convert m/s to km/h (1 m/s = 3.6 km/h)
        
        if (speedKmh > this.maxSpeedKmh) {
            // Apply limiting force in the opposite direction of movement
            const limitFactor = this.maxSpeedKmh / speedKmh;
            this.velocity.multiplyScalar(limitFactor);
        }
        
        // Apply steering as angular acceleration
        // Simple model: angular acceleration proportional to steering angle and speed
        const steeringEffect = this.steering * (speed / 10); // Scale with speed
        this.angularVelocity += steeringEffect * 2 * deltaTime;
        
        // Apply damping to angular velocity
        this.angularVelocity *= 0.95;
        
        // Update rotation
        this.rotation += this.angularVelocity * deltaTime;
        
        // Update velocity using acceleration
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
        
        // Store current position for terrain check
        const prevPos = this.position.clone();
        
        // Update position using velocity
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Apply terrain height constraints
        const terrainY = getTerrainHeightAt(this.position.x, this.position.z);
        
        // Apply ground contact with suspension
        const suspensionHeight = 1.5; // Height above the terrain
        const targetHeight = terrainY + suspensionHeight;
        
        // Apply terrain roughness to the vehicle physics
        const roughness = getTerrainRoughnessAt(this.position.x, this.position.z);
        
        // Simple suspension - gradually adjust height
        if (this.position.y < targetHeight) {
            // Apply upward force proportional to depth
            const depth = targetHeight - this.position.y;
            const suspensionForce = 400 * depth - this.velocity.y * 50; // Spring + damping
            this.velocity.y += suspensionForce * deltaTime / this.mass;
            this.groundContact = true;
        } else {
            // Apply gravity more strongly when airborne to bring vehicle down
            this.velocity.y -= 9.8 * deltaTime * 1.5;
            
            // Detect if we're really airborne or just slightly above the terrain
            this.groundContact = (this.position.y - targetHeight < 0.5);
        }

        // Make sure we're not underground
        if (this.position.y < terrainY + 0.2) {
            this.position.y = terrainY + 0.2;
            this.velocity.y = Math.max(0, this.velocity.y);
        }
        
        // Roll correction - adjust rotation based on terrain normal
        if (this.groundContact) {
            // Use terrain height at nearby points to determine terrain normal
            const sampleDist = 2;
            const heightLeft = getTerrainHeightAt(this.position.x - rightDir.x * sampleDist, this.position.z - rightDir.z * sampleDist);
            const heightRight = getTerrainHeightAt(this.position.x + rightDir.x * sampleDist, this.position.z + rightDir.z * sampleDist);
            const heightFront = getTerrainHeightAt(this.position.x + forwardDir.x * sampleDist, this.position.z + forwardDir.z * sampleDist);
            const heightBack = getTerrainHeightAt(this.position.x - forwardDir.x * sampleDist, this.position.z - forwardDir.z * sampleDist);
            
            // Update terrain normal based on height differences
            const sideSlope = Math.atan2(heightRight - heightLeft, sampleDist * 2);
            const forwardSlope = Math.atan2(heightFront - heightBack, sampleDist * 2);
            
            // Set ground normal - this affects how the truck sits on terrain
            this.groundNormal.set(-sideSlope, 1, -forwardSlope).normalize();
        }
        
        return {
            position: this.position.clone(),
            rotation: this.rotation,
            groundNormal: this.groundNormal.clone(),
            speed: speed,
            wheelRotationSpeed: speed / 1.0, // For wheel animation
            steeringAngle: this.steering * this.maxSteeringAngle
        };
    }

    applyUserInput(input) {
        this.keys = input;
        
        // Convert key states to physics targets
        this.targetThrottle = this.keys.forward ? 1 : 0;
        this.targetBrake = this.keys.backward ? 1 : 0;
        
        // Steering control based on both left/right key states
        if (this.keys.left && !this.keys.right) {
            this.targetSteering = 1; // Full left
        } else if (this.keys.right && !this.keys.left) {
            this.targetSteering = -1; // Full right
        } else {
            this.targetSteering = 0; // Center
        }
    }

    reset() {
        // Reset position and dynamics
        this.position.set(0, 5, 0);
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.rotation = 0;
        this.angularVelocity = 0;
        
        // Reset controls
        this.throttle = 0;
        this.brake = 0; 
        this.steering = 0;
        this.targetSteering = 0;
        this.targetThrottle = 0;
        this.targetBrake = 0;
        
        // Reset key states
        Object.keys(this.keys).forEach(key => {
            this.keys[key] = false;
        });
        
        return this.position.clone();
    }
} 