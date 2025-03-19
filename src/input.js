import nipplejs from 'nipplejs';

export class InputHandler {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };
        
        this.joystick = null;
        this.joystickData = {
            angle: 0,
            force: 0,
            active: false
        };
        
        this.isUsingTouchControls = false;
        this.callbacks = [];
    }
    
    setup() {
        // Set up keyboard event listeners
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Setup touch joystick for mobile
        this.setupTouchControls();
        
        // Handle window resizing
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    handleKeyDown(event) {
        this.updateKeyState(event.code, true);
    }
    
    handleKeyUp(event) {
        this.updateKeyState(event.code, false);
    }
    
    updateKeyState(code, isPressed) {
        const prevState = {...this.keys};
        
        switch (code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.forward = isPressed;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.backward = isPressed;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = isPressed;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = isPressed;
                break;
            case 'Space':
                this.keys.brake = isPressed;
                break;
        }
        
        // Only trigger callbacks if state changed
        if (JSON.stringify(prevState) !== JSON.stringify(this.keys)) {
            this.notifyCallbacks();
        }
    }
    
    setupTouchControls() {
        // Create joystick container
        const joystickContainer = document.createElement('div');
        joystickContainer.id = 'joystick-container';
        joystickContainer.style.position = 'absolute';
        joystickContainer.style.bottom = '40px';
        joystickContainer.style.left = '40px';
        joystickContainer.style.width = '120px';
        joystickContainer.style.height = '120px';
        document.body.appendChild(joystickContainer);
        
        // Create joystick
        this.joystick = nipplejs.create({
            zone: joystickContainer,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'rgba(255, 255, 255, 0.5)',
            size: 120
        });
        
        // Handle joystick events
        this.joystick.on('start', () => {
            this.joystickData.active = true;
            this.isUsingTouchControls = true;
        });
        
        this.joystick.on('end', () => {
            this.joystickData.active = false;
            this.joystickData.force = 0;
            
            // Reset keyboard state when joystick is released
            this.keys.forward = false;
            this.keys.backward = false;
            this.keys.left = false;
            this.keys.right = false;
            
            this.notifyCallbacks();
        });
        
        this.joystick.on('move', (event, data) => {
            // Store joystick data
            this.joystickData.angle = data.angle.radian;
            this.joystickData.force = Math.min(1, data.force / 50);
            
            // Convert joystick to key presses
            const angle = data.angle.degree;
            const force = data.force / 50; // Normalize force
            
            // Reset all movement keys
            this.keys.forward = false;
            this.keys.backward = false;
            this.keys.left = false;
            this.keys.right = false;
            
            // Apply based on angle and force
            if (force > 0.3) { // Minimum threshold for activation
                // Forward/backward based on y-axis
                if (angle > 45 && angle < 135) {
                    // Right quadrant
                    this.keys.right = true;
                } else if (angle > 225 && angle < 315) {
                    // Left quadrant
                    this.keys.left = true;
                }
                
                // Left/right based on x-axis
                if (angle > 315 || angle < 45) {
                    // Up quadrant
                    this.keys.forward = true;
                } else if (angle > 135 && angle < 225) {
                    // Down quadrant
                    this.keys.backward = true;
                }
            }
            
            this.notifyCallbacks();
        });
        
        // Hide joystick on desktop
        this.checkIfMobile();
    }
    
    checkIfMobile() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (this.joystick) {
            const joystickContainer = document.getElementById('joystick-container');
            if (joystickContainer) {
                joystickContainer.style.display = isMobile ? 'block' : 'none';
            }
        }
    }
    
    handleResize() {
        this.checkIfMobile();
    }
    
    onInputChange(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }
    
    notifyCallbacks() {
        for (const callback of this.callbacks) {
            callback(this.keys);
        }
    }
    
    getInputState() {
        return this.keys;
    }
    
    destroy() {
        // Remove event listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('resize', this.handleResize);
        
        // Destroy joystick
        if (this.joystick) {
            this.joystick.destroy();
        }
        
        // Remove joystick container
        const joystickContainer = document.getElementById('joystick-container');
        if (joystickContainer) {
            document.body.removeChild(joystickContainer);
        }
    }
} 