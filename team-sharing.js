// ==========================================
// TEAM SHARING & INVITE CODE SYSTEM
// ==========================================

// ---- Helpers ----

function generateCode(prefix, len = 4) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix + '-';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getFirestoreModules() {
    const { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs,
            deleteDoc, updateDoc, query, where, serverTimestamp } = window.firebaseModules;
    const db = getFirestore(window.firebaseApp);
    return { db, doc, setDoc, getDoc, collection, addDoc, getDocs,
             deleteDoc, updateDoc, query, where, serverTimestamp };
}

// ==========================================
// FEATURE 1 — COMP SHARE CODES
// ==========================================

async function shareComp(compDocId) {
    if (!state.user) { showToast('Please login to share comps', 'warning'); return; }

    const comp = state.savedComps.find(c => c.docId === compDocId);
    if (!comp) { showToast('Comp not found', 'error'); return; }

    // If comp already has a share code, just show it
    if (comp.shareCode) {
        showShareCodeModal(comp.shareCode, 'comp');
        return;
    }

    try {
        const { db, doc, setDoc, updateDoc } = getFirestoreModules();
        const code = generateCode('VLR');

        // Write to public shared_comps collection
        await setDoc(doc(db, 'shared_comps', code), {
            code,
            name: comp.name || 'Untitled Comp',
            mapId: comp.mapId,
            agents: comp.agents,
            notes: comp.notes || '',
            ownerUid: state.user.uid,
            ownerName: state.user.displayName || 'Anonymous',
            createdAt: new Date().toISOString()
        });

        // Attach code back to the user's comp doc
        await updateDoc(doc(db, 'users', state.user.uid, 'comps', compDocId), { shareCode: code });
        comp.shareCode = code;

        renderSavedComps();
        showShareCodeModal(code, 'comp');
        showToast('Share code created!', 'success');
    } catch (e) {
        console.error('Error sharing comp:', e);
        showToast('Error creating share code: ' + e.message, 'error');
    }
}

async function loadSharedComp(code) {
    if (!code || !code.trim()) { showToast('Enter a share code', 'warning'); return; }
    code = code.trim().toUpperCase();

    try {
        const { db, doc, getDoc } = getFirestoreModules();
        const snap = await getDoc(doc(db, 'shared_comps', code));

        if (!snap.exists()) {
            showToast('No comp found with that code', 'error');
            return;
        }

        const data = snap.data();
        const mapName = state.maps.find(m => m.uuid === data.mapId)?.displayName || 'Unknown Map';

        // Build a preview modal
        const agents = (data.agents || []).map(uuid => {
            const ag = state.agents.find(a => a.uuid === uuid);
            return ag ? `<div class="shared-agent-mini" title="${ag.displayName}">
                            <img src="${ag.displayIcon}" alt="${ag.displayName}">
                         </div>` : '';
        }).join('');

        document.getElementById('shared-comp-preview-title').textContent = data.name;
        document.getElementById('shared-comp-preview-map').textContent = `${mapName} • Shared by ${data.ownerName}`;
        document.getElementById('shared-comp-preview-agents').innerHTML = agents;
        document.getElementById('shared-comp-preview-notes').textContent = data.notes || '';
        document.getElementById('shared-comp-preview-modal').classList.remove('hidden');

        // Store pending comp for "Load into Builder"
        window._pendingSharedComp = data;
    } catch (e) {
        console.error('Error loading shared comp:', e);
        showToast('Error loading comp: ' + e.message, 'error');
    }
}

function loadSharedCompIntoBuilder() {
    const data = window._pendingSharedComp;
    if (!data) return;
    const map = state.maps.find(m => m.uuid === data.mapId);
    if (!map) { showToast('Map not found', 'error'); return; }
    closeSharedCompPreview();
    openBuilder(map);
    state.currentComp = [...(data.agents || [null, null, null, null, null])];
    renderSlots();
    showToast('Shared comp loaded into builder!', 'success');
}

function closeSharedCompPreview() {
    document.getElementById('shared-comp-preview-modal').classList.add('hidden');
    window._pendingSharedComp = null;
}

// ==========================================
// FEATURE 2 — TEAM INVITE CODES & ROLES
// ==========================================

let currentTeamData = null; // { teamId, ...data }

async function initTeamSharing() {
    if (!state.user) return;
    await loadMyTeam();
    renderTeamPanel();
}

async function loadMyTeam() {
    if (!state.user) return;
    try {
        const { db, collection, query, where, getDocs } = getFirestoreModules();
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where(`members.${state.user.uid}.role`, '!=', null));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const teamDoc = snap.docs[0];
            currentTeamData = { teamId: teamDoc.id, ...teamDoc.data() };
        } else {
            currentTeamData = null;
        }
    } catch (e) {
        // Firestore composite index may not exist yet — fallback to null
        console.warn('loadMyTeam error (index may be building):', e.message);
        currentTeamData = null;
    }
}

