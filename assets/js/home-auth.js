// Home auth helper: replace 'Login' with username when logged in
(function () {
  const USE_MOCK = !!(window && window.GGG_USE_MOCK_API);
  function apiUrl(path) {
    const origin = (window && window.GGG_API_ORIGIN) || '';
    if (origin) return origin.replace(/\/$/, '') + path;
    return path;
  }

  function getAuthToken() {
    return sessionStorage.getItem('ggg_token') || sessionStorage.getItem('token') || localStorage.getItem('ggg_token') || localStorage.getItem('token') || null;
  }

  function parseJwtUsername(token) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const obj = JSON.parse(decodeURIComponent(escape(json)));
      return obj.sub || obj.username || null;
    } catch (e) {
      return null;
    }
  }

  async function fetchMe(token) {
    if (!token) return null;
    if (USE_MOCK && String(token).startsWith('mock.')) {
      try {
        const payload = JSON.parse(atob(String(token).slice(5)));
        return { username: payload.sub, role: payload.role };
      } catch (e) {
        return { username: 'admin', role: 'admin' };
      }
    }
    try {
      const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return null;
      const data = await res.json();
      return data || null;
    } catch (e) {
      return null;
    }
  }

  function setNavToUsername(username) {
    const desktop = document.getElementById('nav-login-link');
    const mobile = document.getElementById('nav-login-link-mobile');
    if (desktop) {
      desktop.innerHTML = `<a href="#" id="nav-username">${escapeHtml(username)}</a>`;
    }
    if (mobile) {
      mobile.innerHTML = `<a href="#" id="nav-username-mobile">${escapeHtml(username)}</a>`;
    }
    // attach logout behavior
    const el = document.getElementById('nav-username');
    const elm = document.getElementById('nav-username-mobile');
    function logoutHandler(e) {
      e.preventDefault();
      if (!confirm('Log out ' + username + '?')) return;
      sessionStorage.removeItem('ggg_token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('ggg_token');
      localStorage.removeItem('token');
      location.reload();
    }
    if (el) el.addEventListener('click', logoutHandler);
    if (elm) elm.addEventListener('click', logoutHandler);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (s) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
    });
  }

  (async function init() {
    const token = getAuthToken();
    // Redirect unauthenticated users to the login page
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
    const me = await fetchMe(token);
    let username = null;
    let role = null;
    if (me) {
      username = me.username || me.sub || null;
      role = me.role || null;
    }
    if (!username) {
      username = parseJwtUsername(token) || null;
    }
    if (username) setNavToUsername(username);
    // show admin tile when role is admin
    try {
      if (role === 'admin') {
        const t = document.getElementById('admin-tile');
        if (t) t.style.display = '';
        const lm = document.getElementById('league-mgmt-tile');
        if (lm) lm.style.display = '';
        const rl = document.getElementById('rate-limiter-tile');
        if (rl) rl.style.display = '';
      }
    } catch (e) {}
  })();
})();
