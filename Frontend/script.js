/* ============================================================
   CAMPUS COMPLAINT TRACKING SYSTEM - COMPLETE JAVASCRIPT
   ============================================================ */

// ============================================================
// DATA LAYER
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
const SLA_SECONDS = 86400; // 24 hours (24 * 60 * 60)
const deptAssignPointer = {};

let complaints = [
    {
        complaint_id: 1001,
        category: 'IT/Wi-Fi',
        description: 'Wi-Fi not working in Library 2nd floor',
        priority: 'High',
        status: 'Open',
        assigned_staff_id: 1,
        escalation_level: 0,
        strict: false,
        sla_deadline: Date.now() + SLA_SECONDS * 1000
    },
    {
        complaint_id: 1002,
        category: 'Electrical',
        description: 'Main hall ceiling fan sparking',
        priority: 'High',
        status: 'Open',
        assigned_staff_id: 3,
        escalation_level: 0,
        strict: false,
        sla_deadline: Date.now() + SLA_SECONDS * 1000
    }
];

// ============================================================
// UI STATE
// ============================================================

let currentView = 'student';
let currentStaffDept = 'IT/Wi-Fi';
let currentHODDept = 'IT/Wi-Fi';

// ============================================================
// HELPER FUNCTIONS
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
    const secondsLeft = Math.max(0, Math.ceil((c.sla_deadline - Date.now()) / 1000));
    const urgent = secondsLeft <= 5 ? 'urgent' : '';
    return `<span class="countdown ${urgent}">${secondsLeft}s</span>`;
}

function getStatusCounts() {
    const total = complaints.length;
    const open = complaints.filter(c => c.status === 'Open' || c.status === 'In Progress').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;
    const escalated = complaints.filter(c => c.escalation_level >= 1).length;
    return { total, open, resolved, escalated };
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
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
    toast.style.borderLeftColor = colors[type] || 'var(--success)';
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.success}" style="color: ${colors[type] || 'var(--success)'};"></i>
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
// RENDER FUNCTIONS
// ============================================================

function updateHeaderStats() {
    const counts = getStatusCounts();
    document.getElementById('totalComplaints').textContent = counts.total;
    document.getElementById('openComplaints').textContent = counts.open;
    document.getElementById('resolvedComplaints').textContent = counts.resolved;
    document.getElementById('escalatedComplaints').textContent = counts.escalated;
    
    document.getElementById('studentBadge').textContent = complaints.length;
    document.getElementById('staffBadge').textContent = complaints.filter(c => 
        c.category === currentStaffDept && (c.status === 'Open' || c.status === 'In Progress')
    ).length;
    document.getElementById('hodBadge').textContent = complaints.filter(c => 
        c.category === currentHODDept && c.status === 'Escalated to HOD'
    ).length;
    
    document.getElementById('slaDisplay').textContent = SLA_SECONDS + 's';
    document.getElementById('footerSLA').textContent = SLA_SECONDS;
}