async function createTeam() {
    if (!state.user) { showToast('Please login first', 'warning'); return; }
    if (currentTeamData) { showToast('You are already in a team. Leave it first.', 'warning'); return; }

    const teamNameInput = document.getElementById('new-team-name-input');
    const teamName = teamNameInput?.value.trim();
    if (!teamName) { showToast('Enter a team name', 'warning'); return; }

    try {
        const { db, collection, addDoc } = getFirestoreModules();
        const inviteCode = generateCode('TEAM');
        const teamDoc = {
            teamName,
            inviteCode,
            createdAt: new Date().toISOString(),
            createdBy: state.user.uid,
            members: {
                [state.user.uid]: {
                    role: 'captain',
                    displayName: state.user.displayName || state.user.email,
                    photoURL: state.user.photoURL || '',
                    joinedAt: new Date().toISOString()
                }
            }
        };

        const ref = await addDoc(collection(db, 'teams'), teamDoc);
        currentTeamData = { teamId: ref.id, ...teamDoc };

        showToast('Team created!', 'success');
        renderTeamPanel();
    } catch (e) {
        console.error('Error creating team:', e);
        showToast('Error creating team: ' + e.message, 'error');
    }
}

async function joinTeam(code) {
    if (!state.user) { showToast('Please login first', 'warning'); return; }
    if (!code || !code.trim()) { showToast('Enter a team code', 'warning'); return; }
    code = code.trim().toUpperCase();

    if (currentTeamData) { showToast('Leave your current team first', 'warning'); return; }

    try {
        const { db, collection, query, where, getDocs, doc, updateDoc } = getFirestoreModules();
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('inviteCode', '==', code));
        const snap = await getDocs(q);

        if (snap.empty) { showToast('No team found with that code', 'error'); return; }

        const teamDoc = snap.docs[0];
        const teamData = teamDoc.data();

        // Enforce max 10 members (5 core + 5 subs)
        const memberCount = Object.keys(teamData.members || {}).length;
        if (memberCount >= 10) {
            showToast('This team is full (max 10 members)', 'error');
            return;
        }

        if (teamData.members[state.user.uid]) {
            showToast('You are already in this team!', 'info');
            currentTeamData = { teamId: teamDoc.id, ...teamData };
            renderTeamPanel();
            return;
        }

        const newMemberField = `members.${state.user.uid}`;
        await updateDoc(doc(db, 'teams', teamDoc.id), {
            [newMemberField]: {
                role: 'player',
                displayName: state.user.displayName || state.user.email,
                photoURL: state.user.photoURL || '',
                joinedAt: new Date().toISOString()
            }
        });

        teamData.members[state.user.uid] = {
            role: 'player',
            displayName: state.user.displayName || state.user.email,
            photoURL: state.user.photoURL || '',
            joinedAt: new Date().toISOString()
        };

        currentTeamData = { teamId: teamDoc.id, ...teamData };
        showToast(`Joined "${teamData.teamName}"!`, 'success');
        renderTeamPanel();
    } catch (e) {
        console.error('Error joining team:', e);
        showToast('Error joining: ' + e.message, 'error');
    }
}

async function leaveTeam() {
    if (!currentTeamData || !state.user) return;
    const myRole = currentTeamData.members[state.user.uid]?.role;
    if (myRole === 'captain') {
        showToast('Transfer captain role before leaving, or disband the team', 'warning');
        return;
    }
    if (!confirm('Leave this team?')) return;

    try {
        const { db, doc, updateDoc } = getFirestoreModules();
        const field = `members.${state.user.uid}`;
        // Firestore deleteField
        const { deleteField } = window.firebaseModules;
        await updateDoc(doc(db, 'teams', currentTeamData.teamId), {
            [field]: deleteField()
        });
        currentTeamData = null;
        showToast('Left the team', 'info');
        renderTeamPanel();
    } catch (e) {
        console.error('Error leaving team:', e);
        showToast('Error: ' + e.message, 'error');
    }
}

async function disbandTeam() {
    if (!currentTeamData || !state.user) return;
    const myRole = currentTeamData.members[state.user.uid]?.role;
    if (myRole !== 'captain') { showToast('Only the Captain can disband', 'warning'); return; }
    if (!confirm('Disband the team permanently? This cannot be undone.')) return;

    try {
        const { db, doc, deleteDoc } = getFirestoreModules();
        await deleteDoc(doc(db, 'teams', currentTeamData.teamId));
        currentTeamData = null;
        showToast('Team disbanded', 'info');
        renderTeamPanel();
    } catch (e) {
        console.error('Error disbanding:', e);
        showToast('Error: ' + e.message, 'error');
    }
}

