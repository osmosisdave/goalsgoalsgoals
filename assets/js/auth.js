/**
 * Client-side auth module (connects to a simple server-side auth API).
 * This client stores the JWT in sessionStorage for the prototype.
 */
const TOKEN_KEY = 'ggg_token';
// API origin can be set on the page via `window.GGG_API_ORIGIN` (see assets/js/config.js).
// If empty, relative paths are used (useful for local dev where server and site are same origin).
const API_ORIGIN = window.GGG_API_ORIGIN ? window.GGG_API_ORIGIN.replace(/\/$/, '') : '';
function apiUrl(path) { return API_ORIGIN + path; }
export async function login(username, password) {
    try {
        const res = await fetch(apiUrl('/api/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok)
            return false;
        const body = await res.json();
        sessionStorage.setItem(TOKEN_KEY, body.token);
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
export async function assignPreviousMatch(username, fixtureId) {
    const token = getToken();
    if (!token)
        throw new Error('Not authenticated');
    const res = await fetch(apiUrl('/api/admin/assign-previous-match'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, fixtureId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to assign previous match');
    }
    return await res.json();
}
function currentSeasonYear() {
    const now = new Date();
    return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}
function fixtureOptionLabel(f) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const date = new Date(f.fixture.date).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    const home = ((_b = (_a = f.teams) === null || _a === void 0 ? void 0 : _a.home) === null || _b === void 0 ? void 0 : _b.name) || 'Home';
    const away = ((_d = (_c = f.teams) === null || _c === void 0 ? void 0 : _c.away) === null || _d === void 0 ? void 0 : _d.name) || 'Away';
    const league = ((_e = f.league) === null || _e === void 0 ? void 0 : _e.name) || 'League';
    const round = ((_f = f.league) === null || _f === void 0 ? void 0 : _f.round) ? ` — ${f.league.round}` : '';
    const score = (((_g = f.goals) === null || _g === void 0 ? void 0 : _g.home) != null && ((_h = f.goals) === null || _h === void 0 ? void 0 : _h.away) != null)
        ? ` (${f.goals.home}-${f.goals.away})`
        : '';
    return `${home} vs ${away}${score} • ${league}${round} • ${date}`;
}
async function fetchFinishedFixtures(season) {
    const res = await fetch(apiUrl(`/api/football/fixtures?season=${season}&status=FT`));
    if (!res.ok)
        throw new Error('Failed to load finished fixtures');
    const data = await res.json();
    return (data.response || []);
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
                window.location.href = 'index.html';
            }
            else {
                if (err)
                    err.textContent = 'Invalid username or password';
            }
        });
    }
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
                catch (e) {
                    if (msg) {
                        msg.textContent = e.message || 'Error';
                        msg.className = 'red-text';
                    }
                }
            });
        }
        const assignForm = document.getElementById('assignPreviousMatchForm');
        if (assignForm) {
            const assignSeasonInput = document.getElementById('assignSeason');
            const assignFixtureSelect = document.getElementById('assignFixtureSelect');
            const refreshAssignFixturesBtn = document.getElementById('refreshAssignFixturesBtn');
            const msg = document.getElementById('assignPreviousMatchMsg');
            const loadAssignableFixtures = async () => {
                if (!assignSeasonInput || !assignFixtureSelect)
                    return;
                const season = parseInt(assignSeasonInput.value, 10);
                if (Number.isNaN(season)) {
                    assignFixtureSelect.innerHTML = '<option value="">Enter a valid season first</option>';
                    return;
                }
                assignFixtureSelect.disabled = true;
                assignFixtureSelect.innerHTML = '<option value="">Loading finished fixtures…</option>';
                if (refreshAssignFixturesBtn)
                    refreshAssignFixturesBtn.disabled = true;
                try {
                    const fixtures = await fetchFinishedFixtures(season);
                    const recent = fixtures.slice(-300).reverse();
                    if (recent.length === 0) {
                        assignFixtureSelect.innerHTML = '<option value="">No finished fixtures found for this season</option>';
                        if (msg) {
                            msg.textContent = 'No finished fixtures found for selected season.';
                            msg.className = 'orange-text';
                        }
                        return;
                    }
                    assignFixtureSelect.innerHTML = '<option value="">Select a finished fixture</option>' +
                        recent.map(f => `<option value="${f.fixture.id}">${fixtureOptionLabel(f)}</option>`).join('');
                    if (msg)
                        msg.textContent = '';
                }
                catch (e) {
                    assignFixtureSelect.innerHTML = '<option value="">Failed to load fixtures</option>';
                    if (msg) {
                        msg.textContent = e.message || 'Failed to load fixtures';
                        msg.className = 'red-text';
                    }
                }
                finally {
                    assignFixtureSelect.disabled = false;
                    if (refreshAssignFixturesBtn)
                        refreshAssignFixturesBtn.disabled = false;
                }
            };
            if (assignSeasonInput) {
                assignSeasonInput.value = String(currentSeasonYear());
            }
            void loadAssignableFixtures();
            if (refreshAssignFixturesBtn) {
                refreshAssignFixturesBtn.addEventListener('click', () => {
                    void loadAssignableFixtures();
                });
            }
            assignForm.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const username = document.getElementById('assignUsername').value.trim();
                const fixtureId = parseInt(document.getElementById('assignFixtureSelect').value, 10);
                if (!username || Number.isNaN(fixtureId)) {
                    if (msg) {
                        msg.textContent = 'Please provide valid username and select a finished fixture.';
                        msg.className = 'red-text';
                    }
                    return;
                }
                try {
                    const result = await assignPreviousMatch(username, fixtureId);
                    if (msg) {
                        msg.textContent = result.message || 'Assigned.';
                        msg.className = 'green-text';
                    }
                }
                catch (e) {
                    if (msg) {
                        msg.textContent = e.message || 'Error assigning previous match';
                        msg.className = 'red-text';
                    }
                }
            });
        }
    }
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logout();
            window.location.href = 'index.html';
        });
    }
});
