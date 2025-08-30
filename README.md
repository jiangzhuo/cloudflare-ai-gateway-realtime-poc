# Cloudflare AI Gateway + OpenAI Integration POC

## ⚠️ CRITICAL BUG NOTICE - BYOK WebSocket Authentication Issue

**This repository exists to reproduce and demonstrate a critical bug in Cloudflare AI Gateway's WebSocket implementation:**

### 🐛 The Bug:
- **HTTP Endpoints (Chat Completions)**: ✅ BYOK works correctly - you can pass your OpenAI API key via the `Authorization: Bearer` header
- **WebSocket Endpoints (Realtime API)**: ❌ BYOK is broken - the `Authorization` header is ignored, and you MUST use the deprecated `openai-insecure-api-key` subprotocol

### 📝 Current Status:
- **Workaround Required**: For WebSocket connections, you must expose your API key in the subprotocol as `openai-insecure-api-key.{YOUR_API_KEY}`
- **Security Risk**: This forces the API key to be visible in browser developer tools and network logs
- **Inconsistent Behavior**: The same BYOK authentication method works differently between HTTP and WebSocket protocols

### 🔍 Test Files:
- `test-chat-completion.js` - Demonstrates BYOK working correctly with HTTP endpoints
- `test-gateway-node.js` - Demonstrates the WebSocket bug requiring insecure API key transmission

---

A proof of concept demonstrating how to use Cloudflare AI Gateway with OpenAI's APIs for both text-based chat and real-time voice conversations. Built with Vite and modern ES modules.

## Features

- ✅ **Text Chat**: Traditional text-based conversation using OpenAI's Chat Completions API
- ✅ **Voice Chat (via Gateway)**: Real-time voice conversation through Cloudflare AI Gateway
- ✅ **Voice Chat (Direct)**: Direct connection to OpenAI's Realtime API using `openai-realtime-api` library
- ✅ **Cloudflare AI Gateway Integration**: Route requests through Cloudflare for analytics, caching, and control
- ✅ **BYOK Support**: Bring Your Own Key - use your own OpenAI API key
- ✅ **Authenticated Gateway**: Optional authentication for secure gateway access
- ✅ **Modern Development**: Powered by Vite with ES modules and hot module replacement

## Prerequisites

- Node.js (v16 or higher)
- Cloudflare account with AI Gateway configured
- OpenAI API key
- Modern web browser with WebSocket and MediaRecorder support

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd cloudflare-ai-gateway-realtime-poc
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Cloudflare AI Gateway

