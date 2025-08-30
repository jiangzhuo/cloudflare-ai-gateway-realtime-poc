// Configuration Management for Cloudflare AI Gateway

export class ConfigManager {
    constructor() {
        this.storageKey = 'cf_ai_gateway_config';
        this.config = this.loadConfig();
    }

    loadConfig() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved config:', e);
            }
        }
        return {
            accountId: '',
            gatewayId: '',
            openaiKey: '',
            cfAuthToken: '',
            useAuthGateway: false,
            model: 'gpt-4o-mini',
            voice: 'alloy'
        };
    }

    saveConfig(updates) {
        this.config = { ...this.config, ...updates };
        localStorage.setItem(this.storageKey, JSON.stringify(this.config));
        return this.config;
    }

    getConfig() {
        return this.config;
    }

    getCloudflareBaseUrl() {
        const { accountId, gatewayId } = this.config;
        if (!accountId || !gatewayId) {
            throw new Error('Cloudflare Account ID and Gateway ID are required');
        }
        return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openai`;
    }

    getWebSocketUrl() {
        const { accountId, gatewayId } = this.config;
        if (!accountId || !gatewayId) {
            throw new Error('Cloudflare Account ID and Gateway ID are required');
        }
        return `wss://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openai/realtime`;
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.config.openaiKey) {
            headers['Authorization'] = `Bearer ${this.config.openaiKey}`;
        }

        if (this.config.useAuthGateway && this.config.cfAuthToken) {
            headers['cf-aig-authorization'] = `Bearer ${this.config.cfAuthToken}`;
        }

        return headers;
    }

    getWebSocketHeaders() {
        const headers = {};

        if (this.config.openaiKey) {
            headers['Authorization'] = `Bearer ${this.config.openaiKey}`;
        }

        if (this.config.useAuthGateway && this.config.cfAuthToken) {
            headers['cf-aig-authorization'] = `Bearer ${this.config.cfAuthToken}`;
        }

        headers['OpenAI-Beta'] = 'realtime=v1';

        return headers;
    }

    validateConfig() {
        const errors = [];
        
        if (!this.config.accountId) {
            errors.push('Cloudflare Account ID is required');
        }
        
        if (!this.config.gatewayId) {
            errors.push('Gateway ID is required');
        }
        
        if (!this.config.openaiKey) {
            errors.push('OpenAI API Key is required');
        }
        
        if (this.config.useAuthGateway && !this.config.cfAuthToken) {
            errors.push('CF AI Gateway Auth Token is required when using Authenticated Gateway');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Initialize config manager
export const configManager = new ConfigManager();

// Helper function to initialize config UI elements
export function initializeConfigUI() {
    const config = configManager.getConfig();
    
    // Set values for all config inputs if they exist
    const elements = {
        accountId: document.getElementById('accountId'),
        gatewayId: document.getElementById('gatewayId'),
        openaiKey: document.getElementById('openaiKey'),
        cfAuthToken: document.getElementById('cfAuthToken'),
        useAuthGateway: document.getElementById('useAuthGateway'),
        model: document.getElementById('model'),
        voice: document.getElementById('voice')
    };

    for (const [key, element] of Object.entries(elements)) {
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = config[key] || false;
            } else {
                element.value = config[key] || '';
            }
        }
    }

    // Set up save button handler
    const saveButton = document.getElementById('saveConfig');
    const statusElement = document.getElementById('configStatus');
    
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const updates = {};
            
            for (const [key, element] of Object.entries(elements)) {
                if (element) {
                    if (element.type === 'checkbox') {
                        updates[key] = element.checked;
                    } else {
                        updates[key] = element.value.trim();
                    }
                }
            }
            
            configManager.saveConfig(updates);
            
            const validation = configManager.validateConfig();
            
            if (statusElement) {
                if (validation.valid) {
                    statusElement.textContent = 'Configuration saved successfully!';
                    statusElement.className = 'status-message success';
                } else {
                    statusElement.textContent = 'Configuration saved with warnings: ' + validation.errors.join(', ');
                    statusElement.className = 'status-message error';
                }
                
                setTimeout(() => {
                    statusElement.textContent = '';
                    statusElement.className = 'status-message';
                }, 3000);
            }
        });
    }
}

// Initialize config UI when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeConfigUI);
} else {
    initializeConfigUI();
}