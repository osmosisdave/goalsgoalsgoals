// Frontend config. CI overwrites API origin at deploy time using the
// repository Actions secret API_ORIGIN.
//
// Backend options for testing:
// - Local:  'http://localhost:4000'
// - Render: 'https://goalsgoalsgoals.onrender.com'
//
// Simply change the URL below to switch between local and production backend.
window.GGG_API_ORIGIN = window.GGG_API_ORIGIN || 'http://localhost:4000';
window.GGG_USE_MOCK_API = typeof window.GGG_USE_MOCK_API === 'boolean' ? window.GGG_USE_MOCK_API : false;
