// Main entry point for the Vite application
// This file is loaded by index.html

console.log('Cloudflare AI Gateway + OpenAI POC initialized');
console.log('Powered by Vite ⚡');

// You can add any global initialization code here
// For example, setting up service workers, analytics, etc.

// Check if the browser supports all required features
const checkBrowserSupport = () => {
    const features = {
        'WebSocket': typeof WebSocket !== 'undefined',
        'MediaRecorder': typeof MediaRecorder !== 'undefined',
        'getUserMedia': navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
        'AudioContext': typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
        'ES Modules': true // If this code runs, ES modules are supported
    };

    const unsupported = Object.entries(features)
        .filter(([, supported]) => !supported)
        .map(([feature]) => feature);

    if (unsupported.length > 0) {
        console.warn('Browser missing features:', unsupported);
        const message = `Your browser may not support all features. Missing: ${unsupported.join(', ')}`;
        
        // Show a warning banner
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #f59e0b;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 9999;
        `;
        banner.textContent = message;
        document.body.appendChild(banner);
        
        setTimeout(() => {
            banner.remove();
        }, 10000);
    } else {
        console.log('✅ All browser features supported');
    }
};

// Check browser support when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkBrowserSupport);
} else {
    checkBrowserSupport();
}

// Export for use in other modules if needed
export { checkBrowserSupport };