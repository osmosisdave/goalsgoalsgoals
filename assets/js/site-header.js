// Site header helper: display logged-in username and show admin-only tile (no redirects)
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

  async function fetchMe() {
    const token = getAuthToken();
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
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (s) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
    });
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

  (async function init() {
    try {
      // Redirect to login if unauthenticated on any page except the login page
      const path = (window && window.location && window.location.pathname) || '';
      const onLoginPage = /(^|\/)login\.html$/.test(path);
      if (!onLoginPage) {
        const token = getAuthToken();
        if (!token) {
          window.location.href = 'login.html';
          return;
        }
      }

      const me = await fetchMe();
      if (!onLoginPage && !me) {
        // Token is invalid or user fetch failed; return to login
        window.location.href = 'login.html';
        return;
      }
      if (me && (me.username || me.sub)) {
        const username = me.username || me.sub;
        setNavToUsername(username);
      }
      if (me && me.role === 'admin') {
        const t = document.getElementById('admin-tile');
        if (t) t.style.display = '';
      }
    } catch (e) {
      // ignore
    }
  })();
})();
