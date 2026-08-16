/* =============================================================
   chat.js — Chat Global/Trade/Privado + mensagens privadas
   ============================================================= */

function chatEsc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

export class Chat {
    constructor(options = {}) {
        this.db = window.db;
        this.userId = null;
        this.playerName = 'Treinador';
        this.channel = 'global';
        this.subscription = null;
        this.maxMessages = 100;
        this.isOpen = true;
        this.unreadGlobal = 0;
        this.unreadTrade = 0;
        this.unreadGroup = 0;
        this.prefix = options.prefix || '';
        this.container = options.container || null;
        this.privateChats = {};
        this.activePrivateId = null;
        this._privateSub = null;
        this._injectedStyle = false;
    }

    _charId() {
        return window.GameData?.currentCharacterId || null;
    }

    init(userId, playerName) {
        this.userId = userId;
        this.playerName = playerName;
        this.buildUI();
        this.injectStyle();
        this.loadMessages();
        this.subscribeRealtime();
        this.subscribePrivateRealtime();
        this.restorePrivateChats();
        this.setupGroupListener();
        if (window.GroupSystem) {
            window.GroupSystem.onGroupChange(() => {
                if (this.channel === 'group') this.loadMessages();
                this.updateBadges();
            });
        }
    }

    setupGroupListener() {
        if (!window.GroupSystem) return;
        window.GroupSystem.onGroupMessage((msg) => {
            if (!window.GroupSystem.inGroup) return;
            if (this.channel === 'group') {
                const box = document.getElementById(this.prefix + 'chat-messages');
                if (box) {
                    this.appendMessage(msg, true);
                    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
                    if (near) box.scrollTop = box.scrollHeight;
                }
            } else {
                this.unreadGroup++;
                this.updateBadges();
            }
        });
    }

    injectStyle() {
        if (this._injectedStyle) return;
        this._injectedStyle = true;
        if (document.getElementById('chat-private-style')) return;
        const style = document.createElement('style');
        style.id = 'chat-private-style';
        style.textContent = `
            @keyframes chatTabBlink {
                0%, 100% { background: rgba(56,189,248,0.15); }
                50% { background: rgba(56,189,248,0.5); }
            }
            .chat-tab-blink { animation: chatTabBlink 1s ease-in-out infinite; }
            .chat-name-click { cursor: pointer; text-decoration: underline dotted rgba(255,255,255,0.5); }
            .chat-name-click:hover { color: #38bdf8; }
        `;
        document.head.appendChild(style);
    }

    buildUI() {
        const existing = document.getElementById(this.prefix + 'chat-container');
        if (existing) return;

        const html = `
        <div id="${this.prefix}chat-container" style="display:flex;flex-direction:column;height:100%;">
            <div id="${this.prefix}chat-tabs" style="display:flex;gap:4px;padding:4px;">
                <button class="chat-tab active" data-channel="global" style="flex:1;padding:5px;background:rgba(255,255,255,0.08);border:none;border-radius:4px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">
                    <span class="chat-tab-dot"></span> Global
                    <span class="chat-badge hidden" id="${this.prefix}badge-global">0</span>
                </button>
                <button class="chat-tab" data-channel="trade" style="flex:1;padding:5px;background:rgba(255,255,255,0.08);border:none;border-radius:4px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">
                    <span class="chat-tab-dot trade"></span> Trade
                    <span class="chat-badge hidden" id="${this.prefix}badge-trade">0</span>
                </button>
                <button class="chat-tab" data-channel="group" id="${this.prefix}chat-tab-group" style="flex:1;padding:5px;background:rgba(255,255,255,0.08);border:none;border-radius:4px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">
                    <span class="chat-tab-dot group" style="background:#a78bfa;"></span> Grupo
                    <span class="chat-badge hidden" id="${this.prefix}badge-group">0</span>
                </button>
                <button class="chat-tab" data-channel="private" id="${this.prefix}chat-tab-private" style="flex:1;padding:5px;background:rgba(255,255,255,0.08);border:none;border-radius:4px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">
                    <span class="chat-tab-dot private" style="background:#38bdf8;"></span> Privado
                    <span class="chat-badge hidden" id="${this.prefix}badge-private">0</span>
                </button>
            </div>
            <div id="${this.prefix}chat-messages" style="flex:1;overflow-y:auto;"></div>
            <div id="${this.prefix}private-panel" style="display:none;flex:1;min-height:0;border-top:1px solid rgba(255,255,255,0.08);">
                <div id="${this.prefix}private-list" style="width:40%;border-right:1px solid rgba(255,255,255,0.08);overflow-y:auto;padding:6px;"></div>
                <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
                    <div id="${this.prefix}private-messages" style="flex:1;overflow-y:auto;padding:8px;"></div>
                    <div style="display:flex;padding:6px;border-top:1px solid rgba(255,255,255,0.08);">
                        <input id="${this.prefix}private-input" type="text" placeholder="Mensagem privada..." maxlength="300" autocomplete="off" style="flex:1;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;font-size:12px;font-family:Inter,sans-serif;outline:none;">
                        <button id="${this.prefix}private-send" style="margin-left:6px;padding:6px 10px;background:linear-gradient(135deg,#38bdf8,#2563eb);border:none;border-radius:4px;color:#fff;font-weight:700;cursor:pointer;">▶</button>
                    </div>
                </div>
            </div>
            <div id="${this.prefix}chat-input-area" style="display:flex;padding:6px;border-top:1px solid rgba(255,255,255,0.08);">
                <input id="${this.prefix}chat-input" type="text" placeholder="Digite sua mensagem..." maxlength="200" autocomplete="off" style="flex:1;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;font-size:12px;font-family:Inter,sans-serif;outline:none;" />
                <button id="${this.prefix}chat-send" style="margin-left:6px;padding:6px 10px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:#fff;cursor:pointer;">▶</button>
            </div>
        </div>`;

        if (this.container) {
            this.container.innerHTML = html;
        } else {
            const sidebarChat = document.querySelector('.sidebar-chat');
            if (sidebarChat) {
                sidebarChat.innerHTML = html;
            } else {
                const layer = document.getElementById('ui-layer');
                if (layer) layer.insertAdjacentHTML('beforeend', html);
            }
        }

        this.root = document.getElementById(this.prefix + 'chat-container');
        this.setupEvents();
    }

