// Direct OpenAI Realtime API implementation using openai-realtime-api library
// This version connects directly to OpenAI without going through Cloudflare AI Gateway

import { RealtimeClient } from 'openai-realtime-api';

class DirectRealtimeManager {
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
        this.config = this.loadConfig();
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeAudioContext();
    }

    loadConfig() {
        const saved = localStorage.getItem('openai_direct_config');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved config:', e);
            }
        }
        return {
            openaiKey: '',
            model: 'gpt-4o-mini-realtime-preview',
            voice: 'alloy',
            debug: false
        };
    }

    saveConfig(updates) {
        this.config = { ...this.config, ...updates };
        localStorage.setItem('openai_direct_config', JSON.stringify(this.config));
        return this.config;
    }

    initializeElements() {
        // Configuration elements
        this.openaiKeyInput = document.getElementById('openaiKey');
        this.modelSelect = document.getElementById('model');
        this.voiceSelect = document.getElementById('voice');
        this.saveConfigBtn = document.getElementById('saveConfig');
        this.configStatus = document.getElementById('configStatus');
        
        // Connection elements
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.connectionIndicator = document.getElementById('connectionIndicator');
        this.connectionText = document.getElementById('connectionText');
        
        // Audio elements
        this.startRecordingBtn = document.getElementById('startRecording');
        this.stopRecordingBtn = document.getElementById('stopRecording');
        this.pushToTalkBtn = document.getElementById('pushToTalk');
        this.visualizerCanvas = document.getElementById('visualizer');
        this.canvasContext = this.visualizerCanvas.getContext('2d');
        
        // Text elements
        this.textInput = document.getElementById('textInput');
        this.sendTextBtn = document.getElementById('sendText');
        
        // Messages and debug
        this.conversationMessages = document.getElementById('conversationMessages');
        this.clearLogBtn = document.getElementById('clearLog');
        this.debugInfo = document.getElementById('debugInfo');
        
        // Load saved config into UI
        if (this.config.openaiKey) {
            this.openaiKeyInput.value = this.config.openaiKey;
        }
        this.modelSelect.value = this.config.model;
        this.voiceSelect.value = this.config.voice;
    }

    attachEventListeners() {
        // Config save
        this.saveConfigBtn.addEventListener('click', () => {
            const config = {
                openaiKey: this.openaiKeyInput.value.trim(),
                model: this.modelSelect.value,
                voice: this.voiceSelect.value
            };
            
            if (!config.openaiKey) {
                this.showConfigStatus('OpenAI API Key is required', 'error');
                return;
            }
            
            this.saveConfig(config);
            this.showConfigStatus('Configuration saved!', 'success');
        });
        
        // Connection
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        
        // Audio recording
        this.startRecordingBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordingBtn.addEventListener('click', () => this.stopRecording());
        
        // Push to talk
        let isPTTActive = false;
        this.pushToTalkBtn.addEventListener('mousedown', () => {
            if (!this.isConnected || isPTTActive) return;
            isPTTActive = true;
            this.startRecording();
        });
        
        this.pushToTalkBtn.addEventListener('mouseup', () => {
            if (!isPTTActive) return;
            isPTTActive = false;
            this.stopRecording();
        });
        
        this.pushToTalkBtn.addEventListener('mouseleave', () => {
            if (!isPTTActive) return;
            isPTTActive = false;
            this.stopRecording();
        });
        
        // Text input
        this.sendTextBtn.addEventListener('click', () => this.sendTextMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });
        
        // Clear log
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
            if (!this.config.openaiKey) {
                this.addMessage('error', 'Please configure your OpenAI API key first');
                return;
            }

            this.updateConnectionStatus('connecting');
            this.updateDebug('Connecting to OpenAI Realtime API using openai-realtime-api library...');

            // Create RealtimeClient instance with session configuration
            this.client = new RealtimeClient({
                apiKey: this.config.openaiKey,
                dangerouslyAllowAPIKeyInBrowser: true,
                // Set session configuration during initialization
                sessionConfig: {
                    modalities: ['text', 'audio'],
                    instructions: 'You are a helpful assistant. Respond naturally in conversation.',
                    voice: this.config.voice || 'alloy',
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
                }
            });

            // Set up event listeners before connecting
            this.setupClientEventListeners();

            // Connect to the API
            await this.client.connect();

            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.updateDebug('Connected to OpenAI Realtime API');
            this.addMessage('system', 'Connected directly to OpenAI Realtime API');
            
            // Enable controls
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.startRecordingBtn.disabled = false;
            this.pushToTalkBtn.disabled = false;
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

        // Main conversation update event - this is the primary way to track conversation changes
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
                        // Update or add assistant message
                        this.updateOrAddMessage('assistant', item.formatted.text, item.id);
                    }
                    if (item.formatted.transcript) {
                        // Show transcript if available
                        this.updateDebug(`Assistant transcript: ${item.formatted.transcript}`);
                    }
                }
                
                // Handle user messages
                if (item.role === 'user' && item.formatted) {
                    if (item.formatted.text) {
                        // This handles transcribed user audio
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
        if (this.config.debug) {
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
        this.updateDebug('Disconnected from OpenAI Realtime API');
        this.addMessage('system', 'Disconnected from server');
        
        // Disable controls
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
        this.startRecordingBtn.disabled = true;
        this.stopRecordingBtn.disabled = true;
        this.pushToTalkBtn.disabled = true;
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
            
            // Optionally wait for the response to complete
            // const response = await this.client.waitForNextCompletedItem();
            // console.log('Response received:', response);
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.addMessage('error', 'Failed to send message: ' + error.message);
        }
    }

    handleAudioDelta(audioData) {
        // Audio data is base64 encoded PCM16
        this.audioQueue.push(audioData);
        this.playAudioQueue();
    }

    async playAudioQueue() {
        if (this.isPlaying || this.audioQueue.length === 0) return;
        
        this.isPlaying = true;
        
        while (this.audioQueue.length > 0) {
            const audioData = this.audioQueue.shift();
            // In a production implementation, you would:
            // 1. Decode the base64 string
            // 2. Convert PCM16 to Float32Array
            // 3. Play through Web Audio API
            console.log('Would play audio chunk');
        }
        
        this.isPlaying = false;
    }

    updateTranscript(role, text) {
        const messages = this.conversationMessages.querySelectorAll('.message');
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.classList.contains(role)) {
            lastMessage.querySelector('p').textContent += text;
        } else {
            this.addMessage(role, text);
        }
    }

    updateLastMessage(text) {
        const messages = this.conversationMessages.querySelectorAll('.message');
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.classList.contains('assistant')) {
            const p = lastMessage.querySelector('p');
            p.textContent = (p.textContent || '') + text;
        } else {
            this.addMessage('assistant', text);
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
                
                // Use green color for direct connection
                this.canvasContext.fillStyle = `rgb(34, ${197}, ${94})`;
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

    showConfigStatus(message, type) {
        this.configStatus.textContent = message;
        this.configStatus.className = `status-message ${type}`;
        
        setTimeout(() => {
            this.configStatus.textContent = '';
            this.configStatus.className = 'status-message';
        }, 3000);
    }
}

// Initialize when page loads
let directRealtimeManager;

document.addEventListener('DOMContentLoaded', () => {
    directRealtimeManager = new DirectRealtimeManager();
    
    // Add warning about browser API key usage
    console.warn(
        'Note: This implementation uses dangerouslyAllowAPIKeyInBrowser flag. ' +
        'For production use, implement a relay server to keep your API key secure.'
    );
});