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
        document.getElementById('skin-shop-close')?.addEventListener('click', () => this.closeSkinShop());
        document.getElementById('skin-inventory-close')?.addEventListener('click', () => this.closeSkinInventory());
        document.getElementById('btn-recharge-pix')?.addEventListener('click', () => this.buyWithRecharge('pix'));
        document.getElementById('btn-recharge-credit')?.addEventListener('click', () => this.buyWithRecharge('credit'));

        document.querySelectorAll('.skin-shop-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.skin-shop-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._filterSkinCards(tab.dataset.tab);
            });
        });

        document.querySelectorAll('.skin-inv-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.skin-inv-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._filterSkinInventory(tab.dataset.tab);
            });
        });
    }

    setCurrentChar(charId) {
        this.currentCharId = charId;
    }

    async _getDiamonds() {
        if (!this.currentCharId) { this.diamonds = 0; return 0; }
        try {
            const { data, error } = await window.db.rpc('get_currency_balance', {
                p_character_id: this.currentCharId
            });
            if (!error && data) {
                this.diamonds = data.diamonds || 0;
                return this.diamonds;
            }
        } catch (e) {
            console.warn('[PremiumStore] RPC failed, trying direct query');
        }

        try {
            const { data } = await window.db
                .from('character_currencies')
                .select('diamonds')
                .eq('character_id', this.currentCharId)
                .single();
            this.diamonds = data?.diamonds || 0;
            return this.diamonds;
        } catch (e) {
            this.diamonds = 0;
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

        // Shinyficador: perguntar quantidade
        let quantity = 1;
        if (product.name === 'Shinyficador') {
            const input = prompt('Quantos Shinyficadores deseja comprar?', '1');
            quantity = parseInt(input) || 0;
            if (quantity < 1) {
                this._showToast('Quantidade inválida!', 'error');
                return;
            }
        }
        const totalCost = product.price_diamonds * quantity;

        await this._getDiamonds();
        if (this.diamonds < totalCost) {
            this._showToast('Diamantes insuficientes!', 'error');
            return;
        }

        // Deduct diamonds via secure RPC
        try {
            const { data, error } = await window.db.rpc('spend_currency', {
                p_character_id: this.currentCharId,
                p_currency_type: 'diamonds',
                p_amount: totalCost,
                p_action: 'purchase',
                p_description: `Purchase: ${product.name} x${quantity}`,
                p_created_by: null
            });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);
            this.diamonds = data.balance;
            document.getElementById('buy-diamonds-count').textContent = this.diamonds;
            document.getElementById('diamond-shop-count').textContent = this.diamonds;
            if (window.game && window.game.refreshCurrencies) await window.game.refreshCurrencies();
        } catch (e) {
            console.error('[PremiumStore] diamond deduction failed:', e);
            this._showToast('Erro ao deduzir diamantes!', 'error');
            return;
        }

        // Shinyficador: vai pro inventário
        if (product.name === 'Shinyficador') {
            const ok = await window.GameData.addItem(5000, quantity);
            if (ok) {
                this._showToast(`${quantity}x Shinyficador adicionado ao inventário!`, 'success');
            } else {
                await window.db.rpc('add_currency', {
                    p_character_id: this.currentCharId,
                    p_currency_type: 'diamonds',
                    p_amount: totalCost,
                    p_action: 'refund',
                    p_description: 'Refund: Shinyficador - falha ao adicionar item',
                    p_created_by: null
                });
                this.diamonds += totalCost;
                if (window.game && window.game.refreshCurrencies) await window.game.refreshCurrencies();
                this._showToast('Erro ao adicionar item!', 'error');
            }
            return;
        }

        // Activate boost based on product name
        const boostMap = {
            'VIP 30 Dias':                  { type: 'vip',            duration: 30 * 24 * 60 * 60 * 1000 },
            'Centro Pokémon Portátil':      { type: 'center_anywhere', duration: 7 * 24 * 60 * 60 * 1000 },
            'Boost Shiny 24h':              { type: 'shiny_boost',     duration: 24 * 60 * 60 * 1000 },
            'Boost EXP Pokémon 24h':        { type: 'exp_pokemon',     duration: 24 * 60 * 60 * 1000 },
            'Boost EXP Treinador 24h':      { type: 'exp_trainer',     duration: 24 * 60 * 60 * 1000 },
            'Professor Acompanhante':       { type: 'professor_acompanhante', duration: 30 * 24 * 60 * 60 * 1000 }
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
                        if (window.game.updateAfkProfessorCheck) {
                            window.game.updateAfkProfessorCheck();
                            window.game.updateAfkProfessorCheck('city-');
                        }
                    }
            } else {
                // Refund diamonds on failure
                await window.db.rpc('add_currency', {
                    p_character_id: this.currentCharId,
                    p_currency_type: 'diamonds',
                    p_amount: totalCost,
                    p_action: 'refund',
                    p_description: `Refund: ${product.name} - boost activation failed`,
                    p_created_by: null
                });
                this.diamonds += totalCost;
                if (window.game && window.game.refreshCurrencies) await window.game.refreshCurrencies();
                this._showToast('Erro ao ativar boost!', 'error');
            }
        } else {
            this._showToast(`${product.name} comprado!`, 'success');
        }
    }

    // ========================
    //  SKIN SHOP PAGE
    // ========================
    async openSkinShop() {
        const screen = document.getElementById('skin-shop-screen');
        if (!screen) return;
        screen.classList.remove('hidden');

        await this._getDiamonds();
        document.getElementById('skin-shop-count').textContent = this.diamonds;

        const products = await this._loadSkinProducts();
        const owned = await this._loadOwnedSkins();
        this._renderSkinCards(products, owned);

        document.querySelectorAll('.skin-shop-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.skin-shop-tab[data-tab="all"]')?.classList.add('active');
    }

    closeSkinShop() {
        document.getElementById('skin-shop-screen')?.classList.add('hidden');
    }

    async _loadSkinProducts() {
        try {
            const { data, error } = await window.db
                .from('skin_products')
                .select('*')
                .eq('active', true)
                .order('sort_order', { ascending: true });
            if (error) {
                console.warn('[PremiumStore] skin products fetch error:', error.message);
                return [];
            }
            return data || [];
        } catch (e) {
            console.error('[PremiumStore] skin products fetch failed:', e);
            return [];
        }
    }

    async _loadOwnedSkins() {
        if (!this.currentCharId) return [];
        try {
            const { data, error } = await window.db
                .rpc('get_character_skins', { p_character_id: this.currentCharId });
            if (error) return [];
            return data || [];
        } catch (e) {
            return [];
        }
    }

    _renderSkinCards(products, owned = []) {
        const container = document.getElementById('skin-shop-products');
        const emptyEl = document.getElementById('skin-shop-empty');
        if (!container) return;

        if (!products.length) {
            if (emptyEl) emptyEl.style.display = 'block';
            container.innerHTML = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        container.innerHTML = products.map(p => {
            const hasImage = p.image_url && p.image_url.trim();
            const imgHtml = hasImage
                ? `<img class="skin-card-img" src="${this._escHtml(p.image_url)}" alt="${this._escHtml(p.name)}" onerror="this.style.display='none'">`
                : `<div class="skin-card-img" style="display:flex;align-items:center;justify-content:center;font-size:40px">🎨</div>`;

            const isOwned = owned.some(s => s.skin_id === p.id);
            const isEquipped = owned.some(s => s.skin_id === p.id && s.equipped);
            const badgeClass = p.skin_type === 'pokemon_skin' ? 'pokemon' : 'player';
            const badgeText = p.skin_type === 'pokemon_skin' ? 'Pokémon' : 'Treinador';

            let btnHtml;
            if (isEquipped) {
                btnHtml = `<button class="skin-card-buy equipped" disabled>Equipado</button>`;
            } else if (isOwned) {
                btnHtml = `<button class="skin-card-buy owned" onclick="window.premiumStore.equipSkin('${p.id}')">Equipar</button>`;
            } else {
                btnHtml = `<button class="skin-card-buy" onclick="window.premiumStore.buySkin('${p.id}')">💎 ${p.price_diamonds}</button>`;
            }

            return `
                <div class="skin-card" data-skin-type="${p.skin_type}" data-skin-id="${p.id}">
                    ${imgHtml}
                    <div class="skin-card-body">
                        <div class="skin-card-name">${this._escHtml(p.name)}</div>
                        <div class="skin-card-desc">${this._escHtml(p.description || '')}</div>
                        <div class="skin-card-footer">
                            <span class="skin-card-badge ${badgeClass}">${badgeText}</span>
                            ${btnHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    _filterSkinCards(tab) {
        const cards = document.querySelectorAll('.skin-card');
        cards.forEach(card => {
            if (tab === 'all') {
                card.style.display = '';
            } else {
                card.style.display = card.dataset.skinType === tab ? '' : 'none';
            }
        });
    }

    async buySkin(skinId) {
        if (!this.currentCharId) {
            this._showToast('Nenhum personagem selecionado!', 'error');
            return;
        }

        const products = await this._loadSkinProducts();
        const product = products.find(p => p.id === skinId);
        if (!product) {
            this._showToast('Skin não encontrada!', 'error');
            return;
        }

        await this._getDiamonds();
        if (this.diamonds < product.price_diamonds) {
            this._showToast('Diamantes insuficientes!', 'error');
            return;
        }

        // Deduct diamonds
        try {
            const { data, error } = await window.db.rpc('spend_currency', {
                p_character_id: this.currentCharId,
                p_currency_type: 'diamonds',
                p_amount: product.price_diamonds,
                p_action: 'purchase',
                p_description: `Skin: ${product.name}`,
                p_created_by: null
            });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);
            this.diamonds = data.balance;
            document.getElementById('skin-shop-count').textContent = this.diamonds;
            document.getElementById('diamond-shop-count').textContent = this.diamonds;
            if (window.game && window.game.refreshCurrencies) await window.game.refreshCurrencies();
        } catch (e) {
            console.error('[PremiumStore] skin purchase failed:', e);
            this._showToast('Erro ao comprar skin!', 'error');
            return;
        }

        // Register skin ownership
        try {
            const { error } = await window.db.rpc('buy_skin', {
                p_character_id: this.currentCharId,
                p_skin_id: skinId
            });
            if (error) throw error;
            this._showToast(`${product.name} comprada!`, 'success');
            await this.openSkinShop();
        } catch (e) {
            console.error('[PremiumStore] skin registration failed:', e);
            this._showToast('Erro ao registrar skin!', 'error');
        }
    }

    async equipSkin(skinId) {
        if (!this.currentCharId) return;

        try {
            const { data, error } = await window.db.rpc('equip_skin', {
                p_character_id: this.currentCharId,
                p_skin_id: skinId
            });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);
            this._showToast('Skin equipada!', 'success');

            if (this._inventoryOpen) {
                await this.openSkinInventory();
            } else {
                await this.openSkinShop();
            }

            if (data.skin_type === 'player_skin') {
                const { data: skinData } = await window.db.rpc('get_equipped_skin', {
                    p_character_id: this.currentCharId,
                    p_skin_type: 'player_skin'
                });
                const spriteUrl = skinData && skinData.length > 0 && skinData[0].sprite_url
                    ? skinData[0].sprite_url
                    : null;
                if (spriteUrl && window.cityScreen && typeof window.cityScreen.updateEquippedSkin === 'function') {
                    await window.cityScreen.updateEquippedSkin(spriteUrl);
                }
                if (window.game && window.game.overworld) {
                    await window.game.overworld.loadSprites();
                }
            }
        } catch (e) {
            console.error('[PremiumStore] equip skin failed:', e);
            this._showToast('Erro ao equipar skin!', 'error');
        }
    }

    async unequipSkin(skinId) {
        if (!this.currentCharId) return;

        try {
            const { error } = await window.db
                .from('character_skins')
                .update({ equipped: false })
                .eq('character_id', this.currentCharId)
                .eq('skin_id', skinId);
            if (error) throw error;
            this._showToast('Skin desequipada!', 'success');

            if (this._inventoryOpen) {
                await this.openSkinInventory();
            }

            if (window.cityScreen && typeof window.cityScreen.updateEquippedSkin === 'function') {
                const gender = window.game?.playerGender === 'female' ? 'feminino' : 'masculino';
                await window.cityScreen.updateEquippedSkin(`assets/perso_${gender}.webp`);
            }
            if (window.game && window.game.overworld) {
                await window.game.overworld.loadSprites();
            }
        } catch (e) {
            console.error('[PremiumStore] unequip skin failed:', e);
            this._showToast('Erro ao desequipar skin!', 'error');
        }
    }

    // ========================
    //  SKIN INVENTORY
    // ========================
    async openSkinInventory() {
        const screen = document.getElementById('skin-inventory-screen');
        if (!screen) return;
        screen.classList.remove('hidden');
        this._inventoryOpen = true;

        const owned = await this._loadOwnedSkins();
        this._renderSkinInventory(owned);

        document.querySelectorAll('.skin-inv-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.skin-inv-tab[data-tab="player_skin"]')?.classList.add('active');
    }

    closeSkinInventory() {
        document.getElementById('skin-inventory-screen')?.classList.add('hidden');
        this._inventoryOpen = false;
    }

    _renderSkinInventory(owned) {
        const container = document.getElementById('skin-inventory-list');
        const emptyEl = document.getElementById('skin-inventory-empty');
        if (!container) return;

        if (!owned.length) {
            if (emptyEl) emptyEl.style.display = 'block';
            container.innerHTML = '';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        container.innerHTML = owned.map(s => {
            const hasImage = s.image_url && s.image_url.trim();
            const imgHtml = hasImage
                ? `<img class="skin-inv-card-img" src="${this._escHtml(s.image_url)}" alt="${this._escHtml(s.name)}" onerror="this.style.display='none'">`
                : `<div class="skin-inv-card-img" style="display:flex;align-items:center;justify-content:center;font-size:40px">🎨</div>`;

            const badgeClass = s.skin_type === 'pokemon_skin' ? 'pokemon' : 'player';
            const badgeText = s.skin_type === 'pokemon_skin' ? 'Pokémon' : 'Treinador';

            let actionsHtml;
            if (s.equipped) {
                actionsHtml = `
                    <button class="skin-inv-btn active" disabled>Equipado</button>
                    <button class="skin-inv-btn unequip" onclick="window.premiumStore.unequipSkin('${s.skin_id}')">Desequipar</button>
                `;
            } else {
                actionsHtml = `
                    <button class="skin-inv-btn equip" onclick="window.premiumStore.equipSkin('${s.skin_id}')">Equipar</button>
                `;
            }

            return `
                <div class="skin-inv-card" data-skin-type="${s.skin_type}">
                    ${imgHtml}
                    <div class="skin-inv-card-body">
                        <div class="skin-inv-card-name">${this._escHtml(s.name)}</div>
                        <span class="skin-card-badge ${badgeClass}">${badgeText}</span>
                        <div class="skin-inv-card-actions" style="margin-top:8px">
                            ${actionsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    _filterSkinInventory(tab) {
        const cards = document.querySelectorAll('.skin-inv-card');
        cards.forEach(card => {
            card.style.display = card.dataset.skinType === tab ? '' : 'none';
        });
    }
}

window.premiumStore = new PremiumStore();
