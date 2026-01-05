// Frontend config. CI overwrites API origin at deploy time using the
// repository Actions secret API_ORIGIN.
// Local development: use mock API (no backend required).
window.GGG_API_ORIGIN = window.GGG_API_ORIGIN || '';
window.GGG_USE_MOCK_API = typeof window.GGG_USE_MOCK_API === 'boolean' ? window.GGG_USE_MOCK_API : true;
