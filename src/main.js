import { Game } from './game.js';

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Create and initialize game
        const game = new Game();
        game.initialize();
        
        console.log('Game started successfully');
    } catch (error) {
        console.error('Failed to start game:', error);
        
        // Show error to user
        const errorMessage = document.createElement('div');
        errorMessage.style.position = 'absolute';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.background = 'rgba(0,0,0,0.8)';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '10px';
        errorMessage.style.textAlign = 'center';
        errorMessage.innerHTML = `
            <h2>Error Starting Game</h2>
            <p>${error.message}</p>
            <p>Please check if your browser supports WebGL and that it's enabled.</p>
        `;
        document.body.appendChild(errorMessage);
    }
}); 