    setupEvents() {
        const root = this.root || document;
        const tabs = root.querySelectorAll('.chat-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.channel = tab.dataset.channel;
                if (this.channel === 'global') this.unreadGlobal = 0;
                if (this.channel === 'trade') this.unreadTrade = 0;
                if (this.channel === 'group') this.unreadGroup = 0;
                if (this.channel === 'private') {
                    for (const id in this.privateChats) this.privateChats[id].unread = 0;
                    if (!this.activePrivateId) {
                        const first = Object.keys(this.privateChats)[0];
                        if (first) { this.activePrivateId = first; this.loadPrivateMessages(first); }
                    }
                    this.renderPrivateList();
                }
                this.togglePrivateView(this.channel === 'private');
                this.updateBadges();
                this.loadMessages();
            });
        });

        const input = document.getElementById(this.prefix + 'chat-input');
        const sendBtn = document.getElementById(this.prefix + 'chat-send');

        const doSend = () => {
            const text = input.value.trim();
            if (!text) return;
            this.sendMessage(text);
            input.value = '';
        };

        if (sendBtn) sendBtn.addEventListener('click', doSend);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doSend();
                e.stopPropagation();
            });
            input.addEventListener('keyup', (e) => e.stopPropagation());
        }

        const privInput = document.getElementById(this.prefix + 'private-input');
        const privSend = document.getElementById(this.prefix + 'private-send');
        const doPrivSend = () => {
            const text = privInput.value.trim();
            if (!text || !this.activePrivateId) return;
            this.sendPrivateMessage(text);
            privInput.value = '';
        };
        if (privSend) privSend.addEventListener('click', doPrivSend);
        if (privInput) {
            privInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doPrivSend();
                e.stopPropagation();
            });
        }
    }

    togglePrivateView(show) {
        const msgBox = document.getElementById(this.prefix + 'chat-messages');
        const inputArea = document.getElementById(this.prefix + 'chat-input-area');
        const privatePanel = document.getElementById(this.prefix + 'private-panel');
        if (msgBox) msgBox.style.display = show ? 'none' : '';
        if (inputArea) inputArea.style.display = show ? 'none' : '';
        if (privatePanel) privatePanel.style.display = show ? 'flex' : 'none';
    }

    async loadMessages() {
        const box = document.getElementById(this.prefix + 'chat-messages');
        if (!box) return;

        try {
            let data = null;
            if (this.channel === 'group') {
                if (!window.GroupSystem || !window.GroupSystem.inGroup) {
                    box.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:11px;padding:8px;text-align:center;">Você não está em uma equipe.</div>';
                    return;
                }
                const res = await this.db
                    .from('group_messages')
                    .select('*')
                    .eq('group_id', window.GroupSystem.groupId)
                    .order('created_at', { ascending: false })
                    .limit(this.maxMessages);
                if (res.error) throw res.error;
                data = res.data;
            } else {
                const res = await this.db
                    .from('chat_messages')
                    .select('*')
                    .eq('channel', this.channel)
                    .order('created_at', { ascending: false })
                    .limit(this.maxMessages);
                if (res.error) throw res.error;
                data = res.data;
            }

            box.innerHTML = '';
            const reversed = (data || []).reverse();
            reversed.forEach(msg => this.appendMessage(msg, false));
            box.scrollTop = box.scrollHeight;
        } catch (e) {
            console.warn('[Chat] Failed to load messages:', e);
        }
    }

    subscribeRealtime() {
        if (this.subscription) return;

        this.subscription = this.db
            .channel((this.prefix || '') + 'chat-realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages'
            }, (payload) => {
                this.onNewMessage(payload.new);
            })
            .subscribe();
    }

    onNewMessage(msg) {
        if (msg.channel === this.channel) {
            const box = document.getElementById(this.prefix + 'chat-messages');
            if (box) {
                this.appendMessage(msg, true);
                const isNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
                if (isNearBottom) {
                    box.scrollTop = box.scrollHeight;
                }
            }
        } else {
            if (msg.channel === 'global') this.unreadGlobal++;
            if (msg.channel === 'trade') this.unreadTrade++;
            this.updateBadges();
        }
    }

    appendMessage(msg, animate) {
        const box = document.getElementById(this.prefix + 'chat-messages');
        if (!box) return;

        const div = document.createElement('div');
        div.className = 'chat-msg' + (animate ? ' chat-msg-new' : '');

        const time = new Date(msg.created_at);
        const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
        const isMe = this.channel === 'group'
            ? msg.character_id === this._charId()
            : msg.user_id === this.userId;
        const nameHtml = (msg.character_id && !isMe)
            ? `<span class="chat-name chat-name-click" data-char-id="${msg.character_id}" data-char-name="${chatEsc(msg.player_name)}">${chatEsc(msg.player_name)}</span>`
            : `<span class="chat-name${isMe ? ' chat-name-me' : ''}">${chatEsc(msg.player_name)}</span>`;

        div.innerHTML = `<span class="chat-time">${timeStr}</span>${nameHtml}<span class="chat-sep">-</span><span class="chat-text">${chatEsc(msg.message)}</span>`;
        box.appendChild(div);

        if (msg.character_id && !isMe) {
            const nameEl = div.querySelector('.chat-name-click');
            nameEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showNameMenu(msg.character_id, msg.player_name, e);
            });
        }

        while (box.children.length > this.maxMessages) {
            box.removeChild(box.firstChild);
        }
    }

    showNameMenu(characterId, name, e) {
        document.querySelectorAll('.chat-name-menu').forEach(m => m.remove());
        const gs = window.GroupSystem;
        const myId = this._charId();
        const isGroupMember = gs && gs.isMember(characterId);
        const amLeader = gs && gs.isLeader();

        let buttonsHtml = '<button data-action="pm" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer;text-align:left;">Enviar mensagem privada</button>';
        if (amLeader && isGroupMember && characterId !== myId) {
            buttonsHtml += '<button data-action="group-kick" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#f87171;font-size:12px;font-weight:600;cursor:pointer;text-align:left;border-top:1px solid rgba(255,255,255,0.08);">Expulsar do grupo</button>';
        } else if (!isGroupMember) {
            buttonsHtml += '<button data-action="group-invite" style="display:block;width:100%;padding:9px 14px;background:none;border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer;text-align:left;border-top:1px solid rgba(255,255,255,0.08);">Enviar convite de grupo</button>';
        }

        const menu = document.createElement('div');
        menu.className = 'chat-name-menu';
        menu.style.cssText = 'position:fixed;z-index:10070;background:#1c2333;border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);overflow:hidden;';
        menu.innerHTML = buttonsHtml;
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        document.body.appendChild(menu);
        menu.querySelector('[data-action="pm"]').addEventListener('click', () => {
            menu.remove();
            this.openPrivateChat(characterId, name);
        });
        const inviteBtn = menu.querySelector('[data-action="group-invite"]');
        if (inviteBtn) inviteBtn.addEventListener('click', async () => {
            menu.remove();
            if (window.GroupSystem) {
                const result = await window.GroupSystem.sendInvite(characterId, name);
                if (result && result.error) {
                    window.pokefury?.showToast?.(result.error, 'error');
                } else if (result && result.ok) {
                    window.pokefury?.showToast?.('Convite de grupo enviado!', 'success');
                }
            }
        });
        const kickBtn = menu.querySelector('[data-action="group-kick"]');
        if (kickBtn) kickBtn.addEventListener('click', () => {
            menu.remove();
            if (window.GroupSystem) {
                window.GroupSystem.showKickConfirm(characterId, name);
            }
        });
        const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); } };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    openPrivateChat(characterId, name) {
        if (!characterId || characterId === this._charId()) return;
        if (!this.privateChats[characterId]) {
            this.privateChats[characterId] = { name: name || 'Jogador', unread: 0 };
        }
        this.activePrivateId = characterId;
        this.privateChats[characterId].unread = 0;
        this.switchToPrivateTab();
        this.renderPrivateList();
        this.loadPrivateMessages(characterId);
        this.savePrivateChats();
    }

    switchToPrivateTab() {
        this.channel = 'private';
        const root = this.root || document;
        const tabs = root.querySelectorAll('.chat-tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.channel === 'private'));
        this.togglePrivateView(true);
        this.updateBadges();
    }

    closePrivateChat(characterId) {
        delete this.privateChats[characterId];
        if (this.activePrivateId === characterId) {
            this.activePrivateId = null;
            const box = document.getElementById(this.prefix + 'private-messages');
            if (box) box.innerHTML = '';
        }
        this.renderPrivateList();
        this.savePrivateChats();
    }

    renderPrivateList() {
        const list = document.getElementById(this.prefix + 'private-list');
        if (!list) return;
        list.innerHTML = '';
        const ids = Object.keys(this.privateChats);
        if (ids.length === 0) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:11px;padding:8px;text-align:center;">Nenhuma conversa.</div>';
            return;
        }
        for (const id of ids) {
            const c = this.privateChats[id];
            const active = id === this.activePrivateId;
            const row = document.createElement('div');
            row.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:4px;padding:6px 8px;cursor:pointer;border-radius:6px;background:${active ? 'rgba(56,189,248,0.14)' : 'transparent'};`;
            row.innerHTML = `<span style="color:#fff;font-size:12px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${chatEsc(c.name)}${c.unread > 0 ? ` <span style="color:#e94560;font-size:10px;">(${c.unread})</span>` : ''}</span><button data-close style="color:#f44336;background:none;border:none;cursor:pointer;font-size:14px;font-weight:700;line-height:1;">✕</button>`;
            row.addEventListener('click', (e) => {
                if (e.target.closest('[data-close]')) return;
                this.activePrivateId = id;
                this.privateChats[id].unread = 0;
                this.renderPrivateList();
                this.loadPrivateMessages(id);
                this.updateBadges();
            });
            row.querySelector('[data-close]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePrivateChat(id);
            });
            list.appendChild(row);
        }
    }

    async loadPrivateMessages(characterId) {
        const box = document.getElementById(this.prefix + 'private-messages');
        if (!box) return;
        const myId = this._charId();
        if (!myId) return;
        const { data } = await this.db.from('private_messages')
            .select('*')
            .or(`sender_character_id.eq.${myId},receiver_character_id.eq.${myId}`)
            .order('created_at', { ascending: false })
            .limit(200);
        const filtered = (data || []).filter(m =>
            (m.sender_character_id === myId && m.receiver_character_id === characterId) ||
            (m.sender_character_id === characterId && m.receiver_character_id === myId)
        ).reverse();
        box.innerHTML = '';
        filtered.forEach(m => this.appendPrivateMessage(m));
        box.scrollTop = box.scrollHeight;
    }

    appendPrivateMessage(m) {
        const box = document.getElementById(this.prefix + 'private-messages');
        if (!box) return;
        const isMe = m.sender_character_id === this._charId();
        const time = new Date(m.created_at);
        const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
        const div = document.createElement('div');
        div.style.cssText = `display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};margin-bottom:8px;`;
        div.innerHTML = `<div style="max-width:75%;padding:7px 11px;border-radius:12px;background:${isMe ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.08)'};color:#fff;font-size:12px;word-break:break-word;">${chatEsc(m.content)}</div><div style="font-size:9px;color:rgba(255,255,255,0.35);margin-top:2px;">${timeStr}</div>`;
        box.appendChild(div);
    }

    async sendPrivateMessage(text) {
        const friendId = this.activePrivateId;
        const myId = this._charId();
        if (!friendId || !myId) return;
        try {
            await this.db.from('private_messages').insert({
                sender_character_id: myId,
                receiver_character_id: friendId,
                sender_name: this.playerName,
                content: text.substring(0, 300),
                read: false
            });
        } catch (e) { console.warn('[Chat] private send failed:', e); }
    }

    subscribePrivateRealtime() {
        if (this._privateSub) return;
        this._privateSub = this.db
            .channel((this.prefix || '') + 'private-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, (payload) => {
                const m = payload.new;
                if (!m) return;
                const myId = this._charId();
                if (!myId) return;

                if (m.receiver_character_id === myId) {
                    const senderId = m.sender_character_id;
                    if (!this.privateChats[senderId]) {
                        this.privateChats[senderId] = { name: m.sender_name || 'Jogador', unread: 0 };
                    }
                    this.privateChats[senderId].unread++;
                    if (senderId === this.activePrivateId) {
                        this.appendPrivateMessage(m);
                        const box = document.getElementById(this.prefix + 'private-messages');
                        if (box) box.scrollTop = box.scrollHeight;
                    }
                    this.renderPrivateList();
                    this.updateBadges();
                    this.savePrivateChats();
                } else if (m.sender_character_id === myId) {
                    if (m.receiver_character_id === this.activePrivateId) {
                        this.appendPrivateMessage(m);
                        const box = document.getElementById(this.prefix + 'private-messages');
                        if (box) box.scrollTop = box.scrollHeight;
                    }
                }
            })
            .subscribe();
    }

    totalUnreadPrivate() {
        let total = 0;
        for (const id in this.privateChats) total += this.privateChats[id].unread || 0;
        return total;
    }

    updateBadges() {
        const bGlobal = document.getElementById(this.prefix + 'badge-global');
        const bTrade = document.getElementById(this.prefix + 'badge-trade');
        const bPrivate = document.getElementById(this.prefix + 'badge-private');
        if (bGlobal) {
            bGlobal.textContent = this.unreadGlobal;
            bGlobal.classList.toggle('hidden', this.unreadGlobal === 0 || this.channel === 'global');
        }
        if (bTrade) {
            bTrade.textContent = this.unreadTrade;
            bTrade.classList.toggle('hidden', this.unreadTrade === 0 || this.channel === 'trade');
        }
        const bGroup = document.getElementById(this.prefix + 'badge-group');
        if (bGroup) {
            bGroup.textContent = this.unreadGroup;
            bGroup.classList.toggle('hidden', this.unreadGroup === 0 || this.channel === 'group');
        }
        const unread = this.totalUnreadPrivate();
        if (bPrivate) {
            bPrivate.textContent = unread;
            bPrivate.classList.toggle('hidden', unread === 0 || this.channel === 'private');
        }
        const privTab = document.getElementById(this.prefix + 'chat-tab-private');
        if (privTab) {
            privTab.classList.toggle('chat-tab-blink', unread > 0 && this.channel !== 'private');
        }
    }

    async sendMessage(text) {
        if (!this.userId || !this.db) return;

        try {
            if (this.channel === 'group') {
                if (!window.GroupSystem || !window.GroupSystem.inGroup) return;
                await this.db.rpc('group_send_message', {
                    p_character_id: this._charId(),
                    p_message: text.substring(0, 200)
                });
                return;
            }
            await this.db.from('chat_messages').insert({
                channel: this.channel,
                user_id: this.userId,
                player_name: this.playerName,
                character_id: this._charId(),
                message: text.substring(0, 200)
            });
        } catch (e) {
            console.warn('[Chat] Send failed:', e);
        }
    }

    restorePrivateChats() {
        const myId = this._charId();
        if (!myId) return;
        try {
            const raw = localStorage.getItem('pokefury_private_chats_' + myId);
            if (raw) {
                const saved = JSON.parse(raw);
                this.privateChats = saved || {};
            }
        } catch (e) { this.privateChats = {}; }
        this.renderPrivateList();
        this.updateBadges();
    }

    savePrivateChats() {
        const myId = this._charId();
        if (!myId) return;
        try {
            localStorage.setItem('pokefury_private_chats_' + myId, JSON.stringify(this.privateChats));
        } catch (e) {}
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    destroy() {
        if (this.subscription) {
            this.db.removeChannel(this.subscription);
            this.subscription = null;
        }
        if (this._privateSub) {
            try { this._privateSub.unsubscribe(); } catch (e) {}
            this._privateSub = null;
        }
    }
}

window.openPrivateChatWith = (characterId, name) => {
    const cityChat = window.cityScreen?._chat;
    if (cityChat && typeof cityChat.openPrivateChat === 'function') {
        cityChat.openPrivateChat(characterId, name);
        return;
    }
    const gameChat = window.pokefury?.chat;
    if (gameChat && typeof gameChat.openPrivateChat === 'function') {
        gameChat.openPrivateChat(characterId, name);
    }
};