async function changeMemberRole(uid, newRole) {
    if (!currentTeamData || !state.user) return;
    const myRole = currentTeamData.members[state.user.uid]?.role;
    if (myRole !== 'captain') { showToast('Only the Captain can change roles', 'warning'); return; }
    if (uid === state.user.uid) { showToast('Cannot change your own role', 'warning'); return; }

    try {
        const { db, doc, updateDoc } = getFirestoreModules();
        await updateDoc(doc(db, 'teams', currentTeamData.teamId), {
            [`members.${uid}.role`]: newRole
        });
        currentTeamData.members[uid].role = newRole;
        showToast('Role updated!', 'success');
        renderTeamPanel();
    } catch (e) {
        console.error('Error changing role:', e);
        showToast('Error: ' + e.message, 'error');
    }
}

async function removeMember(uid) {
    if (!currentTeamData || !state.user) return;
    const myRole = currentTeamData.members[state.user.uid]?.role;
    if (myRole !== 'captain' && myRole !== 'co-captain') {
        showToast('Insufficient permissions', 'warning'); return;
    }
    if (uid === state.user.uid) { showToast('Cannot remove yourself', 'warning'); return; }

    const memberName = currentTeamData.members[uid]?.displayName || 'this member';
    if (!confirm(`Remove ${memberName} from the team?`)) return;

    try {
        const { db, doc, updateDoc } = getFirestoreModules();
        const { deleteField } = window.firebaseModules;
        await updateDoc(doc(db, 'teams', currentTeamData.teamId), {
            [`members.${uid}`]: deleteField()
        });
        delete currentTeamData.members[uid];
        showToast(`${memberName} removed`, 'info');
        renderTeamPanel();
    } catch (e) {
        console.error('Error removing member:', e);
        showToast('Error: ' + e.message, 'error');
    }
}

