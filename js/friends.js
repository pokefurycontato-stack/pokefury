/* =============================================================
   friends.js — Sistema de Amizade + Chat Privado
   ============================================================= */

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

export class FriendsSystem {
    constructor(game) {
        this.game = game;
        this.charId = null;
        this.playerName = null;
        this.friends = [];
        this.selectedFriendId = null;
        this.overlay = null;
        this._statusTimer = null;
        this._subscription = null;
    }

    _me() {
        return this.game.currentCharacterId;
    }

    _myName() {
        return this.game.playerName || 'Treinador';
    }

    async open() {
        this.charId = this._me();
        this.playerName = this._myName();
        if (!this.charId || !window.db) return;
        this.close();
        this.buildOverlay();
        await this.loadFriends();
        this.startStatusPolling();
        this.subscribeMessages();
    }

    close() {
        if (this.overlay) { this.overlay.remove(); this.overlay = null; }
        if (this._statusTimer) { clearInterval(this._statusTimer); this._statusTimer = null; }
        this.unsubscribeMessages();
        this.selectedFriendId = null;
    }

    buildOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'friends-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
        overlay.innerHTML = `
            <div style="display:flex;width:min(840px,94vw);height:min(580px,88vh);background:#0f1520;border:1px solid rgba(255,255,255,0.12);border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                <div style="width:300px;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;">
                    <div style="padding:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(255,255,255,0.08);">
                        <span style="color:#fff;font-weight:700;font-size:16px;">Amigos</span>
                        <div style="display:flex;gap:6px;">
                            <button id="friends-add-btn" style="padding:6px 10px;background:linear-gradient(135deg,#38bdf8,#2563eb);border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">+ Adicionar amigo</button>
                            <button id="friends-close-btn" style="padding:6px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;">✕</button>
                        </div>
                    </div>
                    <div id="friends-list" style="flex:1;overflow-y:auto;padding:8px;"></div>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
                    <div id="friends-chat-header" style="padding:14px;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-weight:700;font-size:15px;">Selecione um amigo</div>
                    <div id="friends-chat-messages" style="flex:1;overflow-y:auto;padding:12px;"></div>
                    <div id="friends-chat-input-area" style="display:flex;padding:10px;border-top:1px solid rgba(255,255,255,0.08);">
                        <input id="friends-chat-input" type="text" placeholder="Digite sua mensagem..." maxlength="300" autocomplete="off" style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:13px;font-family:Inter,sans-serif;outline:none;">
                        <button id="friends-chat-send" style="margin-left:8px;padding:8px 14px;background:linear-gradient(135deg,#38bdf8,#2563eb);border:none;border-radius:6px;color:#fff;font-weight:700;cursor:pointer;">▶</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.overlay = overlay;

        overlay.querySelector('#friends-close-btn').addEventListener('click', () => this.close());
        overlay.querySelector('#friends-add-btn').addEventListener('click', () => this.openAddFriendPopup());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });

        const sendBtn = overlay.querySelector('#friends-chat-send');
        const input = overlay.querySelector('#friends-chat-input');
        const doSend = () => {
            const text = input.value.trim();
            if (!text || !this.selectedFriendId) return;
            this.sendMessage(text);
            input.value = '';
        };
        sendBtn.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
    }

    async loadFriends() {
        this.friends = [];
        const { data, error } = await window.db.rpc('get_friends', { p_character_id: this.charId });
        if (error) return;
        this.friends = data || [];
        this.renderFriendsList();
    }

    renderFriendsList() {
        const list = document.getElementById('friends-list');
        if (!list) return;
        list.innerHTML = '';
        if (this.friends.length === 0) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.35);font-size:12px;padding:14px;text-align:center;">Nenhum amigo ainda.</div>';
            return;
        }
        for (const f of this.friends) {
            const row = document.createElement('div');
            row.dataset.friendId = f.friend_character_id;
            const active = f.friend_character_id === this.selectedFriendId;
            row.style.cssText = `display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;cursor:pointer;background:${active ? 'rgba(56,189,248,0.12)' : 'transparent'};`;
            row.innerHTML = `
                <button class="friends-menu-btn" data-friend-id="${f.friend_character_id}" style="width:20px;height:20px;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.6);font-size:16px;line-height:1;flex-shrink:0;letter-spacing:1px;">⋮</button>
                <div style="flex:1;min-width:0;">
                    <div style="color:#fff;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(f.name)}</div>
                </div>
                <span class="friends-status" style="color:${f.is_online ? '#4caf50' : '#f44336'};font-size:10px;flex-shrink:0;">${f.is_online ? '● online' : '● offline'}</span>
            `;
            row.addEventListener('click', (e) => {
                if (e.target.closest('.friends-menu-btn')) return;
                this.selectFriend(f.friend_character_id, f.name);
            });
            list.appendChild(row);

            row.querySelector('.friends-menu-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showFriendMenu(f.friend_character_id, e);
            });
        }
    }

    showFriendMenu(friendId, anchorEvent) {
        document.querySelectorAll('.friends-dropdown').forEach(d => d.remove());
        const menu = document.createElement('div');
        menu.className = 'friends-dropdown';
        menu.style.cssText = 'position:fixed;z-index:10060;background:#1c2333;border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);overflow:hidden;';
        menu.innerHTML = `<button data-action="delete" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#f44336;font-size:12px;font-weight:600;cursor:pointer;text-align:left;">Deletar amizade</button>`;
        menu.style.left = anchorEvent.clientX + 'px';
        menu.style.top = anchorEvent.clientY + 'px';
        document.body.appendChild(menu);

        menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
            menu.remove();
            await this.removeFriend(friendId);
        });

        const closeMenu = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    async selectFriend(friendId, friendName) {
        this.selectedFriendId = friendId;
        this.renderFriendsList();
        const header = document.getElementById('friends-chat-header');
        if (header) header.textContent = friendName;
        await this.loadChat(friendId);
    }

    async loadChat(friendId) {
        const box = document.getElementById('friends-chat-messages');
        if (!box) return;
        const { data, error } = await window.db.from('private_messages')
            .select('*')
            .or(`sender_character_id.eq.${this.charId},receiver_character_id.eq.${this.charId}`)
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) return;
        const filtered = (data || []).filter(m =>
            (m.sender_character_id === this.charId && m.receiver_character_id === friendId) ||
            (m.sender_character_id === friendId && m.receiver_character_id === this.charId)
        ).reverse();
        box.innerHTML = '';
        filtered.forEach(m => this.appendMessage(m));
        box.scrollTop = box.scrollHeight;
    }

    appendMessage(m) {
        const box = document.getElementById('friends-chat-messages');
        if (!box) return;
        const isMe = m.sender_character_id === this.charId;
        const time = new Date(m.created_at);
        const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
        const div = document.createElement('div');
        div.style.cssText = `display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};margin-bottom:8px;`;
        div.innerHTML = `
            <div style="max-width:70%;padding:8px 12px;border-radius:12px;background:${isMe ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.08)'};color:#fff;font-size:13px;word-break:break-word;">${esc(m.content)}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.35);margin-top:2px;">${timeStr}</div>
        `;
        box.appendChild(div);
    }

    async sendMessage(text) {
        const friendId = this.selectedFriendId;
        if (!friendId || !this.charId) return;
        try {
            await window.db.from('private_messages').insert({
                sender_character_id: this.charId,
                receiver_character_id: friendId,
                content: text.substring(0, 300),
                read: false
            });
        } catch (e) { console.warn('[Friends] send failed:', e); }
    }

    subscribeMessages() {
        this.unsubscribeMessages();
        this._subscription = window.db
            .channel('private-messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, (payload) => {
                const m = payload.new;
                if (!m) return;
                if (m.sender_character_id === this.charId || m.receiver_character_id === this.charId) {
                    const friendId = this.selectedFriendId;
                    if (friendId && (m.sender_character_id === friendId || m.receiver_character_id === friendId)) {
                        this.appendMessage(m);
                        const box = document.getElementById('friends-chat-messages');
                        if (box) box.scrollTop = box.scrollHeight;
                    }
                }
            })
            .subscribe();
    }

    unsubscribeMessages() {
        if (this._subscription) {
            try { this._subscription.unsubscribe(); } catch (e) {}
            this._subscription = null;
        }
    }

    startStatusPolling() {
        if (this._statusTimer) clearInterval(this._statusTimer);
        this._statusTimer = setInterval(() => {
            if (document.getElementById('friends-overlay')) {
                this.loadFriends();
            } else {
                clearInterval(this._statusTimer);
                this._statusTimer = null;
            }
        }, 15000);
    }

    openAddFriendPopup() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#161b22;border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:18px;width:min(400px,92vw);">
                <div style="color:#fff;font-weight:700;font-size:15px;margin-bottom:12px;">Adicionar amigo</div>
                <input id="friends-search-input" type="text" placeholder="Digite o nome do personagem..." autocomplete="off" style="width:100%;padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:13px;box-sizing:border-box;outline:none;">
                <div id="friends-search-results" style="margin-top:8px;max-height:240px;overflow-y:auto;"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        const input = overlay.querySelector('#friends-search-input');
        const results = overlay.querySelector('#friends-search-results');
        let debounce = null;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            const q = input.value.trim();
            if (q.length < 2) { results.innerHTML = ''; return; }
            debounce = setTimeout(async () => {
                const { data } = await window.db.rpc('search_players_online', { p_query: q });
                results.innerHTML = '';
                (data || []).forEach(p => {
                    if (p.id === this.charId) return;
                    const row = document.createElement('div');
                    row.style.cssText = 'padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:#fff;';
                    row.innerHTML = `${esc(p.player_name)} <span style="color:${p.is_online ? '#4caf50' : '#f44336'};font-size:10px;">${p.is_online ? '● online' : '● offline'}</span>`;
                    row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.06)');
                    row.addEventListener('mouseleave', () => row.style.background = 'transparent');
                    row.addEventListener('click', async () => {
                        const ok = await this.addFriend(p.id);
                        if (ok) { overlay.remove(); }
                    });
                    results.appendChild(row);
                });
            }, 250);
        });
        input.focus();
    }

    async addFriend(friendId) {
        const charId = this._me();
        if (!charId) { this.toast('Erro ao enviar convite', 'error'); return false; }
        const { data, error } = await window.db.rpc('send_friend_request', { p_character_id: charId, p_friend_character_id: friendId });
        if (error) { this.toast('Erro ao enviar convite', 'error'); return false; }
        if (data && data.error) { this.toast(data.error, 'error'); return false; }
        this.toast('Convite de amizade enviado!', 'success');
        return true;
    }

    async removeFriend(friendId) {
        const charId = this._me();
        if (!charId) { this.toast('Erro ao remover amigo', 'error'); return; }
        const { data, error } = await window.db.rpc('remove_friend', { p_character_id: charId, p_friend_character_id: friendId });
        if (error || (data && data.error)) { this.toast('Erro ao remover amigo', 'error'); return; }
        if (this.selectedFriendId === friendId) {
            this.selectedFriendId = null;
            const header = document.getElementById('friends-chat-header');
            if (header) header.textContent = 'Selecione um amigo';
            const box = document.getElementById('friends-chat-messages');
            if (box) box.innerHTML = '';
        }
        await this.loadFriends();
    }

    initRealtime() {
        if (this._reqSubscription) return;
        this._reqSubscription = window.db
            .channel('friend-requests')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests' }, (payload) => {
                const req = payload.new;
                if (req && req.receiver_character_id === this._me() && req.status === 'pending') {
                    this.showFriendRequestPopup(req);
                }
            })
            .subscribe();
        this.loadPendingFriendRequests();
    }

    async loadPendingFriendRequests() {
        const me = this._me();
        if (!me) return;
        const { data } = await window.db.rpc('get_pending_friend_requests', { p_character_id: me });
        (data || []).forEach(req => this.showFriendRequestPopup(req));
    }

    showFriendRequestPopup(req) {
        if (!this._shownRequests) this._shownRequests = {};
        if (this._shownRequests[req.id]) return;
        this._shownRequests[req.id] = true;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10090;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#161b22;border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:20px;width:min(360px,92vw);text-align:center;">
                <div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:6px;">👥 Convite de amizade</div>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-bottom:16px;"><b>${esc(req.sender_name || 'Jogador')}</b> te adicionou como amigo.</div>
                <div style="display:flex;gap:8px;">
                    <button data-act="accept" style="flex:1;padding:10px;background:linear-gradient(135deg,#4caf50,#388e3c);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;">Aceitar</button>
                    <button data-act="decline" style="flex:1;padding:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(255,255,255,0.7);cursor:pointer;">Negar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('[data-act="accept"]').addEventListener('click', async () => {
            overlay.remove();
            await this.respondFriendRequest(req.id, true);
        });
        overlay.querySelector('[data-act="decline"]').addEventListener('click', async () => {
            overlay.remove();
            await this.respondFriendRequest(req.id, false);
        });
    }

    async respondFriendRequest(requestId, accept) {
        const { data, error } = await window.db.rpc('respond_friend_request', { p_request_id: requestId, p_accept: accept });
        if (error || (data && data.error)) { this.toast('Erro ao responder convite', 'error'); return; }
        if (accept) {
            this.toast('Amizade aceita!', 'success');
            await this.loadFriends();
        } else {
            this.toast('Convite recusado.', 'info');
        }
    }

    toast(msg, type = 'info') {
        if (this.game && typeof this.game.showToast === 'function') {
            this.game.showToast(msg, type);
            return;
        }
        console.log(msg);
    }
}
