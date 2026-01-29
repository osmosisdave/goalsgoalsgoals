# API Rate Limiter

A comprehensive rate limiting system to track and control API calls to external football data services. Designed for the free tier API-Football plan with 100 calls/week limit.

## Overview

The rate limiter prevents exceeding API quotas by:
- Tracking all API calls in a rolling 7-day window
- Blocking new calls after reaching 75 calls (soft limit)
- Automatic quota replenishment as old calls expire
- Persistent storage (file or MongoDB)

## Configuration

```javascript
const WEEKLY_HARD_LIMIT = 100;  // Absolute maximum
const WEEKLY_SOFT_LIMIT = 75;   // When to block new calls
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
```

## Server-Side Implementation

### 1. Service Module (`server/api-rate-limiter.js`)

Core rate limiting logic:

```javascript
const apiRateLimiter = require('./api-rate-limiter');

// Initialize (called at server startup)
await apiRateLimiter.initialize(mongoClient);

// Check if a call can be made
const canMake = await apiRateLimiter.canMakeCall();

// Record an API call
await apiRateLimiter.recordCall('/football/fixtures', 'username', metadata);

// Get current status
const status = await apiRateLimiter.getStatus();
```

### 2. API Endpoints

#### Get Status (Public)
```
GET /api/rate-limit/status
```

Response:
```json
{
  "count": 45,
  "remaining": 30,
  "softLimit": 75,
  "hardLimit": 100,
  "isBlocked": false,
  "isNearLimit": false,
  "weekStarting": 1738161600000,
  "oldestCallExpiry": "2026-02-05T10:30:00.000Z",
  "recentCalls": [
    {
      "endpoint": "/football/fixtures",
      "timestamp": "2026-01-29T10:30:00.000Z",
      "user": "john"
    }
  ]
}
```

#### Get Analytics (Admin Only)
```
GET /api/rate-limit/analytics
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "totalCalls": 45,
  "byEndpoint": {
    "/football/fixtures": 30,
    "/football/standings": 15
  },
  "byDay": {
    "2026-01-29": 10,
    "2026-01-28": 15
  },
  "byUser": {
    "john": 25,
    "jane": 20
  },
  "weekPeriod": {
    "start": "2026-01-22T10:30:00.000Z",
    "end": "2026-01-29T10:30:00.000Z"
  }
}
```

#### Reset (Admin Only, Testing)
```
POST /api/rate-limit/reset
Authorization: Bearer <admin-token>
```

### 3. Protected Endpoints

Mock API endpoints that use rate limiting:

```
POST /api/football/fixtures
POST /api/football/standings
```

These endpoints:
1. Check if calls are allowed
2. Return 429 error if limit reached
3. Record the call if allowed
4. Return data + current status

## Frontend Integration

### Rate Limit Widget

Include the widget script:
```html
<script src="assets/js/rate-limit-widget.js"></script>
```

Add container in HTML:
```html
<div id="api-rate-limit-widget"></div>
```

The widget auto-initializes and displays:
- Current usage (e.g., "45 / 75")
- Progress bar with color coding
- Remaining calls
- Warning messages when near/at limit
- Next reset time

### Manual Widget Initialization

```javascript
const widget = new RateLimitWidget('container-id');
```

### Making Tracked API Calls

```javascript
async function fetchFixtures() {
  try {
    const response = await fetch('http://localhost:4000/api/football/fixtures', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <token>' // Optional
      },
      body: JSON.stringify({
        league: 39,
        season: 2025
      })
    });
    
    const data = await response.json();
    
    if (response.status === 429) {
      // Rate limit exceeded
      alert(data.message);
      console.log('Limit resets:', data.status.oldestCallExpiry);
    } else {
      // Success - use data.data for actual results
      console.log('Rate limit status:', data.rateLimitStatus);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Storage

### File Storage (Default)
- Data stored in `server/api-calls.json`
- Format:
```json
{
  "calls": [
    {
      "endpoint": "/football/fixtures",
      "timestamp": "2026-01-29T10:30:00.000Z",
      "user": "john",
      "metadata": { "league": 39 }
    }
  ],
  "weeklyCount": 45,
  "lastReset": "2026-01-29T10:30:00.000Z"
}
```

### MongoDB Storage (Optional)
- Collection: `api_calls`
- Document ID: `tracker`
- Same structure as file storage

## Features

### Rolling Window
- Uses actual timestamps, not calendar weeks
- Calls expire exactly 7 days after they're made
- Quota automatically replenishes

### Color-Coded Status
- **Green**: < 90% of soft limit (< 68 calls)
- **Orange**: ≥ 90% of soft limit (68-74 calls)
- **Red**: At/over soft limit (≥ 75 calls)

### Automatic Cleanup
- Old calls (> 7 days) automatically removed
- Runs on initialization and status checks
- Keeps data file small

## Testing

Visit the test page: `http://localhost:8000/rate-limiter-test.html`

Test actions:
- **Make API Call**: Single API call
- **Make 10 Calls**: Batch of 10 calls
- **Reset Limiter**: Clear all tracking (admin only)
- **View Analytics**: See detailed breakdown (admin only)

## Usage Examples

### Check Before Making External API Call

```javascript
// In your API service
async function callExternalAPI(endpoint, params) {
  // Check limit first
  const canProceed = await apiRateLimiter.canMakeCall();
  
  if (!canProceed) {
    throw new Error('API rate limit exceeded');
  }
  
  // Make the actual external API call
  const response = await fetch(`https://api-football.com/${endpoint}`, params);
  
  // Record successful call
  await apiRateLimiter.recordCall(endpoint, 'system', params);
  
  return response.json();
}
```

### Middleware Pattern

```javascript
// Use as Express middleware
app.post('/api/football/*', async (req, res, next) => {
  const canProceed = await apiRateLimiter.canMakeCall();
  
  if (!canProceed) {
    const status = await apiRateLimiter.getStatus();
    return res.status(429).json({
      error: 'Rate limit exceeded',
      status
    });
  }
  
  req.apiLimiter = apiRateLimiter;
  next();
});
```

## Error Handling

```javascript
try {
  await apiRateLimiter.recordCall('/fixtures', 'user');
} catch (error) {
  console.error('Failed to record API call:', error);
  // Continue - don't block user flow if tracking fails
}
```

## Production Considerations

1. **MongoDB Recommended**: File storage works but MongoDB is better for:
   - Concurrent access
   - Reliability
   - Scalability

2. **Backup Strategy**: 
   - Regularly backup `api-calls.json` or MongoDB
   - Can restore to recover call history

3. **Monitoring**: 
   - Set up alerts when approaching 60 calls (80% of soft limit)
   - Track usage trends

4. **Rate Limit Adjustment**:
   - Modify `WEEKLY_SOFT_LIMIT` if you upgrade API plan
   - Keep soft limit below hard limit for safety margin

## Future Enhancements

Potential additions:
- Per-user quotas (different limits per user role)
- Per-endpoint limits (e.g., 50 for fixtures, 25 for standings)
- Daily limits in addition to weekly
- Email notifications when approaching limit
- Dashboard UI for admins
- Export usage reports
- Cache popular API responses to reduce calls

## License

Part of the Goals Goals Goals project.
