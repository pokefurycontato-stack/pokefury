/* =============================================================
   groups.js — Sistema de Grupos/Equipes (máx. 3 jogadores)
   ============================================================= */

class GroupSystem {
    constructor() {
        this.db = window.db;
        this.groupId = null;
        this.members = [];
        this.leaderId = null;
        this._inviteSub = null;
        this._memberSub = null;
        this._messageSub = null;
        this._groupSub = null;
        this._messageSubGroupId = null;
        this._pendingInvites = {};
        this._listeners = [];
        this._activeInvite = null;
        this._initialized = false;
    }

    _charId() {
        return window.GameData?.currentCharacterId || null;
    }

    _myName() {
        const chat = window.cityScreen?._chat || window.pokefury?.chat;
        return (chat && chat.playerName) || window.GameData?.playerName || 'Treinador';
    }

    _mySkin() {
        const city = window.cityScreen;
        return (city && city.myPlayer && city.myPlayer.skin_url) || window.GameData?.avatar_url || null;
    }

    get inGroup() {
        return !!this.groupId;
    }

    isLeader() {
        return this.groupId && this.leaderId === this._charId();
    }

    onGroupChange(fn) {
        this._listeners.push(fn);
    }

    _notify() {
        this._listeners.forEach(fn => {
            try { fn(); } catch (e) {}
        });
    }

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        this.subscribeInvites();
        this.subscribeMembers();
        this.subscribeGroup();
        await this.loadMyGroup();
    }

    // ---------------- Carregar meu grupo ----------------
    async loadMyGroup() {
        const myId = this._charId();
        if (!myId) { this._clearLocal(); return; }
        try {
            const { data: rows } = await this.db
                .from('group_members')
                .select('group_id')
                .eq('character_id', myId)
                .limit(1);
            if (!rows || rows.length === 0) {
                this._clearLocal();
                return;
            }
            await this.loadGroup(rows[0].group_id);
        } catch (e) {
            console.warn('[Groups] loadMyGroup failed:', e);
        }
    }

    async loadGroup(gid) {
        try {
            const [gRes, mRes] = await Promise.all([
                this.db.from('groups').select('*').eq('id', gid).single(),
                this.db.from('group_members').select('*').eq('group_id', gid).order('joined_at', { ascending: true })
            ]);
            const g = gRes.data;
            const members = mRes.data || [];
            if (!g) { this._clearLocal(); return; }
            this.groupId = gid;
            this.leaderId = g.leader_character_id;
            this.members = members;
            this.renderBox();
            this._syncSkin();
            this._notify();
            this.subscribeMessages(gid);
        } catch (e) {
            console.warn('[Groups] loadGroup failed:', e);
        }
    }

    _clearLocal() {
        const hadGroup = !!this.groupId;
        this.groupId = null;
        this.leaderId = null;
        this.members = [];
        if (hadGroup) {
            this.renderBox();
            this._notify();
            this.unsubscribeMessages();
        }
    }

    async _syncSkin() {
        const myId = this._charId();
        const mySkin = this._mySkin();
        if (!this.groupId || !myId || !mySkin) return;
        const me = this.members.find(m => m.character_id === myId);
        if (!me || me.skin_url !== mySkin) {
            try {
                await this.db.rpc('group_update_skin', { p_character_id: myId, p_skin_url: mySkin });
            } catch (e) {}
        }
    }

    // ---------------- Convites ----------------
    subscribeInvites() {
        if (this._inviteSub) return;
        this._inviteSub = this.db
            .channel('groups-invites-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'group_invites'
            }, (payload) => {
                const inv = payload.new;
                const myId = this._charId();
                if (!inv || inv.receiver_character_id !== myId) return;
                this._pendingInvites[inv.id] = inv;
                this.showInvitePopup(inv);
            })
            .subscribe();
    }

    async sendInvite(characterId, name) {
        const myId = this._charId();
        if (!myId || !characterId) return { error: 'Falha ao enviar convite' };
        if (characterId === myId) return { error: 'Você não pode se convidar' };
        if (this.members.length >= 3 && this.groupId) return { error: 'Sua equipe já está cheia (máx. 3)' };
        try {
            const { data, error } = await this.db.rpc('group_send_invite', {
                p_sender_id: myId,
                p_sender_name: this._myName(),
                p_sender_skin: this._mySkin(),
                p_receiver_id: characterId
            });
            if (error) return { error: error.message };
            if (data && data.error) return { error: data.error };
            if (data && data.group_id && !this.groupId) {
                await this.loadGroup(data.group_id);
            }
            return { ok: true };
        } catch (e) {
            return { error: 'Falha ao enviar convite' };
        }
    }

    showInvitePopup(inv) {
        if (this._activeInvite) return; // só um convite por vez
        this._activeInvite = inv;
        const overlay = document.getElementById('city-group-invite-popup');
        if (!overlay) return;
        const box = document.getElementById('city-group-invite-box');
        if (box) box.innerHTML = `
            <div style="text-align:center;margin-bottom:14px;">
                <div style="font-size:26px;margin-bottom:4px;">👥</div>
                <h3 style="margin:0;color:#fff;font-size:15px;">Solicitação de grupo</h3>
            </div>
            <p style="color:#d1d5db;font-size:13px;text-align:center;margin:0 0 16px;">
                <b style="color:#fff;">${this._esc(inv.sender_name || 'Jogador')}</b> te enviou uma solicitação de grupo, aceitar?
            </p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="city-group-invite-yes" style="flex:1;padding:10px;border:none;border-radius:8px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">Sim</button>
                <button id="city-group-invite-no" style="flex:1;padding:10px;border:none;border-radius:8px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">Não</button>
            </div>
        `;
        overlay.classList.remove('hidden');

        document.getElementById('city-group-invite-yes').addEventListener('click', () => {
            this.acceptInvite(inv);
        });
        document.getElementById('city-group-invite-no').addEventListener('click', () => {
            this.declineInvite(inv);
        });
    }

    async acceptInvite(inv) {
        const myId = this._charId();
        const overlay = document.getElementById('city-group-invite-popup');
        if (overlay) overlay.classList.add('hidden');
        this._activeInvite = null;
        if (!myId) return;
        try {
            const { data, error } = await this.db.rpc('group_accept_invite', {
                p_invite_id: inv.id,
                p_character_id: myId,
                p_character_name: this._myName(),
                p_skin_url: this._mySkin()
            });
            if (error || (data && data.error)) {
                window.pokefury?.showToast?.((data && data.error) || error.message, 'error');
                return;
            }
            window.pokefury?.showToast?.('Você entrou na equipe!', 'success');
            await this.loadGroup(data.group_id);
        } catch (e) {}
    }

    async declineInvite(inv) {
        const myId = this._charId();
        const overlay = document.getElementById('city-group-invite-popup');
        if (overlay) overlay.classList.add('hidden');
        this._activeInvite = null;
        if (!myId) return;
        try {
            await this.db.rpc('group_decline_invite', { p_invite_id: inv.id, p_character_id: myId });
        } catch (e) {}
    }

    // ---------------- Sair da equipe ----------------
    async leaveGroup() {
        const myId = this._charId();
        if (!myId || !this.groupId) return;
        try {
            const { data, error } = await this.db.rpc('group_leave', { p_character_id: myId });
            if (error || (data && data.error)) {
                window.pokefury?.showToast?.((data && data.error) || error.message, 'error');
                return;
            }
            if (data && data.disbanded) {
                window.pokefury?.showToast?.('A equipe foi desfeita.', 'info');
            } else {
                window.pokefury?.showToast?.('Você saiu da equipe.', 'info');
            }
            this._clearLocal();
        } catch (e) {}
    }

    // ---------------- Membros (atualização em tempo real) ----------------
    subscribeMembers() {
        if (this._memberSub) return;
        this._memberSub = this.db
            .channel('groups-members-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_members'
            }, () => {
                this.loadMyGroup();
            })
            .subscribe();
    }

    subscribeGroup() {
        if (this._groupSub) return;
        this._groupSub = this.db
            .channel('groups-group-realtime')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'groups'
            }, (payload) => {
                const row = payload.new;
                if (this.groupId && row && row.id === this.groupId) {
                    this.leaderId = row.leader_character_id;
                    this.renderBox();
                }
            })
            .subscribe();
    }

    // ---------------- Mensagens do grupo (para o chat) ----------------
    subscribeMessages(gid) {
        if (!gid) return;
        if (this._messageSub) {
            if (this._messageSubGroupId === gid) return;
            try { this._messageSub.unsubscribe(); } catch (e) {}
            this._messageSub = null;
        }
        this._messageSubGroupId = gid;
        this._messageSub = this.db
            .channel('groups-messages-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'group_messages',
                filter: `group_id=eq.${gid}`
            }, (payload) => {
                this._notifyMessage(payload.new);
            })
            .subscribe();
    }

    unsubscribeMessages() {
        if (this._messageSub) {
            try { this._messageSub.unsubscribe(); } catch (e) {}
            this._messageSub = null;
        }
        this._messageSubGroupId = null;
    }

    _notifyMessage(msg) {
        this._messageListeners && this._messageListeners.forEach(fn => {
            try { fn(msg); } catch (e) {}
        });
    }

    onGroupMessage(fn) {
        if (!this._messageListeners) this._messageListeners = [];
        this._messageListeners.push(fn);
    }

    // ---------------- Box de time ----------------
    renderBox() {
        const box = document.getElementById('city-group-box');
        if (!box) return;
        if (!this.groupId || this.members.length === 0) {
            box.classList.add('hidden');
            return;
        }
        box.classList.remove('hidden');
        const myId = this._charId();

        const rows = this.members.map(m => {
            const isLeader = m.character_id === this.leaderId;
            const isMe = m.character_id === myId;
            const skin = m.skin_url || 'assets/perso_masculino.webp';
            return `
                <div style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;background:${isMe ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)'};margin-bottom:4px;">
                    <img src="${skin}" alt="" onerror="this.onerror=null;this.src='assets/perso_masculino.webp';" style="width:30px;height:30px;border-radius:6px;object-fit:cover;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);">
                    <span style="flex:1;color:#fff;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this._esc(m.character_name)}${isMe ? ' <span style="color:#38bdf8;font-size:10px;">(você)</span>' : ''}</span>
                    ${isLeader ? '<span style="font-size:14px;" title="Líder">👑</span>' : ''}
                </div>
            `;
        }).join('');

        box.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="color:#fff;font-size:12px;font-weight:700;">👥 Equipe</span>
                <span style="margin-left:auto;color:rgba(255,255,255,0.4);font-size:10px;">${this.members.length}/3</span>
            </div>
            <div style="padding:6px;">${rows}</div>
            <button id="city-group-leave" style="width:100%;padding:9px;border:none;border-radius:8px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Sair da equipe</button>
        `;

        const leaveBtn = document.getElementById('city-group-leave');
        if (leaveBtn) leaveBtn.addEventListener('click', () => this.leaveGroup());
    }

    _esc(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    destroy() {
        if (this._inviteSub) { try { this._inviteSub.unsubscribe(); } catch (e) {} this._inviteSub = null; }
        if (this._memberSub) { try { this._memberSub.unsubscribe(); } catch (e) {} this._memberSub = null; }
        if (this._groupSub) { try { this._groupSub.unsubscribe(); } catch (e) {} this._groupSub = null; }
        this.unsubscribeMessages();
    }
}

window.GroupSystem = new GroupSystem();