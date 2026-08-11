/* =============================================================
   premium-admin.js — Admin panel for Premium Store products
   ============================================================= */

class PremiumAdmin {
    constructor() {
        this.currentTab = 'buy_diamonds';
        this.allProducts = [];
        this.allSkins = [];
        this._selectedFile = null;
        this._selectedSpriteFile = null;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._bindEvents());
        } else {
            this._bindEvents();
        }
    }

    _bindEvents() {
        document.getElementById('premium-admin-close')?.addEventListener('click', () => this.close());
        document.getElementById('premium-admin-new')?.addEventListener('click', () => this.showCreateForm());
        document.getElementById('premium-form-close')?.addEventListener('click', () => this.hideForm());
        document.getElementById('premium-form')?.addEventListener('submit', (e) => this.handleSubmit(e));

        document.querySelectorAll('.premium-admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.premium-admin-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                this.renderProductsList();
            });
        });

        const imageLabel = document.getElementById('pf-image-label');
        const imageInput = document.getElementById('pf-image');
        if (imageLabel && imageInput) {
            imageLabel.addEventListener('click', (e) => {
                e.preventDefault();
                imageInput.click();
            });
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this._selectedFile = file;
                    const preview = document.getElementById('pf-image-preview');
                    if (preview) {
                        preview.src = URL.createObjectURL(file);
                        preview.style.display = 'block';
                    }
                    const label = document.getElementById('pf-image-label');
                    if (label) label.textContent = file.name;
                }
            });
        }

        const spriteLabel = document.querySelector('#pf-sprite')?.parentElement;
        const spriteInput = document.getElementById('pf-sprite');
        if (spriteLabel && spriteInput) {
            spriteLabel.addEventListener('click', (e) => {
                e.preventDefault();
                spriteInput.click();
            });
            spriteInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this._selectedSpriteFile = file;
                    const preview = document.getElementById('pf-sprite-preview');
                    if (preview) {
                        preview.src = URL.createObjectURL(file);
                        preview.style.display = 'block';
                    }
                }
            });
        }

        const destRadios = document.querySelectorAll('input[name="pf-dest"]');
        destRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const skinFields = document.getElementById('pf-skin-fields');
                if (skinFields) {
                    skinFields.style.display = radio.value === 'skin_shop' ? 'block' : 'none';
                }
            });
        });
    }

    async open() {
        const screen = document.getElementById('premium-admin-screen');
        if (!screen) return;
        screen.classList.remove('hidden');
        await this.loadAllProducts();
        await this.loadAllSkins();
        this.renderProductsList();
    }

    close() {
        document.getElementById('premium-admin-screen')?.classList.add('hidden');
    }

    async loadAllProducts() {
        try {
            const { data, error } = await window.db
                .from('premium_products')
                .select('*')
                .order('sort_order', { ascending: true });
            if (error) throw error;
            this.allProducts = data || [];

            const blobProducts = this.allProducts.filter(p => p.image_url && p.image_url.startsWith('blob:'));
            if (blobProducts.length) {
                for (const p of blobProducts) {
                    await window.db.from('premium_products').update({ image_url: '' }).eq('id', p.id);
                    p.image_url = '';
                }
            }
        } catch (e) {
            console.error('[PremiumAdmin] load error:', e);
            this.allProducts = [];
        }
    }

    async loadAllSkins() {
        try {
            const { data, error } = await window.db
                .from('skin_products')
                .select('*')
                .order('sort_order', { ascending: true });
            if (error) throw error;
            this.allSkins = data || [];
        } catch (e) {
            console.error('[PremiumAdmin] load skins error:', e);
            this.allSkins = [];
        }
    }

    renderProductsList() {
        const container = document.getElementById('premium-admin-list');
        if (!container) return;

        if (this.currentTab === 'skin_shop') {
            this._renderSkinList(container);
            return;
        }

        const filtered = this.allProducts.filter(p => p.destination === this.currentTab);

        if (!filtered.length) {
            container.innerHTML = '<div class="premium-empty">Nenhum produto nesta categoria</div>';
            return;
        }

        container.innerHTML = filtered.map(p => {
            const hasImage = p.image_url && p.image_url.trim();
            const imgHtml = hasImage
                ? `<img class="premium-admin-row-img" src="${this._esc(p.image_url)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%230d1117%22 width=%2250%22 height=%2250%22/><text x=%2225%22 y=%2230%22 text-anchor=%22middle%22 fill=%22%2330363d%22 font-size=%2220%22>📦</text></svg>'">`
                : `<div class="premium-admin-row-img" style="display:flex;align-items:center;justify-content:center;font-size:22px;background:#0d1117">📦</div>`;

            const priceText = p.price_diamonds > 0
                ? `💎 ${p.price_diamonds} diamantes`
                : p.price_brl > 0
                    ? `R$ ${Number(p.price_brl).toFixed(2)}`
                    : 'Grátis';

            return `
                <div class="premium-admin-row" data-id="${p.id}" draggable="true">
                    <span class="premium-admin-drag-handle" title="Arrastar para reordenar">⠿</span>
                    ${imgHtml}
                    <div class="premium-admin-row-info">
                        <div class="premium-admin-row-name">${this._esc(p.name)}</div>
                        <div class="premium-admin-row-meta">${priceText}</div>
                    </div>
                    <span class="premium-admin-row-badge ${p.destination}">${p.destination === 'buy_diamonds' ? 'Compre Diamantes' : 'Loja de Diamantes'}</span>
                    <div class="premium-admin-row-actions">
                        <button onclick="window.premiumAdmin.editProduct('${p.id}')">Editar</button>
                        <button class="del" onclick="window.premiumAdmin.deleteProduct('${p.id}')">Excluir</button>
                    </div>
                </div>
            `;
        }).join('');

        this._setupDragAndDrop();
    }

    _renderSkinList(container) {
        if (!this.allSkins.length) {
            container.innerHTML = '<div class="premium-empty">Nenhuma skin nesta categoria</div>';
            return;
        }

        container.innerHTML = this.allSkins.map(p => {
            const hasImage = p.image_url && p.image_url.trim();
            const imgHtml = hasImage
                ? `<img class="premium-admin-row-img" src="${this._esc(p.image_url)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%230d1117%22 width=%2250%22 height=%2250%22/><text x=%2225%22 y=%2230%22 text-anchor=%22middle%22 fill=%22%2330363d%22 font-size=%2220%22>🎨</text></svg>'">`
                : `<div class="premium-admin-row-img" style="display:flex;align-items:center;justify-content:center;font-size:22px;background:#0d1117">🎨</div>`;

            const typeLabel = p.skin_type === 'pokemon_skin' ? 'Pokémon' : 'Treinador';
            const badgeClass = p.skin_type === 'pokemon_skin' ? 'pokemon_skin' : 'player_skin';

            return `
                <div class="premium-admin-row" data-id="${p.id}" draggable="true">
                    <span class="premium-admin-drag-handle" title="Arrastar para reordenar">⠿</span>
                    ${imgHtml}
                    <div class="premium-admin-row-info">
                        <div class="premium-admin-row-name">${this._esc(p.name)}</div>
                        <div class="premium-admin-row-meta">💎 ${p.price_diamonds} diamantes · ${typeLabel}</div>
                    </div>
                    <span class="premium-admin-row-badge ${badgeClass}">${typeLabel}</span>
                    <div class="premium-admin-row-actions">
                        <button onclick="window.premiumAdmin.editSkin('${p.id}')">Editar</button>
                        <button class="del" onclick="window.premiumAdmin.deleteSkin('${p.id}')">Excluir</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    _setupDragAndDrop() {
        const container = document.getElementById('premium-admin-list');
        if (!container) return;

        let dragRow = null;

        container.querySelectorAll('.premium-admin-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragRow = row;
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                container.querySelectorAll('.premium-admin-row').forEach(r => r.classList.remove('drag-over'));
                dragRow = null;
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragRow && dragRow !== row) {
                    row.classList.add('drag-over');
                }
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('drag-over');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('drag-over');
                if (!dragRow || dragRow === row) return;

                const allRows = [...container.querySelectorAll('.premium-admin-row')];
                const fromIdx = allRows.indexOf(dragRow);
                const toIdx = allRows.indexOf(row);

                if (fromIdx < toIdx) {
                    row.after(dragRow);
                } else {
                    row.before(dragRow);
                }

                this._saveNewOrder();
            });
        });
    }

    async _saveNewOrder() {
        const container = document.getElementById('premium-admin-list');
        if (!container) return;

        const rows = container.querySelectorAll('.premium-admin-row');
        const updates = [];

        rows.forEach((row, index) => {
            const id = row.dataset.id;
            const product = this.allProducts.find(p => p.id === id);
            if (product) {
                product.sort_order = index;
                updates.push({ id, sort_order: index });
            }
        });

        try {
            for (const u of updates) {
                const { error } = await window.db
                    .from('premium_products')
                    .update({ sort_order: u.sort_order })
                    .eq('id', u.id);
                if (error) throw error;
            }
        } catch (e) {
            console.error('[PremiumAdmin] reorder failed:', e);
        }
    }

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    _toast(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `premium-toast ${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    hideForm() {
        document.getElementById('premium-form-modal')?.classList.add('hidden');
    }

    // ========================
    //  CREATE / EDIT FORM
    // ========================
    showCreateForm(destination) {
        this._selectedFile = null;
        this._selectedSpriteFile = null;
        const el = (id) => document.getElementById(id);
        if (el('premium-form-title')) el('premium-form-title').textContent = 'Novo Produto';
        if (el('pf-id')) el('pf-id').value = '';
        if (el('pf-name')) el('pf-name').value = '';
        if (el('pf-desc')) el('pf-desc').value = '';
        if (el('pf-price-brl')) el('pf-price-brl').value = '0';
        if (el('pf-price-diamonds')) el('pf-price-diamonds').value = '0';
        if (el('pf-image-preview')) { el('pf-image-preview').style.display = 'none'; el('pf-image-preview').src = ''; }
        if (el('pf-image-label')) el('pf-image-label').textContent = 'Clique para fazer upload';
        if (el('pf-image')) el('pf-image').value = '';
        if (el('pf-skin-type')) el('pf-skin-type').value = 'pokemon_skin';
        if (el('pf-target-id')) el('pf-target-id').value = '';
        if (el('pf-sprite')) el('pf-sprite').value = '';
        if (el('pf-sprite-preview')) { el('pf-sprite-preview').style.display = 'none'; el('pf-sprite-preview').src = ''; }

        if (destination) {
            const radio = document.querySelector(`input[name="pf-dest"][value="${destination}"]`);
            if (radio) radio.checked = true;
        } else {
            const radio = document.querySelector(`input[name="pf-dest"][value="${this.currentTab}"]`);
            if (radio) radio.checked = true;
        }

        const skinFields = document.getElementById('pf-skin-fields');
        const activeDest = document.querySelector('input[name="pf-dest"]:checked')?.value;
        if (skinFields) skinFields.style.display = activeDest === 'skin_shop' ? 'block' : 'none';

        document.getElementById('premium-form-modal').classList.remove('hidden');
    }

    editProduct(id) {
        this._selectedFile = null;
        this._selectedSpriteFile = null;
        const product = this.allProducts.find(p => p.id === id);
        if (!product) return;

        const el = (id) => document.getElementById(id);
        if (el('premium-form-title')) el('premium-form-title').textContent = 'Editar Produto';
        if (el('pf-id')) el('pf-id').value = product.id;
        if (el('pf-name')) el('pf-name').value = product.name;
        if (el('pf-desc')) el('pf-desc').value = product.description || '';
        if (el('pf-price-brl')) el('pf-price-brl').value = product.price_brl || 0;
        if (el('pf-price-diamonds')) el('pf-price-diamonds').value = product.price_diamonds || 0;

        const radio = document.querySelector(`input[name="pf-dest"][value="${product.destination}"]`);
        if (radio) radio.checked = true;

        if (product.image_url) {
            if (el('pf-image-preview')) { el('pf-image-preview').src = product.image_url; el('pf-image-preview').style.display = 'block'; }
            if (el('pf-image-label')) el('pf-image-label').textContent = 'Imagem atual';
        } else {
            if (el('pf-image-preview')) el('pf-image-preview').style.display = 'none';
            if (el('pf-image-label')) el('pf-image-label').textContent = 'Clique para fazer upload';
        }
        if (el('pf-image')) el('pf-image').value = '';

        const skinFields = document.getElementById('pf-skin-fields');
        if (skinFields) skinFields.style.display = 'none';

        document.getElementById('premium-form-modal').classList.remove('hidden');
    }

    editSkin(id) {
        this._selectedFile = null;
        this._selectedSpriteFile = null;
        const skin = this.allSkins.find(p => p.id === id);
        if (!skin) return;

        const el = (id) => document.getElementById(id);
        if (el('premium-form-title')) el('premium-form-title').textContent = 'Editar Skin';
        if (el('pf-id')) el('pf-id').value = 'skin:' + skin.id;
        if (el('pf-name')) el('pf-name').value = skin.name;
        if (el('pf-desc')) el('pf-desc').value = skin.description || '';
        if (el('pf-price-brl')) el('pf-price-brl').value = 0;
        if (el('pf-price-diamonds')) el('pf-price-diamonds').value = skin.price_diamonds || 0;

        const radio = document.querySelector('input[name="pf-dest"][value="skin_shop"]');
        if (radio) radio.checked = true;

        if (skin.image_url) {
            if (el('pf-image-preview')) { el('pf-image-preview').src = skin.image_url; el('pf-image-preview').style.display = 'block'; }
            if (el('pf-image-label')) el('pf-image-label').textContent = 'Imagem atual';
        } else {
            if (el('pf-image-preview')) el('pf-image-preview').style.display = 'none';
            if (el('pf-image-label')) el('pf-image-label').textContent = 'Clique para fazer upload';
        }
        if (el('pf-image')) el('pf-image').value = '';

        if (el('pf-skin-type')) el('pf-skin-type').value = skin.skin_type || 'pokemon_skin';
        if (el('pf-target-id')) el('pf-target-id').value = skin.target_id || '';

        if (skin.sprite_url) {
            if (el('pf-sprite-preview')) { el('pf-sprite-preview').src = skin.sprite_url; el('pf-sprite-preview').style.display = 'block'; }
        } else {
            if (el('pf-sprite-preview')) el('pf-sprite-preview').style.display = 'none';
        }
        if (el('pf-sprite')) el('pf-sprite').value = '';

        const skinFields = document.getElementById('pf-skin-fields');
        if (skinFields) skinFields.style.display = 'block';

        document.getElementById('premium-form-modal').classList.remove('hidden');
    }

    async handleSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('pf-id').value;
        const name = document.getElementById('pf-name').value.trim();
        const description = document.getElementById('pf-desc').value.trim();
        const priceBrl = parseFloat(document.getElementById('pf-price-brl').value) || 0;
        const priceDiamonds = parseInt(document.getElementById('pf-price-diamonds').value) || 0;
        const destination = document.querySelector('input[name="pf-dest"]:checked')?.value || 'buy_diamonds';
        const file = this._selectedFile;

        if (!name) {
            this._toast('Nome é obrigatório!', 'error');
            return;
        }

        if (destination === 'skin_shop') {
            await this._handleSkinSubmit(id, name, description, priceDiamonds, file);
            return;
        }

        let imageUrl = '';

        if (id && !file) {
            const existing = this.allProducts.find(p => p.id === id);
            imageUrl = existing?.image_url || '';
        }

        if (file) {
            try {
                const ext = file.name.split('.').pop() || 'png';
                const filename = `store-products/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                const { data: uploadData, error: uploadError } = await window.db.storage
                    .from('sprites')
                    .upload(filename, file, { contentType: file.type, upsert: true });
                if (uploadError) throw uploadError;
                const { data: urlData } = window.db.storage.from('sprites').getPublicUrl(filename);
                imageUrl = urlData.publicUrl;
            } catch (e) {
                console.error('[PremiumAdmin] image upload failed:', e);
                this._toast('Erro no upload da imagem: ' + e.message, 'error');
                return;
            }
        }

        const productData = {
            name,
            description,
            price_brl: priceBrl,
            price_diamonds: priceDiamonds,
            destination,
            image_url: imageUrl,
            active: true
        };

        try {
            if (id) {
                const { data, error } = await window.db
                    .from('premium_products')
                    .update(productData)
                    .eq('id', id)
                    .select();
                if (error) throw error;
                this._toast('Produto atualizado!');
            } else {
                const { data, error } = await window.db
                    .from('premium_products')
                    .insert([productData])
                    .select();
                if (error) throw error;
                this._toast('Produto criado!');
            }

            this.hideForm();
            this._selectedFile = null;
            await this.loadAllProducts();
            this.renderProductsList();
        } catch (e) {
            console.error('[PremiumAdmin] save failed:', e);
            this._toast('Erro ao salvar produto!', 'error');
        }
    }

    async _handleSkinSubmit(id, name, description, priceDiamonds, file) {
        const skinType = document.getElementById('pf-skin-type')?.value || 'pokemon_skin';
        const targetId = document.getElementById('pf-target-id')?.value || '';
        const spriteFile = this._selectedSpriteFile;

        let imageUrl = '';
        let spriteUrl = '';

        const cleanId = id?.startsWith('skin:') ? id.slice(5) : id;

        if (cleanId && !file) {
            const existing = this.allSkins.find(p => p.id === cleanId);
            imageUrl = existing?.image_url || '';
        }
        if (cleanId && !spriteFile) {
            const existing = this.allSkins.find(p => p.id === cleanId);
            spriteUrl = existing?.sprite_url || '';
        }

        if (file) {
            try {
                const ext = file.name.split('.').pop() || 'png';
                const filename = `store-products/skin-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                const { error: uploadError } = await window.db.storage
                    .from('sprites')
                    .upload(filename, file, { contentType: file.type, upsert: true });
                if (uploadError) throw uploadError;
                const { data: urlData } = window.db.storage.from('sprites').getPublicUrl(filename);
                imageUrl = urlData.publicUrl;
            } catch (e) {
                this._toast('Erro no upload da imagem: ' + e.message, 'error');
                return;
            }
        }

        if (spriteFile) {
            try {
                const ext = spriteFile.name.split('.').pop() || 'png';
                const filename = `store-products/sprite-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                const { error: uploadError } = await window.db.storage
                    .from('sprites')
                    .upload(filename, spriteFile, { contentType: spriteFile.type, upsert: true });
                if (uploadError) throw uploadError;
                const { data: urlData } = window.db.storage.from('sprites').getPublicUrl(filename);
                spriteUrl = urlData.publicUrl;
            } catch (e) {
                this._toast('Erro no upload do sprite: ' + e.message, 'error');
                return;
            }
        }

        const skinData = {
            name,
            description,
            skin_type: skinType,
            target_id: targetId,
            price_diamonds: priceDiamonds,
            image_url: imageUrl,
            sprite_url: spriteUrl,
            active: true
        };

        try {
            if (cleanId) {
                const { error } = await window.db
                    .from('skin_products')
                    .update(skinData)
                    .eq('id', cleanId);
                if (error) throw error;
                this._toast('Skin atualizada!');
            } else {
                const { error } = await window.db
                    .from('skin_products')
                    .insert([skinData]);
                if (error) throw error;
                this._toast('Skin criada!');
            }

            this.hideForm();
            this._selectedFile = null;
            this._selectedSpriteFile = null;
            await this.loadAllSkins();
            this.renderProductsList();
        } catch (e) {
            console.error('[PremiumAdmin] skin save failed:', e);
            this._toast('Erro ao salvar skin!', 'error');
        }
    }

    async deleteProduct(id) {
        const product = this.allProducts.find(p => p.id === id);
        if (!product) return;
        if (!confirm(`Excluir "${product.name}"?`)) return;

        try {
            const { error } = await window.db
                .from('premium_products')
                .delete()
                .eq('id', id);
            if (error) throw error;
            this._toast('Produto excluído!');
            await this.loadAllProducts();
            this.renderProductsList();
        } catch (e) {
            console.error('[PremiumAdmin] delete failed:', e);
            this._toast('Erro ao excluir produto!', 'error');
        }
    }

    async deleteSkin(id) {
        const skin = this.allSkins.find(p => p.id === id);
        if (!skin) return;
        if (!confirm(`Excluir "${skin.name}"?`)) return;

        try {
            const { error } = await window.db
                .from('skin_products')
                .delete()
                .eq('id', id);
            if (error) throw error;
            this._toast('Skin excluída!');
            await this.loadAllSkins();
            this.renderProductsList();
        } catch (e) {
            console.error('[PremiumAdmin] skin delete failed:', e);
            this._toast('Erro ao excluir skin!', 'error');
        }
    }
}

window.premiumAdmin = new PremiumAdmin();
