// ============================================================
// UIB AMS — Agency Management System  v1.0
// Shares localStorage with UIB Binder Book
// ============================================================

// ── Shared constants (mirrors app.js) ───────────────────────
const AMS_LOBS = [
    "BOP","Boat","Builders Risk","Business Owner","Classic Collectors",
    "Commercial Auto","Commercial Property","Excess Liability","Flood",
    "Garage Keepers","General Liability","Home Owners DP1","Home Owners DP2",
    "Home Owners DP3","Home Owners H3","Home Owners H4","Home Owners H6",
    "Home Owners H8","Inland Marine","Motorcycle/ATV","Personal Auto",
    "Professional Liability","Surety Bond","Trucking","Umbrella","Workers Comp"
];

const AMS_ADMIN_PASSWORD = 'admin2024';

// ── State ────────────────────────────────────────────────────
let amsCurrentUser   = null;
let amsCurrentRole   = null;
let amsClientIndex   = {};   // key → { key, displayName, policies[], contact{} }
let amsActiveKey     = null; // currently selected client key
let amsFilteredKeys  = [];   // keys after search/filter
let _amsSearchTimer  = null;

// ── Data helpers ─────────────────────────────────────────────
function amsGetBinderData()  { return JSON.parse(localStorage.getItem('binderData'))  || []; }
function amsGetClientData()  { return JSON.parse(localStorage.getItem('amsClientData')) || {}; }
function amsGetCredentials() { return JSON.parse(localStorage.getItem('agentCredentials')) || {}; }
function amsGetCarriers()    { return JSON.parse(localStorage.getItem('carrierMasterData')) || {}; }

