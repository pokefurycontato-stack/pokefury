/* =============================================================
   premium-store.js — Premium Store (Compre Diamantes + Loja)
   ============================================================= */

class PremiumStore {
    constructor() {
        this.products = [];
        this.diamonds = 0;
        this.currentCharId = null;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._bindEvents());
        } else {
            this._bindEvents();
        }
    }

    _bindEvents() {
        document.getElementById('buy-diamonds-close')?.addEventListener('click', () => this.closeBuyDiamonds());
        document.getElementById('diamond-shop-close')?.addEventListener('click', () => this.closeDiamondShop());
        document.getElementById('btn-recharge-pix')?.addEventListener('click', () => this.buyWithRecharge('pix'));
        document.getElementById('btn-recharge-credit')?.addEventListener('click', () => this.buyWithRecharge('credit'));
    }

    setCurrentChar(charId) {
        this.currentCharId = charId;
    }

    async _getDiamonds() {
        if (!this.currentCharId) return 0;
        try {
            const { data, error } = await window.db
                .from('character_currencies')
                .select('diamonds')
                .eq('character_id', this.currentCharId)
                .single();
            if (error) {
                console.warn('[PremiumStore] diamonds fetch error:', error.message);
                return 0;
            }
            this.diamonds = data?.diamonds || 0;
            return this.diamonds;
        } catch (e) {
            console.error('[PremiumStore] diamonds fetch failed:', e);
            return 0;
        }
    }

    async _loadProducts(destination) {
        try {
            const { data, error } = await window.db
                .from('premium_products')
                .select('*')
                .eq('destination', destination)
                .eq('active', true)
                .order('sort_order', { ascending: true });
            if (error) {
                console.warn('[PremiumStore] products fetch error:', error.message);
                return [];
            }
            return data || [];
        } catch (e) {
            console.error('[PremiumStore] products fetch failed:', e);
            return [];
        }
    }

    _renderProductCards(products, containerId, type = 'diamonds') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!products.length) {
            container.innerHTML = '<div class="premium-empty">Nenhum produto disponível ainda</div>';
            return;
        }

        container.innerHTML = products.map(p => {
            const hasImage = p.image_url && p.image_url.trim();
            const imgHtml = hasImage
                ? `<img class="premium-card-img" src="${this._escHtml(p.image_url)}" alt="${this._escHtml(p.name)}" onerror="this.style.display='none'">`
                : `<div class="premium-card-img" style="display:flex;align-items:center;justify-content:center;font-size:40px">${type === 'diamonds' ? '💎' : '📦'}</div>`;

            const priceHtml = p.price_diamonds > 0
                ? `<div class="premium-card-price">💎 ${p.price_diamonds}</div>`
                : p.price_brl > 0
                    ? `<div class="premium-card-price real">R$ ${Number(p.price_brl).toFixed(2)}</div>`
                    : `<div class="premium-card-price" style="color:rgba(255,255,255,0.3)">Grátis</div>`;

            return `
                <div class="premium-card" data-product-id="${p.id}">
                    ${imgHtml}
                    <div class="premium-card-body">
                        <div class="premium-card-name">${this._escHtml(p.name)}</div>
                        <div class="premium-card-desc">${this._escHtml(p.description || '')}</div>
                        ${priceHtml}
                        <button class="premium-card-buy" onclick="window.premiumStore.buyProduct('${p.id}')">Comprar</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    _escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    _showToast(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `premium-toast ${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ========================
    //  BUY DIAMONDS PAGE
    // ========================
    async openBuyDiamonds() {
        const screen = document.getElementById('buy-diamonds-screen');
        if (!screen) return;
        screen.classList.remove('hidden');

        await this._getDiamonds();
        document.getElementById('buy-diamonds-count').textContent = this.diamonds;

        const products = await this._loadProducts('buy_diamonds');
        this._renderProductCards(products, 'buy-diamonds-products', 'real');
    }

    closeBuyDiamonds() {
        document.getElementById('buy-diamonds-screen')?.classList.add('hidden');
    }

    // ========================
    //  DIAMOND SHOP PAGE
    // ========================
    async openDiamondShop() {
        const screen = document.getElementById('diamond-shop-screen');
        if (!screen) return;
        screen.classList.remove('hidden');

        await this._getDiamonds();
        document.getElementById('diamond-shop-count').textContent = this.diamonds;

        const products = await this._loadProducts('diamond_shop');
        const emptyEl = document.getElementById('diamond-shop-empty');
        const container = document.getElementById('diamond-shop-products');

        if (!products.length) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (container) container.innerHTML = '';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            this._renderProductCards(products, 'diamond-shop-products', 'diamonds');
        }
    }

    closeDiamondShop() {
        document.getElementById('diamond-shop-screen')?.classList.add('hidden');
    }

    // ========================
    //  PURCHASE FLOW
    // ========================
    buyWithRecharge(method) {
        const labels = { pix: 'PIX', credit: 'Crédito' };
        this._showToast(`Pagamento via ${labels[method]} será implementado em breve!`, 'error');
    }

    async buyProduct(productId) {
        if (!this.currentCharId) {
            this._showToast('Nenhum personagem selecionado!', 'error');
            return;
        }

        const allProducts = [...await this._loadProducts('buy_diamonds'), ...await this._loadProducts('diamond_shop')];
        const product = allProducts.find(p => p.id === productId);
        if (!product) {
            this._showToast('Produto não encontrado!', 'error');
            return;
        }

        if (product.price_diamonds <= 0) {
            this._showToast('Produto indisponível para compra!', 'error');
            return;
        }

        await this._getDiamonds();
        if (this.diamonds < product.price_diamonds) {
            this._showToast('Diamantes insuficientes!', 'error');
            return;
        }

        // Deduct diamonds
        try {
            const { error } = await window.db
                .from('character_currencies')
                .update({ diamonds: this.diamonds - product.price_diamonds })
                .eq('character_id', this.currentCharId);
            if (error) throw error;
            this.diamonds -= product.price_diamonds;
            document.getElementById('buy-diamonds-count').textContent = this.diamonds;
            document.getElementById('diamond-shop-count').textContent = this.diamonds;
            if (window.game && window.game.refreshCurrencies) await window.game.refreshCurrencies();
        } catch (e) {
            console.error('[PremiumStore] diamond deduction failed:', e);
            this._showToast('Erro ao deduzir diamantes!', 'error');
            return;
        }

        // Activate boost based on product name
        const boostMap = {
            'VIP 30 Dias':                  { type: 'vip',            duration: 30 * 24 * 60 * 60 * 1000 },
            'Centro Pokémon Portátil':      { type: 'center_anywhere', duration: 7 * 24 * 60 * 60 * 1000 },
            'Boost Shiny 24h':              { type: 'shiny_boost',     duration: 24 * 60 * 60 * 1000 },
            'Boost EXP Pokémon 24h':        { type: 'exp_pokemon',     duration: 24 * 60 * 60 * 1000 },
            'Boost EXP Treinador 24h':      { type: 'exp_trainer',     duration: 24 * 60 * 60 * 1000 }
        };

        const boost = boostMap[product.name];
            if (boost) {
                const ok = await window.boostsManager.purchase(this.currentCharId, boost.type, boost.duration);
                if (ok) {
                    this._showToast(`${product.name} ativado com sucesso!`, 'success');
                    // Refresh game UI
                    if (window.game) {
                        if (window.game.updateVipBadge) window.game.updateVipBadge();
                        if (window.game.updateBoostsDisplay) window.game.updateBoostsDisplay();
                        if (window.game.setupHealAnywhere) window.game.setupHealAnywhere();
                    }
            } else {
                // Refund diamonds on failure
                await window.db
                    .from('character_currencies')
                    .update({ diamonds: this.diamonds + product.price_diamonds })
                    .eq('character_id', this.currentCharId);
                this.diamonds += product.price_diamonds;
                if (window.game && window.game.refreshCurrencies) await window.game.refreshCurrencies();
                this._showToast('Erro ao ativar boost!', 'error');
            }
        } else {
            this._showToast(`${product.name} comprado!`, 'success');
        }
    }
}

window.premiumStore = new PremiumStore();
