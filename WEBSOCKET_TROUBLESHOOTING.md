# WebSocket Connection Troubleshooting Guide

This document helps diagnose and fix WebSocket connection issues with the PhunParty application.

## Production Issue Summary

Based on the production logs, the main issues are:

1. **WebSocket Connection Failures**: Firefox can't establish connection to `wss://api.phun.party/ws/session/{sessionCode}?client_type=web`
2. **Error Code 1006**: Connection closed abnormally (usually server-side issues)
3. **HTTP 500 Errors**: Even fallback API calls to `/game-logic/status/` are failing

## Quick Fixes Applied

### 1. Fixed API Key Header Names
- **Problem**: Frontend was sending `x-api-key` but backend expects `X-API-Key`
- **Fix**: Updated all API calls to use correct header name

### 2. Added WebSocket Fallback Mechanism
- **Problem**: When WebSocket fails, the app should gracefully fall back to HTTP polling
- **Fix**: Enhanced `useGameUpdates` hook to automatically disable WebSocket after failures

### 3. Improved Error Logging
- **Problem**: WebSocket errors were not providing enough information for debugging
- **Fix**: Added detailed logging with close codes and connection details

### 4. Created Diagnostic Tools
- **Problem**: Hard to debug WebSocket issues in production
- **Fix**: Added WebSocket diagnostics component and standalone debug tool

## Testing Tools

### 1. WebSocket Debug Tool
Open `debug-websocket.html` in your browser to test WebSocket connections directly:
- Tests multiple URL variations
- Shows detailed connection logs
- Explains WebSocket close codes
- Can send test messages

### 2. Diagnostics Component (Development Only)
When running in development mode, the ActiveQuiz page shows a diagnostics panel that tests:
- Environment variables
- API connectivity
- Session status endpoints
- WebSocket connections

## Common Issues and Solutions

### Issue 1: WebSocket Connection Refused (Error 1006)
**Symptoms**: 
- `Firefox can't establish a connection to the server at wss://api.phun.party/ws/session/...`
- Close code 1006 (Abnormal Closure)

**Possible Causes**:
1. **Server not running WebSocket support**: The backend might not be properly configured for WebSocket connections
2. **Reverse proxy issues**: nginx/Apache might not be configured to handle WebSocket upgrades
3. **Firewall blocking WebSocket ports**: Some corporate firewalls block WebSocket connections
4. **SSL/TLS issues**: Mixed content or certificate problems

**Solutions**:
1. **Check backend WebSocket configuration**:
   ```bash
   # Test if WebSocket endpoint is accessible
   wscat -c wss://api.phun.party/ws/session/TEST123?client_type=web
   ```

2. **Verify nginx/Apache WebSocket support**:
   ```nginx
   # nginx configuration for WebSocket
   location /ws/ {
       proxy_pass http://backend;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
   }
   ```

3. **Check SSL certificate**: Make sure the certificate covers WebSocket connections

### Issue 2: HTTP 500 Errors on API Calls
**Symptoms**:
- `XHRGET https://api.phun.party/game-logic/status/8VIZHNC6R [HTTP/1.1 500 0ms]`

**Possible Causes**:
1. **Missing or incorrect API key**
2. **Backend server errors**
3. **Database connection issues**
4. **Session not found**

**Solutions**:
1. **Verify API key configuration**:
   ```bash
   # Test API key with health endpoint
   curl -H "X-API-Key: YOUR_API_KEY" https://api.phun.party/health
   ```

2. **Check backend logs** for specific error messages

3. **Verify session exists**:
   ```bash
   curl -H "X-API-Key: YOUR_API_KEY" https://api.phun.party/game-logic/status/8VIZHNC6R
   ```

### Issue 3: Environment Variable Problems
**Symptoms**:
- API calls going to wrong URLs
- Missing API keys
- WebSocket connections to localhost in production

**Solutions**:
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

## Debugging Steps

### Step 1: Environment Check
1. Verify `.env` file exists and has correct values
2. Check that `VITE_API_KEY` matches backend's expected key
3. Confirm `VITE_API_URL` points to correct backend

### Step 2: API Connectivity Test
1. Test basic API connection: `curl https://api.phun.party/health`
2. Test with API key: `curl -H "X-API-Key: YOUR_KEY" https://api.phun.party/health`
3. Test session endpoint: `curl -H "X-API-Key: YOUR_KEY" https://api.phun.party/game-logic/status/YOUR_SESSION`

### Step 3: WebSocket Test
1. Use the debug tool (`debug-websocket.html`) 
2. Try different protocols: `ws://` vs `wss://`
3. Test with/without query parameters
4. Check browser network tab for WebSocket connections

### Step 4: Browser Dev Tools
1. Open Network tab and filter by "WS" to see WebSocket connections
2. Check Console for detailed error messages
3. Look for CORS errors or mixed content warnings

## Backend Requirements

For WebSocket connections to work, the backend needs:

1. **WebSocket endpoint enabled** at `/ws/session/{session_code}`
2. **No API key requirement** for WebSocket handshake (can't send headers)
3. **Proper CORS configuration** for cross-origin requests
4. **SSL/TLS support** for `wss://` connections
5. **Reverse proxy configured** for WebSocket upgrades

## Fallback Mechanism

The application includes an automatic fallback system:
- If WebSocket connection fails repeatedly, it disables WebSocket for that session
- Falls back to HTTP polling every 3 seconds
- User experience is maintained but without real-time updates
- Status indicator shows connection method (WebSocket vs Polling)

## Production Deployment Checklist

- [ ] Environment variables properly set
- [ ] API key matches backend configuration
- [ ] Backend WebSocket endpoint accessible
- [ ] SSL certificate covers WebSocket connections
- [ ] Reverse proxy configured for WebSocket upgrades
- [ ] CORS headers properly configured
- [ ] Firewall allows WebSocket connections
- [ ] Test with debug tool before deploying

## Monitoring

To monitor WebSocket health in production:
1. Check browser console for connection errors
2. Monitor server logs for WebSocket connection attempts
3. Use the diagnostics component in development
4. Set up alerts for repeated connection failures

## Getting Help

If issues persist:
1. Run the diagnostics tool and share results
2. Check browser console and network tabs
3. Share backend logs if accessible
4. Test with the standalone debug tool
5. Verify all environment variables are correct