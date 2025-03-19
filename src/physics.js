import * as THREE from 'three';

export class TruckPhysics {
    constructor() {
        // Basic movement
        this.position = new THREE.Vector3(0, 0.5, 0); // Lower starting position to match truck visual
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        
        // Rotation
        this.rotation = 0;
        this.angularVelocity = 0;
        
        // Physics constants - exaggerated for cartoon monster truck feel
        this.mass = 1200; // Heavier monster truck
        this.engineForce = 65000; // More powerful engine
        this.brakingForce = 30000; // Stronger brakes
        this.rollingResistance = 0.008; // Reduced rolling resistance for monster truck tires
        this.dragCoefficient = 0.04; // Slightly reduced drag
        this.wheelBase = 5.6; // Wider wheelbase for monster truck
        this.maxSteeringAngle = 0.65; // Slightly increased steering angle
        this.maxSpeedKmh = 150; // Higher top speed
        
        // Suspension properties - new for monster truck
        this.suspensionHeight = 0.8; // Reduced from 2.2 - Lower ground clearance so truck doesn't hover
        this.suspensionStiffness = 0.7; // Softer suspension for bouncy effect
        this.suspensionDamping = 0.4; // Less damping for more bounce
        this.suspensionTravel = 1.2; // More suspension travel
        
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
        
        // Track height change to dampen rapid terrain transitions
        this.previousTerrainHeight = null;
        
        // Track truck bounce for cartoony effects
        this.bounce = 0;
        this.bounceVelocity = 0;
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
        
        // Apply steering as angular acceleration - more responsive for cartoon feel
        // Simple model: angular acceleration proportional to steering angle and speed
        const steeringEffect = this.steering * (speed / 8); // Scale with speed but more responsive
        this.angularVelocity += steeringEffect * 2.5 * deltaTime; // Increased steering response
        
        // Apply damping to angular velocity - less for more drift
        this.angularVelocity *= 0.92; // Reduced damping for more cartoony turning
        
        // Update rotation
        this.rotation += this.angularVelocity * deltaTime;
        
        // Update velocity using acceleration
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
        
        // Store current position for terrain check
        const prevPos = this.position.clone();
        
        // Update position using velocity
        const movementVector = this.velocity.clone().multiplyScalar(deltaTime);
        
        // Check for terrain height BEFORE we move, so we can adapt to changing terrain
        const initialTerrainY = getTerrainHeightAt(this.position.x, this.position.z);
        
        // Define maxSafeTerrainChange here before it's used
        const maxSafeTerrainChange = 4.0;  // Increased for monster truck (was 3.0)
        
        // For substantial movements, check terrain at several points along the movement path
        if (movementVector.length() > 1) {
            // Check terrain at several points along the movement path
            const steps = Math.ceil(movementVector.length());
            const stepVector = movementVector.clone().divideScalar(steps);
            
            let lastIntermediateTerrainY = initialTerrainY;
            
            for (let i = 1; i <= steps; i++) {
                // Move a step and check terrain height
                const intermediatePos = prevPos.clone().add(stepVector.clone().multiplyScalar(i));
                const intermediateTerrainY = getTerrainHeightAt(intermediatePos.x, intermediatePos.z);
                
                // Dampen rapid terrain changes for intermediate positions too
                let dampedIntermediateTerrainY = intermediateTerrainY;
                const intTerrainHeightChange = intermediateTerrainY - lastIntermediateTerrainY;
                const stepDeltaTime = deltaTime / steps;
                
                // Limit terrain change rate for smooth traversal
                if (Math.abs(intTerrainHeightChange) > maxSafeTerrainChange * stepDeltaTime) {
                    dampedIntermediateTerrainY = lastIntermediateTerrainY + 
                        Math.sign(intTerrainHeightChange) * maxSafeTerrainChange * stepDeltaTime;
                }
                
                lastIntermediateTerrainY = dampedIntermediateTerrainY;
            }
        }
        
        // Apply movement
        this.position.add(movementVector);
        
        // Terrain collision and suspension
        const terrainY = getTerrainHeightAt(this.position.x, this.position.z);
        const terrainRoughness = getTerrainRoughnessAt(this.position.x, this.position.z);
        
        // Add cartoon bounce effect to suspension - position directly on terrain plus suspension
        const targetHeight = terrainY + this.suspensionHeight + (this.bounce * 0.7);
        
        // Apply suspension force with cartoony bounce
        if (this.position.y < targetHeight) {
            // When hitting ground, determine bounce based on velocity and roughness
            this.groundContact = true;
            
            // Calculate impact velocity and bounce accordingly
            const impactVelocity = Math.max(0, -this.velocity.y);
            
            // Big impacts cause monster truck bounce
            if (impactVelocity > 5) {
                this.bounceVelocity = impactVelocity * 0.5; // Exaggerated bounce effect
            }
            
            // Apply suspension stiffness
            const compressionFactor = (targetHeight - this.position.y) / this.suspensionTravel;
            const suspensionForce = compressionFactor * this.suspensionStiffness * 9.8 * this.mass;
            
            // Apply damping to suspension
            const suspensionDampingForce = -this.velocity.y * this.suspensionDamping * this.mass;
            
            // Update position and velocity based on suspension
            this.position.y = targetHeight;
            this.velocity.y = Math.max(0, this.velocity.y); // Don't let it go negative when grounded
            
            // Set groundNormal based on terrain
            this.groundNormal.set(0, 1, 0); // For simplicity, always up
        } else {
            // When airborne
            this.groundContact = false;
            
            // Apply gravity normally
            // Already done in acceleration section
        }
        
        // Update bounce effect for cartoon feel
        this.bounce += this.bounceVelocity * deltaTime;
        this.bounceVelocity -= 5 * this.bounce * deltaTime; // Spring effect
        this.bounceVelocity *= 0.95; // Damping
        this.bounce *= 0.95; // Decay bounce over time
        
        // Simple collision with ground (prevent going below terrain)
        if (this.position.y < terrainY + 0.1) { // Reduced minimum ground clearance from 0.5 to 0.1
            this.position.y = terrainY + 0.1;
            this.velocity.y = Math.max(0, this.velocity.y);
        }
        
        // Calculate wheel rotation speed
        const wheelRotationSpeed = this.velocity.dot(forwardDir);
        
        // Calculate effective steering angle (degrees)
        const steeringAngle = this.steering * this.maxSteeringAngle;
        
        // Return current physics state
        return {
            position: this.position,
            rotation: this.rotation,
            speed: speed,
            speedKmh: speedKmh,
            steeringAngle: steeringAngle,
            groundContact: this.groundContact,
            groundNormal: this.groundNormal,
            wheelRotationSpeed: wheelRotationSpeed,
            bounce: this.bounce // Add bounce info for visual effects
        };
    }
    
