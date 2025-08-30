# Cloudflare AI Gateway + OpenAI Realtime API Bug Reproduction

## ⚠️ CRITICAL BUG: BYOK WebSocket Authentication Broken

**This repository demonstrates a critical bug in Cloudflare AI Gateway's WebSocket implementation where BYOK (Bring Your Own Key) authentication doesn't work properly.**

### 🐛 The Bug
| Protocol | BYOK Status | Authentication Method |
|----------|-------------|----------------------|
| **HTTP** (Chat Completions) | ✅ Working | `Authorization: Bearer` header |
| **WebSocket** (Realtime API) | ❌ Broken | Forced to use `openai-insecure-api-key` subprotocol |

### 🚨 Security Impact
- API keys exposed in browser DevTools and network logs
- Inconsistent authentication behavior between protocols
- Forces use of deprecated insecure authentication method

### 🧪 Test Scripts
- **`test-chat-completion.js`** - Demonstrates working BYOK with HTTP
- **`test-gateway-node.js`** - Demonstrates broken BYOK with WebSocket
- **`test-gateway.html`** - Browser-based WebSocket testing interface

---

## Quick Start

### Prerequisites
- Node.js v16+
- Cloudflare account with AI Gateway configured
- OpenAI API key

### Installation
```bash
# Clone repository
git clone <repository-url>
cd cloudflare-ai-gateway-realtime-poc

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### Configuration
1. Get your Cloudflare Account ID and Gateway ID from [Cloudflare Dashboard](https://dash.cloudflare.com) → AI → AI Gateway
2. Add your OpenAI API key to `.env`
3. (Optional) Add Cloudflare auth token for authenticated gateway

## Testing the Bug

### Test HTTP (Working)
```bash
node test-chat-completion.js
# Select option 1 for automated tests
# BYOK works correctly via Authorization header
```

### Test WebSocket (Broken)
```bash
node test-gateway-node.js
# Observe: Must use openai-insecure-api-key subprotocol
# Authorization header is ignored
```

### Browser Testing
1. Open `http://localhost:3000`
2. Navigate to Voice Chat
3. Check browser DevTools → Network → WS
4. See API key exposed in subprotocol

## Project Structure

```
├── test-chat-completion.js  # HTTP endpoint test (BYOK works)
├── test-gateway-node.js     # WebSocket test (BYOK broken)
├── test-gateway.html        # Browser WebSocket test
├── src/                     # Vite application
│   ├── js/
│   │   ├── chat.js         # Text chat (HTTP)
│   │   ├── realtime.js     # Voice chat (WebSocket)
│   │   └── config.js       # Configuration manager
│   └── pages/              # UI pages
├── .env.example            # Environment template
└── cloudflare-support-ticket.md  # Bug report details
```

## API Endpoints

### HTTP Chat Completions (BYOK ✅)
```
POST https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions
Authorization: Bearer {openai_key}
```

### WebSocket Realtime (BYOK ❌)
```
wss://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/realtime
Subprotocol: openai-insecure-api-key.{openai_key}  # Forced insecure method
```

## Development

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Features
- **Text Chat**: HTTP-based chat using Chat Completions API
- **Voice Chat**: WebSocket-based realtime voice conversations
- **Direct Mode**: Bypass gateway for direct OpenAI connection
- **Vite Development**: Hot module replacement and ES modules

## Security Notes

⚠️ **This POC intentionally demonstrates the security issue:**
- API keys are stored in localStorage for testing
- Never use this approach in production
- The bug forces insecure API key transmission in WebSocket connections

## Troubleshooting

### WebSocket Connection Fails
- Check if API key is included in subprotocol (required due to bug)
- Verify gateway configuration in Cloudflare dashboard
- Check browser console for detailed errors

### Authentication Issues
- HTTP: Ensure Authorization header is set correctly
- WebSocket: Must use subprotocol due to bug

## Resources

- [Cloudflare AI Gateway Docs](https://developers.cloudflare.com/ai-gateway/)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Bug Report Template](./cloudflare-support-ticket.md)

## License

MIT

## Disclaimer

This repository exists solely to demonstrate and reproduce the BYOK WebSocket authentication bug in Cloudflare AI Gateway. Do not use in production.