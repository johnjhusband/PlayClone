# PlayClone REST API Documentation

## Overview

The PlayClone REST API provides a RESTful interface for browser automation, allowing you to control browsers remotely via HTTP requests.

## Getting Started

### Starting the Server

```bash
# Basic start
node rest-api-server.js

# With authentication
node rest-api-server.js --api-key your-secret-key --port 8080

# With WebSocket support
node rest-api-server.js --websocket --port 3000
```

### Authentication

If an API key is configured, include it in your requests:

```http
X-API-Key: your-secret-key
```

Or as a query parameter:
```
?apiKey=your-secret-key
```

## API Endpoints

### Health Check

```http
GET /health
```

Returns server health status and session information.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "sessions": 2,
    "maxSessions": 10,
    "uptime": 3600
  },
  "timestamp": "2025-09-01T12:00:00.000Z"
}
```

### Session Management

#### Create Session

```http
POST /sessions
Content-Type: application/json

{
  "options": {
    "headless": false,
    "viewport": {
      "width": 1280,
      "height": 720
    }
  },
  "metadata": {
    "user": "john",
    "purpose": "testing"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-here",
    "createdAt": "2025-09-01T12:00:00.000Z"
  },
  "timestamp": "2025-09-01T12:00:00.000Z"
}
```

#### List Sessions

```http
GET /sessions
```

#### Delete Session

```http
DELETE /sessions/{sessionId}
```

### Navigation

#### Navigate to URL

```http
POST /sessions/{sessionId}/navigate
Content-Type: application/json

{
  "url": "https://example.com"
}
```

#### Go Back

```http
POST /sessions/{sessionId}/back
```

#### Go Forward

```http
POST /sessions/{sessionId}/forward
```

#### Reload Page

```http
POST /sessions/{sessionId}/reload
```

### Actions

#### Click Element

```http
POST /sessions/{sessionId}/click
Content-Type: application/json

{
  "selector": "button.submit",
  "options": {
    "button": "left",
    "clickCount": 1
  }
}
```

#### Type Text

```http
POST /sessions/{sessionId}/type
Content-Type: application/json

{
  "text": "Hello World",
  "options": {
    "delay": 100
  }
}
```

#### Fill Input

```http
POST /sessions/{sessionId}/fill
Content-Type: application/json

{
  "selector": "#email",
  "value": "user@example.com"
}
```

#### Select Option

```http
POST /sessions/{sessionId}/select
Content-Type: application/json

{
  "selector": "#country",
  "value": "US"
}
```

#### Check/Uncheck

```http
POST /sessions/{sessionId}/check
Content-Type: application/json

{
  "selector": "#agree-terms"
}
```

### Data Extraction

#### Get Text

```http
GET /sessions/{sessionId}/text?selector=h1
```

#### Get Links

```http
GET /sessions/{sessionId}/links
```

#### Get Table Data

```http
GET /sessions/{sessionId}/table?selector=table.data
```

#### Get Form Data

```http
GET /sessions/{sessionId}/form?selector=form#signup
```

### Screenshot

```http
GET /sessions/{sessionId}/screenshot?fullPage=true&format=base64
```

Parameters:
- `fullPage`: Capture full page (true/false)
- `format`: Return format (base64/image)
- `selector`: Capture specific element

### State Management

#### Save State

```http
POST /sessions/{sessionId}/state/save
Content-Type: application/json

{
  "name": "checkpoint1"
}
```

#### Restore State

```http
POST /sessions/{sessionId}/state/restore
Content-Type: application/json

{
  "name": "checkpoint1"
}
```

### Wait for Element

```http
POST /sessions/{sessionId}/wait
Content-Type: application/json

{
  "selector": "#loading",
  "timeout": 5000
}
```

### Execute JavaScript

```http
POST /sessions/{sessionId}/execute
Content-Type: application/json

{
  "script": "return document.title",
  "args": []
}
```

## WebSocket API

When WebSocket is enabled, you can establish a persistent connection for real-time communication:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  ws.send(JSON.stringify({
    action: 'navigate',
    sessionId: 'your-session-id',
    params: {
      url: 'https://example.com'
    }
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);
});
```

## Error Handling

All errors return with appropriate HTTP status codes:

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `404` - Not Found (session or endpoint not found)
- `500` - Internal Server Error
- `503` - Service Unavailable (max sessions reached)

