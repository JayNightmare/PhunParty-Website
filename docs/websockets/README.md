# WebSocket Implementation & Troubleshooting Guide

This document provides comprehensive information about WebSocket implementation, fixes applied, and troubleshooting guidance for the PhunParty application.

## Table of Contents

1. [Production Issue Analysis](#production-issue-analysis)
2. [Root Causes & Fixes](#root-causes--fixes)
3. [Testing Tools](#testing-tools)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Deployment Instructions](#deployment-instructions)
6. [Monitoring & Maintenance](#monitoring--maintenance)

## Production Issue Analysis

Based on the production logs from Firefox showing WebSocket connection failures with session `8VIZHNC6R`, the main issues were:

1. **Error 1006 (Abnormal Closure)**: `Firefox can't establish a connection to the server at wss://api.phun.party/ws/session/8VIZHNC6R?client_type=web`
2. **HTTP 500 Errors**: Fallback API calls to `/game-logic/status/8VIZHNC6R` returning 500 errors
3. **Continuous Reconnection Loops**: Multiple failed attempts without proper fallback

### Error Code 1006 Details
Error code 1006 indicates "Abnormal Closure" which typically means:
- Connection closed without a close frame
- Network connectivity issues
- Server-side problems
- Proxy/firewall interference

## Root Causes & Fixes

### 1. API Key Header Mismatch ✅ **FIXED**
- **Problem**: Frontend was sending `x-api-key` header, but backend expects `X-API-Key`
- **Impact**: All API calls failing with authentication errors
- **Files affected**: `src/lib/api.ts`

**Changes made:**
```typescript
// Before
headers.set("x-api-key", API_KEY);

// After  
headers.set("X-API-Key", API_KEY);
```

### 2. Enhanced WebSocket Error Handling ✅ **FIXED**
- **Files modified**: `src/hooks/useWebSocket.ts`, `src/hooks/useGameUpdates.ts`

**Key improvements:**
- Detailed WebSocket close code logging with explanations
- Automatic WebSocket disabling after repeated failures
- Graceful fallback to HTTP polling
- Better connection state management

### 3. WebSocket Fallback Mechanism ✅ **IMPLEMENTED**
- **Files modified**: `src/hooks/useGameUpdates.ts`

**Features:**
- Automatically disables WebSocket after connection errors
- Falls back to HTTP polling (3-second intervals)
- Maintains user experience even without real-time updates
- Prevents infinite reconnection loops

### 4. Diagnostic Tools ✅ **CREATED**
**New files created:**
- `src/lib/diagnostics.ts` - WebSocket diagnostic utilities
- `src/components/WebSocketDiagnostics.tsx` - Development diagnostics UI
- `debug-websocket.html` - Standalone WebSocket test tool
- `test-production-websocket.sh` - Production testing script

## Testing Tools

### 1. WebSocket Debug Tool (`debug-websocket.html`)
A standalone HTML tool for testing WebSocket connections:

**Features:**
- Test WebSocket connections with different URLs
- Send/receive messages in real-time
- View detailed connection logs
- Decode WebSocket close codes
- Test multiple URL variations automatically

**Usage:**
1. Open `debug-websocket.html` in your browser
2. Enter session code (e.g., `8VIZHNC6R`)
3. Click "Connect" to test WebSocket connection
4. Use "Send Ping" or custom messages to test communication

### 2. Production Test Script (`test-production-websocket.sh`)
A comprehensive bash script that tests all aspects of the deployment:

**Tests performed:**
- API connectivity
- Environment variable validation
- DNS resolution
- Port connectivity
- WebSocket connections (if wscat available)

**Usage:**
```bash
# Make executable (if not already)
chmod +x test-production-websocket.sh

# Run tests
./test-production-websocket.sh
```

### 3. Development Diagnostics Panel
Automatically appears in ActiveQuiz page during development:

**Features:**
- Environment variable validation
- API connectivity testing
- Session status endpoint testing  
- WebSocket connection testing
- Detailed error reporting with solutions

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: WebSocket Connection Refused (Error 1006)
**Symptoms**: 
- `Firefox can't establish a connection to the server at wss://api.phun.party/ws/session/...`
- Close code 1006 (Abnormal Closure)

**Possible Causes:**
1. **Server not running WebSocket support**: Backend might not be configured for WebSocket connections
2. **Reverse proxy issues**: nginx/Apache might not handle WebSocket upgrades
3. **Firewall blocking WebSocket ports**: Corporate firewalls often block WebSocket connections
4. **SSL/TLS issues**: Mixed content or certificate problems

**Solutions:**
1. **Test WebSocket endpoint directly**:
   ```bash
   # Install wscat if not available
   npm install -g wscat
   
   # Test WebSocket connection
   wscat -c wss://api.phun.party/ws/session/TEST123?client_type=web
   ```

2. **Check nginx/Apache WebSocket configuration**:
   ```nginx
   # nginx configuration for WebSocket
   location /ws/ {
       proxy_pass http://backend;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_read_timeout 86400;
   }
   ```

3. **Verify SSL certificate**: Ensure certificate covers WebSocket connections

#### Issue 2: HTTP 500 Errors on API Calls
**Symptoms**:
- `XHRGET https://api.phun.party/game-logic/status/8VIZHNC6R [HTTP/1.1 500 0ms]`

**Possible Causes:**
1. **Missing or incorrect API key**
2. **Backend server errors**
3. **Database connection issues**
4. **Session not found**

**Solutions:**
1. **Verify API key configuration**:
   ```bash
   # Test API key with health endpoint
   curl -H "X-API-Key: YOUR_API_KEY" https://api.phun.party/health
   ```

2. **Test session endpoint**:
   ```bash
   curl -H "X-API-Key: YOUR_API_KEY" https://api.phun.party/game-logic/status/8VIZHNC6R
   ```

3. **Check backend logs** for specific error messages

#### Issue 3: Environment Variable Problems
**Symptoms**:
- API calls going to wrong URLs
- Missing API keys
- WebSocket connections to localhost in production

**Solutions:**
1. **Create proper `.env` file**:
   ```bash
   VITE_API_URL=https://api.phun.party
   VITE_API_KEY=your_actual_api_key_here
   VITE_WS_URL=wss://api.phun.party
   ```

2. **Verify environment variables are loaded**:
   ```javascript
   console.log('API URL:', import.meta.env.VITE_API_URL);
   console.log('API Key set:', !!import.meta.env.VITE_API_KEY);
   console.log('WS URL:', import.meta.env.VITE_WS_URL);
   ```

### Debugging Steps

#### Step 1: Environment Check
1. Verify `.env` file exists and has correct values
2. Check that `VITE_API_KEY` matches backend's expected key
3. Confirm `VITE_API_URL` points to correct backend

#### Step 2: API Connectivity Test
1. Test basic API connection: `curl https://api.phun.party/health`
2. Test with API key: `curl -H "X-API-Key: YOUR_KEY" https://api.phun.party/health`
3. Test session endpoint: `curl -H "X-API-Key: YOUR_KEY" https://api.phun.party/game-logic/status/YOUR_SESSION`

#### Step 3: WebSocket Test
1. Use the debug tool (`debug-websocket.html`) 
2. Try different protocols: `ws://` vs `wss://`
3. Test with/without query parameters
4. Check browser network tab for WebSocket connections

#### Step 4: Browser Dev Tools
1. Open Network tab and filter by "WS" to see WebSocket connections
2. Check Console for detailed error messages
3. Look for CORS errors or mixed content warnings

## Deployment Instructions

### 1. Environment Setup
Ensure your `.env` file contains:
```bash
VITE_API_URL=https://api.phun.party
VITE_API_KEY=your_actual_api_key_here
VITE_WS_URL=wss://api.phun.party
```

### 2. Testing Before Deployment
1. Run the test script: `./test-production-websocket.sh`
2. Test with debug tool: Open `debug-websocket.html` in browser
3. Verify environment variables are loaded correctly
4. Test with development diagnostics panel

### 3. Backend Requirements
For WebSocket to work fully, the backend needs:

- **WebSocket endpoint enabled** at `/ws/session/{session_code}`
- **No API key requirement** for WebSocket handshake (can't send headers during handshake)
- **Proper CORS configuration** for cross-origin requests
- **SSL/TLS support** for `wss://` connections
- **Reverse proxy configured** for WebSocket upgrades

### 4. Production Deployment Checklist

- [ ] Environment variables properly set
- [ ] API key matches backend configuration
- [ ] Backend WebSocket endpoint accessible
- [ ] SSL certificate covers WebSocket connections
- [ ] Reverse proxy configured for WebSocket upgrades
- [ ] CORS headers properly configured
- [ ] Firewall allows WebSocket connections
- [ ] Tested with debug tool before deploying

## Monitoring & Maintenance

### What to Monitor
1. **Browser console errors** (should be reduced significantly)
2. **WebSocket connection success rates**
3. **API response times and error rates**
4. **User reports of connection issues**

### Red Flags
- **Persistent HTTP 500 errors** (backend issue)
- **WebSocket connections never succeeding** (server config issue)
- **High frequency of fallback to polling** (WebSocket server problems)

### Monitoring Tools
1. **Browser dev tools**: Check console for connection errors
2. **Server logs**: Monitor WebSocket connection attempts
3. **Development diagnostics**: Use component in development
4. **Production testing**: Regular runs of test script

## Fallback Mechanism

The application includes an automatic fallback system:

- **WebSocket failure detection**: Automatically detects repeated connection failures
- **Graceful degradation**: Disables WebSocket for that session after errors
- **HTTP polling fallback**: Falls back to polling every 3 seconds
- **User experience maintained**: App continues working without real-time updates
- **Status indicators**: Shows connection method (WebSocket vs Polling)
- **No infinite loops**: Prevents endless reconnection attempts

## Expected Outcomes

### Immediate Improvements
1. **API calls should work**: Fixed header name should resolve HTTP 500 errors
2. **Better error handling**: Users see more informative error messages
3. **Automatic fallback**: App continues working even if WebSocket fails
4. **No more infinite loops**: WebSocket reconnection attempts are limited

### User Experience
- App loads and functions properly even with WebSocket issues
- Real-time updates work when WebSocket connection is successful
- Automatic fallback to polling when WebSocket fails
- Clear connection status indicators
- Better error messages for debugging

## Files Changed Summary

### Modified Files:
- `src/lib/api.ts` - Fixed API key headers
- `src/hooks/useWebSocket.ts` - Enhanced error handling  
- `src/hooks/useGameUpdates.ts` - Added fallback mechanism
- `src/lib/websocket.ts` - Added API key to query params
- `src/pages/ActiveQuiz.tsx` - Added diagnostics (dev only)
- `.env.example` - Updated with WebSocket configuration

### New Files:
- `src/lib/diagnostics.ts` - Diagnostic utilities
- `src/components/WebSocketDiagnostics.tsx` - Diagnostics UI
- `debug-websocket.html` - Standalone debug tool
- `test-production-websocket.sh` - Production test script
- `docs/websockets/README.md` - This comprehensive guide

## Getting Help

If issues persist after following this guide:

1. **Run the diagnostics tool** and share results
2. **Check browser console and network tabs** for detailed error information
3. **Share backend logs** if accessible
4. **Test with the standalone debug tool** (`debug-websocket.html`)
5. **Verify all environment variables** are correctly set
6. **Test API endpoints manually** using curl commands provided above

## Implementation Notes

All fixes are backward compatible and include proper fallback mechanisms to ensure the application continues working even if WebSocket connections fail. The robust fallback system means users will have a functional experience regardless of WebSocket connectivity issues, while the diagnostic tools help identify and resolve underlying server-side problems.

The WebSocket implementation follows best practices:
- Graceful error handling
- Automatic reconnection with limits
- Fallback to HTTP polling
- Detailed logging for debugging
- Status indicators for users
- Comprehensive testing tools