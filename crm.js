/* ══════════════════════════════════════════════════════════════════
   UIB CRM — Universal Insurance Brokers
   Same theme + data conventions as the UIB Binder Book.
   Storage: localStorage (uibcrm_*)
   ══════════════════════════════════════════════════════════════════ */

// ── Reference data (mirrors the Binder Book) ─────────────────────────
const AGENTS = ['Uri', 'Lazaro', 'Amanda', 'Randy', 'Jorge Castro'];

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

// ── State ────────────────────────────────────────────────────────────
let contacts   = load('uibcrm_contacts');
let leads      = load('uibcrm_leads');
let tasks      = load('uibcrm_tasks');
let activities = load('uibcrm_activities');
let stageFilter = '';   // pipeline stage-card filter

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

function toast(msg) {
    const el = document.getElementById('successMessage');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function refreshIcons() { if (window.lucide) lucide.createIcons(); }

// ── Seed data (first run only) ───────────────────────────────────────
function seedIfEmpty() {
    if (contacts.length || leads.length || tasks.length || activities.length) return;
    const d = todayISO();
    contacts = [
        { id: uid(), name: 'Maria Gonzalez',  type: 'Customer', phone: '(305) 555-0142', email: 'maria.g@email.com',  address: '1240 W 29th St, Hialeah, FL', dob: '', lob: 'Personal Auto',   carrier: 'Progressive',        policy: 'PRG-88231', premium: 2140, effective: '2026-05-01', expiration: '2026-11-01', agent: 'Uri',          office: 'Hialeah',   notes: 'Renewal shopper — watch rate at renewal.' },
        { id: uid(), name: 'Carlos Mendez',   type: 'Customer', phone: '(786) 555-0968', email: 'cmendez@gmail.com',   address: '89 E 10th Ave, Hialeah, FL',  dob: '', lob: 'Commercial Auto', carrier: 'Infinity',           policy: 'INF-45120', premium: 6890, effective: '2026-03-15', expiration: '2027-03-15', agent: 'Lazaro',       office: 'Hialeah',   notes: 'Box truck + trailer. Referred his brother.' },
        { id: uid(), name: 'Yolanda Perez',   type: 'Customer', phone: '(305) 555-3311', email: 'yperez@yahoo.com',    address: '445 Palm Ave, Hialeah, FL',   dob: '', lob: 'Homeowners',      carrier: 'Citizens',           policy: 'CIT-20977', premium: 3480, effective: '2026-01-20', expiration: '2027-01-20', agent: 'Amanda',       office: 'Hialeah',   notes: '' },
        { id: uid(), name: 'Reinaldo Diaz',   type: 'Prospect', phone: '(954) 555-7720', email: '',                    address: '',                            dob: '', lob: 'Workers Comp',    carrier: '',                   policy: '',          premium: 0,    effective: '',           expiration: '',           agent: 'Jorge Castro', office: 'Franchise', notes: 'Roofing crew of 6 — needs WC quote.' },
        { id: uid(), name: 'Ana Rodriguez',   type: 'Lead',     phone: '(305) 555-8804', email: 'anar88@email.com',    address: '',                            dob: '', lob: 'Personal Auto',   carrier: 'United Automobile',  policy: '',          premium: 0,    effective: '',           expiration: '',           agent: 'Randy',        office: 'Hialeah',   notes: 'Two vehicles, prior lapse.' }
    ];
    leads = [
        { id: uid(), name: 'Ana Rodriguez',       phone: '(305) 555-8804', source: 'Phone',    lob: 'Personal Auto',          carrier: 'United Automobile', premium: 1850,  stage: 'quoted',   agent: 'Randy',        notes: 'Quoted $1,850 — waiting on down payment.', created: d },
        { id: uid(), name: 'Reinaldo Diaz',       phone: '(954) 555-7720', source: 'Referral', lob: 'Workers Comp',           carrier: 'Other',             premium: 9200,  stage: 'new',      agent: 'Jorge Castro', notes: 'Needs certs for GC job.', created: d },
        { id: uid(), name: 'Trucking Dorales LLC', phone: '(786) 555-2288', source: 'Walk-In',  lob: 'Non-Trucking Liability', carrier: 'Progressive',       premium: 4400,  stage: 'followup', agent: 'Lazaro',       notes: 'Owner-operator, leased to carrier.', created: d },
        { id: uid(), name: 'Bella Nails Salon',    phone: '(305) 555-6119', source: 'Website',  lob: 'General Liability',      carrier: 'Bristol West',      premium: 1200,  stage: 'bound',    agent: 'Amanda',       notes: 'Bound — send COI to landlord.', created: d },
        { id: uid(), name: 'Pedro Fuentes',        phone: '(305) 555-4470', source: 'Referral', lob: 'Personal Auto',          carrier: 'Kemper Insurance',  premium: 2300,  stage: 'lost',     agent: 'Uri',          notes: 'Went with online quote.', created: d }
    ];
    const in2 = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    const in5 = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    tasks = [
        { id: uid(), title: 'Collect down payment from Ana Rodriguez', contact: 'Ana Rodriguez',        agent: 'Randy',        due: in2, priority: 'High',   done: false },
        { id: uid(), title: 'Send COI to Bella Nails landlord',        contact: 'Bella Nails Salon',    agent: 'Amanda',       due: d,   priority: 'High',   done: false },
        { id: uid(), title: 'Follow up on WC quote for Reinaldo',      contact: 'Reinaldo Diaz',        agent: 'Jorge Castro', due: in5, priority: 'Medium', done: false },
        { id: uid(), title: 'Review Maria Gonzalez renewal rate',      contact: 'Maria Gonzalez',       agent: 'Uri',          due: in5, priority: 'Low',    done: false }
    ];
    activities = [
        { id: uid(), type: 'call',  contact: 'Ana Rodriguez',        agent: 'Randy',  text: 'Called with United Auto quote — $1,850/yr. She wants to pay Friday.', when: new Date().toISOString() },
        { id: uid(), type: 'note',  contact: 'Trucking Dorales LLC', agent: 'Lazaro', text: 'Needs copy of lease agreement before binding NTL.',                    when: new Date().toISOString() },
        { id: uid(), type: 'email', contact: 'Bella Nails Salon',    agent: 'Amanda', text: 'Emailed binder + invoice. Policy bound with Bristol West.',            when: new Date().toISOString() }
    ];
    persist();
}

// ── Tabs ─────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
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
    // Filters
    fillSelect('contactAgentFilter', AGENTS, { blank: 'All Agents' });
    fillSelect('contactLobFilter',   LOBS,   { blank: 'All LOBs' });
    fillSelect('leadAgentFilter',    AGENTS, { blank: 'All Agents' });
    fillSelect('taskAgentFilter',    AGENTS, { blank: 'All Agents' });
    // Modal dropdowns
    fillSelect('cLob',     LOBS,   { blank: '— Select —' });
    fillSelect('cCarrier', CARRIERS, { blank: '— Select —' });
    fillSelect('cAgent',   AGENTS);
    fillSelect('lLob',     LOBS,   { blank: '— Select —' });
    fillSelect('lCarrier', CARRIERS, { blank: '— Select —' });
    fillSelect('lAgent',   AGENTS);
    fillSelect('tAgent',   AGENTS);
    fillSelect('aAgent',   AGENTS);
    const stageEl = document.getElementById('lStage');
    stageEl.innerHTML = STAGES.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
}

