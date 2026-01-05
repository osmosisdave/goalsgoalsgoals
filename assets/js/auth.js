const TOKEN_KEY = 'ggg_token';
const USE_MOCK = !!(window && window.GGG_USE_MOCK_API);
// API origin can be set on the page via `window.GGG_API_ORIGIN`.
// If empty, relative paths are used (useful for local dev where server and site are same origin).
const API_ORIGIN = window.GGG_API_ORIGIN ? String(window.GGG_API_ORIGIN).replace(/\/$/, '') : '';
function apiUrl(path) { return (API_ORIGIN ? API_ORIGIN : '') + path; }
export async function login(username, password) {
    if (USE_MOCK) {
        const ok = (username === 'admin' && password === 'admin123') || (username === 'user' && password === 'user123');
        if (!ok) return false;
        const role = username === 'admin' ? 'admin' : 'user';
        const payload = { sub: username, role };
        const token = 'mock.' + btoa(JSON.stringify(payload));
        sessionStorage.setItem(TOKEN_KEY, token);
        return true;
    }
    try {
        const res = await fetch(apiUrl('/api/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok)
            return false;
        const { token } = await res.json();
        sessionStorage.setItem(TOKEN_KEY, token);
        return true;
    }
    catch (e) {
        return false;
    }
}
export function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
}
export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}
export async function currentUser() {
    const token = getToken();
    if (!token)
        return null;
    if (USE_MOCK && token.startsWith('mock.')) {
        try {
            const json = atob(token.slice(5));
            const payload = JSON.parse(json);
            return { username: payload.sub, role: payload.role };
        }
        catch (e) {
            return { username: 'admin', role: 'admin' };
        }
    }
    try {
        const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (e) {
        return null;
    }
}
export async function requireAuth(redirect = 'login.html') {
    const u = await currentUser();
    if (!u)
        window.location.href = redirect;
}
export async function createUser(username, password, role = 'user') {
    const token = getToken();
    if (!token)
        throw new Error('Not authenticated');
    const res = await fetch(apiUrl('/api/users'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, password, role }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create user');
    }
    return await res.json();
}
// UI wiring for login.html and admin.html (calls server endpoints)
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const ok = await login(username, password);
            const err = document.getElementById('loginError');
            if (ok) {
                    // After successful login, go to the home page
                    window.location.href = 'index.html';
                }
            else {
                if (err)
                    err.textContent = 'Invalid username or password';
            }
        });
    }
    // If we're on admin.html require auth as before
    if (window.location.pathname.endsWith('admin.html')) {
        requireAuth();
        currentUser().then((user) => {
            const welcome = document.getElementById('adminWelcome');
            if (welcome && user)
                welcome.textContent = `Signed in as ${user.username} (${user.role || 'user'})`;
        });
        // Fetch users from API
        const list = document.getElementById('userList');
        if (list) {
            if (USE_MOCK) {
                const mockUsers = [
                    { username: 'admin', role: 'admin' },
                    { username: 'user', role: 'user' },
                ];
                mockUsers.forEach((u) => {
                    const li = document.createElement('li');
                    li.className = 'collection-item';
                    li.textContent = `${u.username} — ${u.role || 'user'}`;
                    list.appendChild(li);
                });
            }
            else {
                const token = getToken();
                fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
                    .then((r) => r.json())
                    .then((users) => {
                    users.forEach((u) => {
                        const li = document.createElement('li');
                        li.className = 'collection-item';
                        li.textContent = `${u.username} — ${u.role || 'user'}`;
                        list.appendChild(li);
                    });
                })
                    .catch(() => {
                    const li = document.createElement('li');
                    li.className = 'collection-item red-text';
                    li.textContent = 'Failed to load users (are you authenticated?)';
                    list.appendChild(li);
                });
            }
        }
        // Create user form handling
        const createForm = document.getElementById('createUserForm');
        if (createForm) {
            createForm.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const u = document.getElementById('newUsername').value.trim();
                const p = document.getElementById('newPassword').value;
                const r = document.getElementById('newRole').value || 'user';
                const msg = document.getElementById('createUserMsg');
                try {
                    if (USE_MOCK) {
                        if (msg) { msg.textContent = 'Created.'; msg.className = 'green-text'; }
                        if (list) {
                            const li = document.createElement('li');
                            li.className = 'collection-item';
                            li.textContent = `${u} — ${r || 'user'}`;
                            list.appendChild(li);
                        }
                    } else {
                        await createUser(u, p, r);
                        if (msg) {
                            msg.textContent = 'Created.';
                            msg.className = 'green-text';
                        }
                        // refresh list
                        if (!list)
                            return;
                        list.innerHTML = '';
                        const token = getToken();
                        fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
                            .then((r) => r.json())
                            .then((users) => {
                            users.forEach((u) => {
                                const li = document.createElement('li');
                                li.className = 'collection-item';
                                li.textContent = `${u.username} — ${u.role || 'user'}`;
                                list.appendChild(li);
                            });
                        });
                    }
                }
                catch (e) {
                    if (msg) {
                        msg.textContent = e.message || 'Error';
                        msg.className = 'red-text';
                    }
                }
            });
        }
    }
    // If we're on the login page and already authenticated, redirect to home
    if (window.location.pathname.endsWith('login.html')) {
        currentUser().then(u => {
            if (u) window.location.href = 'index.html';
        });
    }
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logout();
            window.location.href = 'index.html';
        });
    }
});
