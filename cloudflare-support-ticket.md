# Cloudflare Support Ticket: BYOK Not Working with OpenAI Realtime API WebSocket Connections

## Ticket Details

**Subject:** BYOK Configuration Not Applied to OpenAI Realtime API WebSocket Connections

**Priority:** High

**Product:** Cloudflare AI Gateway

**Category:** Bug Report / Configuration Issue

## Executive Summary

We have discovered that BYOK (Bring Your Own Keys) configuration is not being applied when connecting to OpenAI's Realtime API via WebSocket through Cloudflare AI Gateway. Despite having BYOK properly configured and Authenticated Gateway enabled, the Gateway still requires the OpenAI API key to be passed explicitly in the WebSocket connection, which defeats the primary security purpose of BYOK.

## Issue Description

### Current Setup
- **Cloudflare Account ID:** YOUR_ACCOUNT_ID
- **Gateway ID:** YOUR_GATEWAY_ID
- **BYOK Status:** Configured for OpenAI
- **Authenticated Gateway:** Enabled with valid auth token
- **Target API:** OpenAI Realtime API (WebSocket-based)
- **Model:** gpt-4o-mini-realtime-preview

### Expected Behavior
With BYOK configured, the Cloudflare AI Gateway should:
1. Accept connections authenticated only with the cf-aig-authorization token
2. Automatically inject the stored OpenAI API key from BYOK configuration
3. Forward the request to OpenAI with proper authentication
4. Eliminate the need to expose API keys in client code

### Actual Behavior
The Gateway returns the following error when attempting to connect without explicitly passing the OpenAI API key:
```json
{
  "type": "error",
  "error": {
    "message": "Missing bearer or basic authentication in header"
  }
}
```

The connection only succeeds when the OpenAI API key is explicitly passed via WebSocket subprotocol, even though BYOK is configured.

## Reproduction Steps

### Step 1: Configure BYOK
1. Navigate to Cloudflare AI Gateway dashboard
2. Configure BYOK for OpenAI with valid API key
3. Enable Authenticated Gateway
4. Generate and save cf-aig-authorization token

### Step 2: Test Connection (Fails)
Run the following Node.js test script that SHOULD work with BYOK:

```javascript
#!/usr/bin/env node
import WebSocket from 'ws';

const config = {
    accountId: 'xxxxx',
    gatewayId: 'aaaaa',
    cfAuthToken: 'xxxxxxx', // Valid auth token
    model: 'gpt-4o-mini-realtime-preview'
};

// This SHOULD work with BYOK but doesn't
const url = `wss://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/openai?model=${config.model}`;

const protocols = [
    'realtime',
    `cf-aig-authorization.${config.cfAuthToken}`, // Authenticated Gateway token
    'openai-beta.realtime-v1'
];

console.log('Attempting connection with BYOK (should work but fails)...');
console.log('URL:', url);
console.log('Protocols:', protocols.map(p => p.includes('authorization') ? p.substring(0, 30) + '...' : p));

const ws = new WebSocket(url, protocols);

ws.on('open', () => {
    console.log('✅ Connected successfully!');
    
    // Send test message
    const testMessage = {
        type: 'response.create',
        response: {
            modalities: ['text'],
            instructions: 'Say "Hello! BYOK test successful!"'
        }
    };
    
    ws.send(JSON.stringify(testMessage));
    console.log('📤 Test message sent');
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', message.type);
    
    if (message.type === 'error') {
        console.error('❌ Error:', message.error?.message || JSON.stringify(message.error));
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed: Code ${code}, Reason: ${reason || 'No reason provided'}`);
});
```

### Step 3: Current Workaround (Works but insecure)
The connection only works when explicitly passing the OpenAI API key:

```javascript
// This works but defeats the purpose of BYOK
const protocols = [
    'realtime',
    `openai-insecure-api-key.${openaiApiKey}`, // Should NOT be needed with BYOK!
    `cf-aig-authorization.${config.cfAuthToken}`,
    'openai-beta.realtime-v1'
];
```

## Test Results

### Test 1: BYOK Only (FAILS)
```
Connection attempt with cf-aig-authorization only
Result: Error - "Missing bearer or basic authentication in header"
Close code: 4001 (Unauthorized)
```

### Test 2: Explicit API Key (WORKS)
```
Connection attempt with openai-insecure-api-key subprotocol
Result: Success - Session created
Issue: API key exposed in client code
```

## Technical Analysis

### Root Cause Hypothesis
The BYOK implementation appears to be designed for HTTP/REST API calls where headers can be modified server-side. However, for WebSocket connections:

1. The initial HTTP upgrade request is handled differently
2. BYOK key injection may not be triggered for WebSocket upgrade requests
3. The Gateway may not be intercepting WebSocket subprotocols to inject stored keys

### WebSocket vs REST API Differences
- **REST API:** Gateway can modify headers before forwarding to OpenAI ✅
- **WebSocket:** Gateway may not be processing subprotocols for BYOK injection ❌

## Business Impact

### Security Implications
1. **API Key Exposure:** Developers must include API keys in client code
2. **BYOK Purpose Defeated:** Cannot leverage centralized key management
3. **Compliance Risk:** Sensitive keys exposed in browser/client applications

### Developer Experience
1. **Inconsistent Behavior:** BYOK works for REST but not WebSocket
2. **Additional Complexity:** Requires proxy servers or key exposure
3. **Documentation Gap:** No clear guidance for Realtime API with BYOK

## Requested Resolution

### Immediate Needs
1. **Confirmation:** Is this a known limitation or a bug?
2. **Workaround:** Official recommended approach for secure WebSocket connections
3. **Timeline:** When can BYOK support for WebSocket be expected?

### Long-term Solution
Implement BYOK support for WebSocket connections by:
1. Intercepting WebSocket upgrade requests
2. Injecting stored API keys from BYOK configuration
3. Supporting both REST and WebSocket protocols uniformly

## Additional Information

### Environment Details
- **Node.js Version:** v18.17.0
- **WebSocket Library:** ws@8.14.2
- **Test Date:** 2025-08-29
- **Gateway Region:** Global

### Related Documentation
- [Cloudflare AI Gateway Docs](https://developers.cloudflare.com/ai-gateway/)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- WebSocket subprotocol authentication patterns

### Attachments
1. Complete test script (test-gateway-node.js)
2. Network traces showing authentication failures
3. BYOK configuration screenshots (if needed)

## Contact Information
[Your contact details]

---

**Note:** We are actively building a production application that relies on Cloudflare AI Gateway's security features. This issue is blocking our ability to securely deploy real-time AI features to our users. Any guidance or timeline for resolution would be greatly appreciated.

Thank you for your attention to this matter.