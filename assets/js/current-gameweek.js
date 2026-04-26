(function () {
    const root = document.getElementById('current-gameweek-root');
    if (!root)
        return;
    const rootEl = root;
    function getToken() {
        return sessionStorage.getItem('ggg_token');
    }
    // Derive the current football season start year (same logic as fixtures.ts)
    const _now = new Date();
    const currentSeason = _now.getMonth() >= 7 ? _now.getFullYear() : _now.getFullYear() - 1;
    async function fetchCurrentGameweek() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/gameweek/current?season=${currentSeason}`);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            return await res.json();
        }
        catch (err) {
            console.error('Error fetching current gameweek:', err);
            return null;
        }
    }
    function statusLabel(status) {
        switch (status) {
            case 'FT': return { text: 'Full Time', colour: '#757575' };
            case '1H':
            case '2H':
            case 'HT':
            case 'ET': return { text: 'Live', colour: '#e53935' };
            case 'PST': return { text: 'Postponed', colour: '#f57c00' };
            case 'CANC': return { text: 'Cancelled', colour: '#b71c1c' };
            default: return { text: 'Not Started', colour: '#1976d2' };
        }
    }
    function renderPlayerCard(player, isMe, isStealable) {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '12px';
        const content = document.createElement('div');
        content.className = 'card-content';
        content.style.padding = '16px';
        // Player name row
        const nameRow = document.createElement('div');
        nameRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';
        const avatar = document.createElement('i');
        avatar.className = 'material-icons';
        avatar.style.cssText = `font-size:28px;color:${isMe ? '#1976d2' : '#757575'};`;
        avatar.textContent = 'account_circle';
        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = `font-size:16px;font-weight:bold;color:${isMe ? '#1976d2' : 'inherit'};`;
        nameSpan.textContent = player.username + (isMe ? ' (You)' : '');
        nameRow.appendChild(avatar);
        nameRow.appendChild(nameSpan);
        content.appendChild(nameRow);
        if (player.selection) {
            const s = player.selection;
            // Match teams
            const matchRow = document.createElement('div');
            matchRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';
            const teams = document.createElement('div');
            teams.style.cssText = 'font-size:18px;font-weight:500;color:#2e7d32;';
            teams.textContent = `${s.homeTeam} vs ${s.awayTeam}`;
            const { text: stText, colour: stColour } = statusLabel(s.status);
            const statusBadge = document.createElement('span');
            statusBadge.style.cssText = `padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;background:${stColour};color:white;`;
            statusBadge.textContent = stText;
            matchRow.appendChild(teams);
            matchRow.appendChild(statusBadge);
            content.appendChild(matchRow);
            // At-risk warning — shown when the holder repeated a team vs their previous pick
            if (isStealable) {
                const riskBadge = document.createElement('div');
                riskBadge.style.cssText = 'margin-top:8px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;background:#ff6f00;color:white;';
                riskBadge.innerHTML = '<i class="material-icons" style="font-size:14px;">warning</i> At risk — this pick can be stolen';
                content.appendChild(riskBadge);
            }
            // Meta: league + date
            if (s.leagueName || s.date) {
                const meta = document.createElement('div');
                meta.style.cssText = 'margin-top:6px;font-size:12px;color:#666;display:flex;gap:16px;flex-wrap:wrap;';
                if (s.leagueName) {
                    meta.innerHTML += `<span><i class="material-icons" style="font-size:12px;vertical-align:middle;">sports_soccer</i> ${s.leagueName}</span>`;
                }
                if (s.date) {
                    const d = new Date(s.date).toLocaleString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    });
                    meta.innerHTML += `<span><i class="material-icons" style="font-size:12px;vertical-align:middle;">event</i> ${d}</span>`;
                }
                content.appendChild(meta);
            }
        }
        else {
            const noPick = document.createElement('div');
            noPick.style.cssText = 'display:flex;align-items:center;gap:6px;color:#9e9e9e;font-style:italic;';
            noPick.innerHTML = '<i class="material-icons" style="font-size:18px;">help_outline</i> No pick yet';
            content.appendChild(noPick);
        }
        card.appendChild(content);
        return card;
    }
    async function fetchStealable() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/matches/stealable?season=${currentSeason}`);
            if (!res.ok)
                return new Set();
            const data = await res.json();
            return new Set(data.stealableFixtureIds);
        }
        catch (_a) {
            return new Set();
        }
    }
    async function render() {
        var _a, _b;
        rootEl.innerHTML = '<div class="progress"><div class="indeterminate"></div></div>';
        const token = getToken();
        let currentUsername = null;
        if (token) {
            try {
                // Decode JWT payload (no verification needed client-side — just for display)
                const payload = JSON.parse(atob(token.split('.')[1]));
                currentUsername = (_b = (_a = payload.sub) !== null && _a !== void 0 ? _a : payload.username) !== null && _b !== void 0 ? _b : null;
            }
            catch ( /* ignore */_c) { /* ignore */ }
        }
        const [data, stealableIds] = await Promise.all([
            fetchCurrentGameweek(),
            fetchStealable(),
        ]);
        rootEl.innerHTML = '';
        // Page heading
        const heading = document.createElement('h4');
        heading.style.marginBottom = '4px';
        heading.innerHTML = '<i class="material-icons left" style="font-size:32px;vertical-align:middle;">today</i>Current Gameweek';
        rootEl.appendChild(heading);
        if (!data || !data.gameweek) {
            const msg = document.createElement('p');
            msg.className = 'grey-text';
            msg.textContent = 'No gameweek is currently open for selection.';
            rootEl.appendChild(msg);
            return;
        }
        const { gameweek, players } = data;
        const subheading = document.createElement('p');
        subheading.className = 'grey-text';
        subheading.style.marginTop = '0';
        subheading.textContent = gameweek.label;
        rootEl.appendChild(subheading);
        // Summary bar
        const picked = players.filter(p => p.selection !== null).length;
        const summary = document.createElement('div');
        summary.className = 'card-panel blue lighten-5';
        summary.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:24px;padding:12px 16px;';
        summary.innerHTML = `
      <span><i class="material-icons" style="font-size:16px;vertical-align:middle;color:#1976d2;">people</i>
        <strong>${players.length}</strong> player${players.length !== 1 ? 's' : ''}
      </span>
      <span><i class="material-icons" style="font-size:16px;vertical-align:middle;color:#2e7d32;">check_circle</i>
        <strong>${picked}</strong> picked
      </span>
      <span><i class="material-icons" style="font-size:16px;vertical-align:middle;color:#9e9e9e;">help_outline</i>
        <strong>${players.length - picked}</strong> still to pick
      </span>`;
        rootEl.appendChild(summary);
        if (players.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'grey-text';
            empty.textContent = 'No players found.';
            rootEl.appendChild(empty);
            return;
        }
        // Sort: current user first, then alphabetically
        const sorted = [...players].sort((a, b) => {
            if (a.username === currentUsername)
                return -1;
            if (b.username === currentUsername)
                return 1;
            return a.username.localeCompare(b.username);
        });
        for (const player of sorted) {
            const isStealable = player.selection != null && stealableIds.has(player.selection.fixtureId);
            rootEl.appendChild(renderPlayerCard(player, player.username === currentUsername, isStealable));
        }
    }
    document.addEventListener('DOMContentLoaded', render);
})();
export {};