async function refreshInviteCode() {
    if (!currentTeamData || !state.user) return;
    const myRole = currentTeamData.members[state.user.uid]?.role;
    if (myRole !== 'captain') { showToast('Only Captain can refresh the code', 'warning'); return; }
    if (!confirm('Generate a new invite code? The old one will stop working.')) return;

    try {
        const { db, doc, updateDoc } = getFirestoreModules();
        const newCode = generateCode('TEAM');
        await updateDoc(doc(db, 'teams', currentTeamData.teamId), { inviteCode: newCode });
        currentTeamData.inviteCode = newCode;
        showToast('New invite code generated!', 'success');
        renderTeamPanel();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ==========================================
// RENDERING
// ==========================================

const ROLE_LABELS = { captain: '👑 Captain', 'co-captain': '⚡ Co-Captain', player: '🎮 Player' };
const ROLE_ORDER = { captain: 0, 'co-captain': 1, player: 2 };

function renderTeamPanel() {
    const panel = document.getElementById('team-panel');
    if (!panel) return;

    if (!state.user) {
        panel.innerHTML = `<div class="team-panel-empty"><p>Login to create or join a team.</p></div>`;
        return;
    }

    if (!currentTeamData) {
        panel.innerHTML = `
            <div class="team-create-join">
                <div class="team-action-card">
                    <h3>Create a Team</h3>
                    <p>You'll get an invite code to share with teammates.</p>
                    <input id="new-team-name-input" class="team-text-input" type="text" placeholder="Team Name" maxlength="30">
                    <button class="primary-btn" onclick="window.createTeam()">Create Team</button>
                </div>
                <div class="team-divider">or</div>
                <div class="team-action-card">
                    <h3>Join a Team</h3>
                    <p>Paste the invite code your captain shared.</p>
                    <input id="join-code-input" class="team-text-input" type="text" placeholder="TEAM-XXXX" maxlength="9">
                    <button class="primary-btn" onclick="window.joinTeamFromInput()">Join Team</button>
                </div>
            </div>
        `;
        return;
    }

    const myRole = currentTeamData.members[state.user.uid]?.role || 'player';
    const isCaptain = myRole === 'captain';
    const isCoOrCaptain = myRole === 'captain' || myRole === 'co-captain';

    const members = Object.entries(currentTeamData.members)
        .sort((a, b) => (ROLE_ORDER[a[1].role] ?? 9) - (ROLE_ORDER[b[1].role] ?? 9));

    const membersHTML = members.map(([uid, member]) => {
        const isMe = uid === state.user.uid;
        const roleLabel = ROLE_LABELS[member.role] || member.role;
        const avatar = member.photoURL
            ? `<img src="${member.photoURL}" class="member-avatar" alt="">`
            : `<div class="member-avatar member-avatar-placeholder">${(member.displayName || '?')[0].toUpperCase()}</div>`;

        let roleSelect = '';
        if (isCaptain && !isMe) {
            roleSelect = `
                <select class="role-select" onchange="window.changeMemberRole('${uid}', this.value)">
                    <option value="co-captain" ${member.role === 'co-captain' ? 'selected' : ''}>⚡ Co-Captain</option>
                    <option value="player" ${member.role === 'player' ? 'selected' : ''}>🎮 Player</option>
                </select>`;
        } else {
            roleSelect = `<span class="role-badge role-${member.role}">${roleLabel}</span>`;
        }

        const removeBtn = (isCoOrCaptain && !isMe && member.role !== 'captain')
            ? `<button class="remove-member-btn" onclick="window.removeMember('${uid}')" title="Remove member">×</button>`
            : '';

        return `
            <div class="member-row ${isMe ? 'member-row-me' : ''}">
                ${avatar}
                <div class="member-info">
                    <span class="member-name">${member.displayName || 'Unknown'}${isMe ? ' (you)' : ''}</span>
                    <span class="member-joined">Joined ${new Date(member.joinedAt).toLocaleDateString()}</span>
                </div>
                <div class="member-actions">
                    ${roleSelect}
                    ${removeBtn}
                </div>
            </div>
        `;
    }).join('');

    const captainActions = isCaptain ? `
        <button class="secondary-btn danger-btn" onclick="window.disbandTeam()">Disband Team</button>
    ` : `
        <button class="secondary-btn" onclick="window.leaveTeam()">Leave Team</button>
    `;

    panel.innerHTML = `
        <div class="team-panel-inner">
            <div class="team-panel-header">
                <div>
                    <h3 class="team-panel-name">${currentTeamData.teamName}</h3>
                    <span class="member-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
                </div>
                ${captainActions}
            </div>

            <div class="invite-code-block">
                <label>Team Invite Code</label>
                <div class="invite-code-row">
                    <span class="invite-code-display">${currentTeamData.inviteCode}</span>
                    <button class="copy-code-btn" onclick="window.copyToClipboard('${currentTeamData.inviteCode}', 'Code copied!')" title="Copy invite code">📋 Copy</button>
                    ${isCaptain ? `<button class="copy-code-btn refresh-btn" onclick="window.refreshInviteCode()" title="Generate new code">🔄</button>` : ''}
                </div>
            </div>

            <div class="members-list">
                ${membersHTML}
            </div>
        </div>
    `;
}

// ==========================================
// SHARE CODE MODAL
// ==========================================

function showShareCodeModal(code, type) {
    document.getElementById('share-code-value').textContent = code;
    document.getElementById('share-code-modal').classList.remove('hidden');
}

function closeShareCodeModal() {
    document.getElementById('share-code-modal').classList.add('hidden');
}

function copyShareCode() {
    const code = document.getElementById('share-code-value').textContent;
    copyToClipboard(code, 'Code copied to clipboard!');
}

function copyToClipboard(text, successMsg = 'Copied!') {
    // Modern async clipboard API (works on https:// and localhost)
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMsg, 'success');
        }).catch(() => {
            fallbackCopy(text, successMsg);
        });
    } else {
        // Fallback for file:// or non-secure contexts
        fallbackCopy(text, successMsg);
    }
}

function fallbackCopy(text, successMsg) {
    const el = document.createElement('textarea');
    el.value = text;
    // Position off-screen so it doesn't flash
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(el);
    if (success) {
        showToast(successMsg, 'success');
    } else {
        showToast('Could not copy — please copy manually', 'warning');
    }
}

// ==========================================
// GLOBALS
// ==========================================

window.shareComp = shareComp;
window.loadSharedComp = loadSharedComp;
window.loadSharedCompIntoBuilder = loadSharedCompIntoBuilder;
window.closeSharedCompPreview = closeSharedCompPreview;
window.createTeam = createTeam;
window.joinTeamFromInput = () => joinTeam(document.getElementById('join-code-input')?.value);
window.joinTeam = joinTeam;
window.leaveTeam = leaveTeam;
window.disbandTeam = disbandTeam;
window.changeMemberRole = changeMemberRole;
window.removeMember = removeMember;
window.refreshInviteCode = refreshInviteCode;
window.closeShareCodeModal = closeShareCodeModal;
window.copyShareCode = copyShareCode;
window.copyToClipboard = copyToClipboard;
window.fallbackCopy = fallbackCopy;
window.initTeamSharing = initTeamSharing;
window.renderTeamPanel = renderTeamPanel;
