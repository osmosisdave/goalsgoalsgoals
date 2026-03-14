// Site header helper — compiled to assets/js/site-header.js by `npm run build`.
// Loaded on every page (except login.html itself). Redirects unauthenticated
// users to login, then shows the logged-in username in the nav and reveals the
// admin tile when the user is an admin.
const USE_MOCK = !!window.GGG_USE_MOCK_API;
function apiUrl(path) {
    const origin = (window.GGG_API_ORIGIN || '').replace(/\/$/, '');
    return origin + path;
}
function getToken() {
    return sessionStorage.getItem('ggg_token');
}
async function fetchMe() {
    const token = getToken();
    if (!token)
        return null;
    // Mock mode: decode a locally-minted mock token without hitting the network.
    if (USE_MOCK && token.startsWith('mock.')) {
        try {
            const payload = JSON.parse(atob(token.slice(5)));
            return { username: payload.sub, role: payload.role };
        }
        catch (_a) {
            return { username: 'admin', role: 'admin' };
        }
    }
    try {
        const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (_b) {
        return null;
    }
}
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, s => { var _a; return (_a = ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]) !== null && _a !== void 0 ? _a : s; });
}
function setNavToUsername(username) {
    var _a, _b;
    const safe = escapeHtml(username);
    const desktop = document.getElementById('nav-login-link');
    const mobile = document.getElementById('nav-login-link-mobile');
    if (desktop)
        desktop.innerHTML = `<a href="#" id="nav-username">${safe}</a>`;
    if (mobile)
        mobile.innerHTML = `<a href="#" id="nav-username-mobile">${safe}</a>`;
    function logoutHandler(e) {
        e.preventDefault();
        if (!confirm(`Log out ${username}?`))
            return;
        sessionStorage.removeItem('ggg_token');
        location.reload();
    }
    (_a = document.getElementById('nav-username')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', logoutHandler);
    (_b = document.getElementById('nav-username-mobile')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', logoutHandler);
}
(async function init() {
    try {
        const onLoginPage = /(^|\/)login\.html$/.test(window.location.pathname);
        if (!onLoginPage && !getToken()) {
            window.location.href = 'login.html';
            return;
        }
        const me = await fetchMe();
        if (!onLoginPage && !me) {
            // Token present but invalid or expired — send back to login.
            window.location.href = 'login.html';
            return;
        }
        if (me === null || me === void 0 ? void 0 : me.username) {
            setNavToUsername(me.username);
        }
        if ((me === null || me === void 0 ? void 0 : me.role) === 'admin') {
            const adminTile = document.getElementById('admin-tile');
            if (adminTile)
                adminTile.style.display = '';
        }
    }
    catch (_a) {
        // Never let a header error break the page.
    }
})();
export {};
