#!/usr/bin/env node

/**
 * Node.js test script for Cloudflare AI Gateway WebSocket connection
 * Tests OpenAI Realtime API through Cloudflare Gateway using Subprotocols
 */

import WebSocket from 'ws';
import readline from 'readline';

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Configuration
const config = {
    accountId: process.env.CF_ACCOUNT_ID || 'YOUR_ACCOUNT_ID',
    gatewayId: process.env.CF_GATEWAY_ID || 'YOUR_GATEWAY_ID',
    openaiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
    cfAuthToken: process.env.CF_AUTH_TOKEN || 'YOUR_CF_AUTH_TOKEN',
    model: process.env.MODEL || 'gpt-4o-mini-realtime-preview',
    debug: process.env.DEBUG === 'true'
};

// Create readline interface for interactive input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper functions
function log(message, color = colors.reset) {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logError(message) {
    log(`❌ ${message}`, colors.red);
}

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
}

function logInfo(message) {
    log(`ℹ️  ${message}`, colors.cyan);
}

function logSent(message) {
    log(`📤 ${message}`, colors.blue);
}

function logReceived(message) {
    log(`📥 ${message}`, colors.magenta);
}

function logWarning(message) {
    log(`⚠️  ${message}`, colors.yellow);
}

// Prompt for configuration if not provided
async function promptConfig() {
    const questions = [
        { key: 'accountId', prompt: 'Cloudflare Account ID: ', required: true },
        { key: 'gatewayId', prompt: 'Gateway ID: ', required: true },
        { key: 'openaiKey', prompt: 'OpenAI API Key: ', required: true },
        { key: 'cfAuthToken', prompt: 'CF Auth Token (optional, press Enter to skip): ', required: false },
        { key: 'model', prompt: `Model (default: ${config.model}): `, required: false }
    ];

    for (const q of questions) {
        if (!config[q.key] || (q.required && config[q.key] === '')) {
            config[q.key] = await new Promise(resolve => {
                rl.question(q.prompt, answer => {
                    resolve(answer || (q.key === 'model' ? config.model : ''));
                });
            });
        }
    }
}

// Gateway Tester using Subprotocols
class GatewayTester {
    constructor(config) {
        this.config = config;
        this.ws = null;
    }

