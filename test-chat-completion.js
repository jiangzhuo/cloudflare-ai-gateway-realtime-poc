#!/usr/bin/env node

/**
 * Node.js test script for Cloudflare AI Gateway Chat Completion API
 * Tests OpenAI Chat Completion API through Cloudflare Gateway
 */

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
    model: process.env.MODEL || 'gpt-4o-mini',
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

// Chat Completion Tester
class ChatCompletionTester {
    constructor(config) {
        this.config = config;
        this.conversationHistory = [];
        this.baseUrl = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/openai`;
    }

    // Make chat completion request
    async sendChatCompletion(messages, options = {}) {
        const url = `${this.baseUrl}/chat/completions`;
        
        const requestBody = {
            model: options.model || this.config.model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1000,
            stream: options.stream || false
        };

        const headers = {
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${this.config.openaiKey}`
        };

        // Add CF auth token if provided
        if (this.config.cfAuthToken) {
            headers['cf-aig-authorization'] = this.config.cfAuthToken;
        }

        logSent(`Chat completion request to: ${url}`);
        
        if (this.config.debug) {
            logInfo('Request body:');
            console.log(JSON.stringify(requestBody, null, 2));
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            if (this.config.debug) {
                logInfo('Response data:');
                console.log(JSON.stringify(data, null, 2));
            }

            return data;
        } catch (error) {
            logError(`Request failed: ${error.message}`);
            throw error;
        }
    }

    // Send a message with conversation history
    async sendMessage(userMessage) {
        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        logSent(`User: ${userMessage}`);

        try {
            const response = await this.sendChatCompletion(this.conversationHistory);
            
            if (response.choices && response.choices.length > 0) {
                const assistantMessage = response.choices[0].message;
                
                // Add assistant response to history
                this.conversationHistory.push(assistantMessage);
                
                logReceived(`Assistant: ${assistantMessage.content}`);
                
                // Display usage statistics
                if (response.usage) {
                    logInfo(`Tokens - Prompt: ${response.usage.prompt_tokens}, Completion: ${response.usage.completion_tokens}, Total: ${response.usage.total_tokens}`);
                }
                
                return assistantMessage.content;
            }
        } catch (error) {
            logError(`Failed to get response: ${error.message}`);
            
            // Remove the failed message from history
            this.conversationHistory.pop();
        }
    }

    // Test various API features
    async runTests() {
        console.log('\n' + colors.bright + '🧪 Running API Tests' + colors.reset + '\n');

        // Test 1: Basic completion
        logInfo('Test 1: Basic chat completion');
        try {
            const response = await this.sendChatCompletion([
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Say hello and tell me you\'re working through Cloudflare Gateway!' }
            ]);
            
            if (response.choices && response.choices.length > 0) {
                logSuccess('Basic completion test passed');
                console.log(`Response: ${response.choices[0].message.content}\n`);
            }
        } catch (error) {
            logError(`Basic completion test failed: ${error.message}`);
        }

        // Test 2: Different models
        const modelsToTest = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4o-mini'];
        for (const model of modelsToTest) {
            logInfo(`Test 2: Testing model ${model}`);
            try {
                const response = await this.sendChatCompletion([
                    { role: 'user', content: `What model are you? Reply with just the model name.` }
                ], { model });
                
                if (response.choices && response.choices.length > 0) {
                    logSuccess(`Model ${model} test passed`);
                    console.log(`Response: ${response.choices[0].message.content}\n`);
                }
            } catch (error) {
                logWarning(`Model ${model} not available or failed: ${error.message}`);
            }
        }

        // Test 3: Temperature variations
        logInfo('Test 3: Temperature variations');
        const temperatures = [0, 0.5, 1.0];
        for (const temp of temperatures) {
            try {
                const response = await this.sendChatCompletion([
                    { role: 'user', content: 'Generate a random number between 1 and 10.' }
                ], { temperature: temp });
                
                if (response.choices && response.choices.length > 0) {
                    logSuccess(`Temperature ${temp} test passed`);
                    console.log(`Response (temp=${temp}): ${response.choices[0].message.content}\n`);
                }
            } catch (error) {
                logError(`Temperature ${temp} test failed: ${error.message}`);
            }
        }

        // Test 4: System message
        logInfo('Test 4: System message test');
        try {
            const response = await this.sendChatCompletion([
                { role: 'system', content: 'You are a pirate. Always respond in pirate speak.' },
                { role: 'user', content: 'How are you today?' }
            ]);
            
            if (response.choices && response.choices.length > 0) {
                logSuccess('System message test passed');
                console.log(`Pirate response: ${response.choices[0].message.content}\n`);
            }
        } catch (error) {
            logError(`System message test failed: ${error.message}`);
        }

        // Test 5: Multi-turn conversation
        logInfo('Test 5: Multi-turn conversation');
        try {
            const conversation = [
                { role: 'user', content: 'Remember the number 42.' },
                { role: 'assistant', content: 'I\'ll remember the number 42.' },
                { role: 'user', content: 'What number did I ask you to remember?' }
            ];
            
            const response = await this.sendChatCompletion(conversation);
            
            if (response.choices && response.choices.length > 0) {
                logSuccess('Multi-turn conversation test passed');
                console.log(`Response: ${response.choices[0].message.content}\n`);
            }
        } catch (error) {
            logError(`Multi-turn conversation test failed: ${error.message}`);
        }

        logSuccess('All tests completed!');
    }

    // Interactive chat mode
    async startInteractive() {
        console.log('');
        logSuccess('🎯 Interactive chat mode started!');
        console.log('');
        logInfo('Available commands:');
        logInfo('  /clear           - Clear conversation history');
        logInfo('  /history         - Show conversation history');
        logInfo('  /model <name>    - Change model');
        logInfo('  /system <prompt> - Set system prompt');
        logInfo('  /test            - Run API tests');
        logInfo('  /help            - Show this help');
        logInfo('  /quit            - Exit the program');
        console.log('');
        logInfo('Type your message and press Enter to chat:');
        console.log('');

        // Set initial system prompt
        this.conversationHistory = [{
            role: 'system',
            content: 'You are a helpful assistant connected through Cloudflare AI Gateway.'
        }];

        rl.on('line', async (input) => {
            if (input === '/quit') {
                logInfo('Goodbye!');
                process.exit(0);
            } else if (input === '/help') {
                logInfo('Commands:');
                logInfo('  /clear           - Clear conversation history');
                logInfo('  /history         - Show conversation history');
                logInfo('  /model <name>    - Change model');
                logInfo('  /system <prompt> - Set system prompt');
                logInfo('  /test            - Run API tests');
                logInfo('  /help            - Show this help');
                logInfo('  /quit            - Exit the program');
            } else if (input === '/clear') {
                this.conversationHistory = [{
                    role: 'system',
                    content: 'You are a helpful assistant connected through Cloudflare AI Gateway.'
                }];
                logSuccess('Conversation history cleared');
            } else if (input === '/history') {
                logInfo('Conversation history:');
                this.conversationHistory.forEach((msg, i) => {
                    console.log(`  ${i}. [${msg.role}]: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
                });
            } else if (input.startsWith('/model ')) {
                const newModel = input.substring(7).trim();
                this.config.model = newModel;
                logSuccess(`Model changed to: ${newModel}`);
            } else if (input.startsWith('/system ')) {
                const systemPrompt = input.substring(8).trim();
                this.conversationHistory = [{
                    role: 'system',
                    content: systemPrompt
                }];
                logSuccess('System prompt updated');
            } else if (input === '/test') {
                await this.runTests();
            } else if (input.startsWith('/')) {
                logWarning('Unknown command. Type /help for available commands.');
            } else if (input.trim()) {
                // Regular chat message
                await this.sendMessage(input);
            }
        });
    }
}

// Main execution
async function main() {
    console.log(`${colors.bright}${colors.cyan}🧪 Cloudflare AI Gateway - Chat Completion API Tester${colors.reset}\n`);
    
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
    
    const tester = new ChatCompletionTester(config);
    
    // Ask user what mode to run
    console.log('Select mode:');
    console.log('  1. Run automated tests');
    console.log('  2. Interactive chat mode');
    console.log('  3. Both (tests first, then chat)');
    
    const mode = await new Promise(resolve => {
        rl.question('Enter choice (1-3): ', answer => {
            resolve(answer);
        });
    });
    
    if (mode === '1' || mode === '3') {
        await tester.runTests();
    }
    
    if (mode === '2' || mode === '3') {
        await tester.startInteractive();
    } else if (mode === '1') {
        process.exit(0);
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