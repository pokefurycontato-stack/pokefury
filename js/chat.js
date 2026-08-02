export class Chat {
    constructor() {
        this.db = window.db;
        this.userId = null;
        this.playerName = 'Treinador';
        this.channel = 'global';
        this.subscription = null;
        this.maxMessages = 100;
        this.isOpen = true;
        this.unreadGlobal = 0;
        this.unreadTrade = 0;
    }

    init(userId, playerName) {
        this.userId = userId;
        this.playerName = playerName;
        this.buildUI();
        this.loadMessages();
        this.subscribeRealtime();
    }

    buildUI() {
        const existing = document.getElementById('chat-container');
        if (existing) return;

        const html = `
        <div id="chat-container">
            <div id="chat-tabs">
                <button class="chat-tab active" data-channel="global">
                    <span class="chat-tab-dot"></span> Global
                    <span class="chat-badge hidden" id="badge-global">0</span>
                </button>
                <button class="chat-tab" data-channel="trade">
                    <span class="chat-tab-dot trade"></span> Trade
                    <span class="chat-badge hidden" id="badge-trade">0</span>
                </button>
            </div>
            <div id="chat-messages"></div>
            <div id="chat-input-area">
                <input id="chat-input" type="text" placeholder="Digite sua mensagem..." maxlength="200" autocomplete="off" />
                <button id="chat-send">▶</button>
            </div>
        </div>`;

        const sidebarChat = document.querySelector('.sidebar-chat');
        if (sidebarChat) {
            sidebarChat.innerHTML = html;
        } else {
            const layer = document.getElementById('ui-layer');
            if (layer) layer.insertAdjacentHTML('beforeend', html);
        }

        this.setupEvents();
    }

    setupEvents() {
        const tabs = document.querySelectorAll('.chat-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.channel = tab.dataset.channel;
                if (this.channel === 'global') this.unreadGlobal = 0;
                if (this.channel === 'trade') this.unreadTrade = 0;
                this.updateBadges();
                this.loadMessages();
            });
        });

        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');

        const doSend = () => {
            const text = input.value.trim();
            if (!text) return;
            this.sendMessage(text);
            input.value = '';
        };

        sendBtn.addEventListener('click', doSend);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSend();
            e.stopPropagation();
        });

        input.addEventListener('keyup', (e) => e.stopPropagation());
    }

    async loadMessages() {
        const box = document.getElementById('chat-messages');
        if (!box) return;

        try {
            const { data, error } = await this.db
                .from('chat_messages')
                .select('*')
                .eq('channel', this.channel)
                .order('created_at', { ascending: false })
                .limit(this.maxMessages);

            if (error) throw error;

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
            .channel('chat-realtime')
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
            const box = document.getElementById('chat-messages');
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
        const box = document.getElementById('chat-messages');
        if (!box) return;

        const div = document.createElement('div');
        div.className = 'chat-msg' + (animate ? ' chat-msg-new' : '');

        const time = new Date(msg.created_at);
        const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
        const isMe = msg.user_id === this.userId;

        div.innerHTML = `<span class="chat-time">${timeStr}</span><span class="chat-name${isMe ? ' chat-name-me' : ''}">${this.escapeHtml(msg.player_name)}</span><span class="chat-sep">-</span><span class="chat-text">${this.escapeHtml(msg.message)}</span>`;
        box.appendChild(div);

        while (box.children.length > this.maxMessages) {
            box.removeChild(box.firstChild);
        }
    }

    updateBadges() {
        const bGlobal = document.getElementById('badge-global');
        const bTrade = document.getElementById('badge-trade');
        if (bGlobal) {
            bGlobal.textContent = this.unreadGlobal;
            bGlobal.classList.toggle('hidden', this.unreadGlobal === 0 || this.channel === 'global');
        }
        if (bTrade) {
            bTrade.textContent = this.unreadTrade;
            bTrade.classList.toggle('hidden', this.unreadTrade === 0 || this.channel === 'trade');
        }
    }

    async sendMessage(text) {
        if (!this.userId || !this.db) return;

        try {
            await this.db.from('chat_messages').insert({
                channel: this.channel,
                user_id: this.userId,
                player_name: this.playerName,
                message: text.substring(0, 200)
            });
        } catch (e) {
            console.warn('[Chat] Send failed:', e);
        }
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
    }
}