Error response format:
```json
{
  "success": false,
  "error": "Error message here",
  "timestamp": "2025-09-01T12:00:00.000Z"
}
```

## Rate Limiting

Default rate limits:
- 100 requests per minute per IP
- Configurable via server options

## Session Timeout

Sessions automatically expire after 30 minutes of inactivity (configurable).

## Examples

### Python Example

```python
import requests
import json

# Configuration
API_URL = "http://localhost:3000"
API_KEY = "your-api-key"  # Optional

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY
}

# Create a session
response = requests.post(f"{API_URL}/sessions", 
                         headers=headers,
                         json={"options": {"headless": False}})
session_data = response.json()
session_id = session_data["data"]["sessionId"]

# Navigate to a website
requests.post(f"{API_URL}/sessions/{session_id}/navigate",
              headers=headers,
              json={"url": "https://example.com"})

# Click a button
requests.post(f"{API_URL}/sessions/{session_id}/click",
              headers=headers,
              json={"selector": "button.submit"})

# Get page text
response = requests.get(f"{API_URL}/sessions/{session_id}/text",
                        headers=headers,
                        params={"selector": "h1"})
text_data = response.json()
print("Page title:", text_data["data"]["text"])

# Take a screenshot
response = requests.get(f"{API_URL}/sessions/{session_id}/screenshot",
                        headers=headers,
                        params={"fullPage": "true", "format": "base64"})
screenshot_data = response.json()

# Clean up - close the session
requests.delete(f"{API_URL}/sessions/{session_id}", headers=headers)
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000';
const API_KEY = 'your-api-key'; // Optional

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  }
});

async function automateExample() {
  // Create session
  const { data: sessionData } = await client.post('/sessions', {
    options: { headless: false }
  });
  const sessionId = sessionData.data.sessionId;
  
  // Navigate
  await client.post(`/sessions/${sessionId}/navigate`, {
    url: 'https://example.com'
  });
  
  // Fill form
  await client.post(`/sessions/${sessionId}/fill`, {
    selector: '#email',
    value: 'user@example.com'
  });
  
  // Click submit
  await client.post(`/sessions/${sessionId}/click`, {
    selector: 'button[type="submit"]'
  });
  
  // Get result text
  const { data: textData } = await client.get(`/sessions/${sessionId}/text`, {
    params: { selector: '.success-message' }
  });
  console.log('Result:', textData.data.text);
  
  // Clean up
  await client.delete(`/sessions/${sessionId}`);
}

automateExample().catch(console.error);
```

### cURL Examples

```bash
# Create session
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"options": {"headless": false}}'

# Navigate to URL
curl -X POST http://localhost:3000/sessions/{sessionId}/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Click element
curl -X POST http://localhost:3000/sessions/{sessionId}/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "button.submit"}'

# Get text
curl http://localhost:3000/sessions/{sessionId}/text?selector=h1

# Take screenshot
curl http://localhost:3000/sessions/{sessionId}/screenshot?fullPage=true > screenshot.png

# Delete session
curl -X DELETE http://localhost:3000/sessions/{sessionId}
```

## Best Practices

1. **Session Management**: Always close sessions when done to free resources
2. **Error Handling**: Implement proper error handling for network failures
3. **Timeouts**: Set appropriate timeouts for long-running operations
4. **Rate Limiting**: Respect rate limits to avoid being throttled
5. **Security**: Use API keys in production environments
6. **Monitoring**: Monitor session usage and clean up stale sessions

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "rest-api-server.js"]
```

### PM2

```bash
pm2 start rest-api-server.js --name playclone-api -- --port 3000 --api-key secret
```

### Systemd

```ini
[Unit]
Description=PlayClone REST API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/playclone
ExecStart=/usr/bin/node rest-api-server.js --port 3000 --api-key secret
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Performance Considerations

- Each session consumes ~50-100MB RAM
- Browser startup takes 1-3 seconds
- Consider using connection pooling for high-traffic scenarios
- Enable browser pre-warming for faster response times
- Use headless mode for better performance

## Troubleshooting

### Session Not Found
- Session may have expired
- Check session ID is correct
- Verify session wasn't manually closed

### Maximum Sessions Reached
- Increase `--max-sessions` limit
- Close unused sessions
- Implement session pooling

### Timeout Errors
- Increase timeout values
- Check network connectivity
- Verify target website is responsive

### Memory Issues
- Limit concurrent sessions
- Enable headless mode
- Implement session recycling