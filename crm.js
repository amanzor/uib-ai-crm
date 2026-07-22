/* ══════════════════════════════════════════════════════════════════
   UIB CRM — Universal Insurance Brokers
   Same theme + data conventions as the UIB Binder Book.
   Storage: localStorage (uibcrm_*), credentials shared with the
   Binder Book via the same 'agentCredentials' key.
   ══════════════════════════════════════════════════════════════════ */

// ── Reference data (mirrors the Binder Book) ─────────────────────────
const AGENTS = ['Alberto Manzor', 'Randy Diaz', 'Amanda Montano', 'Uriel Rendon', 'Jorge Castro', 'Lazaro Reigoza'];
const ADMIN_PASSWORD = 'admin123';   // same as UIB Binder Book

const CARRIERS = [
    'Progressive', 'Infinity', 'United Automobile', 'Kemper Insurance',
    'Bristol West', 'National General', 'Ocean Harbor', 'Mercury',
    'GEICO', 'Citizens', 'Universal Property', 'Other'
];

const LOBS = [
    'Personal Auto', 'Commercial Auto', 'Homeowners', 'Renters',
    'General Liability', 'Workers Comp', 'Pollution Liability',
    'Non-Trucking Liability', 'Motorcycle', 'Boat', 'Umbrella', 'Other'
];

const STAGES = [
    { key: 'new',      label: 'New Lead',  badge: 'badge-blue',   card: 'stage-new' },
    { key: 'quoted',   label: 'Quoted',    badge: 'badge-purple', card: 'stage-quoted' },
    { key: 'followup', label: 'Follow-Up', badge: 'badge-amber',  card: 'stage-followup' },
    { key: 'bound',    label: 'Bound',     badge: 'badge-green',  card: 'stage-bound' },
    { key: 'lost',     label: 'Lost',      badge: 'badge-red',    card: 'stage-lost' }
];

const ACTIVITY_ICONS = { call: 'phone', email: 'mail', note: 'sticky-note', meeting: 'calendar' };
const RENEWAL_WINDOW_DAYS = 90;

// ── One-time reset (2026-07-22): wipe sample/seed data from browsers
//    that loaded the initial release ─────────────────────────────────
if (!localStorage.getItem('uibcrm_reset_20260722')) {
    ['uibcrm_contacts', 'uibcrm_leads', 'uibcrm_tasks', 'uibcrm_activities']
        .forEach(k => localStorage.removeItem(k));
    localStorage.setItem('uibcrm_reset_20260722', '1');
}

// ── State ────────────────────────────────────────────────────────────
let contacts   = load('uibcrm_contacts');
let leads      = load('uibcrm_leads');
let tasks      = load('uibcrm_tasks');
let activities = load('uibcrm_activities');
let stageFilter = '';   // pipeline stage-card filter
let session = null;     // { name, role: 'agent' | 'admin' }
try { session = JSON.parse(localStorage.getItem('uibcrm_session')); } catch { session = null; }

