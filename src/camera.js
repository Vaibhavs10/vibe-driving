import * as THREE from 'three';

export class GameCamera {
    constructor(camera) {
        this.camera = camera;
        this.target = null;
        
        // Camera parameters - adjusted for flat terrain
        this.defaultHeight = 15; // Increased from 12 for better overview
        this.defaultDistance = 25; // Increased from 20 for wider field of view
        
        // Current values for smooth transition
        this.currentHeight = this.defaultHeight;
        this.currentDistance = this.defaultDistance;
        this.currentLookAt = new THREE.Vector3();
        
        // Smoothing factors
        this.positionSmoothing = 0.1;
        this.rotationSmoothing = 0.2;
        this.targetOffset = new THREE.Vector3(0, 2, 0); // Reduced from 3 for flatter perspective
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    update(deltaTime, targetSpeed = 0) {
        if (!this.target || !this.camera) return;
        
        // Get target position
        const targetPosition = this.target.position.clone();
        
        // Adjust camera height and distance based on speed for a dynamic feel
        const heightFactor = Math.min(1, targetSpeed / 30);
        const targetHeight = this.defaultHeight + heightFactor * 6; // Increased from 5 for higher perspective at speed
        const targetDistance = this.defaultDistance + heightFactor * 8; // Increased from 5 for better visibility at speed
        
        // Smooth transitions
        this.currentHeight += (targetHeight - this.currentHeight) * this.positionSmoothing;
        this.currentDistance += (targetDistance - this.currentDistance) * this.positionSmoothing;
        
        // Calculate camera position based on truck position and rotation
        const truckDirection = new THREE.Vector3(
            Math.sin(this.target.rotation.y),
            0,
            Math.cos(this.target.rotation.y)
        );
        
        // Calculate camera position
        const cameraPosition = targetPosition.clone()
            .sub(truckDirection.clone().multiplyScalar(this.currentDistance))
            .add(new THREE.Vector3(0, this.currentHeight, 0));
        
        // Smoothly update camera position
        this.camera.position.lerp(cameraPosition, this.positionSmoothing);
        
        // Calculate the look at position (slightly ahead of the truck)
        const lookAheadFactor = Math.min(1, targetSpeed / 10);
        const lookAtPosition = targetPosition.clone()
            .add(this.targetOffset)
            .add(truckDirection.clone().multiplyScalar(8 * lookAheadFactor)); // Increased from 5 for looking further ahead
        
        // Smoothly update the look at position
        this.currentLookAt.lerp(lookAtPosition, this.rotationSmoothing);
        
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
        
        // Look at truck
        this.camera.lookAt(targetPosition.clone().add(this.targetOffset));
        
        // Reset camera parameters
        this.currentHeight = this.defaultHeight;
        this.currentDistance = this.defaultDistance;
        this.currentLookAt.copy(targetPosition.clone().add(this.targetOffset));
    }
} 