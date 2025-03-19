import * as THREE from 'three';

export class GameCamera {
    constructor(camera) {
        this.camera = camera;
        this.target = null;
        
        // Camera parameters - optimized for better turning visibility
        this.defaultHeight = 6; // Further lowered from 7 for a lower, more dynamic view
        this.defaultDistance = 12; // Reduced from 14 for closer, more immediate feedback
        
        // Current values for smooth transition
        this.currentHeight = this.defaultHeight;
        this.currentDistance = this.defaultDistance;
        this.currentLookAt = new THREE.Vector3();
        
        // Smoothing factors - more dynamic for better turning feedback
        this.positionSmoothing = 0.12; // Increased from 0.08 for more camera movement during turns
        this.rotationSmoothing = 0.18; // Increased from 0.15 for more dynamic rotation
        this.targetOffset = new THREE.Vector3(0, 0.8, 0); // Lower camera target for better road view
        
        // Add lateral offset for more dramatic view during cornering
        this.maxLateralOffset = 3.0; // Increased from 2.0 for more dramatic offset during turns
        this.currentLateralOffset = 0;
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    update(deltaTime, targetSpeed = 0) {
        if (!this.target || !this.camera) return;
        
        // Get target position and rotation
        const targetPosition = this.target.position.clone();
        const targetRotation = this.target.rotation.y;
        
        // Calculate current steering angle from rotation
        const steeringAngle = this.target.children[0]?.rotation.y || 0;
        
        // Adjust camera height and distance based on speed
        const heightFactor = Math.min(1, targetSpeed / 30); // Reduced from 40 for earlier height change
        const targetHeight = this.defaultHeight + heightFactor * 5; // Increased from 4 for more dramatic height change
        const targetDistance = this.defaultDistance + heightFactor * 6; // Increased from 5 for more dramatic distance change
        
        // Calculate lateral offset based on steering - more dramatic effect
        const targetLateralOffset = steeringAngle * this.maxLateralOffset;
        this.currentLateralOffset += (targetLateralOffset - this.currentLateralOffset) * 
            Math.min(deltaTime * 3.0, 0.15); // Increased from 2.0/0.1 for much faster response
        
        // Smooth transitions with more responsiveness for enhanced turning feel
        this.currentHeight += (targetHeight - this.currentHeight) * 
            Math.min(deltaTime * 2.0, this.positionSmoothing); // Increased from 1.5
        this.currentDistance += (targetDistance - this.currentDistance) * 
            Math.min(deltaTime * 2.0, this.positionSmoothing); // Increased from 1.5
        
        // Calculate camera position based on truck position and rotation
        const truckDirection = new THREE.Vector3(
            Math.sin(targetRotation),
            0,
            Math.cos(targetRotation)
        );
        
        // Calculate right vector for lateral offset
        const rightVector = new THREE.Vector3(
            Math.cos(targetRotation),
            0,
            -Math.sin(targetRotation)
        );
        
        // Calculate camera position with enhanced lateral offset for more dramatic cornering view
        const cameraPosition = targetPosition.clone()
            .sub(truckDirection.clone().multiplyScalar(this.currentDistance))
            .add(rightVector.clone().multiplyScalar(this.currentLateralOffset))
            .add(new THREE.Vector3(0, this.currentHeight, 0));
        
        // Smoothly update camera position - much faster for more immediate turning feedback
        this.camera.position.lerp(cameraPosition, Math.min(deltaTime * 4.0, this.positionSmoothing * 2.0));
        
        // Calculate the look at position with more focus on turning direction
        const lookAheadFactor = Math.min(1, targetSpeed / 12); // Reduced from 15 for earlier look-ahead
        const lookAtPosition = targetPosition.clone()
            .add(this.targetOffset)
            .add(truckDirection.clone().multiplyScalar(6 * lookAheadFactor)) // Increased from 5 for looking further ahead
            .add(rightVector.clone().multiplyScalar(steeringAngle * 2.0)); // Added rightward shift for better turning visibility
        
        // Smoothly update the look at position - faster for better turning response
        this.currentLookAt.lerp(lookAtPosition, Math.min(deltaTime * 4.5, this.rotationSmoothing * 2.0));
        
        // Apply look at
        this.camera.lookAt(this.currentLookAt);
    }
    
    reset() {
        if (!this.target) return;
        
        // Reset camera to default position
        const targetPosition = this.target.position.clone();
        const truckDirection = new THREE.Vector3(0, 0, 1);
        
        // Set camera position behind truck
        this.camera.position.copy(
            targetPosition.clone()
                .sub(truckDirection.multiplyScalar(this.defaultDistance))
                .add(new THREE.Vector3(0, this.defaultHeight, 0))
        );
        
        // Look at truck with the new target offset
        this.camera.lookAt(targetPosition.clone().add(this.targetOffset));
        
        // Reset camera parameters
        this.currentHeight = this.defaultHeight;
        this.currentDistance = this.defaultDistance;
        this.currentLateralOffset = 0;
        this.currentLookAt.copy(targetPosition.clone().add(this.targetOffset));
    }
} 