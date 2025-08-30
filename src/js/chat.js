// Text Chat Implementation using OpenAI SDK via Cloudflare AI Gateway

import { configManager, initializeConfigUI } from './config.js';

class ChatManager {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.clearButton = document.getElementById('clearChat');
        this.statusElement = document.getElementById('status');
    }

    attachEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.clearButton.addEventListener('click', () => this.clearChat());
        
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isProcessing) return;

        // Validate configuration
        const validation = configManager.validateConfig();
        if (!validation.valid) {
            this.addMessage('system', `Configuration errors: ${validation.errors.join(', ')}`);
            return;
        }

        this.isProcessing = true;
        this.updateStatus('Sending message...');
        this.sendButton.disabled = true;

        // Add user message to chat
        this.addMessage('user', message);
        this.messages.push({ role: 'user', content: message });

        // Clear input
        this.messageInput.value = '';

        try {
            // Get configuration
            const config = configManager.getConfig();
            const baseURL = configManager.getCloudflareBaseUrl();
            const headers = configManager.getHeaders();

            // Make API call using fetch (since we're in browser)
            const response = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: config.model,
                    messages: this.messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorData}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices[0] && data.choices[0].message) {
                const assistantMessage = data.choices[0].message.content;
                this.addMessage('assistant', assistantMessage);
                this.messages.push({ role: 'assistant', content: assistantMessage });
                this.updateStatus('');
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage('system', `Error: ${error.message}`);
            this.updateStatus('Error occurred');
        } finally {
            this.isProcessing = false;
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const messageContent = document.createElement('p');
        messageContent.textContent = content;
        messageDiv.appendChild(messageContent);
        
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    clearChat() {
        this.messages = [];
        this.messagesContainer.innerHTML = '<div class="message system"><p>Chat cleared. Start a new conversation!</p></div>';
        this.updateStatus('Chat cleared');
        setTimeout(() => this.updateStatus(''), 2000);
    }

    updateStatus(message) {
        this.statusElement.textContent = message;
    }
}

// Alternative implementation using streaming if needed
class StreamingChatManager extends ChatManager {
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isProcessing) return;

        // Validate configuration
        const validation = configManager.validateConfig();
        if (!validation.valid) {
            this.addMessage('system', `Configuration errors: ${validation.errors.join(', ')}`);
            return;
        }

        this.isProcessing = true;
        this.updateStatus('Sending message...');
        this.sendButton.disabled = true;

        // Add user message to chat
        this.addMessage('user', message);
        this.messages.push({ role: 'user', content: message });

        // Clear input
        this.messageInput.value = '';

        try {
            const config = configManager.getConfig();
            const baseURL = configManager.getCloudflareBaseUrl();
            const headers = configManager.getHeaders();

            // Create streaming request
            const response = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: config.model,
                    messages: this.messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: true
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorData}`);
            }

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            // Create assistant message element
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            const messageContent = document.createElement('p');
            messageDiv.appendChild(messageContent);
            this.messagesContainer.appendChild(messageDiv);
            
            let fullContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                fullContent += content;
                                messageContent.textContent = fullContent;
                                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                            }
                        } catch (e) {
                            console.error('Failed to parse streaming data:', e);
                        }
                    }
                }
            }
            
            if (fullContent) {
                this.messages.push({ role: 'assistant', content: fullContent });
                this.updateStatus('');
            }

        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage('system', `Error: ${error.message}`);
            this.updateStatus('Error occurred');
        } finally {
            this.isProcessing = false;
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }
}

// Initialize chat manager when page loads
let chatManager;

document.addEventListener('DOMContentLoaded', () => {
    // Use streaming version if you want streaming responses
    // chatManager = new StreamingChatManager();
    
    // Use regular version for simpler implementation
    chatManager = new ChatManager();
});