function load(key)      { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function persist()      {
    localStorage.setItem('uibcrm_contacts',   JSON.stringify(contacts));
    localStorage.setItem('uibcrm_leads',      JSON.stringify(leads));
    localStorage.setItem('uibcrm_tasks',      JSON.stringify(tasks));
    localStorage.setItem('uibcrm_activities', JSON.stringify(activities));
}
function uid()          { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s)         { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function money(n)       { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function todayISO()     { return new Date().toISOString().slice(0, 10); }
function fmtDate(d)     { return d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function fmtWhen(iso)   { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function initials(name) { return name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase(); }

function toast(msg) {
    const el = document.getElementById('successMessage');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function refreshIcons() { if (window.lucide) lucide.createIcons(); }

// ══════════════════════════════════════════════════════════════════
// CREDENTIALS — same structure & key as the UIB Binder Book:
// localStorage 'agentCredentials' = { "Agent Name": { email, password } }
// Default password = agent's first name, lowercase (e.g. "alberto")
// ══════════════════════════════════════════════════════════════════
function initializeCredentials() {
    let credentials;
    try { credentials = JSON.parse(localStorage.getItem('agentCredentials')); } catch { credentials = null; }
    if (!credentials || typeof credentials !== 'object') credentials = {};

    let changed = false;

    // Migrate any legacy plain-string entry to {email, password}
    Object.keys(credentials).forEach(agent => {
        if (typeof credentials[agent] === 'string') {
            credentials[agent] = { email: '', password: credentials[agent] };
            changed = true;
        }
    });

    // Add defaults ONLY for agents with no entry — never overwrite saved creds
    AGENTS.forEach(agent => {
        if (!credentials[agent]) {
            credentials[agent] = { email: '', password: agent.split(' ')[0].toLowerCase() };
            changed = true;
        }
    });

    if (changed) localStorage.setItem('agentCredentials', JSON.stringify(credentials));
    return credentials;
}

function getCredentials() {
    try { return JSON.parse(localStorage.getItem('agentCredentials')) || {}; } catch { return {}; }
}

function getAllAgents() {
    return [...new Set([...AGENTS, ...Object.keys(getCredentials())])].sort();
}

// ── Auth / session ───────────────────────────────────────────────────
function isAdmin()      { return session?.role === 'admin'; }
function currentAgent() { return session?.name || ''; }

function setSession(name, role) {
    session = { name, role };
    localStorage.setItem('uibcrm_session', JSON.stringify(session));
    applySession();
}

function logout() {
    session = null;
    localStorage.removeItem('uibcrm_session');
    applySession();
}

function applySession() {
    const loginScreen = document.getElementById('loginScreen');
    document.body.classList.toggle('role-admin', isAdmin());
    document.body.classList.toggle('role-agent', !!session && !isAdmin());
    if (!session) {
        loginScreen.style.display = 'flex';
        const remembered = localStorage.getItem('rememberedAgentEmail');
        if (remembered) {
            document.getElementById('agentLoginEmail').value = remembered;
            document.getElementById('rememberAgentEmail').checked = true;
        }
        refreshIcons();
        return;
    }
    loginScreen.style.display = 'none';
    document.getElementById('userBar').innerHTML = `
        <span class="user-chip"><i data-lucide="${isAdmin() ? 'shield' : 'user'}"></i> ${esc(session.name)}${isAdmin() && session.name !== 'Admin' ? ' (Admin)' : ''}</span>
        <button class="nav-tab" onclick="logout()" title="Sign out"><i data-lucide="log-out"></i> Logout</button>`;
    switchTab('dashboard');
}

// Login form (email + password — same matching logic as the Binder Book)
function submitAgentEmailLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('agentLoginEmail').value.trim().toLowerCase();
    const password = document.getElementById('agentLoginPassword').value;
    const errEl    = document.getElementById('agentLoginError');
    const credentials = getCredentials();

    let matched = null;
    Object.entries(credentials).forEach(([name, data]) => {
        const storedEmail = (typeof data === 'object' ? data.email : '') || '';
        const storedPass  = (typeof data === 'object' ? data.password : data) || '';
        if (storedEmail.toLowerCase() === email && storedPass === password) matched = name;
    });

    if (!matched) {
        errEl.textContent = 'Incorrect email or password. Please try again.';
        errEl.style.display = 'block';
        return;
    }
    errEl.style.display = 'none';

    if (document.getElementById('rememberAgentEmail').checked) {
        localStorage.setItem('rememberedAgentEmail', email);
    } else {
        localStorage.removeItem('rememberedAgentEmail');
    }
    document.getElementById('agentLoginPassword').value = '';
    setSession(matched, 'agent');
    toast(`Welcome, ${matched.split(' ')[0]}!`);
}

function togglePasswordVisibility(inputId) {
    const inp = document.getElementById(inputId);
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

// Admin login (same password as the Binder Book)
function showAdminLogin() {
    openModal('adminLoginModal');
    setTimeout(() => document.getElementById('adminPassword').focus(), 60);
}

function submitAdminLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('adminPassword').value;
    const errEl = document.getElementById('adminLoginError');
    if (pass === ADMIN_PASSWORD) {
        document.getElementById('adminPassword').value = '';
        errEl.style.display = 'none';
        closeModal('adminLoginModal');
        setSession('Admin', 'admin');
        toast('Welcome, Admin!');
    } else {
        errEl.textContent = 'Incorrect admin password.';
        errEl.style.display = 'block';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
    }
}

// ── Role-based visibility: agents see only their own records ────────
function visibleContacts()   { return isAdmin() ? contacts   : contacts.filter(c => c.agent === currentAgent()); }
function visibleLeads()      { return isAdmin() ? leads      : leads.filter(l => l.agent === currentAgent()); }
function visibleTasks()      { return isAdmin() ? tasks      : tasks.filter(t => t.agent === currentAgent()); }
function visibleActivities() { return isAdmin() ? activities : activities.filter(a => a.agent === currentAgent()); }

// ── Tabs ─────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('section-' + tab).classList.add('active');
    renderAll();
}

// ── Select helpers ───────────────────────────────────────────────────
function fillSelect(id, items, { blank = null, selected = '' } = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML =
        (blank !== null ? `<option value="">${esc(blank)}</option>` : '') +
        items.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

function fillStaticSelects() {
    const agents = getAllAgents();
    // Filters
    fillSelect('contactAgentFilter', agents, { blank: 'All Agents' });
    fillSelect('contactLobFilter',   LOBS,   { blank: 'All LOBs' });
    fillSelect('leadAgentFilter',    agents, { blank: 'All Agents' });
    fillSelect('taskAgentFilter',    agents, { blank: 'All Agents' });
    fillSelect('renewalAgentFilter', agents, { blank: 'All Agents' });
    // Modal dropdowns
    fillSelect('cLob',     LOBS,     { blank: '— Select —' });
    fillSelect('cCarrier', CARRIERS, { blank: '— Select —' });
    fillSelect('cAgent',   agents);
    fillSelect('lLob',     LOBS,     { blank: '— Select —' });
    fillSelect('lCarrier', CARRIERS, { blank: '— Select —' });
    fillSelect('lAgent',   agents);
    fillSelect('tAgent',   agents);
    fillSelect('aAgent',   agents);
    const stageEl = document.getElementById('lStage');
    stageEl.innerHTML = STAGES.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
}

function fillContactSelects() {
    const names = visibleContacts().map(c => c.name).sort((a, b) => a.localeCompare(b));
    fillSelect('tContact', names, { blank: '— None —' });
    fillSelect('aContact', names, { blank: '— None —' });
}

// ── Dashboard ────────────────────────────────────────────────────────
function renderDashboard() {
    const myLeads = visibleLeads();
    const open = myLeads.filter(l => l.stage !== 'bound' && l.stage !== 'lost');
    const pipelinePremium = open.reduce((s, l) => s + Number(l.premium || 0), 0);
    const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const dueSoon = visibleTasks().filter(t => !t.done && t.due && t.due <= week);

    document.getElementById('statContacts').textContent = visibleContacts().length;
    document.getElementById('statLeads').textContent    = open.length;
    document.getElementById('statPremium').textContent  = money(pipelinePremium);
    document.getElementById('statTasks').textContent    = dueSoon.length;

    // Chart 1 — leads by stage (blue gradient, Binder Book style)
    const stageData = STAGES.map(s => ({
        label: s.label,
        value: myLeads.filter(l => l.stage === s.key).length,
        sub: money(myLeads.filter(l => l.stage === s.key).reduce((a, l) => a + Number(l.premium || 0), 0))
    }));
    renderBarChart('stageChart', stageData, 'linear-gradient(90deg, var(--blue) 0%, var(--blue-light) 100%)', v => v);

    // Chart 2 — open-pipeline premium by agent (purple→blue gradient)
    const chartAgents = isAdmin() ? getAllAgents() : [currentAgent()];
    const byAgent = {};
    open.forEach(l => { byAgent[l.agent || '—'] = (byAgent[l.agent || '—'] || 0) + Number(l.premium || 0); });
    const agentData = chartAgents
        .map(a => ({ label: a, value: byAgent[a] || 0, sub: (open.filter(l => l.agent === a).length) + ' leads' }))
        .sort((a, b) => b.value - a.value);
    renderBarChart('agentChart', agentData, 'linear-gradient(90deg, var(--purple) 0%, var(--blue-light) 100%)', money);

    // Upcoming tasks
    const upcoming = visibleTasks().filter(t => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 6);
    document.getElementById('dashTasks').innerHTML = upcoming.length
        ? upcoming.map(t => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-100);align-items:center;">
                <div style="min-width:0;">
                    <div style="font-size:13px;font-weight:600;color:var(--gray-700);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.title)}</div>
                    <div style="font-size:11.5px;color:var(--gray-400);">${esc(t.agent || '—')}${t.contact ? ' · ' + esc(t.contact) : ''}</div>
                </div>
                <span class="badge ${t.due && t.due < todayISO() ? 'badge-red' : 'badge-blue'}">${fmtDate(t.due)}</span>
            </div>`).join('')
        : '<div class="no-data">No open tasks 🎉</div>';

    // Recent activity
    const recent = [...visibleActivities()].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 6);
    document.getElementById('dashActivities').innerHTML = recent.length
        ? recent.map(a => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--gray-100);align-items:center;">
                <div style="min-width:0;">
                    <div style="font-size:13px;font-weight:600;color:var(--gray-700);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.text)}</div>
                    <div style="font-size:11.5px;color:var(--gray-400);">${esc(a.agent || '—')}${a.contact ? ' · ' + esc(a.contact) : ''}</div>
                </div>
                <span class="badge badge-gray">${esc(a.type)}</span>
            </div>`).join('')
        : '<div class="no-data">No activity yet.</div>';
}

// Horizontal bar chart in the exact Binder Book / Production style
function renderBarChart(elId, rows, gradient, fmt) {
    const el = document.getElementById(elId);
    const max = Math.max(...rows.map(r => r.value), 1);
    if (!rows.some(r => r.value)) { el.innerHTML = '<div class="no-data">No data yet.</div>'; return; }
    el.innerHTML = rows.map(r => {
        const pct = Math.round((r.value / max) * 100);
        const fill = r.value > 0
            ? `<div class="prod-bar-fill" data-chart-bar="${pct}" style="background:${gradient};">
                    <span>${esc(String(fmt(r.value)))}</span>
                </div>`
            : `<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;font-weight:600;color:var(--gray-400);">${esc(String(fmt(0)))}</span>`;
        return `
        <div class="prod-bar-row" title="${esc(r.label)}: ${esc(String(fmt(r.value)))}${r.sub ? ' (' + esc(r.sub) + ')' : ''}">
            <div class="prod-bar-label">${esc(r.label)}</div>
            <div class="prod-bar-track">${fill}</div>
            <div class="prod-bar-count">${esc(r.sub || '')}</div>
        </div>`;
    }).join('');
    animateChartBars(el);
}

function animateChartBars(container) {
    requestAnimationFrame(() => {
        container.querySelectorAll('[data-chart-bar]').forEach(bar => {
            bar.style.width = bar.dataset.chartBar + '%';
        });
    });
}

// ── Contacts ─────────────────────────────────────────────────────────
function typeBadge(t) {
    return { Customer: 'badge-green', Lead: 'badge-purple', Prospect: 'badge-amber' }[t] || 'badge-gray';
}

function renderContacts() {
    const q     = (document.getElementById('contactSearch').value || '').toLowerCase();
    const type  = document.getElementById('contactTypeFilter').value;
    const agent = isAdmin() ? document.getElementById('contactAgentFilter').value : '';
    const lob   = document.getElementById('contactLobFilter').value;

    const rows = visibleContacts().filter(c =>
        (!type  || c.type === type) &&
        (!agent || c.agent === agent) &&
        (!lob   || c.lob === lob) &&
        (!q || [c.name, c.phone, c.email, c.policy, c.carrier].some(v => (v || '').toLowerCase().includes(q)))
    );

    document.getElementById('contactsBody').innerHTML = rows.length ? rows.map(c => `
        <tr>
            <td><strong style="color:var(--navy);">${esc(c.name)}</strong>${c.office ? `<div style="font-size:11px;color:var(--gray-400);">${esc(c.office)}</div>` : ''}</td>
            <td><span class="badge ${typeBadge(c.type)}">${esc(c.type)}</span></td>
            <td>${esc(c.phone) || '—'}</td>
            <td>${esc(c.email) || '—'}</td>
            <td>${esc(c.lob) || '—'}</td>
            <td>${esc(c.carrier) || '—'}</td>
            <td>${esc(c.agent) || '—'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-primary btn-sm" onclick="openContactModal('${c.id}')"><i data-lucide="pencil"></i> Edit</button>
                    <button class="btn-purple btn-sm" title="Reassign to another agent" onclick="openReassignModal('${c.id}')"><i data-lucide="arrow-left-right"></i> Reassign</button>
                    <button class="btn-success btn-sm" onclick="quickLog('${c.id}')"><i data-lucide="phone"></i> Log</button>
                    <button class="btn-danger btn-sm" onclick="deleteContact('${c.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>`).join('')
        : '<tr><td colspan="8"><div class="no-data">No contacts match.</div></td></tr>';
    refreshIcons();
}

function openContactModal(id) {
    const c = contacts.find(x => x.id === id);
    document.getElementById('contactModalTitle').textContent = c ? 'Edit Contact' : 'Add Contact';
    document.getElementById('contactId').value = c ? c.id : '';
    setVal('cName', c?.name); setVal('cPhone', c?.phone); setVal('cEmail', c?.email);
    setVal('cAddress', c?.address); setVal('cDob', c?.dob);
    setVal('cType', c?.type || 'Customer');
    setVal('cLob', c?.lob); setVal('cCarrier', c?.carrier); setVal('cPolicy', c?.policy);
    setVal('cPremium', c?.premium || ''); setVal('cEffective', c?.effective); setVal('cExpiration', c?.expiration);
    setVal('cAgent', c?.agent || (isAdmin() ? getAllAgents()[0] : currentAgent()));
    // Binder Book rule: Jorge Castro → Franchise office, everyone else → Hialeah
    setVal('cOffice', c?.office || (document.getElementById('cAgent').value === 'Jorge Castro' ? 'Franchise' : 'Hialeah'));
    setVal('cNotes', c?.notes);
    openModal('contactModal');
}

function saveContact() {
    const name = document.getElementById('cName').value.trim();
    if (!name) { toast('Name is required'); return; }
    const id = document.getElementById('contactId').value;
    const agent = document.getElementById('cAgent').value;
    const data = {
        name,
        type:       document.getElementById('cType').value,
        phone:      document.getElementById('cPhone').value.trim(),
        email:      document.getElementById('cEmail').value.trim(),
        address:    document.getElementById('cAddress').value.trim(),
        dob:        document.getElementById('cDob').value,
        lob:        document.getElementById('cLob').value,
        carrier:    document.getElementById('cCarrier').value,
        policy:     document.getElementById('cPolicy').value.trim(),
        premium:    Number(document.getElementById('cPremium').value || 0),
        effective:  document.getElementById('cEffective').value,
        expiration: document.getElementById('cExpiration').value,
        agent,
        office:     document.getElementById('cOffice').value || (agent === 'Jorge Castro' ? 'Franchise' : 'Hialeah'),
        notes:      document.getElementById('cNotes').value.trim()
    };
    if (id) {
        const i = contacts.findIndex(x => x.id === id);
        contacts[i] = { ...contacts[i], ...data };
        toast('Contact updated ✓');
    } else {
        contacts.push({ id: uid(), ...data });
        toast('Contact added ✓');
    }
    persist(); closeModal('contactModal'); renderAll();
}

function deleteContact(id) {
    const c = contacts.find(x => x.id === id);
    if (!c || !confirm(`Delete contact "${c.name}"?`)) return;
    contacts = contacts.filter(x => x.id !== id);
    persist(); renderAll(); toast('Contact deleted');
}

function quickLog(id) {
    const c = contacts.find(x => x.id === id);
    openActivityModal();
    if (c) { setVal('aContact', c.name); setVal('aAgent', c.agent || currentAgent()); }
}

// ── Reassign clients agent → agent ───────────────────────────────────
function openReassignModal(id) {
    const c = contacts.find(x => x.id === id);
    if (!c) return;
    document.getElementById('reassignContactId').value = c.id;
    document.getElementById('reassignWho').innerHTML =
        `<strong style="color:var(--navy);">${esc(c.name)}</strong> — currently assigned to <span class="badge badge-blue">${esc(c.agent || 'Unassigned')}</span>`;
    fillSelect('reassignAgent', getAllAgents().filter(a => a !== c.agent));
    document.getElementById('reassignMoveOpen').checked = true;
    openModal('reassignModal');
}

function submitReassign() {
    const id = document.getElementById('reassignContactId').value;
    const c = contacts.find(x => x.id === id);
    const newAgent = document.getElementById('reassignAgent').value;
    if (!c || !newAgent) return;
    const oldAgent = c.agent || 'Unassigned';
    const moveOpen = document.getElementById('reassignMoveOpen').checked;

    c.agent = newAgent;
    c.office = newAgent === 'Jorge Castro' ? 'Franchise' : (c.office || 'Hialeah');

    let moved = 0;
    if (moveOpen) {
        leads.forEach(l => {
            if (l.name.toLowerCase() === c.name.toLowerCase() && l.stage !== 'bound' && l.stage !== 'lost' && l.agent !== newAgent) {
                l.agent = newAgent; moved++;
            }
        });
        tasks.forEach(t => {
            if (!t.done && t.contact && t.contact.toLowerCase() === c.name.toLowerCase() && t.agent !== newAgent) {
                t.agent = newAgent; moved++;
            }
        });
    }

    activities.unshift({
        id: uid(), type: 'note', contact: c.name, agent: newAgent,
        text: `Client reassigned from ${oldAgent} to ${newAgent}${moved ? ` (+${moved} open lead/task record${moved > 1 ? 's' : ''} moved)` : ''} by ${currentAgent()}.`,
        when: new Date().toISOString()
    });

    persist(); closeModal('reassignModal'); renderAll();
    toast(`${c.name} reassigned to ${newAgent} ✓`);
}

// ── Pipeline ─────────────────────────────────────────────────────────
function renderStageCards() {
    const myLeads = visibleLeads();
    document.getElementById('stageCards').innerHTML = STAGES.map(s => {
        const inStage = myLeads.filter(l => l.stage === s.key);
        const amt = inStage.reduce((a, l) => a + Number(l.premium || 0), 0);
        return `
        <div class="stage-card ${s.card} ${stageFilter === s.key ? 'selected' : ''}" onclick="toggleStageFilter('${s.key}')">
            <h5>${s.label}</h5>
            <div class="count">${inStage.length}</div>
            <div class="amt">${money(amt)}</div>
        </div>`;
    }).join('');
}

function toggleStageFilter(key) {
    stageFilter = stageFilter === key ? '' : key;
    renderStageCards(); renderLeads();
}

function stageOf(key) { return STAGES.find(s => s.key === key) || STAGES[0]; }

function renderLeads() {
    const q     = (document.getElementById('leadSearch').value || '').toLowerCase();
    const agent = isAdmin() ? document.getElementById('leadAgentFilter').value : '';

    const rows = visibleLeads().filter(l =>
        (!stageFilter || l.stage === stageFilter) &&
        (!agent || l.agent === agent) &&
        (!q || [l.name, l.lob, l.carrier, l.phone].some(v => (v || '').toLowerCase().includes(q)))
    );

    document.getElementById('leadsBody').innerHTML = rows.length ? rows.map(l => {
        const s = stageOf(l.stage);
        const next = STAGES[Math.min(STAGES.findIndex(x => x.key === l.stage) + 1, STAGES.length - 2)];
        const canAdvance = l.stage !== 'bound' && l.stage !== 'lost';
        return `
        <tr>
            <td><strong style="color:var(--navy);">${esc(l.name)}</strong><div style="font-size:11px;color:var(--gray-400);">${esc(l.phone) || ''}${l.source ? ' · ' + esc(l.source) : ''}</div></td>
            <td>${esc(l.lob) || '—'}</td>
            <td>${esc(l.carrier) || '—'}</td>
            <td><strong>${money(l.premium)}</strong></td>
            <td>${esc(l.agent) || '—'}</td>
            <td><span class="badge ${s.badge}">${s.label}</span></td>
            <td>
                <div class="action-buttons">
                    ${canAdvance ? `<button class="btn-success btn-sm" title="Advance to ${next.label}" onclick="advanceLead('${l.id}')"><i data-lucide="arrow-right"></i> ${next.label}</button>` : ''}
                    ${canAdvance ? `<button class="btn-danger btn-sm" title="Mark Lost" onclick="setLeadStage('${l.id}','lost')"><i data-lucide="x"></i></button>` : ''}
                    <button class="btn-primary btn-sm" onclick="openLeadModal('${l.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-secondary btn-sm" onclick="deleteLead('${l.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('')
        : '<tr><td colspan="7"><div class="no-data">No leads match.</div></td></tr>';
    refreshIcons();
}

function openLeadModal(id) {
    const l = leads.find(x => x.id === id);
    document.getElementById('leadModalTitle').textContent = l ? 'Edit Lead' : 'Add Lead';
    document.getElementById('leadId').value = l ? l.id : '';
    setVal('lName', l?.name); setVal('lPhone', l?.phone);
    setVal('lSource', l?.source || 'Walk-In');
    setVal('lLob', l?.lob); setVal('lCarrier', l?.carrier);
    setVal('lPremium', l?.premium || '');
    setVal('lStage', l?.stage || 'new');
    setVal('lAgent', l?.agent || (isAdmin() ? getAllAgents()[0] : currentAgent()));
    setVal('lNotes', l?.notes);
    openModal('leadModal');
}

function saveLead() {
    const name = document.getElementById('lName').value.trim();
    if (!name) { toast('Name is required'); return; }
    const id = document.getElementById('leadId').value;
    const data = {
        name,
        phone:   document.getElementById('lPhone').value.trim(),
        source:  document.getElementById('lSource').value,
        lob:     document.getElementById('lLob').value,
        carrier: document.getElementById('lCarrier').value,
        premium: Number(document.getElementById('lPremium').value || 0),
        stage:   document.getElementById('lStage').value,
        agent:   document.getElementById('lAgent').value,
        notes:   document.getElementById('lNotes').value.trim()
    };
    if (id) {
        const i = leads.findIndex(x => x.id === id);
        leads[i] = { ...leads[i], ...data };
        toast('Lead updated ✓');
    } else {
        leads.push({ id: uid(), created: todayISO(), ...data });
        toast('Lead added ✓');
    }
    persist(); closeModal('leadModal'); renderAll();
}

function advanceLead(id) {
    const l = leads.find(x => x.id === id);
    if (!l) return;
    const i = STAGES.findIndex(s => s.key === l.stage);
    const next = STAGES[Math.min(i + 1, STAGES.length - 2)];   // never auto-advance into "lost"
    setLeadStage(id, next.key);
}

function setLeadStage(id, stage) {
    const l = leads.find(x => x.id === id);
    if (!l) return;
    l.stage = stage;
    // Bound leads become customers in Contacts (Binder Book sync behavior)
    if (stage === 'bound') {
        const existing = contacts.find(c => c.name.toLowerCase() === l.name.toLowerCase());
        if (existing) {
            existing.type = 'Customer';
            existing.lob = existing.lob || l.lob;
            existing.carrier = existing.carrier || l.carrier;
            existing.premium = existing.premium || l.premium;
            existing.agent = existing.agent || l.agent;
        } else {
            contacts.push({
                id: uid(), name: l.name, type: 'Customer', phone: l.phone || '', email: '',
                address: '', dob: '', lob: l.lob || '', carrier: l.carrier || '', policy: '',
                premium: l.premium || 0, effective: todayISO(), expiration: '',
                agent: l.agent || '', office: l.agent === 'Jorge Castro' ? 'Franchise' : 'Hialeah', notes: l.notes || ''
            });
        }
        activities.unshift({ id: uid(), type: 'note', contact: l.name, agent: l.agent || '', text: `Policy bound 🎉 (${l.lob || 'LOB n/a'}${l.carrier ? ' — ' + l.carrier : ''}, ${money(l.premium)})`, when: new Date().toISOString() });
        toast(`${l.name} bound — added to Contacts ✓`);
    } else {
        toast(`Stage → ${stageOf(stage).label}`);
    }
    persist(); renderAll();
}

function deleteLead(id) {
    const l = leads.find(x => x.id === id);
    if (!l || !confirm(`Delete lead "${l.name}"?`)) return;
    leads = leads.filter(x => x.id !== id);
    persist(); renderAll(); toast('Lead deleted');
}

// ── Renewals ─────────────────────────────────────────────────────────
function daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 864e5);
}

function renewalRows() {
    return visibleContacts()
        .filter(c => c.expiration)
        .map(c => ({ c, days: daysUntil(c.expiration) }))
        .filter(r => r.days !== null && r.days <= RENEWAL_WINDOW_DAYS)
        .sort((a, b) => a.days - b.days);
}

function renderRenewals() {
    const agent = isAdmin() ? document.getElementById('renewalAgentFilter').value : '';
    const rows = renewalRows().filter(r => !agent || r.c.agent === agent);

    document.getElementById('renewalCount').textContent =
        `${rows.length} polic${rows.length === 1 ? 'y' : 'ies'} expiring within ${RENEWAL_WINDOW_DAYS} days`;

    document.getElementById('renewalsBody').innerHTML = rows.length ? rows.map(({ c, days }) => {
        const badge = days < 0 ? 'badge-red' : days <= 15 ? 'badge-red' : days <= 45 ? 'badge-amber' : 'badge-green';
        const label = days < 0 ? `Expired ${-days}d ago` : days === 0 ? 'Expires today' : `${days} days`;
        return `
        <tr>
            <td><strong style="color:var(--navy);">${esc(c.name)}</strong><div style="font-size:11px;color:var(--gray-400);">${esc(c.phone) || ''}</div></td>
            <td>${esc(c.lob) || '—'}</td>
            <td>${esc(c.carrier) || '—'}</td>
            <td>${esc(c.policy) || '—'}</td>
            <td>${money(c.premium)}</td>
            <td>${fmtDate(c.expiration)}</td>
            <td><span class="badge ${badge}">${label}</span></td>
            <td>${esc(c.agent) || '—'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-success btn-sm" title="Log renewal call" onclick="quickLog('${c.id}')"><i data-lucide="phone"></i> Call</button>
                    <button class="btn-primary btn-sm" title="Update policy dates" onclick="openContactModal('${c.id}')"><i data-lucide="refresh-cw"></i> Renew</button>
                    <button class="btn-purple btn-sm" title="Reassign" onclick="openReassignModal('${c.id}')"><i data-lucide="arrow-left-right"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('')
        : `<tr><td colspan="9"><div class="no-data">No renewals due in the next ${RENEWAL_WINDOW_DAYS} days.</div></td></tr>`;
    refreshIcons();
}

// ── Agents section ───────────────────────────────────────────────────
function renderAgents() {
    const agents = getAllAgents();
    const creds = getCredentials();
    document.getElementById('agentCards').innerHTML = agents.map(a => {
        const myContacts = contacts.filter(c => c.agent === a);
        const myOpen = leads.filter(l => l.agent === a && l.stage !== 'bound' && l.stage !== 'lost');
        const premium = myOpen.reduce((s, l) => s + Number(l.premium || 0), 0);
        const renewals = contacts.filter(c => c.agent === a && c.expiration && daysUntil(c.expiration) !== null && daysUntil(c.expiration) <= RENEWAL_WINDOW_DAYS).length;
        const email = creds[a]?.email;
        return `
        <div class="agent-card">
            <div class="agent-card-top">
                <div class="agent-avatar">${esc(initials(a))}</div>
                <div style="min-width:0;">
                    <div class="agent-card-name">${esc(a)}</div>
                    <div class="agent-card-email">${email ? esc(email) : '<span style="color:var(--gray-300);">no email set</span>'}</div>
                </div>
            </div>
            <div class="agent-card-stats">
                <div><span class="num">${myContacts.length}</span><span class="lbl">Clients</span></div>
                <div><span class="num">${myOpen.length}</span><span class="lbl">Open Leads</span></div>
                <div><span class="num">${money(premium)}</span><span class="lbl">Pipeline</span></div>
                <div><span class="num">${renewals}</span><span class="lbl">Renewals</span></div>
            </div>
            <div class="action-buttons" style="margin-top:12px;">
                <button class="btn-primary btn-sm" onclick="viewAgentClients('${esc(a)}')"><i data-lucide="users"></i> Clients</button>
                <button class="btn-secondary btn-sm" onclick="viewAgentPipeline('${esc(a)}')"><i data-lucide="trending-up"></i> Pipeline</button>
            </div>
        </div>`;
    }).join('');
    refreshIcons();
}

function viewAgentClients(agent) {
    switchTab('contacts');
    if (isAdmin()) { setVal('contactAgentFilter', agent); renderContacts(); }
}

function viewAgentPipeline(agent) {
    switchTab('pipeline');
    if (isAdmin()) { setVal('leadAgentFilter', agent); renderLeads(); }
}

// ── Credential Manager (admin) — mirrors the Binder Book page ───────
function openCredentialManager() {
    if (!isAdmin()) { toast('Admin access required'); return; }
    renderCredentialList();
    openModal('credentialsModal');
}

function renderCredentialList() {
    const credentials = getCredentials();
    const allAgents = getAllAgents();
    document.getElementById('credentialList').innerHTML = allAgents.map(agent => {
        const cred = credentials[agent] || { email: '', password: '' };
        const key = agent.replace(/\s+/g, '_');
        return `
        <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-weight:700;color:var(--navy);font-size:14px;"><i data-lucide="user"></i> ${esc(agent)}</span>
                <span id="cred_status_${key}" style="font-size:12px;color:var(--green);font-weight:600;opacity:0;transition:opacity .3s;">✓ Saved</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                    <label style="font-size:12px;color:var(--gray-500);font-weight:600;display:block;margin-bottom:4px;">Email (username)</label>
                    <input type="email" id="cred_email_${key}"
                        value="${esc(cred.email || '')}" placeholder="agent@email.com"
                        oninput="autoSaveCredential('${esc(agent)}')"
                        style="width:100%;padding:8px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500);font-weight:600;display:block;margin-bottom:4px;">Password</label>
                    <input type="text" id="cred_pass_${key}"
                        value="${esc(cred.password || '')}" placeholder="Enter password"
                        oninput="autoSaveCredential('${esc(agent)}')"
                        style="width:100%;padding:8px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;">
                </div>
            </div>
        </div>`;
    }).join('');
    refreshIcons();
}

function autoSaveCredential(agent) {
    const key = agent.replace(/\s+/g, '_');
    const email = document.getElementById(`cred_email_${key}`)?.value.trim() || '';
    const pass  = document.getElementById(`cred_pass_${key}`)?.value.trim() || '';
    const credentials = getCredentials();
    credentials[agent] = { email, password: pass };
    localStorage.setItem('agentCredentials', JSON.stringify(credentials));
    const status = document.getElementById(`cred_status_${key}`);
    if (status) {
        status.style.opacity = '1';
        clearTimeout(status._hideTimer);
        status._hideTimer = setTimeout(() => { status.style.opacity = '0'; }, 2000);
    }
}

function submitAddAgent(e) {
    e.preventDefault();
    const name  = document.getElementById('newCredAgent').value.trim();
    const email = document.getElementById('newCredEmail').value.trim();
    const pass  = document.getElementById('newCredPassword').value.trim();
    if (!name || !pass) { toast('Agent name and password are required'); return; }
    const credentials = getCredentials();
    if (credentials[name]) { toast('That agent already exists'); return; }
    credentials[name] = { email, password: pass };
    localStorage.setItem('agentCredentials', JSON.stringify(credentials));
    document.getElementById('newCredAgent').value = '';
    document.getElementById('newCredEmail').value = '';
    document.getElementById('newCredPassword').value = '';
    fillStaticSelects();
    renderCredentialList();
    renderAgents();
    toast(`Agent ${name} added ✓`);
}

// ── Tasks ────────────────────────────────────────────────────────────
function priorityBadge(p) {
    return { High: 'badge-red', Medium: 'badge-amber', Low: 'badge-gray' }[p] || 'badge-gray';
}

function renderTasks() {
    const status = document.getElementById('taskStatusFilter').value;
    const agent  = isAdmin() ? document.getElementById('taskAgentFilter').value : '';

    const rows = visibleTasks()
        .filter(t =>
            (status === '' || (status === 'done' ? t.done : !t.done)) &&
            (!agent || t.agent === agent))
        .sort((a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999'));

    const today = todayISO();
    document.getElementById('tasksBody').innerHTML = rows.length ? rows.map(t => `
        <tr class="${t.done ? 'done-row' : ''}">
            <td><strong style="color:var(--navy);">${esc(t.title)}</strong></td>
            <td>${esc(t.contact) || '—'}</td>
            <td>${esc(t.agent) || '—'}</td>
            <td class="${!t.done && t.due && t.due < today ? 'overdue' : ''}">${fmtDate(t.due)}${!t.done && t.due && t.due < today ? ' ⚠' : ''}</td>
            <td><span class="badge ${priorityBadge(t.priority)}">${esc(t.priority)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="${t.done ? 'btn-secondary' : 'btn-success'} btn-sm" onclick="toggleTask('${t.id}')"><i data-lucide="${t.done ? 'rotate-ccw' : 'check'}"></i> ${t.done ? 'Reopen' : 'Done'}</button>
                    <button class="btn-primary btn-sm" onclick="openTaskModal('${t.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-danger btn-sm" onclick="deleteTask('${t.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>`).join('')
        : '<tr><td colspan="6"><div class="no-data">No tasks match.</div></td></tr>';
    refreshIcons();
}

function openTaskModal(id) {
    const t = tasks.find(x => x.id === id);
    document.getElementById('taskModalTitle').textContent = t ? 'Edit Task' : 'Add Task';
    document.getElementById('taskId').value = t ? t.id : '';
    fillContactSelects();
    setVal('tTitle', t?.title);
    setVal('tContact', t?.contact || '');
    setVal('tAgent', t?.agent || (isAdmin() ? getAllAgents()[0] : currentAgent()));
    setVal('tDue', t?.due || todayISO());
    setVal('tPriority', t?.priority || 'Medium');
    openModal('taskModal');
}

function saveTask() {
    const title = document.getElementById('tTitle').value.trim();
    if (!title) { toast('Task description is required'); return; }
    const id = document.getElementById('taskId').value;
    const data = {
        title,
        contact:  document.getElementById('tContact').value,
        agent:    document.getElementById('tAgent').value,
        due:      document.getElementById('tDue').value,
        priority: document.getElementById('tPriority').value
    };
    if (id) {
        const i = tasks.findIndex(x => x.id === id);
        tasks[i] = { ...tasks[i], ...data };
        toast('Task updated ✓');
    } else {
        tasks.push({ id: uid(), done: false, ...data });
        toast('Task added ✓');
    }
    persist(); closeModal('taskModal'); renderAll();
}

function toggleTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    persist(); renderAll();
    toast(t.done ? 'Task completed ✓' : 'Task reopened');
}

function deleteTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t || !confirm(`Delete task "${t.title}"?`)) return;
    tasks = tasks.filter(x => x.id !== id);
    persist(); renderAll(); toast('Task deleted');
}

// ── Activities ───────────────────────────────────────────────────────
function renderActivities() {
    const type = document.getElementById('activityTypeFilter').value;
    const q    = (document.getElementById('activitySearch').value || '').toLowerCase();

    const rows = [...visibleActivities()]
        .filter(a =>
            (!type || a.type === type) &&
            (!q || [a.contact, a.text, a.agent].some(v => (v || '').toLowerCase().includes(q))))
        .sort((a, b) => b.when.localeCompare(a.when));

    document.getElementById('activityList').innerHTML = rows.length ? rows.map(a => `
        <div class="timeline-item">
            <div class="timeline-icon ${esc(a.type)}"><i data-lucide="${ACTIVITY_ICONS[a.type] || 'sticky-note'}"></i></div>
            <div class="timeline-body">
                <div class="t-head">
                    <span class="t-who">${esc(a.contact || 'General')}<span style="font-weight:400;color:var(--gray-400);"> — ${esc(a.agent || '—')}</span></span>
                    <span class="t-when">${fmtWhen(a.when)}</span>
                </div>
                <div class="t-text">${esc(a.text)}</div>
            </div>
            <button class="btn-secondary btn-sm" onclick="deleteActivity('${a.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
        </div>`).join('')
        : '<div class="no-data">No activity logged yet.</div>';
    refreshIcons();
}

function openActivityModal() {
    fillContactSelects();
    setVal('aType', 'call'); setVal('aContact', ''); setVal('aAgent', isAdmin() ? getAllAgents()[0] : currentAgent()); setVal('aText', '');
    openModal('activityModal');
}

function saveActivity() {
    const text = document.getElementById('aText').value.trim();
    if (!text) { toast('Details are required'); return; }
    activities.unshift({
        id: uid(),
        type:    document.getElementById('aType').value,
        contact: document.getElementById('aContact').value,
        agent:   document.getElementById('aAgent').value,
        text,
        when:    new Date().toISOString()
    });
    persist(); closeModal('activityModal'); renderAll(); toast('Activity logged ✓');
}

function deleteActivity(id) {
    activities = activities.filter(x => x.id !== id);
    persist(); renderActivities(); toast('Activity deleted');
}

// ── Modal plumbing ───────────────────────────────────────────────────
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ''; }
function openModal(id)  { document.getElementById(id).classList.add('active'); refreshIcons(); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.addEventListener('click', e => {
    if (e.target.classList && e.target.classList.contains('modal')) e.target.classList.remove('active');
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
});

// Auto-assign office when agent changes in contact modal (Binder Book rule)
document.addEventListener('change', e => {
    if (e.target && e.target.id === 'cAgent') {
        setVal('cOffice', e.target.value === 'Jorge Castro' ? 'Franchise' : 'Hialeah');
    }
});

// ── Render everything ────────────────────────────────────────────────
function renderAll() {
    if (!session) return;
    renderDashboard();
    renderContacts();
    renderStageCards();
    renderLeads();
    renderRenewals();
    renderAgents();
    renderTasks();
    renderActivities();
    refreshIcons();
}

// ── Boot ─────────────────────────────────────────────────────────────
initializeCredentials();
fillStaticSelects();
fillContactSelects();
applySession();
renderAll();