function fillContactSelects() {
    const names = contacts.map(c => c.name).sort((a, b) => a.localeCompare(b));
    fillSelect('tContact', names, { blank: '— None —' });
    fillSelect('aContact', names, { blank: '— None —' });
}

// ── Dashboard ────────────────────────────────────────────────────────
function renderDashboard() {
    const open = leads.filter(l => l.stage !== 'bound' && l.stage !== 'lost');
    const pipelinePremium = open.reduce((s, l) => s + Number(l.premium || 0), 0);
    const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const dueSoon = tasks.filter(t => !t.done && t.due && t.due <= week);

    document.getElementById('statContacts').textContent = contacts.length;
    document.getElementById('statLeads').textContent    = open.length;
    document.getElementById('statPremium').textContent  = money(pipelinePremium);
    document.getElementById('statTasks').textContent    = dueSoon.length;

    // Chart 1 — leads by stage (blue gradient, Binder Book style)
    const stageData = STAGES.map(s => ({
        label: s.label,
        value: leads.filter(l => l.stage === s.key).length,
        sub: money(leads.filter(l => l.stage === s.key).reduce((a, l) => a + Number(l.premium || 0), 0))
    }));
    renderBarChart('stageChart', stageData, 'linear-gradient(90deg, var(--blue) 0%, var(--blue-light) 100%)', v => v);

    // Chart 2 — open-pipeline premium by agent (purple→blue gradient)
    const byAgent = {};
    open.forEach(l => { byAgent[l.agent || '—'] = (byAgent[l.agent || '—'] || 0) + Number(l.premium || 0); });
    const agentData = AGENTS
        .map(a => ({ label: a, value: byAgent[a] || 0, sub: (open.filter(l => l.agent === a).length) + ' leads' }))
        .sort((a, b) => b.value - a.value);
    renderBarChart('agentChart', agentData, 'linear-gradient(90deg, var(--purple) 0%, var(--blue-light) 100%)', money);

    // Upcoming tasks
    const upcoming = tasks.filter(t => !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 6);
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
    const recent = [...activities].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 6);
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
    const agent = document.getElementById('contactAgentFilter').value;
    const lob   = document.getElementById('contactLobFilter').value;

    const rows = contacts.filter(c =>
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
    setVal('cAgent', c?.agent || AGENTS[0]);
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
    if (c) setVal('aContact', c.name), setVal('aAgent', c.agent || AGENTS[0]);
}

// ── Pipeline ─────────────────────────────────────────────────────────
function renderStageCards() {
    document.getElementById('stageCards').innerHTML = STAGES.map(s => {
        const inStage = leads.filter(l => l.stage === s.key);
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
    const agent = document.getElementById('leadAgentFilter').value;

    const rows = leads.filter(l =>
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
    setVal('lAgent', l?.agent || AGENTS[0]);
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

// ── Tasks ────────────────────────────────────────────────────────────
function priorityBadge(p) {
    return { High: 'badge-red', Medium: 'badge-amber', Low: 'badge-gray' }[p] || 'badge-gray';
}

function renderTasks() {
    const status = document.getElementById('taskStatusFilter').value;
    const agent  = document.getElementById('taskAgentFilter').value;

    const rows = tasks
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
    setVal('tAgent', t?.agent || AGENTS[0]);
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

    const rows = [...activities]
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
    setVal('aType', 'call'); setVal('aContact', ''); setVal('aAgent', AGENTS[0]); setVal('aText', '');
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
    renderDashboard();
    renderContacts();
    renderStageCards();
    renderLeads();
    renderTasks();
    renderActivities();
    refreshIcons();
}

// ── Boot ─────────────────────────────────────────────────────────────
seedIfEmpty();
fillStaticSelects();
fillContactSelects();
renderAll();
