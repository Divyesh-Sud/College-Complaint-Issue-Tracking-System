/* ============================================================
   CAMPUS COMPLAINT TRACKING SYSTEM - FIREBASE POWERED (SAFE)
   ============================================================ */

// ============================================================
// CONFIGURATION
// ============================================================

const SLA_SECONDS = 86400; // 24 hours
const COMPLAINTS_COLLECTION = 'complaints';

// ============================================================
// STATIC DATA
// ============================================================

const staffMembers = [
    { staff_id: 1, name: 'Staff 1', department: 'IT/Wi-Fi', escalation_count: 0 },
    { staff_id: 2, name: 'Staff 2', department: 'IT/Wi-Fi', escalation_count: 0 },
    { staff_id: 3, name: 'Staff 3', department: 'Electrical', escalation_count: 0 },
    { staff_id: 4, name: 'Staff 4', department: 'Electrical', escalation_count: 0 },
    { staff_id: 5, name: 'Staff 5', department: 'Plumbing', escalation_count: 0 },
    { staff_id: 6, name: 'Staff 6', department: 'Plumbing', escalation_count: 0 },
    { staff_id: 7, name: 'Staff 7', department: 'Academic', escalation_count: 0 },
    { staff_id: 8, name: 'Staff 8', department: 'Academic', escalation_count: 0 }
];

const hods = [{ hod_id: 1, name: 'HOD 1' }];
const deptAssignPointer = {};

// ============================================================
// STATE
// ============================================================

let complaints = [];
let currentView = 'student';
let currentStaffDept = 'IT/Wi-Fi';
let currentHODDept = 'IT/Wi-Fi';
let fbReady = false;

// ============================================================
// SAFE DOM HELPERS  ⭐ (THE FIX)
// ============================================================

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

function setHTML(id, value) {
    const el = $(id);
    if (el) el.innerHTML = value;
}

function setDisplay(id, value) {
    const el = $(id);
    if (el) el.style.display = value;
}

function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value;
}

function getValue(id) {
    const el = $(id);
    return el ? el.value : '';
}

function queryAll(selector) {
    return document.querySelectorAll(selector);
}

// ============================================================
// HELPERS
// ============================================================

function newDeadline() {
    return Date.now() + SLA_SECONDS * 1000;
}

function getStaffName(staffId) {
    const s = staffMembers.find(s => s.staff_id === staffId);
    return s ? s.name : 'Unassigned';
}

function getStaffByDept(dept) {
    return staffMembers.filter(s => s.department === dept);
}

function findStaffForDept(dept) {
    const deptStaff = staffMembers.filter(s => s.department === dept);
    if (deptStaff.length === 0) return null;
    const pointer = deptAssignPointer[dept] || 0;
    const chosen = deptStaff[pointer % deptStaff.length];
    deptAssignPointer[dept] = pointer + 1;
    return chosen.staff_id;
}

function incrementEscalationCount(staffId) {
    const s = staffMembers.find(s => s.staff_id === staffId);
    if (s) s.escalation_count++;
}

function timeLeftLabel(c) {
    if (c.status === 'Resolved') return '✅ Done';
    if (c.escalation_level >= 1) return '⏫ Escalated';
    
    const timeLeft = c.sla_deadline - Date.now();
    if (timeLeft <= 0) return '⏰ Overdue';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    let display = '';
    if (hours > 0) display += `${hours}h `;
    if (minutes > 0 || hours > 0) display += `${minutes}m `;
    display += `${seconds}s`;
    
    const urgent = hours < 1 && minutes < 30;
    return `<span class="countdown ${urgent ? 'urgent' : ''}">${display}</span>`;
}

// ============================================================
// TOAST
// ============================================================