1. Log into your [Cloudflare dashboard](https://dash.cloudflare.com)
2. Navigate to **AI > AI Gateway**
3. Create a new gateway or use an existing one
4. Note your **Account ID** and **Gateway ID**

### 4. Start the Development Server

```bash
npm run dev
```

The Vite development server will start on `http://localhost:3000` with hot module replacement.

### 5. Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` directory.

### 6. Preview Production Build

```bash
npm run preview
```

## Usage

### Text Chat

1. Navigate to `http://localhost:3000`
2. Click on **Text Chat**
3. Enter your configuration:
   - Cloudflare Account ID
   - Gateway ID
   - OpenAI API Key
   - (Optional) CF AI Gateway Auth Token
4. Select your preferred model
5. Start chatting!

### Voice Chat (Realtime API)

1. Navigate to `http://localhost:3000`
2. Click on **Voice Chat**
3. Enter your configuration (same as above)
4. Click **Connect** to establish WebSocket connection
5. Use either:
   - **Voice**: Click "Start Recording" to speak
   - **Text**: Type messages in the text input field

## Configuration Options

### BYOK (Bring Your Own Key)

You can use your own OpenAI API key by entering it in the configuration panel. The key is stored in browser localStorage for convenience.

### Authenticated Gateway

If you've enabled authentication on your Cloudflare AI Gateway:

1. Generate an auth token in the Cloudflare dashboard
2. Enter the token in the "CF AI Gateway Auth Token" field
3. Check "Use Authenticated Gateway"

## Architecture

```
Browser Client (Vite)
     ↓
Cloudflare AI Gateway (Optional)
     ↓
OpenAI API

Components:
- Vite Dev Server: Modern development with HMR
- Text Chat: Uses fetch API with Cloudflare Gateway endpoint
- Voice Chat (Gateway): WebSocket connection through Cloudflare Gateway
- Voice Chat (Direct): Uses openai-realtime-api library for direct connection
- Configuration Manager: ES module for API keys and settings
```

## Project Structure

```
cloudflare-ai-gateway-realtime-poc/
├── index.html              # Main entry point
├── src/
│   ├── main.js            # Application entry
│   ├── css/
│   │   └── styles.css     # Global styles
│   ├── js/
│   │   ├── config.js      # Configuration manager (ESM)
│   │   ├── chat.js        # Text chat implementation
│   │   ├── realtime.js    # Voice chat via Gateway
│   │   └── realtime-direct.js  # Direct voice chat with library
│   └── pages/
│       ├── chat.html      # Text chat page
│       ├── realtime.html  # Voice chat via Gateway
│       └── realtime-direct.html  # Direct voice chat
├── vite.config.js         # Vite configuration
└── package.json           # Dependencies and scripts
```

## API Endpoints

### Text Chat
- Endpoint: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions`
- Method: POST
- Headers:
  - `Authorization: Bearer {openai_key}`
  - `cf-aig-authorization: Bearer {cf_token}` (if authenticated)

### Realtime Voice Chat
- Endpoint: `wss://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/realtime`
- Protocol: WebSocket
- Authentication: Via subprotocols or headers

## Security Considerations

⚠️ **Important Security Notes:**

1. **API Keys in Browser**: This POC stores API keys in browser localStorage for demonstration purposes. In production:
   - Use server-side proxy to keep API keys secure
   - Implement proper authentication and authorization
   - Never expose API keys in client-side code

2. **CORS**: The Cloudflare AI Gateway handles CORS, but ensure your gateway settings are configured appropriately

3. **Rate Limiting**: Configure rate limits in Cloudflare AI Gateway to prevent abuse

## Troubleshooting

### Connection Issues

- Verify your Cloudflare Account ID and Gateway ID are correct
- Check that your OpenAI API key is valid
- Ensure your Cloudflare AI Gateway is properly configured

### Voice Chat Issues

- Make sure your browser supports WebSocket and MediaRecorder APIs
- Grant microphone permissions when prompted
- Check browser console for detailed error messages

### Authentication Errors

- If using authenticated gateway, ensure your auth token is valid
- Check that the token is properly formatted (with "Bearer " prefix if required)

## Development

### Project Structure

```
├── public/
│   ├── index.html          # Main navigation page
│   ├── chat.html           # Text chat interface
│   ├── realtime.html       # Voice chat interface
│   ├── css/
│   │   └── styles.css      # Styling
│   └── js/
│       ├── config.js       # Configuration management
│       ├── chat.js         # Text chat logic
│       └── realtime.js     # Voice chat logic
├── server.js               # Express server
├── package.json
└── README.md
```

### Adding Features

To extend this POC:

1. **Server-Side Proxy**: Implement server-side API calls for better security
2. **User Authentication**: Add proper user authentication system
3. **Message History**: Store conversation history in a database
4. **Audio Processing**: Add better audio encoding/decoding for voice chat
5. **UI Improvements**: Enhance the user interface with a modern framework

## Resources

- [Cloudflare AI Gateway Documentation](https://developers.cloudflare.com/ai-gateway/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Realtime API Guide](https://platform.openai.com/docs/guides/realtime)
- [Cloudflare WebSocket API Guide](https://developers.cloudflare.com/ai-gateway/usage/websockets-api/)

## License

MIT

## Disclaimer

This is a proof of concept for demonstration purposes. Do not use in production without implementing proper security measures.