function amsSave(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function amsClientKey(name) {
    return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

// ── Build client index from binderData ───────────────────────
function amsBuildClientIndex() {
    const binder   = amsGetBinderData();
    const contacts = amsGetClientData();
    const index    = {};

    binder.forEach(entry => {
        const key = amsClientKey(entry.customerName);
        if (!key) return;
        if (!index[key]) {
            index[key] = {
                key,
                displayName: entry.customerName,
                policies:    [],
                contact:     contacts[key] || {}
            };
        }
        index[key].policies.push(entry);
    });

    // Also include clients that have contact info but no policies yet
    Object.keys(contacts).forEach(key => {
        if (!index[key]) {
            index[key] = {
                key,
                displayName: contacts[key].firstName
                    ? `${contacts[key].firstName} ${contacts[key].lastName || ''}`.trim()
                    : key,
                policies: [],
                contact:  contacts[key]
            };
        } else {
            index[key].contact = contacts[key];
        }
    });

    // Sort policies within each client by date desc
    Object.values(index).forEach(c => {
        c.policies.sort((a, b) => {
            const da = a.entryDate ? new Date(a.entryDate + 'T12:00:00') : new Date(0);
            const db = b.entryDate ? new Date(b.entryDate + 'T12:00:00') : new Date(0);
            return db - da;
        });
    });

    amsClientIndex = index;
    amsFilteredKeys = Object.keys(index).sort();
}

// ── Login ────────────────────────────────────────────────────
function amsDoLogin() {
    const email    = (document.getElementById('amsLoginEmail')?.value || '').trim().toLowerCase();
    const password = (document.getElementById('amsLoginPassword')?.value || '');
    const creds    = amsGetCredentials();
    const errEl    = document.getElementById('amsLoginError');

    let matched = null;
    Object.entries(creds).forEach(([agent, data]) => {
        const agentEmail = (typeof data === 'object' ? data.email : '') || '';
        const agentPass  = (typeof data === 'object' ? data.password : data) || '';
        if (agentEmail.toLowerCase() === email && agentPass === password) matched = agent;
    });

    if (!matched) {
        if (errEl) { errEl.textContent = 'Invalid email or password.'; errEl.style.display = 'block'; }
        return;
    }
    amsCurrentUser = matched;
    amsCurrentRole = 'agent';
    amsLaunchApp();
}

function amsDoAdminLogin() {
    const pwd   = (document.getElementById('amsAdminPassword')?.value || '');
    const errEl = document.getElementById('amsAdminLoginError');
    const creds = amsGetCredentials();
    const adminPwd = (typeof creds['Admin'] === 'object' ? creds['Admin'].password : creds['Admin']) || AMS_ADMIN_PASSWORD;

    if (pwd !== adminPwd && pwd !== AMS_ADMIN_PASSWORD) {
        if (errEl) { errEl.style.display = 'block'; }
        return;
    }
    amsCurrentUser = 'Admin';
    amsCurrentRole = 'admin';
    amsLaunchApp();
}

function amsShowAdminLogin() {
    document.getElementById('amsAgentLoginForm').style.display = 'none';
    document.getElementById('amsAdminLoginForm').style.display = 'block';
}

function amsShowAgentLogin() {
    document.getElementById('amsAgentLoginForm').style.display = 'block';
    document.getElementById('amsAdminLoginForm').style.display = 'none';
}

function amsLogout() {
    amsCurrentUser = null;
    amsCurrentRole = null;
    amsActiveKey   = null;
    document.getElementById('amsApp').classList.remove('visible');
    document.getElementById('amsLoginScreen').style.display = 'flex';
    document.getElementById('amsLoginEmail').value    = '';
    document.getElementById('amsLoginPassword').value = '';
}

// ── App launch ───────────────────────────────────────────────
function amsLaunchApp() {
    document.getElementById('amsLoginScreen').style.display = 'none';
    document.getElementById('amsApp').classList.add('visible');

    // User chip
    const initials = amsCurrentUser.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('amsUserLabel').textContent = amsCurrentUser;
    document.getElementById('amsUserAvatar').textContent = initials;

    amsBuildClientIndex();
    amsPopulateAgentFilter();
    amsPopulateCarrierFilter();
    amsRenderClientList();
    amsPopulateModalDropdowns();

    lucide.createIcons();

    // Listen for storage changes from Binder Book
    window.addEventListener('storage', e => {
        if (e.key === 'binderData' || e.key === 'amsClientData') {
            amsBuildClientIndex();
            amsRenderClientList();
            if (amsActiveKey) amsLoadClientDetail(amsActiveKey);
        }
    });
}

// ── Populate filter dropdowns ────────────────────────────────
function amsPopulateAgentFilter() {
    const sel = document.getElementById('amsAgentFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All Agents</option>';
    const agents = [...new Set(Object.values(amsClientIndex).flatMap(c => c.policies.map(p => p.agent)))].filter(Boolean).sort();
    agents.forEach(a => {
        const o = document.createElement('option'); o.value = a; o.textContent = a; sel.appendChild(o);
    });
    sel.value = current;
}

function amsPopulateCarrierFilter() {
    const sel = document.getElementById('amsCarrierFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All Carriers</option>';
    const carriers = [...new Set(Object.values(amsClientIndex).flatMap(c => c.policies.map(p => p.company)))].filter(Boolean).sort();
    carriers.forEach(c => {
        const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o);
    });
    sel.value = current;
}

function amsPopulateModalDropdowns() {
    // Agent select in policy modal
    const agentSel = document.getElementById('mp_agent');
    if (agentSel) {
        agentSel.innerHTML = '<option value="">— Select Agent —</option>';
        const creds = amsGetCredentials();
        Object.keys(creds).sort().forEach(a => {
            const o = document.createElement('option'); o.value = a; o.textContent = a; agentSel.appendChild(o);
        });
    }

    // LOB select
    const lobSel = document.getElementById('mp_lob');
    if (lobSel) {
        lobSel.innerHTML = '<option value="">— Select LOB —</option>';
        AMS_LOBS.forEach(l => {
            const o = document.createElement('option'); o.value = l; o.textContent = l; lobSel.appendChild(o);
        });
    }

    // Carrier select
    const carrierSel = document.getElementById('mp_carrier');
    if (carrierSel) {
        carrierSel.innerHTML = '<option value="">— Select Carrier —</option>';
        const carriers = Object.keys(amsGetCarriers()).sort();
        carriers.forEach(c => {
            const o = document.createElement('option'); o.value = c; o.textContent = c; carrierSel.appendChild(o);
        });
    }

    // Contact: assigned agent
    const ciAgent = document.getElementById('ci_assignedAgent');
    if (ciAgent) {
        ciAgent.innerHTML = '<option value="">— Select Agent —</option>';
        const creds = amsGetCredentials();
        Object.keys(creds).sort().forEach(a => {
            const o = document.createElement('option'); o.value = a; o.textContent = a; ciAgent.appendChild(o);
        });
    }
}

// ── Search & Filter ──────────────────────────────────────────
function amsSearch(q) {
    clearTimeout(_amsSearchTimer);
    _amsSearchTimer = setTimeout(() => {
        // Sync both search boxes
        const qLow = (q || '').toLowerCase().trim();
        const sb = document.getElementById('amsSidebarSearch');
        const gb = document.getElementById('amsGlobalSearch');
        if (sb && sb.value.toLowerCase() !== qLow) sb.value = q;
        if (gb && gb.value.toLowerCase() !== qLow) gb.value = q;
        amsApplyFilters(qLow);
    }, 180);
}

function amsApplyFilters(q) {
    if (q === undefined) q = (document.getElementById('amsSidebarSearch')?.value || '').toLowerCase().trim();
    const agentFilter   = document.getElementById('amsAgentFilter')?.value   || '';
    const carrierFilter = document.getElementById('amsCarrierFilter')?.value || '';

    amsFilteredKeys = Object.keys(amsClientIndex).filter(key => {
        const client = amsClientIndex[key];
        // Search match
        if (q) {
            const contact = client.contact || {};
            const haystack = [
                client.displayName,
                contact.phone1, contact.phone2, contact.email,
                contact.address, contact.city,
                ...client.policies.map(p => p.policyNumber || ''),
                ...client.policies.map(p => p.binderNumber || ''),
                ...client.policies.map(p => p.company      || '')
            ].join(' ').toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        // Agent filter
        if (agentFilter && !client.policies.some(p => p.agent === agentFilter)) {
            // allow if contact's assigned agent matches
            if ((client.contact?.assignedAgent || '') !== agentFilter) return false;
        }
        // Carrier filter
        if (carrierFilter && !client.policies.some(p => p.company === carrierFilter)) return false;
        return true;
    }).sort();

    amsRenderClientList();
}

// ── Render client list ───────────────────────────────────────
function amsRenderClientList() {
    const container = document.getElementById('amsClientList');
    const countEl   = document.getElementById('amsClientCount');
    if (!container) return;
    if (countEl) countEl.textContent = `${amsFilteredKeys.length} client${amsFilteredKeys.length !== 1 ? 's' : ''}`;

    if (!amsFilteredKeys.length) {
        container.innerHTML = '<div class="no-results">No clients found.</div>';
        return;
    }

    container.innerHTML = amsFilteredKeys.map(key => {
        const c = amsClientIndex[key];
        const contact = c.contact || {};
        const numPolicies = c.policies.length;
        const lastAgent   = c.policies[0]?.agent || contact.assignedAgent || '';
        const phone       = contact.phone1 || '';
        const lastDate    = c.policies[0]?.entryDate
            ? new Date(c.policies[0].entryDate + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : '';
        const initials = c.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        return `
        <div class="client-card ${key === amsActiveKey ? 'active' : ''}" onclick="amsLoadClientDetail('${amsEsc(key)}')">
            <div style="display:flex;gap:10px;align-items:center;">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--navy));color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>
                <div style="flex:1;min-width:0;">
                    <div class="cc-name">${amsEscHtml(c.displayName)}</div>
                    <div class="cc-meta">
                        ${phone ? `<span>${amsEscHtml(phone)}</span>` : ''}
                        ${lastDate ? `<span>${lastDate}</span>` : ''}
                    </div>
                    <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">
                        <span class="cc-badge policies">${numPolicies} polic${numPolicies !== 1 ? 'ies' : 'y'}</span>
                        ${lastAgent ? `<span class="cc-badge agent">${amsEscHtml(lastAgent)}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Load & render client detail ──────────────────────────────
function amsLoadClientDetail(key) {
    const client = amsClientIndex[key];
    if (!client) return;
    amsActiveKey = key;

    // Mark active in list
    document.querySelectorAll('.client-card').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.client-card').forEach(el => {
        if (el.onclick?.toString().includes(`'${key}'`)) el.classList.add('active');
    });

    document.getElementById('amsWelcome').style.display      = 'none';
    document.getElementById('amsClientDetail').style.display = 'block';

    const contact  = client.contact || {};
    const initials = client.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const numPol   = client.policies.length;

    document.getElementById('detailAvatar').textContent = initials;
    document.getElementById('detailName').textContent   = contact.firstName
        ? `${contact.firstName} ${contact.lastName || ''}`.trim()
        : client.displayName;

    // Meta row
    const metaItems = [];
    if (contact.phone1) metaItems.push(`<span><i data-lucide="phone" style="width:12px;height:12px;"></i> ${amsEscHtml(contact.phone1)}</span>`);
    if (contact.email)  metaItems.push(`<span><i data-lucide="mail"  style="width:12px;height:12px;"></i> ${amsEscHtml(contact.email)}</span>`);
    if (contact.city)   metaItems.push(`<span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${amsEscHtml(contact.city)}</span>`);
    metaItems.push(`<span class="tag tag-blue">${numPol} Polic${numPol !== 1 ? 'ies' : 'y'}</span>`);
    if (contact.clientStatus) metaItems.push(`<span class="tag tag-green">${amsEscHtml(contact.clientStatus)}</span>`);
    document.getElementById('detailMeta').innerHTML = metaItems.join('');

    // Populate contact form fields
    const fields = ['firstName','lastName','dob','gender','marital','ssn4','phone1','phone2','email',
                    'prefContact','address','city','state','zip','dlNum','dlState','dlExp','language',
                    'assignedAgent','csrName','dealerLocation','clientSince','referral','clientStatus'];
    fields.forEach(f => {
        const el = document.getElementById(`ci_${f}`);
        if (el) el.value = contact[f] || '';
    });

    amsRenderPolicies(key);
    amsRenderNotes(key);
    amsShowTab('contact');
    lucide.createIcons();
}

// ── Render policy table ──────────────────────────────────────
function amsRenderPolicies(key) {
    const tbody = document.getElementById('amsPoliciesBody');
    if (!tbody) return;
    const policies = (amsClientIndex[key]?.policies || []);
    if (!policies.length) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--gray-400);">No policies on record. Click "Add Policy" to create one.</td></tr>`;
        return;
    }

    tbody.innerHTML = policies.map(p => {
        const dateStr = p.entryDate
            ? new Date(p.entryDate + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            : '—';
        const prem   = p.totalPremium != null ? `$${parseFloat(p.totalPremium).toFixed(2)}` : '—';
        const canEdit = amsCurrentRole === 'admin' || p.agent === amsCurrentUser;

        return `<tr>
            <td style="white-space:nowrap;">${dateStr}</td>
            <td>${amsEscHtml(p.agent || '—')}</td>
            <td><span class="tag tag-blue">${amsEscHtml(p.policyType || '—')}</span></td>
            <td>${amsEscHtml(p.lineOfBusiness || '—')}</td>
            <td><strong>${amsEscHtml(p.company || '—')}</strong></td>
            <td style="font-family:monospace;font-size:11.5px;">${amsEscHtml(p.policyNumber || '—')}</td>
            <td style="font-family:monospace;font-size:11.5px;">${amsEscHtml(p.binderNumber || '—')}</td>
            <td style="text-align:right;font-weight:700;color:var(--navy);">${prem}</td>
            <td>${amsEscHtml(p.paymentType || p.commissionType || '—')}</td>
            <td>${amsEscHtml(p.mga || '—')}</td>
            <td style="white-space:nowrap;">
                ${canEdit
                    ? `<button class="btn-secondary btn-sm" onclick="amsEditPolicy(${p.id})">
                           <i data-lucide="pencil"></i> Edit
                       </button>`
                    : '<span style="font-size:11px;color:var(--gray-300);">—</span>'}
            </td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}

// ── Render notes ─────────────────────────────────────────────
function amsRenderNotes(key) {
    const container = document.getElementById('amsNotesList');
    if (!container) return;
    const contacts = amsGetClientData();
    const notes    = contacts[key]?.notes || [];

    if (!notes.length) {
        container.innerHTML = '<div class="no-results" style="padding:24px;">No notes yet.</div>';
        return;
    }

    container.innerHTML = [...notes].reverse().map((n, i) => `
        <div class="note-entry">
            <div class="note-meta">${amsEscHtml(n.author || 'Unknown')} — ${amsEscHtml(n.date || '')}</div>
            <div class="note-text">${amsEscHtml(n.text)}</div>
        </div>
    `).join('');
}

// ── Tabs ─────────────────────────────────────────────────────
function amsShowTab(tab) {
    ['contact','policies','notes'].forEach(t => {
        document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`).style.display = t === tab ? 'block' : 'none';
        document.querySelector(`.ams-tab[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
}

// ── Save contact info ────────────────────────────────────────
function amsSaveContact() {
    if (!amsActiveKey) return;
    const contacts = amsGetClientData();
    if (!contacts[amsActiveKey]) contacts[amsActiveKey] = {};

    const fields = ['firstName','lastName','dob','gender','marital','ssn4','phone1','phone2','email',
                    'prefContact','address','city','state','zip','dlNum','dlState','dlExp','language',
                    'assignedAgent','csrName','dealerLocation','clientSince','referral','clientStatus'];
    fields.forEach(f => {
        contacts[amsActiveKey][f] = document.getElementById(`ci_${f}`)?.value || '';
    });
    contacts[amsActiveKey].updatedAt = new Date().toISOString();

    amsSave('amsClientData', contacts);

    // Re-index and refresh
    amsBuildClientIndex();
    amsRenderClientList();
    amsLoadClientDetail(amsActiveKey);
    amsFlashBanner('Contact info saved ✓');
}

function amsDiscardContact() {
    if (amsActiveKey) amsLoadClientDetail(amsActiveKey);
}

// ── Save note ────────────────────────────────────────────────
function amsSaveNote() {
    if (!amsActiveKey) return;
    const text = (document.getElementById('amsNewNote')?.value || '').trim();
    if (!text) return;

    const contacts = amsGetClientData();
    if (!contacts[amsActiveKey]) contacts[amsActiveKey] = {};
    if (!contacts[amsActiveKey].notes) contacts[amsActiveKey].notes = [];

    const now = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' });
    contacts[amsActiveKey].notes.push({ text, author: amsCurrentUser, date: now });
    amsSave('amsClientData', contacts);

    document.getElementById('amsNewNote').value = '';
    amsBuildClientIndex();
    amsRenderNotes(amsActiveKey);
    amsFlashBanner('Note saved ✓');
}

// ── Add / Edit Policy Modal ───────────────────────────────────
function amsOpenAddPolicyModal() {
    document.getElementById('amsPolicyModalTitle').innerHTML = '<i data-lucide="file-plus"></i> Add Policy';
    document.getElementById('amsPolicyEditId').value = '';
    const fields = ['mp_agent','mp_policyType','mp_lob','mp_carrier','mp_mga','mp_policyNum','mp_binderNum','mp_premium','mp_payType','mp_effDate','mp_expDate'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    // Pre-select current user if agent
    if (amsCurrentRole === 'agent') {
        const agSel = document.getElementById('mp_agent');
        if (agSel) agSel.value = amsCurrentUser;
    }

    document.getElementById('amsPolicyModal').classList.add('open');
    lucide.createIcons();
}

function amsEditPolicy(policyId) {
    const binder  = amsGetBinderData();
    const entry   = binder.find(p => p.id === policyId);
    if (!entry) return;

    document.getElementById('amsPolicyModalTitle').innerHTML = '<i data-lucide="pencil"></i> Edit Policy';
    document.getElementById('amsPolicyEditId').value = policyId;

    const map = {
        mp_agent:       'agent',
        mp_policyType:  'policyType',
        mp_lob:         'lineOfBusiness',
        mp_carrier:     'company',
        mp_mga:         'mga',
        mp_policyNum:   'policyNumber',
        mp_binderNum:   'binderNumber',
        mp_premium:     'totalPremium',
        mp_payType:     'paymentType',
        mp_effDate:     'effectiveDate',
        mp_expDate:     'expirationDate'
    };
    Object.entries(map).forEach(([elId, field]) => {
        const el = document.getElementById(elId);
        if (el) el.value = entry[field] || '';
    });

    document.getElementById('amsPolicyModal').classList.add('open');
    lucide.createIcons();
}

function amsClosePolicyModal() {
    document.getElementById('amsPolicyModal').classList.remove('open');
}

function amsSavePolicyModal() {
    const agent      = document.getElementById('mp_agent')?.value      || '';
    const policyType = document.getElementById('mp_policyType')?.value || '';
    const lob        = document.getElementById('mp_lob')?.value        || '';
    const carrier    = document.getElementById('mp_carrier')?.value    || '';

    if (!agent)      { alert('Please select an Agent.');            return; }
    if (!policyType) { alert('Please select a Policy Type.');       return; }
    if (!lob)        { alert('Please select a Line of Business.');  return; }
    if (!carrier)    { alert('Please select a Carrier.');           return; }

    const editId = parseInt(document.getElementById('amsPolicyEditId')?.value) || null;
    let binder   = amsGetBinderData();

    const premVal = parseFloat(document.getElementById('mp_premium')?.value) || 0;

    if (editId) {
        // Update existing entry
        const idx = binder.findIndex(p => p.id === editId);
        if (idx !== -1) {
            binder[idx] = {
                ...binder[idx],
                agent,
                policyType,
                lineOfBusiness: lob,
                company:        carrier,
                mga:            document.getElementById('mp_mga')?.value        || '',
                policyNumber:   document.getElementById('mp_policyNum')?.value  || '',
                binderNumber:   document.getElementById('mp_binderNum')?.value  || '',
                totalPremium:   premVal,
                paymentType:    document.getElementById('mp_payType')?.value    || '',
                effectiveDate:  document.getElementById('mp_effDate')?.value    || '',
                expirationDate: document.getElementById('mp_expDate')?.value    || ''
            };
        }
    } else {
        // New entry — add to binder
        const newId = Date.now();
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD ET
        binder.push({
            id:             newId,
            agent,
            entryDate:      today,
            customerName:   amsClientIndex[amsActiveKey]?.displayName || amsActiveKey,
            policyType,
            lineOfBusiness: lob,
            company:        carrier,
            mga:            document.getElementById('mp_mga')?.value        || '',
            policyNumber:   document.getElementById('mp_policyNum')?.value  || '',
            binderNumber:   document.getElementById('mp_binderNum')?.value  || '',
            totalPremium:   premVal,
            paymentType:    document.getElementById('mp_payType')?.value    || '',
            effectiveDate:  document.getElementById('mp_effDate')?.value    || '',
            expirationDate: document.getElementById('mp_expDate')?.value    || '',
            agencyCommission: 0, agentCommission: 0
        });
    }

    localStorage.setItem('binderData', JSON.stringify(binder));  // triggers storage event in Binder Book

    amsClosePolicyModal();
    amsBuildClientIndex();
    amsRenderClientList();
    amsRenderPolicies(amsActiveKey);
    amsFlashBanner(editId ? 'Policy updated ✓' : 'Policy added ✓');
}

// ── Print ────────────────────────────────────────────────────
function amsPrintClient() {
    window.print();
}

// ── Utilities ────────────────────────────────────────────────
function amsEsc(str) {
    return (str || '').replace(/'/g, "\\'");
}

function amsEscHtml(str) {
    return (str || '').toString()
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function amsFlashBanner(msg) {
    const b = document.getElementById('amsSyncBanner');
    if (!b) return;
    b.textContent = msg;
    b.style.display = 'block';
    setTimeout(() => { b.style.display = 'none'; }, 2200);
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    // Close modal on backdrop click
    document.getElementById('amsPolicyModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('amsPolicyModal')) amsClosePolicyModal();
    });
});