    // Connect using Subprotocols (browser-compatible approach)
    async connect() {
        logInfo('Connecting via Subprotocols (browser-compatible approach)');
        
        const url = `wss://gateway.ai.cloudflare.com/v1/${this.config.accountId}/${this.config.gatewayId}/openai?model=${this.config.model}`;
        
        logInfo(`URL: ${url}`);
        
        // Build subprotocols array
        const protocols = [
            'realtime',
            // `openai-insecure-api-key.${this.config.openaiKey}`,
            'openai-beta.realtime-v1'
        ];
        
        // Add CF auth token if provided
        if (this.config.cfAuthToken) {
            protocols.push(`cf-aig-authorization.${this.config.cfAuthToken}`);
        }
        
        logInfo('Subprotocols:');
        protocols.forEach(p => {
            if (p.includes('key')) {
                logInfo(`  - ${p.substring(0, 30)}...`);
            } else {
                logInfo(`  - ${p}`);
            }
        });
        
        return new Promise((resolve, reject) => {
            try {
                logInfo('Creating WebSocket connection...');
                
                // Create WebSocket connection with subprotocols
                this.ws = new WebSocket(url, protocols);
                
                // Set up event handlers
                this.ws.on('open', () => {
                    logSuccess('✨ WebSocket connection established!');
                    
                    // Send a test message after 1 second
                    setTimeout(() => {
                        const testMessage = {
                            type: 'response.create',
                            response: {
                                modalities: ['text'],
                                instructions: 'Say "Hello! Connection test successful!" in a friendly way.'
                            }
                        };
                        
                        this.ws.send(JSON.stringify(testMessage));
                        logSent('Test message sent: response.create');
                    }, 1000);
                    
                    resolve(true);
                });
                
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        logReceived(`Message type: ${message.type}`);
                        
                        if (this.config.debug) {
                            console.log(JSON.stringify(message, null, 2));
                        }
                        
                        // Handle specific message types
                        switch (message.type) {
                            case 'session.created':
                                logSuccess('Session created successfully');
                                logInfo(`Session ID: ${message.session?.id}`);
                                break;
                            case 'session.updated':
                                logSuccess('Session updated');
                                break;
                            case 'response.created':
                                logInfo('Response started');
                                break;
                            case 'response.done':
                                logSuccess('Response completed');
                                break;
                            case 'response.text.delta':
                                if (message.delta) {
                                    process.stdout.write(message.delta);
                                }
                                break;
                            case 'response.text.done':
                                console.log(''); // New line after text completion
                                break;
                            case 'conversation.item.created':
                                if (message.item?.content?.[0]?.text) {
                                    logInfo(`Assistant: ${message.item.content[0].text}`);
                                }
                                break;
                            case 'error':
                                logError(`Error from server: ${message.error?.message || JSON.stringify(message.error)}`);
                                break;
                        }
                    } catch (error) {
                        logError(`Failed to parse message: ${error.message}`);
                        if (this.config.debug) {
                            console.log('Raw data:', data.toString());
                        }
                    }
                });
                
                this.ws.on('error', (error) => {
                    logError(`WebSocket error: ${error.message || error}`);
                    reject(error);
                });
                
                this.ws.on('close', (code, reason) => {
                    logInfo(`Connection closed: Code ${code}, Reason: ${reason || 'No reason provided'}`);
                    
                    // Common close codes
                    const closeCodes = {
                        1000: 'Normal closure',
                        1001: 'Going away',
                        1002: 'Protocol error',
                        1003: 'Unsupported data',
                        1006: 'Abnormal closure',
                        1007: 'Invalid frame payload data',
                        1008: 'Policy violation',
                        1009: 'Message too big',
                        1011: 'Internal server error',
                        4000: 'Bad request',
                        4001: 'Unauthorized',
                        4002: 'Payment required',
                        4003: 'Forbidden',
                        4004: 'Not found',
                        4008: 'Request timeout'
                    };
                    
                    if (closeCodes[code]) {
                        logInfo(`Close code meaning: ${closeCodes[code]}`);
                    }
                    
                    // Specific guidance for common issues
                    if (code === 4001 || code === 4003) {
                        logWarning('Authentication failed. Check your API keys and Gateway configuration.');
                    } else if (code === 1002) {
                        logWarning('Protocol error. The subprotocol authentication may not be supported.');
                    }
                });
                
            } catch (error) {
                logError(`Failed to create WebSocket: ${error.message}`);
                reject(error);
            }
        });
    }

    // Disconnect
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    // Interactive message sending
    async startInteractive() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            logError('Not connected');
            return;
        }
        
        console.log('');
        logSuccess('🎯 Interactive mode started!');
        console.log('');
        logInfo('Available commands:');
        logInfo('  /text <message>  - Send a text message');
        logInfo('  /json <json>     - Send raw JSON');
        logInfo('  /help            - Show this help');
        logInfo('  /quit            - Exit the program');
        console.log('');
        
        rl.on('line', (input) => {
            if (input === '/quit') {
                logInfo('Disconnecting...');
                this.disconnect();
                process.exit(0);
            } else if (input === '/help') {
                logInfo('Commands:');
                logInfo('  /text <message>  - Send a text message');
                logInfo('  /json <json>     - Send raw JSON');
                logInfo('  /help            - Show this help');
                logInfo('  /quit            - Exit the program');
            } else if (input.startsWith('/json ')) {
                try {
                    const json = JSON.parse(input.substring(6));
                    this.ws.send(JSON.stringify(json));
                    logSent('Custom JSON sent');
                } catch (error) {
                    logError(`Invalid JSON: ${error.message}`);
                }
            } else if (input.startsWith('/text ')) {
                const text = input.substring(6);
                const message = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'user',
                        content: [{
                            type: 'input_text',
                            text: text
                        }]
                    }
                };
                this.ws.send(JSON.stringify(message));
                logSent(`User message: ${text}`);
                
                // Request response
                const responseRequest = {
                    type: 'response.create',
                    response: {
                        modalities: ['text']
                    }
                };
                this.ws.send(JSON.stringify(responseRequest));
            } else if (input.startsWith('/')) {
                logWarning('Unknown command. Type /help for available commands.');
            } else {
                // Treat as text message if no command prefix
                const message = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'user',
                        content: [{
                            type: 'input_text',
                            text: input
                        }]
                    }
                };
                this.ws.send(JSON.stringify(message));
                logSent(`User message: ${input}`);
                
                // Request response
                const responseRequest = {
                    type: 'response.create',
                    response: {
                        modalities: ['text']
                    }
                };
                this.ws.send(JSON.stringify(responseRequest));
            }
        });
    }
}

// Main execution
async function main() {
    console.log(`${colors.bright}${colors.cyan}🧪 Cloudflare AI Gateway - OpenAI Realtime API Tester${colors.reset}`);
    console.log(`${colors.cyan}   Using Subprotocol Authentication (Browser-Compatible)${colors.reset}\n`);
    
    // Load from environment or prompt for configuration
    await promptConfig();
    
    // Validate config
    if (!config.accountId || !config.gatewayId || !config.openaiKey) {
        logError('Missing required configuration');
        process.exit(1);
    }
    
    console.log('');
    logInfo('Configuration Summary:');
    logInfo(`  Account ID: ${config.accountId}`);
    logInfo(`  Gateway ID: ${config.gatewayId}`);
    logInfo(`  Model: ${config.model}`);
    logInfo(`  OpenAI Key: ${config.openaiKey ? '✓ Configured' : '✗ Missing'}`);
    logInfo(`  CF Auth Token: ${config.cfAuthToken ? '✓ Configured' : '✗ Not provided'}`);
    console.log('');
    
    const tester = new GatewayTester(config);
    
    try {
        // Connect to the gateway
        await tester.connect();
        
        // Start interactive mode
        await tester.startInteractive();
        
    } catch (error) {
        logError(`Connection failed: ${error.message}`);
        
        console.log('');
        logWarning('Troubleshooting tips:');
        logWarning('1. Verify your Cloudflare Account ID and Gateway ID');
        logWarning('2. Check that your OpenAI API key is valid');
        logWarning('3. Ensure your Gateway is configured to accept WebSocket connections');
        logWarning('4. Note: Subprotocol authentication may not be supported by Cloudflare Gateway');
        logWarning('5. Consider using a relay server for production use');
        
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    logInfo('\nShutting down gracefully...');
    process.exit(0);
});

// Run main function
main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
});