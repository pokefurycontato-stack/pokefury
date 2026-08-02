/* =============================================================
   premium-admin.js — Admin panel for Premium Store products
   ============================================================= */

class PremiumAdmin {
    constructor() {
        this.currentTab = 'buy_diamonds';
        this.allProducts = [];
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

        // Tabs
        document.querySelectorAll('.premium-admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.premium-admin-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                this.renderProductsList();
            });
        });

        // Image preview + click to open file dialog
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
    }

    async open() {
        const screen = document.getElementById('premium-admin-screen');
        if (!screen) return;
        screen.classList.remove('hidden');
        await this.loadAllProducts();
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
        } catch (e) {
            console.error('[PremiumAdmin] load error:', e);
            this.allProducts = [];
        }
    }

    renderProductsList() {
        const container = document.getElementById('premium-admin-list');
        if (!container) return;

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
                <div class="premium-admin-row" data-id="${p.id}">
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

    // ========================
    //  CREATE / EDIT FORM
    // ========================
    showCreateForm(destination) {
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

        if (destination) {
            const radio = document.querySelector(`input[name="pf-dest"][value="${destination}"]`);
            if (radio) radio.checked = true;
        } else {
            const radio = document.querySelector(`input[name="pf-dest"][value="${this.currentTab}"]`);
            if (radio) radio.checked = true;
        }

        document.getElementById('premium-form-modal').classList.remove('hidden');
    }

    hideForm() {
        document.getElementById('premium-form-modal').classList.add('hidden');
    }

    async editProduct(id) {
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
        const fileInput = document.getElementById('pf-image');
        const file = fileInput?.files[0];

        if (!name) {
            this._toast('Nome é obrigatório!', 'error');
            return;
        }

        let imageUrl = document.getElementById('pf-image-preview').src || '';

        // Upload image if new file selected
        if (file) {
            try {
                const ext = file.name.split('.').pop() || 'png';
                const filename = `store-products/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                const { error: uploadError } = await window.db.storage
                    .from('sprites')
                    .upload(filename, file, { contentType: file.type, upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = window.db.storage.from('sprites').getPublicUrl(filename);
                imageUrl = urlData.publicUrl;
            } catch (e) {
                console.error('[PremiumAdmin] image upload failed:', e);
                this._toast('Erro no upload da imagem!', 'error');
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
                // Update existing
                const { error } = await window.db
                    .from('premium_products')
                    .update(productData)
                    .eq('id', id);
                if (error) throw error;
                this._toast('Produto atualizado!');
            } else {
                // Create new
                const { error } = await window.db
                    .from('premium_products')
                    .insert([productData]);
                if (error) throw error;
                this._toast('Produto criado!');
            }

            this.hideForm();
            await this.loadAllProducts();
            this.renderProductsList();
        } catch (e) {
            console.error('[PremiumAdmin] save failed:', e);
            this._toast('Erro ao salvar produto!', 'error');
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
}

window.premiumAdmin = new PremiumAdmin();
