class EventPokemonAdmin {
    constructor() {
        this.allAbilities = [];
        this.allPokemon = [];
        this.selectedAbilities = [];
        this.selectedBasePokemon = null;
        this.frontFile = null;
        this.backFile = null;

        this.bindEvents();
    }

    bindEvents() {
        const btn = document.getElementById('admin-btn-new-pokemon');
        if (btn) btn.addEventListener('click', () => this.open());

        const closeBtn = document.getElementById('ep-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());

        const form = document.getElementById('ep-form');
        if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));

        const frontInput = document.getElementById('ep-sprite-front');
        if (frontInput) frontInput.addEventListener('change', (e) => this.handleFilePreview(e, 'ep-sprite-front-preview', 'front'));

        const backInput = document.getElementById('ep-sprite-back');
        if (backInput) backInput.addEventListener('change', (e) => this.handleFilePreview(e, 'ep-sprite-back-preview', 'back'));

        const abilitySearch = document.getElementById('ep-ability-search');
        if (abilitySearch) {
            abilitySearch.addEventListener('input', () => this.searchAbilities(abilitySearch.value));
            abilitySearch.addEventListener('focus', () => this.searchAbilities(abilitySearch.value));
        }

        const baseSearch = document.getElementById('ep-base-search');
        if (baseSearch) {
            baseSearch.addEventListener('input', () => this.searchPokemon(baseSearch.value));
            baseSearch.addEventListener('focus', () => this.searchPokemon(baseSearch.value));
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#ep-ability-search') && !e.target.closest('#ep-ability-dropdown')) {
                const dd = document.getElementById('ep-ability-dropdown');
                if (dd) dd.style.display = 'none';
            }
            if (!e.target.closest('#ep-base-search') && !e.target.closest('#ep-base-dropdown')) {
                const dd = document.getElementById('ep-base-dropdown');
                if (dd) dd.style.display = 'none';
            }
        });
    }

    async open() {
        document.getElementById('event-pokemon-screen').classList.remove('hidden');
        await this.loadData();
    }

    close() {
        document.getElementById('event-pokemon-screen').classList.add('hidden');
        this.resetForm();
    }

    resetForm() {
        document.getElementById('ep-form').reset();
        document.getElementById('ep-sprite-front-preview').style.display = 'none';
        document.getElementById('ep-sprite-back-preview').style.display = 'none';
        document.getElementById('ep-ability-tags').innerHTML = '';
        document.getElementById('ep-base-selected').textContent = '';
        document.getElementById('ep-status').textContent = '';
        this.selectedAbilities = [];
        this.selectedBasePokemon = null;
        this.frontFile = null;
        this.backFile = null;
    }

    async loadData() {
        try {
            const [abilitiesRes, pokemonRes] = await Promise.all([
                window.db.from('abilities').select('id, name'),
                window.db.from('pokemon').select('id, name').order('id')
            ]);
            this.allAbilities = abilitiesRes.data || [];
            this.allPokemon = pokemonRes.data || [];
            console.log(`[EventPokemon] Loaded ${this.allAbilities.length} abilities, ${this.allPokemon.length} pokemon`);
        } catch (e) {
            console.error('[EventPokemon] Load error:', e);
        }
    }

    handleFilePreview(e, previewId, type) {
        const file = e.target.files[0];
        if (!file) return;
        if (type === 'front') this.frontFile = file;
        else this.backFile = file;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.getElementById(previewId);
            img.src = ev.target.result;
            img.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    async uploadImage(file, path) {
        const { data, error } = await window.db.storage
            .from('sprites')
            .upload(path, file, { upsert: true });
        if (error) throw error;
        return `${window.SUPABASE_URL}/storage/v1/object/public/sprites/${path}`;
    }

    searchAbilities(query) {
        const dd = document.getElementById('ep-ability-dropdown');
        if (!query || query.length < 1) {
            dd.style.display = 'none';
            return;
        }
        const q = query.toLowerCase();
        const matches = this.allAbilities
            .filter(a => a.name.toLowerCase().includes(q) && !this.selectedAbilities.find(s => s.id === a.id))
            .slice(0, 20);
        if (matches.length === 0) {
            dd.style.display = 'none';
            return;
        }
        dd.innerHTML = matches.map(a =>
            `<div class="ep-dropdown-item" data-id="${a.id}" data-name="${a.name}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #21262d;font-size:13px;color:#c9d1d9;">${a.name}</div>`
        ).join('');
        dd.style.display = 'block';
        dd.querySelectorAll('.ep-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.addAbility(parseInt(item.dataset.id), item.dataset.name);
                document.getElementById('ep-ability-search').value = '';
                dd.style.display = 'none';
            });
        });
    }

    addAbility(id, name) {
        if (this.selectedAbilities.find(a => a.id === id)) return;
        this.selectedAbilities.push({ id, name, slot: this.selectedAbilities.length + 1, hidden: false });
        this.renderAbilityTags();
    }

    removeAbility(id) {
        this.selectedAbilities = this.selectedAbilities.filter(a => a.id !== id);
        this.selectedAbilities.forEach((a, i) => a.slot = i + 1);
        this.renderAbilityTags();
    }

    toggleHiddenAbility(id) {
        const a = this.selectedAbilities.find(a => a.id === id);
        if (a) a.hidden = !a.hidden;
        this.renderAbilityTags();
    }

    renderAbilityTags() {
        const container = document.getElementById('ep-ability-tags');
        container.innerHTML = this.selectedAbilities.map(a =>
            `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:16px;font-size:12px;cursor:pointer;${a.hidden ? 'background:#e94560;color:#fff;' : 'background:#21262d;color:#c9d1d9;'}" data-id="${a.id}">
                ${a.hidden ? '🌟 ' : ''}${a.name}
                <span class="ep-rm-ability" data-id="${a.id}" style="margin-left:2px;opacity:0.6;">✕</span>
            </span>`
        ).join('');

        container.querySelectorAll('.ep-rm-ability').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeAbility(parseInt(el.dataset.id));
            });
        });

        container.querySelectorAll('span[data-id]').forEach(el => {
            el.addEventListener('dblclick', () => {
                this.toggleHiddenAbility(parseInt(el.dataset.id));
            });
        });
    }

    searchPokemon(query) {
        const dd = document.getElementById('ep-base-dropdown');
        if (!query || query.length < 1) {
            dd.style.display = 'none';
            return;
        }
        const q = query.toLowerCase();
        const matches = this.allPokemon
            .filter(p => p.name.toLowerCase().includes(q))
            .slice(0, 20);
        if (matches.length === 0) {
            dd.style.display = 'none';
            return;
        }
        dd.innerHTML = matches.map(p =>
            `<div class="ep-dropdown-item" data-id="${p.id}" data-name="${p.name}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #21262d;font-size:13px;color:#c9d1d9;">#${p.id} ${p.name}</div>`
        ).join('');
        dd.style.display = 'block';
        dd.querySelectorAll('.ep-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedBasePokemon = { id: parseInt(item.dataset.id), name: item.dataset.name };
                document.getElementById('ep-base-search').value = '';
                document.getElementById('ep-base-selected').textContent = `✅ Base: #${item.dataset.id} ${item.dataset.name}`;
                dd.style.display = 'none';
            });
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        const status = document.getElementById('ep-status');
        const saveBtn = document.getElementById('ep-save-btn');
        saveBtn.disabled = true;
        status.style.color = '#ffd43b';
        status.textContent = 'Enviando...';

        try {
            const name = document.getElementById('ep-name').value.trim();
            const type1 = document.getElementById('ep-type1').value;
            const type2 = document.getElementById('ep-type2').value;
            const types = type2 ? [type1, type2] : [type1];
            const hp = parseInt(document.getElementById('ep-hp').value);
            const attack = parseInt(document.getElementById('ep-attack').value);
            const defense = parseInt(document.getElementById('ep-defense').value);
            const spAtk = parseInt(document.getElementById('ep-sp-atk').value);
            const spDef = parseInt(document.getElementById('ep-sp-def').value);
            const speed = parseInt(document.getElementById('ep-speed').value);

            if (!this.frontFile) {
                status.style.color = '#e94560';
                status.textContent = 'Envie o sprite frente!';
                saveBtn.disabled = false;
                return;
            }

            const timestamp = Date.now();
            const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

            status.textContent = 'Uploading sprites...';
            const frontExt = (this.frontFile.name.split('.').pop() || 'png').toLowerCase();
            const frontUrl = await this.uploadImage(this.frontFile, `event-pokemon/${safeName}_${timestamp}_front.${frontExt}`);
            let backUrl = frontUrl;
            if (this.backFile) {
                const backExt = (this.backFile.name.split('.').pop() || 'png').toLowerCase();
                backUrl = await this.uploadImage(this.backFile, `event-pokemon/${safeName}_${timestamp}_back.${backExt}`);
            }

            const abilityIds = this.selectedAbilities.map(a => a.id);
            const abilitySlots = this.selectedAbilities.map(a => a.slot);
            const abilityHidden = this.selectedAbilities.map(a => a.hidden);

            status.textContent = 'Criando pokemon...';
            const { data, error } = await window.db.rpc('create_event_pokemon', {
                p_name: name,
                p_types: types,
                p_hp: hp,
                p_attack: attack,
                p_defense: defense,
                p_sp_atk: spAtk,
                p_sp_def: spDef,
                p_speed: speed,
                p_sprite_front: frontUrl,
                p_sprite_back: backUrl,
                p_sprite_official: frontUrl,
                p_base_pokemon_id: this.selectedBasePokemon ? this.selectedBasePokemon.id : null,
                p_ability_ids: abilityIds.length > 0 ? abilityIds : null,
                p_ability_slots: abilitySlots.length > 0 ? abilitySlots : null,
                p_ability_hidden: abilityHidden.length > 0 ? abilityHidden : null
            });

            if (error) throw error;

            status.style.color = '#69db7c';
            status.textContent = `✅ Pokemon #${data} criado com sucesso!`;
            saveBtn.disabled = false;

            setTimeout(() => this.close(), 2000);
        } catch (e) {
            console.error('[EventPokemon] Save error:', e);
            status.style.color = '#e94560';
            status.textContent = `❌ Erro: ${e.message || e}`;
            saveBtn.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.eventPokemonAdmin = new EventPokemonAdmin();
});
