// Realtime Voice Chat Implementation using OpenAI Realtime API via Cloudflare AI Gateway
// This version uses the openai-realtime-api library to connect through Cloudflare Gateway

import { RealtimeClient } from 'openai-realtime-api';
import { configManager, initializeConfigUI } from './config.js';

class RealtimeGatewayManager {
    constructor() {
        this.client = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyser = null;
        this.isConnected = false;
        this.isRecording = false;
        this.audioQueue = [];
        this.isPlaying = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeAudioContext();
        
        // Initialize config UI
        initializeConfigUI();
    }

    initializeElements() {
        // Connection elements
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.connectionIndicator = document.getElementById('connectionIndicator');
        this.connectionText = document.getElementById('connectionText');
        
        // Audio elements
        this.startRecordingBtn = document.getElementById('startRecording');
        this.stopRecordingBtn = document.getElementById('stopRecording');
        this.visualizerCanvas = document.getElementById('visualizer');
        this.canvasContext = this.visualizerCanvas.getContext('2d');
        
        // Text elements
        this.textInput = document.getElementById('textInput');
        this.sendTextBtn = document.getElementById('sendText');
        
        // Messages and debug
        this.conversationMessages = document.getElementById('conversationMessages');
        this.clearLogBtn = document.getElementById('clearLog');
        this.debugInfo = document.getElementById('debugInfo');
    }

    attachEventListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        
        this.startRecordingBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordingBtn.addEventListener('click', () => this.stopRecording());
        
