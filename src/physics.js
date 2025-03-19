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
        
        // Physics constants - optimized for better turning
        this.mass = 1200; // Heavier monster truck
        this.engineForce = 28000; // Increased from 25000 for more responsive acceleration
        this.brakingForce = 18000; // Reduced from 20000 for slightly smoother braking
        this.rollingResistance = 0.01; // Further reduced for less resistance
        this.dragCoefficient = 0.05; // Further reduced for less air resistance
        this.wheelBase = 5.6; // Wider wheelbase for monster truck
        this.maxSteeringAngle = 0.6; // Significantly increased for much better turning capability
        this.maxSpeedKmh = 120; // Realistic top speed
        this.normalMaxSpeedKmh = 120; // Store normal max speed for nitro
        
        // Tire friction parameters - much reduced for better turning
        this.lateralFriction = 2.5; // Significantly reduced from 5.0 to allow for much better turning
        this.lateralFrictionCoefficient = 0.9; // Further reduced from 1.2 for much less aggressive grip
        this.lateralFrictionCurve = 0.4; // Further reduced from 0.5 for even more gradual friction drop-off
        this.frictionMultiplierAtLowSpeed = 1.0; // Reduced to 1.0 for more consistent turning at all speeds
        this.minSpeedForFullFriction = 1.5; // Further reduced for better handling at low speeds
        
        // Suspension properties
        this.suspensionHeight = 0.8; // Lower ground clearance so truck doesn't hover
        this.suspensionStiffness = 0.9; // Stiffer for more stable driving
        this.suspensionDamping = 0.7; // Higher for less bounce, more realistic feel
        this.suspensionTravel = 0.8; // Reduced for more realistic feel
        
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
        
        // Track boundary collisions to avoid playing sounds too frequently
        this.lastBoundaryCollisionTime = 0;
        this.boundaryCollisionCooldown = 500; // ms
        
        // Nitro state
        this.nitroActive = false;
        this.nitroMultiplier = 2.0; // Speed multiplier when nitro is active
    }

    update(deltaTime, getTerrainHeightAt, getTerrainRoughnessAt) {
        // Update steering with smooth interpolation
        this.steering += (this.targetSteering - this.steering) * Math.min(1, deltaTime * 2.0);
        
        // Update throttle and brake with smooth interpolation
        this.throttle += (this.targetThrottle - this.throttle) * Math.min(1, deltaTime * 1.5);
        this.brake += (this.targetBrake - this.brake) * Math.min(1, deltaTime * 2.0);
        
        // Calculate forward direction based on rotation
        const forwardDir = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        const rightDir = new THREE.Vector3(Math.cos(this.rotation), 0, -Math.sin(this.rotation));
        
        // Reset acceleration
        this.acceleration.set(0, -9.8, 0); // Gravity
        
        // Calculate speed and velocity components
        const speedSq = this.velocity.lengthSq();
        const speed = Math.sqrt(speedSq);
        const speedKmh = speed * 3.6; // Convert m/s to km/h
        
        // Decompose velocity into forward and lateral components
        const forwardVelocity = this.velocity.dot(forwardDir);
        const forwardVelocityVector = forwardDir.clone().multiplyScalar(forwardVelocity);
        const lateralVelocityVector = this.velocity.clone().sub(forwardVelocityVector);
        const lateralSpeed = lateralVelocityVector.length();
        
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
        
        // Calculate lateral friction (tire grip) - realistic physics for cornering
        if (this.groundContact && lateralSpeed > 0.01) {
            // Lateral friction increases at lower speeds for better maneuverability
            let frictionMultiplier = 1.0;
            if (speed < this.minSpeedForFullFriction && speed > 0.1) {
                frictionMultiplier = this.frictionMultiplierAtLowSpeed + 
                    (1.0 - this.frictionMultiplierAtLowSpeed) * (speed / this.minSpeedForFullFriction);
            }
            
            // Calculate slip angle ratio (higher = more sliding)
            const slipRatio = Math.min(1.0, lateralSpeed / (speed + 0.1));
            
            // Non-linear friction model that decreases with slip angle
            const frictionCoeff = this.lateralFrictionCoefficient * 
                Math.pow(1.0 - slipRatio, this.lateralFrictionCurve);
            
            // Calculate lateral friction force
            const lateralFrictionMag = this.lateralFriction * frictionCoeff * frictionMultiplier * this.mass;
            
            // Create normalized lateral direction vector
            let lateralDir;
            if (lateralSpeed > 0.01) {
                lateralDir = lateralVelocityVector.clone().normalize().negate();
            } else {
                lateralDir = rightDir.clone().multiplyScalar(Math.sign(this.velocity.dot(rightDir))).negate();
            }
            
            // Apply lateral friction as acceleration
            const lateralFrictionAccel = lateralDir.multiplyScalar(lateralFrictionMag / this.mass);
            
            // Limit lateral friction based on speed to prevent unnatural behavior
            const maxLateralAccel = Math.min(lateralSpeed / deltaTime, lateralFrictionAccel.length());
            lateralFrictionAccel.normalize().multiplyScalar(maxLateralAccel);
            
            this.acceleration.add(lateralFrictionAccel);
        }
        
        // Calculate drag (air resistance)
        if (speedSq > 0) {
            const dragMag = this.dragCoefficient * speedSq;
            const dragDir = this.velocity.clone().normalize().negate();
            const dragAccel = dragDir.multiplyScalar(dragMag / this.mass);
            this.acceleration.add(dragAccel);
        }
        
        // Calculate rolling resistance (tire friction when moving straight)
        if (this.groundContact && speedSq > 0.01) {
            // Rolling resistance increases at higher speeds
            const speedFactor = Math.min(1.0, speed / 10);
            const adjustedRollingResistance = this.rollingResistance * (1.0 + speedFactor * 0.5);
            
            const rollResistMag = adjustedRollingResistance * this.mass * 9.8; // Proportional to normal force
            const rollResistDir = this.velocity.clone().normalize().negate();
            const rollResistAccel = rollResistDir.multiplyScalar(rollResistMag / this.mass);
            this.acceleration.add(rollResistAccel);
        }
        
        // Apply speed limit if velocity exceeds maximum speed
        if (speedKmh > this.maxSpeedKmh) {
            // Apply limiting force in the opposite direction of movement
            const limitFactor = this.maxSpeedKmh / speedKmh;
            this.velocity.multiplyScalar(limitFactor);
        }
        
        // Apply steering as angular acceleration with enhanced turning
        if (this.groundContact) {
            // Calculate steering effect based on speed - much easier to turn at all speeds
            const steeringSpeedFactor = Math.min(1.0, speed / 1.5); // Further reduced from 2.5 to 1.5
            
            // Less reduction in steering at high speeds
            const highSpeedFactor = Math.max(0.8, 1.0 - (speed / 50.0) * 0.2); // Adjusted for better high-speed turning
            
            // Significantly increase steering response
            const steeringResponse = 3.5 * steeringSpeedFactor * highSpeedFactor; // Increased from 2.5 to 3.5
            
            // Greatly reduce the impact of lateral grip on steering
            const lateralGripFactor = Math.max(0.9, 1.0 - lateralSpeed / (speed + 0.1)); // Increased from 0.75 to 0.9
            const steeringEffect = this.steering * steeringResponse * lateralGripFactor;
            
            this.angularVelocity += steeringEffect * deltaTime;
        }
        
        // Apply less damping to angular velocity for much better turning
        this.angularVelocity *= 0.9; // Changed from 0.85 to 0.9 for even less damping
        
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
        
        // Check and enforce ground boundaries (1750 = half of groundSize 3500)
        const boundaryLimit = 1750 - 5; // Allow a small buffer from the edge
        const potentialNewPosition = this.position.clone().add(movementVector);
        
        if (Math.abs(potentialNewPosition.x) > boundaryLimit || Math.abs(potentialNewPosition.z) > boundaryLimit) {
            // Calculate the allowed movement vector that keeps the truck within bounds
            const clampedPosition = potentialNewPosition.clone();
            clampedPosition.x = Math.max(-boundaryLimit, Math.min(boundaryLimit, clampedPosition.x));
            clampedPosition.z = Math.max(-boundaryLimit, Math.min(boundaryLimit, clampedPosition.z));
            
            // If we're hitting the boundary, reduce velocity in that direction
            if (Math.abs(potentialNewPosition.x) > boundaryLimit) {
                this.velocity.x *= 0.5; // Reduce x velocity when hitting x boundary
            }
            if (Math.abs(potentialNewPosition.z) > boundaryLimit) {
                this.velocity.z *= 0.5; // Reduce z velocity when hitting z boundary
            }
            
            // Calculate the allowed movement
            movementVector.copy(clampedPosition.sub(this.position));
            
            // Trigger boundary collision sound if cooldown has elapsed
            const currentTime = Date.now();
            if (currentTime - this.lastBoundaryCollisionTime > this.boundaryCollisionCooldown) {
                this.lastBoundaryCollisionTime = currentTime;
                this.triggerBoundaryCollisionSound();
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
            
            // Big impacts cause monster truck bounce - less extreme for more realism
            if (impactVelocity > 5) {
                this.bounceVelocity = impactVelocity * 0.2; // Reduced from 0.3 for less exaggerated bounce
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
        
        // End of update, return important physics data
        return {
            position: this.position.clone(),
            rotation: this.rotation,
            wheelRotationSpeed: forwardVelocity * 0.5,
            steering: this.steering,
            steeringAngle: this.steering * this.maxSteeringAngle,
            speed: speed,
            velocity: this.velocity.clone(),
            groundNormal: this.groundNormal.clone(),
            groundContact: this.groundContact,
            bounce: this.bounce,
            nitroActive: this.nitroActive
        };
    }
    
    // Process user inputs
    applyUserInput(input, deltaTime = 0.016) {
        // Apply nitro effect
        if (input.nitro && !this.nitroActive) {
            // Activate nitro
            this.nitroActive = true;
            this.maxSpeedKmh = this.normalMaxSpeedKmh * this.nitroMultiplier;
        } else if (!input.nitro && this.nitroActive) {
            // Deactivate nitro
            this.nitroActive = false;
            this.maxSpeedKmh = this.normalMaxSpeedKmh;
        }
        
        // Set target controls based on input
        if (input.forward) {
            // Progressive throttle application
            const throttleIncrement = 0.7; // Reduced from 0.8 for smoother acceleration
            const newThrottle = Math.min(1.0, this.targetThrottle + throttleIncrement * deltaTime);
            this.targetThrottle = newThrottle;
            this.targetBrake = 0;
        } else if (input.backward) {
            // Reverse with progressive application
            const throttleIncrement = 0.5; // Reduced from 0.6 for smoother reverse
            const newThrottle = Math.max(-0.4, this.targetThrottle - throttleIncrement * deltaTime);
            this.targetThrottle = newThrottle;
            this.targetBrake = 0;
        } else {
            // Gradual throttle release
            if (Math.abs(this.targetThrottle) > 0.05) {
                this.targetThrottle *= 0.92; // Increased from 0.95 for quicker deceleration
            } else {
                this.targetThrottle = 0;
            }
            this.targetBrake = 0;
        }
        
        // Braking takes priority over throttle
        if (input.brake) {
            // Progressive brake application
            const brakeIncrement = 0.8; // Increased from 0.7 for more responsive braking
            const newBrake = Math.min(1.0, this.targetBrake + brakeIncrement * deltaTime);
            this.targetBrake = newBrake;
            this.targetThrottle = 0;
        }
        
        // Steering input processing - much more responsive steering
        // Apply progressive steering with greatly enhanced response
        const steeringIncrement = 2.5; // Significantly increased from 1.5 for much quicker steering response
        const steeringDecay = 0.95; // Increased from 0.9 to keep steering input even longer
        
        // Start with decay toward center
        this.targetSteering *= steeringDecay;
        
        // Apply steering input progressively but much faster
        if (input.left) {
            this.targetSteering += steeringIncrement * deltaTime;
            this.targetSteering = Math.min(this.targetSteering, 1.0);
        }
        if (input.right) {
            this.targetSteering -= steeringIncrement * deltaTime;
            this.targetSteering = Math.max(this.targetSteering, -1.0);
        }
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
        
        // Reset nitro state
        this.nitroActive = false;
        this.maxSpeedKmh = this.normalMaxSpeedKmh;
        
        return this.position;
    }
    
    // Trigger boundary collision sound effect
    triggerBoundaryCollisionSound() {
        try {
            // Simple sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            // Connect nodes
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Configure sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
            
            // Configure volume
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            // Play and stop
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.warn('Could not play boundary collision sound:', error);
        }
    }
} 