    // Process user inputs
    applyUserInput(input) {
        // Set target controls based on input
        if (input.forward) {
            this.targetThrottle = 1.0;
            this.targetBrake = 0;
        } else if (input.backward) {
            // Reverse at half power
            this.targetThrottle = -0.6;
            this.targetBrake = 0;
        } else {
            this.targetThrottle = 0;
            this.targetBrake = 0;
        }
        
        // Braking takes priority over throttle
        if (input.brake) {
            this.targetBrake = 1.0;
            this.targetThrottle = 0;
        }
        
        // Steering input processing - more responsive for cartoon feel
        this.targetSteering = 0;
        if (input.left) this.targetSteering += 1.0;
        if (input.right) this.targetSteering -= 1.0;
    }
    
    // Reset the truck physics
    reset() {
        // Reset position on flat terrain
        this.position.set(0, this.suspensionHeight, 0); // Position the truck at suspension height above ground
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        
        // Reset rotation
        this.rotation = 0;
        this.angularVelocity = 0;
        
        // Reset controls
        this.throttle = 0;
        this.brake = 0;
        this.steering = 0;
        this.targetThrottle = 0;
        this.targetBrake = 0;
        this.targetSteering = 0;
        
        // Reset bounce effects
        this.bounce = 0;
        this.bounceVelocity = 0;
        
        return this.position;
    }
} 