function showToast(message, type = 'success') {
    const container = $('toastContainer');
    if (!container) {
        console.log(`[Toast ${type}] ${message}`);
        return;
    }
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    const colors = {
        success: 'var(--success)',
        error: 'var(--danger)',
        warning: 'var(--warning)',
        info: 'var(--info)'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.borderLeftColor = colors[type];
    toast.innerHTML = `
        <i class="fas ${icons[type]}" style="color: ${colors[type]};"></i>
        <span class="toast-msg">${message}</span>
    `;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ============================================================
// CONNECTION STATUS
// ============================================================

function setConnectionStatus(status) {
    const el = $('connectionStatus');
    if (!el) return;
    
    if (status === 'connected') {
        el.innerHTML = '<i class="fas fa-circle"></i> Live';
        el.className = 'connection-status connected';
    } else if (status === 'error') {
        el.innerHTML = '<i class="fas fa-circle"></i> Offline';
        el.className = 'connection-status error';
    } else {
        el.innerHTML = '<i class="fas fa-circle"></i> Connecting...';
        el.className = 'connection-status';
    }
}

// ============================================================
// FIREBASE LISTENER
// ============================================================

function setupFirebaseListener() {
    if (!window.fb) {
        console.error('❌ Firebase not loaded');
        setConnectionStatus('error');
        return;
    }
    
    fbReady = true;
    console.log('🔥 Setting up Firestore listener...');
    
    const complaintsRef = window.fb.collection(window.fb.db, COMPLAINTS_COLLECTION);
    
    window.fb.onSnapshot(complaintsRef, async (snapshot) => {
        complaints = [];
        snapshot.forEach(doc => {
            complaints.push({ ...doc.data(), _docId: doc.id });
        });
        
        // Sort by complaint_id ascending
        complaints.sort((a, b) => a.complaint_id - b.complaint_id);
        
        console.log(`🔥 ${complaints.length} complaints received from Firebase`);
        setConnectionStatus('connected');
        
        await checkAndAutoEscalate();
        renderCurrentView();
    }, (error) => {
        console.error('❌ Firestore listener error:', error);
        setConnectionStatus('error');
        showToast('Connection error. Please refresh.', 'error');
    });
    
    seedInitialData();
}

async function seedInitialData() {
    try {
        const snap = await window.fb.getDocs(
            window.fb.collection(window.fb.db, COMPLAINTS_COLLECTION)
        );
        
        if (snap.empty) {
            console.log('📝 Seeding initial demo complaints...');
            const seedData = [
                {
                    complaint_id: 1001,
                    submitted_by: 'Demo Student',
                    category: 'IT/Wi-Fi',
                    description: 'Wi-Fi not working in Library 2nd floor',
                    priority: 'High',
                    status: 'Open',
                    assigned_staff_id: 1,
                    escalation_level: 0,
                    strict: false,
                    sla_deadline: Date.now() + SLA_SECONDS * 1000,
                    created_at: Date.now()
                },
                {
                    complaint_id: 1002,
                    submitted_by: 'Demo Student',
                    category: 'Electrical',
                    description: 'Main hall ceiling fan sparking',
                    priority: 'High',
                    status: 'Open',
                    assigned_staff_id: 3,
                    escalation_level: 0,
                    strict: false,
                    sla_deadline: Date.now() + SLA_SECONDS * 1000,
                    created_at: Date.now()
                }
            ];
            
            for (const c of seedData) {
                await window.fb.setDoc(
                    window.fb.doc(window.fb.db, COMPLAINTS_COLLECTION, String(c.complaint_id)),
                    c
                );
            }
        }
    } catch (e) {
        console.error('Seed error:', e);
    }
}

// ============================================================
// FIREBASE WRITE HELPERS
// ============================================================

async function saveTicket(ticket) {
    const docId = String(ticket.complaint_id);
    const cleanTicket = { ...ticket };
    delete cleanTicket._docId;
    await window.fb.setDoc(
        window.fb.doc(window.fb.db, COMPLAINTS_COLLECTION, docId),
        cleanTicket
    );
}

// ============================================================
// RENDER FUNCTIONS  (all safe — no crashes)
// ============================================================

function updateHeaderStats() {
    const total = complaints.length;
    const open = complaints.filter(c => c.status === 'Open' || c.status === 'In Progress').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;
    const escalated = complaints.filter(c => c.escalation_level >= 1).length;
    
    setText('totalComplaints', total);
    setText('openComplaints', open);
    setText('resolvedComplaints', resolved);
    setText('escalatedComplaints', escalated);
    
    setText('studentBadge', total);
    setText('staffBadge', complaints.filter(c => 
        c.category === currentStaffDept && (c.status === 'Open' || c.status === 'In Progress')
    ).length);
    setText('hodBadge', complaints.filter(c => 
        c.category === currentHODDept && c.status === 'Escalated to HOD'
    ).length);
}

function renderStudentTable() {
    const tbody = document.querySelector('#studentTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (complaints.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h4>No complaints yet</h4>
                        <p style="color: var(--text-light);">Submit your first complaint above!</p>
                    </div>
                </td>
            </tr>
        `;
        setText('studentCount', '');
        return;
    }
    
    const sorted = [...complaints].sort((a, b) => b.complaint_id - a.complaint_id);
    
    sorted.forEach(c => {
        const priorityClass = `priority-${c.priority}`;
        const statusClass = `status-${c.status.replace(/\s/g, '-')}`;
        tbody.innerHTML += `
            <tr>
                <td><strong>#${c.complaint_id}</strong></td>
                <td><i class="fas fa-user" style="color: var(--text-light); font-size: 11px;"></i> ${c.submitted_by || 'Anonymous'}</td>
                <td>${c.category}</td>
                <td>${c.description}</td>
                <td><span class="priority-badge ${priorityClass}">${c.priority}</span></td>
                <td>${getStaffName(c.assigned_staff_id)}</td>
                <td>
                    <span class="status-badge ${statusClass}">${c.status}</span>
                    ${c.strict ? '<span class="strict-badge">STRICT</span>' : ''}
                </td>
                <td id="sla-${c.complaint_id}">${timeLeftLabel(c)}</td>
            </tr>
        `;
    });
    
    setText('studentCount', `(${complaints.length} total)`);
}

function renderStaffTable() {
    const tbody = document.querySelector('#staffTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const filtered = complaints.filter(c => c.category === currentStaffDept);
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <h4>No tickets for ${currentStaffDept}</h4>
                        <p style="color: var(--text-light);">All caught up! 🎉</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    filtered.sort((a, b) => b.complaint_id - a.complaint_id).forEach(c => {
        const locked = (c.status === 'Escalated to HOD' || c.status === 'Escalated to Admin');
        const statusClass = `status-${c.status.replace(/\s/g, '-')}`;
        const priorityClass = `priority-${c.priority}`;
        
        tbody.innerHTML += `
            <tr>
                <td><strong>#${c.complaint_id}</strong></td>
                <td>${c.description}</td>
                <td><span class="priority-badge ${priorityClass}">${c.priority}</span></td>
                <td>${getStaffName(c.assigned_staff_id)}</td>
                <td>
                    <span class="status-badge ${statusClass}">${c.status}</span>
                    ${c.strict ? '<span class="strict-badge">STRICT</span>' : ''}
                </td>
                <td id="sla-${c.complaint_id}">${timeLeftLabel(c)}</td>
                <td>
                    ${locked ? '<span style="color: var(--text-light);"><i class="fas fa-lock"></i> Locked</span>' : `
                    <select class="status-select" onchange="updateStaffStatus(${c.complaint_id}, this.value)">
                        <option value="Open" ${c.status === 'Open' ? 'selected' : ''}>Open</option>
                        <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                    </select>`}
                </td>
                <td>
                    ${locked || c.status === 'Resolved' ? '<span style="color: var(--text-light);">—</span>' : 
                    `<button class="btn btn-danger btn-xs" onclick="escalateToHOD(${c.complaint_id})">
                        <i class="fas fa-arrow-up"></i> Unable
                    </button>`}
                </td>
            </tr>
        `;
    });
}

function renderHODTables() {
    const escBody = document.querySelector('#hodEscalatedTable tbody');
    if (escBody) {
        escBody.innerHTML = '';
        
        const escalated = complaints.filter(c => 
            c.category === currentHODDept && c.status === 'Escalated to HOD'
        );
        
        if (escalated.length === 0) {
            escBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <i class="fas fa-check-circle" style="color: var(--success);"></i>
                            <h4>No escalated tickets</h4>
                            <p style="color: var(--text-light);">All tickets are being handled by staff.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            escalated.forEach(c => {
                const priorityClass = `priority-${c.priority}`;
                const statusClass = `status-${c.status.replace(/\s/g, '-')}`;
                escBody.innerHTML += `
                    <tr>
                        <td><strong>#${c.complaint_id}</strong></td>
                        <td>${c.description}</td>
                        <td><span class="priority-badge ${priorityClass}">${c.priority}</span></td>
                        <td>${getStaffName(c.assigned_staff_id)}</td>
                        <td><span class="status-badge ${statusClass}">${c.status}</span></td>
                        <td>
                            <div class="action-buttons">
                                <select id="hodReassignSelect-${c.complaint_id}">
                                    ${getStaffByDept(c.category).map(s =>
                                        `<option value="${s.staff_id}" ${s.staff_id === c.assigned_staff_id ? 'selected' : ''}>
                                            ${s.name} (${s.escalation_count})
                                        </option>`
                                    ).join('')}
                                </select>
                                <button class="btn btn-warning btn-xs" onclick="reassignStrict(${c.complaint_id})">
                                    <i class="fas fa-exchange-alt"></i> Reassign
                                </button>
                                <button class="btn btn-danger btn-xs" onclick="escalateToAdmin(${c.complaint_id})">
                                    <i class="fas fa-arrow-up"></i> To Admin
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
    }
    
    const allBody = document.querySelector('#hodAllTable tbody');
    if (allBody) {
        allBody.innerHTML = '';
        const allDept = complaints.filter(c => c.category === currentHODDept);
        if (allDept.length === 0) {
            allBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:20px;">No tickets in this department.</td></tr>`;
        } else {
            allDept.sort((a, b) => b.complaint_id - a.complaint_id).forEach(c => {
                const statusClass = `status-${c.status.replace(/\s/g, '-')}`;
                const priorityClass = `priority-${c.priority}`;
                allBody.innerHTML += `
                    <tr>
                        <td><strong>#${c.complaint_id}</strong></td>
                        <td>${c.description}</td>
                        <td><span class="priority-badge ${priorityClass}">${c.priority}</span></td>
                        <td>${getStaffName(c.assigned_staff_id)}</td>
                        <td>
                            <span class="status-badge ${statusClass}">${c.status}</span>
                            ${c.strict ? '<span class="strict-badge">STRICT</span>' : ''}
                        </td>
                        <td>${c.escalation_level}</td>
                    </tr>
                `;
            });
        }
    }
    
    const perfBody = document.querySelector('#hodPerformanceTable tbody');
    if (perfBody) {
        perfBody.innerHTML = '';
        const sorted = getStaffByDept(currentHODDept).sort((a, b) => a.escalation_count - b.escalation_count);
        const maxEsc = Math.max(1, ...sorted.map(s => s.escalation_count));
        
        sorted.forEach(s => {
            const pct = Math.min(100, (s.escalation_count / maxEsc) * 100);
            const cls = pct < 30 ? 'good' : pct < 60 ? 'warning' : 'danger';
            perfBody.innerHTML += `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.escalation_count}</td>
                    <td>
                        <div class="perf-wrapper">
                            <div class="performance-bar">
                                <div class="fill ${cls}" style="width: ${pct}%;"></div>
                            </div>
                            <span class="perf-label">${pct.toFixed(0)}%</span>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
}

function renderAdminTables() {
    const escBody = document.querySelector('#adminEscalatedTable tbody');
    if (escBody) {
        escBody.innerHTML = '';
        const level2 = complaints.filter(c => c.status === 'Escalated to Admin');
        
        if (level2.length === 0) {
            escBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-shield-alt" style="color: var(--success);"></i>
                            <h4>No Level-2 escalations</h4>
                            <p style="color: var(--text-light);">All tickets are being handled at department level.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            level2.forEach(c => {
                const priorityClass = `priority-${c.priority}`;
                const statusClass = `status-${c.status.replace(/\s/g, '-')}`;
                escBody.innerHTML += `
                    <tr>
                        <td><strong>#${c.complaint_id}</strong></td>
                        <td>${c.category}</td>
                        <td>${c.description}</td>
                        <td><span class="priority-badge ${priorityClass}">${c.priority}</span></td>
                        <td>${getStaffName(c.assigned_staff_id)}</td>
                        <td><span class="status-badge ${statusClass}">${c.status}</span></td>
                        <td>
                            <div class="action-buttons">
                                <select id="adminReassignSelect-${c.complaint_id}">
                                    ${getStaffByDept(c.category).map(s =>
                                        `<option value="${s.staff_id}" ${s.staff_id === c.assigned_staff_id ? 'selected' : ''}>
                                            ${s.name} (${s.escalation_count})
                                        </option>`
                                    ).join('')}
                                </select>
                                <button class="btn btn-success btn-xs" onclick="adminResolve(${c.complaint_id})">
                                    <i class="fas fa-check"></i> Resolve
                                </button>
                                <button class="btn btn-warning btn-xs" onclick="adminReassignToDept(${c.complaint_id})">
                                    <i class="fas fa-exchange-alt"></i> Reassign
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
    }
    
    const allBody = document.querySelector('#adminAllTable tbody');
    if (allBody) {
        allBody.innerHTML = '';
        if (complaints.length === 0) {
            allBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:20px;">No complaints in the system.</td></tr>`;
        } else {
            [...complaints].sort((a, b) => b.complaint_id - a.complaint_id).forEach(c => {
                const statusClass = `status-${c.status.replace(/\s/g, '-')}`;
                const priorityClass = `priority-${c.priority}`;
                allBody.innerHTML += `
                    <tr>
                        <td><strong>#${c.complaint_id}</strong></td>
                        <td>${c.category}</td>
                        <td>${c.description}</td>
                        <td><span class="priority-badge ${priorityClass}">${c.priority}</span></td>
                        <td>${getStaffName(c.assigned_staff_id)}</td>
                        <td>
                            <span class="status-badge ${statusClass}">${c.status}</span>
                            ${c.strict ? '<span class="strict-badge">STRICT</span>' : ''}
                        </td>
                        <td>${c.escalation_level}</td>
                    </tr>
                `;
            });
        }
    }
    
    const usersBody = document.querySelector('#adminUsersTable tbody');
    if (usersBody) {
        usersBody.innerHTML = '';
        staffMembers.forEach(s => {
            usersBody.innerHTML += `
                <tr>
                    <td><i class="fas fa-user-cog" style="color: var(--info);"></i> Staff</td>
                    <td>${s.name}</td>
                    <td>${s.department}</td>
                </tr>
            `;
        });
        hods.forEach(h => {
            usersBody.innerHTML += `
                <tr>
                    <td><i class="fas fa-user-tie" style="color: var(--warning);"></i> HOD</td>
                    <td>${h.name}</td>
                    <td>All Departments</td>
                </tr>
            `;
        });
    }
    
    const perfBody = document.querySelector('#adminPerformanceTable tbody');
    if (perfBody) {
        perfBody.innerHTML = '';
        const sorted = [...staffMembers].sort((a, b) => a.escalation_count - b.escalation_count);
        const maxEsc = Math.max(1, ...sorted.map(s => s.escalation_count));
        
        sorted.forEach(s => {
            const pct = Math.min(100, (s.escalation_count / maxEsc) * 100);
            const cls = pct < 30 ? 'good' : pct < 60 ? 'warning' : 'danger';
            perfBody.innerHTML += `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.department}</td>
                    <td>${s.escalation_count}</td>
                    <td>
                        <div class="perf-wrapper">
                            <div class="performance-bar">
                                <div class="fill ${cls}" style="width: ${pct}%;"></div>
                            </div>
                            <span class="perf-label">${pct.toFixed(0)}%</span>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
}

function renderCurrentView() {
    try {
        updateHeaderStats();
        if (currentView === 'student') renderStudentTable();
        else if (currentView === 'staff') renderStaffTable();
        else if (currentView === 'hod') renderHODTables();
        else if (currentView === 'admin') renderAdminTables();
    } catch (err) {
        console.error('Render error:', err);
    }
}

// ============================================================
// ACTIONS
// ============================================================

async function submitComplaint(e) {
    e.preventDefault();
    
    const cat = getValue('catSelect');
    const desc = getValue('descInput').trim();
    const priority = getValue('prioritySelect');
    const studentName = getValue('studentName').trim();
    
    if (!desc || !studentName) {
        showToast('Please fill in all fields.', 'warning');
        return;
    }
    
    if (!fbReady) {
        showToast('Not connected to database. Please wait.', 'error');
        return;
    }
    
    const btn = $('submitBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner"></i> Submitting...';
    }
    
    try {
        const newId = complaints.length ? Math.max(...complaints.map(c => c.complaint_id)) + 1 : 1001;
        const assignedStaff = findStaffForDept(cat);
        
        const newTicket = {
            complaint_id: newId,
            submitted_by: studentName,
            category: cat,
            description: desc,
            priority: priority,
            status: 'Open',
            assigned_staff_id: assignedStaff,
            escalation_level: 0,
            strict: false,
            sla_deadline: newDeadline(),
            created_at: Date.now()
        };
        
        await saveTicket(newTicket);
        
        setValue('descInput', '');
        setValue('studentName', '');
        
        showToast(`✅ Complaint #${newId} submitted!`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Failed to submit. Check connection.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Complaint';
        }
    }
}

function resetForm() {
    setValue('descInput', '');
    setValue('studentName', '');
    setValue('prioritySelect', 'Medium');
    setValue('catSelect', 'IT/Wi-Fi');
    showToast('Form has been reset.', 'info');
}

async function updateStaffStatus(id, newStatus) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    ticket.status = newStatus;
    if (newStatus === 'Resolved') ticket.strict = false;
    
    try {
        await saveTicket(ticket);
        showToast(`Ticket #${id} → ${newStatus}`, 'info');
    } catch (err) {
        showToast('Update failed.', 'error');
    }
}

async function escalateToHOD(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    ticket.status = 'Escalated to HOD';
    ticket.escalation_level = 1;
    incrementEscalationCount(ticket.assigned_staff_id);
    
    try {
        await saveTicket(ticket);
        showToast(`⬆️ Ticket #${id} escalated to HOD.`, 'warning');
    } catch (err) {
        showToast('Escalation failed.', 'error');
    }
}

async function reassignStrict(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    const select = $(`hodReassignSelect-${id}`);
    const chosenStaffId = select ? parseInt(select.value) : ticket.assigned_staff_id;
    
    ticket.assigned_staff_id = chosenStaffId;
    ticket.status = 'Open';
    ticket.strict = true;
    ticket.sla_deadline = newDeadline();
    
    try {
        await saveTicket(ticket);
        showToast(`🔄 Reassigned STRICT to ${getStaffName(chosenStaffId)}.`, 'warning');
    } catch (err) {
        showToast('Reassign failed.', 'error');
    }
}

async function escalateToAdmin(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    ticket.status = 'Escalated to Admin';
    ticket.escalation_level = 2;
    
    try {
        await saveTicket(ticket);
        showToast(`⬆️ Ticket #${id} → Admin.`, 'error');
    } catch (err) {
        showToast('Escalation failed.', 'error');
    }
}

async function adminResolve(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    ticket.status = 'Resolved';
    ticket.strict = false;
    
    try {
        await saveTicket(ticket);
        showToast(`✅ Ticket #${id} resolved.`, 'success');
    } catch (err) {
        showToast('Resolve failed.', 'error');
    }
}

async function adminReassignToDept(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    const select = $(`adminReassignSelect-${id}`);
    const chosenStaffId = select ? parseInt(select.value) : ticket.assigned_staff_id;
    
    ticket.assigned_staff_id = chosenStaffId;
    ticket.status = 'Open';
    ticket.strict = true;
    ticket.escalation_level = 1;
    ticket.sla_deadline = newDeadline();
    
    try {
        await saveTicket(ticket);
        showToast(`🔄 Reassigned STRICT.`, 'warning');
    } catch (err) {
        showToast('Reassign failed.', 'error');
    }
}

async function clearAllData() {
    if (!confirm('⚠️ Delete ALL complaints from the database? This affects everyone!')) return;
    
    try {
        const snap = await window.fb.getDocs(
            window.fb.collection(window.fb.db, COMPLAINTS_COLLECTION)
        );
        
        for (const docItem of snap.docs) {
            await window.fb.deleteDoc(
                window.fb.doc(window.fb.db, COMPLAINTS_COLLECTION, docItem.id)
            );
        }
        
        staffMembers.forEach(s => s.escalation_count = 0);
        
        showToast('All data cleared.', 'info');
    } catch (err) {
        console.error(err);
        showToast('Reset failed.', 'error');
    }
}

// ============================================================
// AUTO-ESCALATION
// ============================================================

async function checkAndAutoEscalate() {
    for (const c of complaints) {
        const stillWithStaff = (c.status === 'Open' || c.status === 'In Progress');
        if (stillWithStaff && c.escalation_level < 1 && Date.now() >= c.sla_deadline) {
            c.status = 'Escalated to HOD';
            c.escalation_level = 1;
            incrementEscalationCount(c.assigned_staff_id);
            
            try {
                await saveTicket(c);
                showToast(`⏰ SLA breached! Ticket #${c.complaint_id} auto-escalated.`, 'error');
            } catch (err) {
                console.error('Auto-escalation failed:', err);
            }
        }
    }
}

function updateCountdowns() {
    complaints.forEach(c => {
        const cell = $(`sla-${c.complaint_id}`);
        if (cell) cell.innerHTML = timeLeftLabel(c);
    });
}

// ============================================================
// VIEW SWITCHING
// ============================================================

function switchView(viewName) {
    currentView = viewName;
    
    queryAll('.section').forEach(el => el.classList.remove('active'));
    const section = $(`${viewName}Section`);
    if (section) section.classList.add('active');
    
    queryAll('.view-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    renderCurrentView();
}

// ============================================================
// EVENT BINDINGS
// ============================================================

function bindEvents() {
    // View tabs
    queryAll('.view-tabs button').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    
    // Staff dept filters
    queryAll('[data-staff-dept]').forEach(btn => {
        btn.addEventListener('click', function() {
            queryAll('[data-staff-dept]').forEach(b => b.classList.remove('active-filter'));
            this.classList.add('active-filter');
            currentStaffDept = this.dataset.staffDept;
            setText('staffDeptHeading', `Assigned Tickets (${currentStaffDept} Dept)`);
            renderCurrentView();
        });
    });
    
    // HOD dept filters
    queryAll('[data-hod-dept]').forEach(btn => {
        btn.addEventListener('click', function() {
            queryAll('[data-hod-dept]').forEach(b => b.classList.remove('active-filter'));
            this.classList.add('active-filter');
            currentHODDept = this.dataset.hodDept;
            setText('hodDeptHeading', `Escalated Tickets (${currentHODDept} Dept)`);
            renderCurrentView();
        });
    });
    
    // Complaint form
    const form = $('complaintForm');
    if (form) form.addEventListener('submit', submitComplaint);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
} else {
    bindEvents();
}

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================================

window.submitComplaint = submitComplaint;
window.resetForm = resetForm;
window.updateStaffStatus = updateStaffStatus;
window.escalateToHOD = escalateToHOD;
window.reassignStrict = reassignStrict;
window.escalateToAdmin = escalateToAdmin;
window.adminResolve = adminResolve;
window.adminReassignToDept = adminReassignToDept;
window.clearAllData = clearAllData;
window.switchView = switchView;

// ============================================================
// INITIALIZATION
// ============================================================

window.addEventListener('firebase-ready', () => {
    console.log('🔥 Firebase-ready event received');
    setupFirebaseListener();
});

setTimeout(() => {
    if (!fbReady && window.fb) {
        setupFirebaseListener();
    }
}, 1500);

setInterval(updateCountdowns, 1000);
setInterval(checkAndAutoEscalate, 30000);

console.log('📌 SLA: 24 Hours');
console.log('✅ Safe script loaded — no crashes guaranteed');