function renderStudentTable() {
    const tbody = document.querySelector('#studentTable tbody');
    tbody.innerHTML = '';
    
    if (complaints.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h4>No complaints submitted yet</h4>
                        <p style="color: var(--text-light);">Submit your first complaint above!</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    complaints.forEach(c => {
        const priorityClass = `priority-${c.priority}`;
        const statusClass = `status-${c.status.replace(/\s/g, '-')}`;
        tbody.innerHTML += `
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
                <td id="sla-${c.complaint_id}">${timeLeftLabel(c)}</td>
            </tr>
        `;
    });
    
    document.getElementById('studentCount').textContent = `(${complaints.length} total)`;
}

function renderStaffTable() {
    const tbody = document.querySelector('#staffTable tbody');
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
    
    filtered.forEach(c => {
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
    
    const allBody = document.querySelector('#hodAllTable tbody');
    allBody.innerHTML = '';
    
    const allDept = complaints.filter(c => c.category === currentHODDept);
    if (allDept.length === 0) {
        allBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:20px;">No tickets in this department.</td></tr>`;
    } else {
        allDept.forEach(c => {
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
    
    const perfBody = document.querySelector('#hodPerformanceTable tbody');
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

function renderAdminTables() {
    const escBody = document.querySelector('#adminEscalatedTable tbody');
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
    
    const allBody = document.querySelector('#adminAllTable tbody');
    allBody.innerHTML = '';
    
    if (complaints.length === 0) {
        allBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:20px;">No complaints in the system.</td></tr>`;
    } else {
        complaints.forEach(c => {
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
    
    const usersBody = document.querySelector('#adminUsersTable tbody');
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
    
    const perfBody = document.querySelector('#adminPerformanceTable tbody');
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

function renderCurrentView() {
    updateHeaderStats();
    if (currentView === 'student') renderStudentTable();
    else if (currentView === 'staff') renderStaffTable();
    else if (currentView === 'hod') renderHODTables();
    else if (currentView === 'admin') renderAdminTables();
}

// ============================================================
// ACTION FUNCTIONS
// ============================================================

function submitComplaint(e) {
    e.preventDefault();
    
    const cat = document.getElementById('catSelect').value;
    const desc = document.getElementById('descInput').value.trim();
    const priority = document.getElementById('prioritySelect').value;
    
    if (!desc) {
        showToast('Please describe the issue in detail.', 'warning');
        return;
    }
    
    const newId = complaints.length ? Math.max(...complaints.map(c => c.complaint_id)) + 1 : 1001;
    const assignedStaff = findStaffForDept(cat);
    
    const newTicket = {
        complaint_id: newId,
        category: cat,
        description: desc,
        priority: priority,
        status: 'Open',
        assigned_staff_id: assignedStaff,
        escalation_level: 0,
        strict: false,
        sla_deadline: newDeadline()
    };
    
    complaints.push(newTicket);
    document.getElementById('descInput').value = '';
    
    showToast(`✅ Complaint #${newId} submitted! Assigned to ${getStaffName(assignedStaff)}.`, 'success');
    renderCurrentView();
}

function resetForm() {
    document.getElementById('descInput').value = '';
    document.getElementById('prioritySelect').value = 'Medium';
    document.getElementById('catSelect').value = 'IT/Wi-Fi';
    showToast('Form has been reset.', 'info');
}

function updateStaffStatus(id, newStatus) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (ticket) {
        ticket.status = newStatus;
        if (newStatus === 'Resolved') {
            ticket.strict = false;
            showToast(`✅ Ticket #${id} has been resolved.`, 'success');
        } else {
            showToast(`Ticket #${id} status updated to ${newStatus}.`, 'info');
        }
        renderCurrentView();
    }
}

function escalateToHOD(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (ticket) {
        ticket.status = 'Escalated to HOD';
        ticket.escalation_level = 1;
        incrementEscalationCount(ticket.assigned_staff_id);
        renderCurrentView();
        showToast(`⬆️ Ticket #${id} escalated to HOD for review.`, 'warning');
    }
}

function reassignStrict(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    const select = document.getElementById(`hodReassignSelect-${id}`);
    const chosenStaffId = select ? parseInt(select.value) : ticket.assigned_staff_id;
    
    ticket.assigned_staff_id = chosenStaffId;
    ticket.status = 'Open';
    ticket.strict = true;
    ticket.sla_deadline = newDeadline();
    
    renderCurrentView();
    showToast(`🔄 Ticket #${id} reassigned to ${getStaffName(chosenStaffId)} with STRICT flag.`, 'warning');
}

function escalateToAdmin(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (ticket) {
        ticket.status = 'Escalated to Admin';
        ticket.escalation_level = 2;
        renderCurrentView();
        showToast(`⬆️ Ticket #${id} escalated to Admin (Level 2).`, 'error');
    }
}

function adminResolve(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (ticket) {
        ticket.status = 'Resolved';
        ticket.strict = false;
        renderCurrentView();
        showToast(`✅ Ticket #${id} resolved by Admin.`, 'success');
    }
}

function adminReassignToDept(id) {
    const ticket = complaints.find(c => c.complaint_id === id);
    if (!ticket) return;
    
    const select = document.getElementById(`adminReassignSelect-${id}`);
    const chosenStaffId = select ? parseInt(select.value) : ticket.assigned_staff_id;
    
    ticket.assigned_staff_id = chosenStaffId;
    ticket.status = 'Open';
    ticket.strict = true;
    ticket.escalation_level = 1;
    ticket.sla_deadline = newDeadline();
    
    renderCurrentView();
    showToast(`🔄 Ticket #${id} reassigned to ${getStaffName(chosenStaffId)} with STRICT flag.`, 'warning');
}

// ============================================================
// SLA ENGINE
// ============================================================

function checkSLABreaches() {
    let changed = false;
    complaints.forEach(c => {
        const stillWithStaff = (c.status === 'Open' || c.status === 'In Progress');
        if (stillWithStaff && c.escalation_level < 1 && Date.now() >= c.sla_deadline) {
            c.status = 'Escalated to HOD';
            c.escalation_level = 1;
            incrementEscalationCount(c.assigned_staff_id);
            changed = true;
            showToast(`⏰ SLA breached! Ticket #${c.complaint_id} auto-escalated.`, 'error');
        }
    });
    
    if (changed) {
        renderCurrentView();
    } else {
        complaints.forEach(c => {
            const cell = document.getElementById(`sla-${c.complaint_id}`);
            if (cell) cell.innerHTML = timeLeftLabel(c);
        });
    }
}

// ============================================================
// VIEW SWITCHING
// ============================================================

function switchView(viewName) {
    currentView = viewName;
    
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.getElementById(`${viewName}Section`).classList.add('active');
    
    document.querySelectorAll('.view-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    renderCurrentView();
}

// ============================================================
// EVENT BINDINGS
// ============================================================

document.querySelectorAll('.view-tabs button').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

document.querySelectorAll('[data-staff-dept]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-staff-dept]').forEach(b => b.classList.remove('active-filter'));
        this.classList.add('active-filter');
        currentStaffDept = this.dataset.staffDept;
        document.getElementById('staffDeptHeading').textContent = 
            `Assigned Tickets (${currentStaffDept} Dept)`;
        renderCurrentView();
    });
});

document.querySelectorAll('[data-hod-dept]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-hod-dept]').forEach(b => b.classList.remove('active-filter'));
        this.classList.add('active-filter');
        currentHODDept = this.dataset.hodDept;
        document.getElementById('hodDeptHeading').textContent = 
            `Escalated Tickets (${currentHODDept} Dept)`;
        renderCurrentView();
    });
});

document.getElementById('complaintForm').addEventListener('submit', submitComplaint);

// ============================================================
// MAKE FUNCTIONS GLOBALLY ACCESSIBLE
// ============================================================

window.submitComplaint = submitComplaint;
window.resetForm = resetForm;
window.updateStaffStatus = updateStaffStatus;
window.escalateToHOD = escalateToHOD;
window.reassignStrict = reassignStrict;
window.escalateToAdmin = escalateToAdmin;
window.adminResolve = adminResolve;
window.adminReassignToDept = adminReassignToDept;
window.switchView = switchView;

// ============================================================
// INITIALIZATION
// ============================================================

console.log('🏫 Campus Complaint Tracking System Loaded');
console.log(`📌 SLA: ${SLA_SECONDS} seconds`);
console.log(`📊 Initial complaints: ${complaints.length}`);

setInterval(checkSLABreaches, 1000);
renderCurrentView();