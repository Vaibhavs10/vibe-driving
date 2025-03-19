export class DebugDisplay {
    constructor() {
        this.debugDiv = null;
        this.visible = true;
    }
    
    initialize() {
        // Create a debug info display
        this.debugDiv = document.createElement('div');
        this.debugDiv.id = 'debug-info';
        this.debugDiv.style.position = 'absolute';
        this.debugDiv.style.top = '10px';
        this.debugDiv.style.left = '10px';
        this.debugDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.debugDiv.style.color = 'white';
        this.debugDiv.style.padding = '10px';
        this.debugDiv.style.borderRadius = '5px';
        this.debugDiv.style.fontFamily = 'monospace';
        this.debugDiv.style.zIndex = '1000';
        this.debugDiv.style.pointerEvents = 'none'; // Allow click-through
        document.body.appendChild(this.debugDiv);
        
        // Add toggle button
        const toggleButton = document.createElement('button');
        toggleButton.innerText = 'Toggle Debug';
        toggleButton.style.position = 'absolute';
        toggleButton.style.top = '10px';
        toggleButton.style.right = '10px';
        toggleButton.style.zIndex = '1001';
        toggleButton.addEventListener('click', () => this.toggleVisibility());
        document.body.appendChild(toggleButton);
    }
    
    update(data) {
        if (!this.debugDiv || !this.visible) return;
        
        // Format position and speed with 2 decimal points
        const formattedPosition = {
            x: data.position.x.toFixed(2),
            y: data.position.y.toFixed(2),
            z: data.position.z.toFixed(2)
        };
        
        // Check if near boundary
        const boundaryLimit = 1750 - 5; // Same as in physics.js
        const distanceToBoundaryX = boundaryLimit - Math.abs(data.position.x);
        const distanceToBoundaryZ = boundaryLimit - Math.abs(data.position.z);
        const minDistanceToBoundary = Math.min(distanceToBoundaryX, distanceToBoundaryZ);
        let boundaryWarning = '';
        
        if (minDistanceToBoundary < 200) {
            const warningIntensity = Math.floor((1 - minDistanceToBoundary / 200) * 10);
            const exclamationMarks = '!'.repeat(warningIntensity);
            boundaryWarning = `<div class="boundary-warning">APPROACHING BOUNDARY${exclamationMarks}</div>`;
        }
        
        let html = '<strong>DEBUG INFO</strong><br>';
        
        if (data.position) {
            html += `Position: (${formattedPosition.x}, ${formattedPosition.y}, ${formattedPosition.z})<br>`;
        }
        
        if (data.rotation !== undefined) {
            html += `Rotation: ${(data.rotation * 180 / Math.PI).toFixed(2)}°<br>`;
        }
        
        if (data.speed !== undefined) {
            html += `Speed: ${(data.speed * 3.6).toFixed(2)} km/h<br>`;
        }
        
        if (data.nitroActive) {
            html += `<span style="color: #ff5500; font-weight: bold;">NITRO ACTIVE!</span><br>`;
        }
        
        if (data.controls) {
            html += `<br><strong>Controls:</strong> `;
            const activeControls = [];
            if (data.controls.forward) activeControls.push('Forward');
            if (data.controls.backward) activeControls.push('Backward');
            if (data.controls.left) activeControls.push('Left');
            if (data.controls.right) activeControls.push('Right');
            if (data.controls.brake) activeControls.push('Brake');
            if (data.controls.nitro) activeControls.push('<span style="color: #ff5500;">Nitro</span>');
            html += activeControls.length ? activeControls.join(', ') : 'None';
        }
        
        if (data.fps !== undefined) {
            html += `<br>FPS: ${data.fps.toFixed(1)}`;
        }
        
        if (data.terrainHeight !== undefined) {
            html += `<br>Terrain height: ${data.terrainHeight.toFixed(2)}`;
        }
        
        if (data.groundContact !== undefined) {
            html += `<br>Ground contact: ${data.groundContact ? 'Yes' : 'No'}`;
        }
        
        if (data.custom) {
            html += `<br><br>${data.custom}`;
        }
        
        html += boundaryWarning;
        
        this.debugDiv.innerHTML = html;
    }
    
    showMessage(message, duration = 3000) {
        const messageDiv = document.createElement('div');
        messageDiv.style.position = 'absolute';
        messageDiv.style.top = '50%';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translate(-50%, -50%)';
        messageDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '20px';
        messageDiv.style.borderRadius = '10px';
        messageDiv.style.textAlign = 'center';
        messageDiv.style.zIndex = '2000';
        messageDiv.innerHTML = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, duration);
    }
    
    toggleVisibility() {
        this.visible = !this.visible;
        if (this.debugDiv) {
            this.debugDiv.style.display = this.visible ? 'block' : 'none';
        }
    }
    
    showControlsHelp() {
        const help = `
            <strong>CONTROLS</strong><br>
            WASD / Arrow keys: Drive<br>
            Space: Brake<br>
            N: <span style="color: #ff5500;">Nitro Boost</span><br>
            R: Reset position<br><br>
            On mobile, use the joystick in the bottom left corner.
        `;
        this.showMessage(help, 5000);
    }
} 