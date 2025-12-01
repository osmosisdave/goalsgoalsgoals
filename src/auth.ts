type User = {
  username: string;
  password: string; // plaintext for prototype only
  role?: string;
};

/**
 * Client-side auth module (connects to a simple server-side auth API).
 * This client stores the JWT in sessionStorage for the prototype.
 */
type UserInfo = { username: string; role?: string };

const TOKEN_KEY = 'ggg_token';

// API origin can be set on the page via `window.GGG_API_ORIGIN`.
// If empty, relative paths are used (useful for local dev where server and site are same origin).
const API_ORIGIN = (window as any).GGG_API_ORIGIN ? String((window as any).GGG_API_ORIGIN).replace(/\/$/, '') : '';
function apiUrl(path: string) { return (API_ORIGIN ? API_ORIGIN : '') + path; }

export async function login(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const { token } = await res.json();
    sessionStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch (e) {
    return false;
  }
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export async function currentUser(): Promise<UserInfo | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function requireAuth(redirect = 'login.html') {
  const u = await currentUser();
  if (!u) window.location.href = redirect;
}

export async function createUser(username: string, password: string, role = 'user') {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
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
  const loginForm = document.getElementById('loginForm') as HTMLFormElement | null;
  if (loginForm) {
    loginForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const username = (document.getElementById('username') as HTMLInputElement).value.trim();
      const password = (document.getElementById('password') as HTMLInputElement).value;
      const ok = await login(username, password);
      const err = document.getElementById('loginError');
      if (ok) {
        window.location.href = 'admin.html';
      } else {
        if (err) err.textContent = 'Invalid username or password';
      }
    });
  }

  if (window.location.pathname.endsWith('admin.html')) {
    requireAuth();
    currentUser().then((user) => {
      const welcome = document.getElementById('adminWelcome');
      if (welcome && user) welcome.textContent = `Signed in as ${user.username} (${user.role || 'user'})`;
    });

    // Fetch users from API
    const list = document.getElementById('userList');
    if (list) {
      const token = getToken();
      fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((users: Array<{ username: string; role?: string }>) => {
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
    const createForm = document.getElementById('createUserForm') as HTMLFormElement | null;
    if (createForm) {
      createForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const u = (document.getElementById('newUsername') as HTMLInputElement).value.trim();
        const p = (document.getElementById('newPassword') as HTMLInputElement).value;
        const r = (document.getElementById('newRole') as HTMLInputElement).value || 'user';
        const msg = document.getElementById('createUserMsg');
        try {
            await createUser(u, p, r);
            if (msg) { msg.textContent = 'Created.'; msg.className = 'green-text'; }
            // refresh list
            if (!list) return;
            list.innerHTML = '';
            const token = getToken();
                    fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => r.json())
              .then((users: Array<{ username: string; role?: string }>) => {
                users.forEach((u) => {
                  const li = document.createElement('li');
                  li.className = 'collection-item';
                  li.textContent = `${u.username} — ${u.role || 'user'}`;
                  list.appendChild(li);
                });
              });
        } catch (e: any) {
          if (msg) { msg.textContent = e.message || 'Error'; msg.className = 'red-text'; }
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