        this.sendTextBtn.addEventListener('click', () => this.sendTextMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });
        
        this.clearLogBtn.addEventListener('click', () => this.clearConversation());
    }

    async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            this.updateDebug('Audio initialization failed: ' + error.message);
        }
    }

    async connect() {
        try {
            // Validate configuration
            const validation = configManager.validateConfig();
            if (!validation.valid) {
                this.addMessage('system', `Configuration errors: ${validation.errors.join(', ')}`);
                return;
            }

            this.updateConnectionStatus('connecting');
            this.updateDebug('Connecting to OpenAI via Cloudflare AI Gateway...');

            const config = configManager.getConfig();
            
            // Build Cloudflare Gateway WebSocket URL
            // Note: Using wss:// for WebSocket, not https://
            const baseUrl = `wss://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/openai`;
            
            // Add model as query parameter as shown in Cloudflare docs
            const gatewayUrl = `${baseUrl}?model=${config.model || 'gpt-4o-mini-realtime-preview'}`;
            
            this.updateDebug(`Gateway URL: ${gatewayUrl}`);
            
            // Create RealtimeClient instance with Gateway URL
            this.client = new RealtimeClient({
                url: gatewayUrl,
                apiKey: config.openaiKey,
                dangerouslyAllowAPIKeyInBrowser: true,
                sessionConfig: {
                    modalities: ['text', 'audio'],
                    instructions: 'You are a helpful assistant. Respond naturally in conversation.',
                    voice: config.voice || 'alloy',
                    input_audio_format: 'webm-opus',
                    output_audio_format: 'pcm16',
                    input_audio_transcription: {
                        model: 'whisper-1'
                    },
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500
                    },
                    temperature: 0.8,
                    max_response_output_tokens: 4096
                },
                debug: true
            });
            
            // Set up event listeners before connecting
            this.setupClientEventListeners();
            
            // Connect to the API through Gateway
            await this.client.connect();
            
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.updateDebug('Connected to OpenAI Realtime API via Cloudflare Gateway');
            this.addMessage('system', 'Connected to OpenAI via Cloudflare AI Gateway');
            
            // Enable controls
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.startRecordingBtn.disabled = false;
            this.textInput.disabled = false;
            this.sendTextBtn.disabled = false;

        } catch (error) {
            console.error('Connection error:', error);
            this.updateDebug('Connection failed: ' + error.message);
            this.updateConnectionStatus('disconnected');
            this.addMessage('error', 'Failed to connect: ' + error.message);
        }
    }

    setupClientEventListeners() {
        if (!this.client) return;
        console.log('Setting up event listeners...');

        // Main conversation update event
        this.client.on('conversation.updated', (event) => {
            console.log('Conversation updated', event);
            
            // Get the latest conversation items
            const items = this.client.conversation.getItems();
            
            // Check if this is a new item we haven't displayed yet
            if (event.item) {
                const { item } = event;
                
                // Handle assistant messages
                if (item.role === 'assistant' && item.formatted) {
                    if (item.formatted.text) {
                        this.updateOrAddMessage('assistant', item.formatted.text, item.id);
                    }
                    if (item.formatted.transcript) {
                        this.updateDebug(`Assistant transcript: ${item.formatted.transcript}`);
                    }
                }
                
                // Handle user messages
                if (item.role === 'user' && item.formatted) {
                    if (item.formatted.text) {
                        this.updateOrAddMessage('user', item.formatted.text, item.id);
                    }
                    if (item.formatted.transcript) {
                        this.updateDebug(`User transcript: ${item.formatted.transcript}`);
                    }
                }
            }
            
            // Handle delta updates (streaming text)
            if (event.delta) {
                this.handleDeltaUpdate(event.delta);
            }
        });

        // Handle conversation interruptions
        this.client.on('conversation.interrupted', () => {
            console.log('Conversation interrupted');
            this.addMessage('system', 'Response interrupted');
            this.updateDebug('Conversation interrupted');
        });

        // Handle item appended events
        this.client.on('conversation.item.appended', (event) => {
            console.log('Item appended', event);
            if (event.item) {
                this.updateDebug(`New item: ${event.item.type} from ${event.item.role}`);
            }
        });

        // Handle item completed events
        this.client.on('conversation.item.completed', (event) => {
            console.log('Item completed', event);
            if (event.item) {
                this.updateDebug(`Item completed: ${event.item.type}`);
            }
        });

        // Error handling
        this.client.on('error', (error) => {
            console.error('Client error:', error);
            const errorMessage = error.message || error.error?.message || JSON.stringify(error);
            this.addMessage('error', `Error: ${errorMessage}`);
            this.updateDebug(`Error: ${errorMessage}`);
        });

        // Optional: Log all events for debugging
        const config = configManager.getConfig();
        if (config.debug) {
            this.client.realtime.on('server.*', (event) => {
                console.log('Server event:', event.type, event);
            });
            
            this.client.realtime.on('client.*', (event) => {
                console.log('Client event:', event.type, event);
            });
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
        }
        
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.updateDebug('Disconnected from Cloudflare Gateway');
        this.addMessage('system', 'Disconnected from server');
        
        // Disable controls
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
        this.startRecordingBtn.disabled = true;
        this.stopRecordingBtn.disabled = true;
        this.textInput.disabled = true;
        this.sendTextBtn.disabled = true;
        
        // Clean up recording if active
        if (this.isRecording) {
            this.stopRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create media recorder with opus codec
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? 'audio/webm;codecs=opus' 
                : 'audio/webm';
                
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    this.sendAudioChunk(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                this.isRecording = false;
                this.startRecordingBtn.disabled = false;
                this.stopRecordingBtn.disabled = true;
                
                // Commit audio buffer
                if (this.client) {
                    this.client.createResponse();
                }
                
                this.updateDebug('Recording stopped and committed');
            };
            
            // Start recording with 100ms chunks
            this.mediaRecorder.start(100);
            this.isRecording = true;
            
            this.startRecordingBtn.disabled = true;
            this.stopRecordingBtn.disabled = false;
            
            this.addMessage('system', 'Recording started...');
            this.updateDebug('Recording audio...');
            
            // Start visualizer
            this.startVisualizer(stream);
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.addMessage('error', 'Failed to access microphone: ' + error.message);
            this.updateDebug('Recording error: ' + error.message);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.addMessage('system', 'Recording stopped');
        }
    }

    async sendAudioChunk(audioBlob) {
        if (!this.isConnected || !this.client) return;
        
        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Audio = reader.result.split(',')[1];
                
                // Use the library's method to append audio
                this.client.appendInputAudio(base64Audio);
                this.updateDebug('Sent audio chunk');
            };
            reader.readAsDataURL(audioBlob);
        } catch (error) {
            console.error('Failed to send audio chunk:', error);
            this.updateDebug('Audio send error: ' + error.message);
        }
    }

    async sendTextMessage() {
        const text = this.textInput.value.trim();
        if (!text || !this.isConnected || !this.client) return;
        
        try {
            // Clear input immediately
            this.textInput.value = '';
            
            // Add user message to UI
            this.addMessage('user', text);
            
            // Send message using the library's method
            this.client.sendUserMessageContent([{
                type: 'input_text',
                text: text
            }]);
            
            this.updateDebug('Sent text message, waiting for response...');
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.addMessage('error', 'Failed to send message: ' + error.message);
        }
    }

    startVisualizer(stream) {
        if (!this.audioContext || !this.analyser) return;
        
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        
        const draw = () => {
            if (!this.isRecording) {
                // Clear visualizer when not recording
                this.canvasContext.fillStyle = '#1f2937';
                this.canvasContext.fillRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
                return;
            }
            
            requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(this.dataArray);
            
            this.canvasContext.fillStyle = '#1f2937';
            this.canvasContext.fillRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
            
            const barWidth = (this.visualizerCanvas.width / this.bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < this.bufferLength; i++) {
                barHeight = this.dataArray[i] / 2;
                
                // Use Cloudflare orange color for gateway connection
                this.canvasContext.fillStyle = `rgb(248, ${113 + barHeight}, 113)`;
                this.canvasContext.fillRect(x, this.visualizerCanvas.height - barHeight / 2, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }

    addMessage(type, content, id = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        if (id) {
            messageDiv.dataset.messageId = id;
        }
        
        const messageContent = document.createElement('p');
        messageContent.textContent = content;
        messageDiv.appendChild(messageContent);
        
        this.conversationMessages.appendChild(messageDiv);
        this.conversationMessages.scrollTop = this.conversationMessages.scrollHeight;
    }
    
    updateOrAddMessage(type, content, id) {
        // Check if message with this ID already exists
        const existingMessage = this.conversationMessages.querySelector(`[data-message-id="${id}"]`);
        
        if (existingMessage) {
            // Update existing message
            const messageContent = existingMessage.querySelector('p');
            messageContent.textContent = content;
        } else {
            // Add new message
            this.addMessage(type, content, id);
        }
    }
    
    handleDeltaUpdate(delta) {
        // Handle streaming text updates
        if (delta && typeof delta === 'string') {
            // Find the last assistant message and update it
            const messages = this.conversationMessages.querySelectorAll('.message.assistant');
            const lastAssistantMessage = messages[messages.length - 1];
            
            if (lastAssistantMessage) {
                const messageContent = lastAssistantMessage.querySelector('p');
                messageContent.textContent += delta;
            } else {
                // Create new assistant message if none exists
                this.addMessage('assistant', delta);
            }
        }
    }

    clearConversation() {
        this.conversationMessages.innerHTML = '<div class="message system"><p>Conversation cleared</p></div>';
        this.audioQueue = [];
        this.updateDebug('Conversation cleared');
    }

    updateConnectionStatus(status) {
        this.connectionIndicator.className = `status-badge ${status}`;
        this.connectionText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }

    updateDebug(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.debugInfo.textContent = `[${timestamp}] ${message}\n${this.debugInfo.textContent}`.substring(0, 1000);
    }
}

// Initialize manager when page loads
let realtimeManager;

document.addEventListener('DOMContentLoaded', () => {
    realtimeManager = new RealtimeGatewayManager();
});