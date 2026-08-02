class GymLeadersAdmin {
    constructor() {
        this._currentRegion = null;
        this._currentLeader = null;
        this._regions = [];
        this._leaders = [];
        this._allPokemon = [];
        this._allMoves = [];
        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById('gym-admin-close')?.addEventListener('click', () => this.close());
        document.getElementById('gym-admin-add-region')?.addEventListener('click', () => this.createRegion());
        document.getElementById('gym-admin-add-leader')?.addEventListener('click', () => this.createLeader());
    }

    async open() {
        document.getElementById('gym-admin-overlay')?.classList.remove('hidden');
        await this.loadPokemonList();
        await this.loadMovesList();
        await this.loadRegions();
    }

    close() {
        document.getElementById('gym-admin-overlay')?.classList.add('hidden');
        this._currentRegion = null;
        this._currentLeader = null;
    }

    async loadPokemonList() {
        try {
            const { data } = await window.db.from('pokemon').select('id, name').order('id');
            this._allPokemon = data || [];
        } catch (e) {
            console.error('[GymAdmin] Error loading pokemon:', e);
        }
    }

    async loadMovesList() {
        try {
            const { data } = await window.db.from('moves').select('id, name, type, category, power').order('name');
            this._allMoves = data || [];
        } catch (e) {
            console.error('[GymAdmin] Error loading moves:', e);
        }
    }

    // ============================================================
    // REGIONS
    // ============================================================

    async loadRegions() {
        try {
            const { data } = await window.db.from('gym_regions').select('*').order('sort_order');
            this._regions = data || [];
            this.renderRegionsList();
        } catch (e) {
            console.error('[GymAdmin] Error loading regions:', e);
            this._regions = [];
            this.renderRegionsList();
        }
    }

    renderRegionsList() {
        const list = document.getElementById('gym-admin-regions-list');
        if (!list) return;
        list.innerHTML = '';

        if (this._regions.length === 0) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;padding:16px;">Nenhuma região criada</div>';
            return;
        }

        this._regions.forEach(region => {
            const item = document.createElement('div');
            item.style.cssText = `padding:8px;border-radius:6px;cursor:pointer;margin-bottom:4px;background:${this._currentRegion?.id === region.id ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.03)'};border:1px solid ${this._currentRegion?.id === region.id ? 'rgba(233,69,96,0.4)' : 'transparent'};display:flex;align-items:center;justify-content:space-between;`;
            item.innerHTML = `
                <span style="font-size:12px;font-weight:600;color:#fff;">${region.name}</span>
                <button class="gym-delete-region" data-id="${region.id}" style="background:rgba(244,67,54,0.2);border:none;color:#f44336;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:12px;">🗑</button>
            `;
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.gym-delete-region')) this.selectRegion(region);
            });
            item.querySelector('.gym-delete-region')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteRegion(region.id);
            });
            list.appendChild(item);
        });
    }

    async createRegion() {
        const name = prompt('Nome da região (ex: Kanto, Johto):');
        if (!name) return;

        const sortOrder = this._regions.length + 1;
        try {
            const { data, error } = await window.db.from('gym_regions').insert({
                name,
                sort_order: sortOrder
            }).select().single();

            if (error) throw error;
            await this.loadRegions();
            if (data) this.selectRegion(data);
        } catch (e) {
            alert('Erro ao criar região: ' + e.message);
        }
    }

    async deleteRegion(id) {
        if (!confirm('Tem certeza que deseja deletar esta região e todos os líderes?')) return;
        try {
            await window.db.from('gym_leaders').delete().eq('region_id', id);
            await window.db.from('gym_regions').delete().eq('id', id);
            if (this._currentRegion?.id === id) {
                this._currentRegion = null;
                this._currentLeader = null;
                this.clearEditor();
            }
            await this.loadRegions();
        } catch (e) {
            alert('Erro ao deletar região: ' + e.message);
        }
    }

    async selectRegion(region) {
        this._currentRegion = region;
        this._currentLeader = null;
        this.renderRegionsList();
        await this.loadLeaders();
    }

    // ============================================================
    // LEADERS
    // ============================================================

    async loadLeaders() {
        if (!this._currentRegion) return;
        try {
            const { data } = await window.db.from('gym_leaders')
                .select('*')
                .eq('region_id', this._currentRegion.id)
                .order('gym_number');
            this._leaders = data || [];
            this.renderLeadersList();
        } catch (e) {
            console.error('[GymAdmin] Error loading leaders:', e);
            this._leaders = [];
            this.renderLeadersList();
        }
    }

    renderLeadersList() {
        const list = document.getElementById('gym-admin-leaders-list');
        if (!list) return;
        list.innerHTML = '';

        if (!this._currentRegion) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;padding:16px;">Selecione uma região</div>';
            return;
        }

        if (this._leaders.length === 0) {
            list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;padding:16px;">Nenhum líder criado</div>';
            return;
        }

        this._leaders.forEach((leader, i) => {
            const item = document.createElement('div');
            item.style.cssText = `padding:8px;border-radius:6px;cursor:pointer;margin-bottom:4px;background:${this._currentLeader?.id === leader.id ? 'rgba(233,69,96,0.2)' : 'rgba(255,255,255,0.03)'};border:1px solid ${this._currentLeader?.id === leader.id ? 'rgba(233,69,96,0.4)' : 'transparent'};display:flex;align-items:center;gap:8px;`;
            item.innerHTML = `
                <div style="width:28px;height:28px;border-radius:50%;background:rgba(233,69,96,0.2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#e94560;">${leader.gym_number || i + 1}</div>
                <div style="flex:1;">
                    <div style="font-size:11px;font-weight:700;color:#fff;">${leader.name}</div>
                    <div style="font-size:9px;color:rgba(255,255,255,0.5);">${leader.type} • ${leader.badge_name || 'Sem insígnia'}</div>
                </div>
            `;
            item.addEventListener('click', () => this.selectLeader(leader));
            list.appendChild(item);
        });
    }

    async createLeader() {
        if (!this._currentRegion) {
            alert('Selecione uma região primeiro!');
            return;
        }

        const name = prompt('Nome do líder de ginásio:');
        if (!name) return;

        const gymNumber = this._leaders.length + 1;
        try {
            const { data, error } = await window.db.from('gym_leaders').insert({
                region_id: this._currentRegion.id,
                name,
                gym_number: gymNumber,
                type: 'Normal',
                badge_name: `${name} Badge`,
                sprite_url: '',
                map_image_url: '',
                battle_bg_url: '',
                map_effect: '',
                pokemon_list: [],
                dialogue: `Eu sou ${name}, o líder do ginásio!`
            }).select().single();

            if (error) throw error;
            await this.loadLeaders();
            if (data) this.selectLeader(data);
        } catch (e) {
            alert('Erro ao criar líder: ' + e.message);
        }
    }

    selectLeader(leader) {
        this._currentLeader = leader;
        this.renderLeadersList();
        this.renderLeaderEditor();
    }

    // ============================================================
    // LEADER EDITOR
    // ============================================================

    renderLeaderEditor() {
        const editor = document.getElementById('gym-admin-editor');
        if (!editor || !this._currentLeader) return;

        const leader = this._currentLeader;
        const pokemonList = leader.pokemon_list || [];

        editor.innerHTML = `
            <div style="display:flex;gap:16px;margin-bottom:16px;">
                <div style="flex:1;">
                    <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Nome</label>
                    <input id="gym-ed-name" value="${leader.name || ''}" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:13px;font-family:Inter;">
                </div>
                <div style="width:120px;">
                    <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Nº Ginásio</label>
                    <input id="gym-ed-number" type="number" min="1" max="8" value="${leader.gym_number || 1}" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:13px;font-family:Inter;">
                </div>
            </div>

            <div style="display:flex;gap:16px;margin-bottom:16px;">
                <div style="flex:1;">
                    <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Tipo</label>
                    <select id="gym-ed-type" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:13px;font-family:Inter;">
                        ${['Normal','Fire','Water','Grass','Electric','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'].map(t =>
                            `<option value="${t}" ${leader.type === t ? 'selected' : ''}>${t}</option>`
                        ).join('')}
                    </select>
                </div>
                <div style="flex:1;">
                    <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Insígnia</label>
                    <input id="gym-ed-badge" value="${leader.badge_name || ''}" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:13px;font-family:Inter;">
                </div>
            </div>

            <div style="display:flex;gap:16px;margin-bottom:16px;">
                <div style="flex:1;">
                    <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Sprite URL</label>
                    <input id="gym-ed-sprite" value="${leader.sprite_url || ''}" placeholder="URL da imagem do líder" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:12px;font-family:Inter;">
                </div>
            </div>

            <div style="display:flex;gap:16px;margin-bottom:16px;">
                <div style="flex:1;">
                    <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Imagem do Mapa (Ginásio)</label>
                    <div style="display:flex;gap:8px;">
                        <input id="gym-ed-map-img" value="${leader.map_image_url || ''}" placeholder="URL da imagem do ginásio" style="flex:1;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:12px;font-family:Inter;">
                        <button id="gym-pick-map-img" style="padding:8px 12px;background:rgba(233,69,96,0.2);border:1px solid rgba(233,69,96,0.4);border-radius:6px;color:#e94560;font-size:11px;cursor:pointer;">📁</button>
                    </div>
                    ${leader.map_image_url ? `<div style="margin-top:8px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);"><img src="${leader.map_image_url}" style="width:100%;height:120px;object-fit:cover;"></div>` : ''}
                </div>
                <div style="flex:1;">
                    <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Imagem de Batalha (Fundo)</label>
                    <div style="display:flex;gap:8px;">
                        <input id="gym-ed-battle-bg" value="${leader.battle_bg_url || ''}" placeholder="URL do fundo de batalha" style="flex:1;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:12px;font-family:Inter;">
                        <button id="gym-pick-battle-bg" style="padding:8px 12px;background:rgba(233,69,96,0.2);border:1px solid rgba(233,69,96,0.4);border-radius:6px;color:#e94560;font-size:11px;cursor:pointer;">📁</button>
                    </div>
                    ${leader.battle_bg_url ? `<div style="margin-top:8px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);"><img src="${leader.battle_bg_url}" style="width:100%;height:80px;object-fit:cover;"></div>` : ''}
                </div>
            </div>

            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Efeito do Mapa</label>
                <select id="gym-ed-effect" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:13px;font-family:Inter;">
                    ${['none','rain','sun','sandstorm','hail','fog','wind'].map(e =>
                        `<option value="${e}" ${leader.map_effect === e ? 'selected' : ''}>${e === 'none' ? 'Nenhum' : e.charAt(0).toUpperCase() + e.slice(1)}</option>`
                    ).join('')}
                </select>
            </div>

            <div style="margin-bottom:16px;">
                <label style="display:block;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase;">Diálogo</label>
                <textarea id="gym-ed-dialogue" rows="2" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:12px;font-family:Inter;resize:vertical;">${leader.dialogue || ''}</textarea>
            </div>

            <div style="margin-bottom:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <label style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;">Pokémon do Líder</label>
                    <button id="gym-add-pokemon" style="padding:4px 10px;background:rgba(76,175,80,0.2);border:1px solid rgba(76,175,80,0.4);border-radius:4px;color:#4caf50;font-size:10px;font-weight:700;cursor:pointer;">+ Pokémon</button>
                </div>
                <div id="gym-pokemon-list" style="display:flex;flex-direction:column;gap:6px;"></div>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
                <button id="gym-save-leader" style="flex:1;padding:10px;background:linear-gradient(135deg,#4caf50,#2e7d32);border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Salvar</button>
                <button id="gym-delete-leader" style="padding:10px 16px;background:rgba(244,67,54,0.2);border:1px solid rgba(244,67,54,0.4);border-radius:6px;color:#f44336;font-size:12px;font-weight:700;cursor:pointer;">Deletar</button>
            </div>
        `;

        this.renderPokemonList(pokemonList);
        this.bindEditorEvents();
    }

    renderPokemonList(pokemonList) {
        const container = document.getElementById('gym-pokemon-list');
        if (!container) return;
        container.innerHTML = '';

        if (pokemonList.length === 0) {
            container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;">Nenhum Pokémon adicionado</div>';
            return;
        }

        pokemonList.forEach((poke, i) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;border:1px solid rgba(255,255,255,0.08);';
            item.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:11px;font-weight:700;color:#e94560;">#${i + 1}</span>
                    <select class="gym-poke-select" data-index="${i}" style="flex:1;padding:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;font-size:11px;font-family:Inter;">
                        <option value="">Selecione</option>
                        ${this._allPokemon.map(p => `<option value="${p.id}" ${poke.pokemon_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                    <input type="number" class="gym-poke-level" data-index="${i}" value="${poke.level || 20}" min="1" max="100" style="width:50px;padding:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;font-size:11px;font-family:Inter;text-align:center;">
                    <button class="gym-remove-poke" data-index="${i}" style="background:rgba(244,67,54,0.2);border:none;color:#f44336;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:12px;">✕</button>
                </div>
                <div style="margin-left:24px;">
                    <label style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;">Movimentos</label>
                    <div class="gym-poke-moves" data-index="${i}" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                        ${(poke.moves || []).map((m, mi) => `
                            <span style="display:inline-flex;align-items:center;gap:2px;padding:2px 6px;background:rgba(233,69,96,0.2);border:1px solid rgba(233,69,96,0.3);border-radius:4px;font-size:9px;color:#e94560;">
                                ${m.name || m.move_id}
                                <button class="gym-remove-move" data-poke="${i}" data-move="${mi}" style="background:none;border:none;color:#f44336;cursor:pointer;font-size:10px;">✕</button>
                            </span>
                        `).join('')}
                        <select class="gym-add-move" data-index="${i}" style="padding:2px 4px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;font-size:9px;font-family:Inter;max-width:100px;">
                            <option value="">+ Movimento</option>
                            ${this._allMoves.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.gym-poke-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const pokemonList = [...(this._currentLeader.pokemon_list || [])];
                if (pokemonList[idx]) {
                    pokemonList[idx].pokemon_id = parseInt(e.target.value);
                    pokemonList[idx].name = e.target.options[e.target.selectedIndex].text;
                    this._currentLeader.pokemon_list = pokemonList;
                }
            });
        });

        container.querySelectorAll('.gym-poke-level').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const pokemonList = [...(this._currentLeader.pokemon_list || [])];
                if (pokemonList[idx]) {
                    pokemonList[idx].level = parseInt(e.target.value);
                    this._currentLeader.pokemon_list = pokemonList;
                }
            });
        });

        container.querySelectorAll('.gym-remove-poke').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const pokemonList = [...(this._currentLeader.pokemon_list || [])];
                pokemonList.splice(idx, 1);
                this._currentLeader.pokemon_list = pokemonList;
                this.renderPokemonList(pokemonList);
            });
        });

        container.querySelectorAll('.gym-add-move').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const moveId = parseInt(e.target.value);
                if (!moveId) return;
                const move = this._allMoves.find(m => m.id === moveId);
                if (!move) return;
                const pokemonList = [...(this._currentLeader.pokemon_list || [])];
                if (!pokemonList[idx].moves) pokemonList[idx].moves = [];
                pokemonList[idx].moves.push({ move_id: move.id, name: move.name });
                this._currentLeader.pokemon_list = pokemonList;
                this.renderPokemonList(pokemonList);
            });
        });

        container.querySelectorAll('.gym-remove-move').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pokeIdx = parseInt(e.target.dataset.poke);
                const moveIdx = parseInt(e.target.dataset.move);
                const pokemonList = [...(this._currentLeader.pokemon_list || [])];
                if (pokemonList[pokeIdx]?.moves) {
                    pokemonList[pokeIdx].moves.splice(moveIdx, 1);
                    this._currentLeader.pokemon_list = pokemonList;
                    this.renderPokemonList(pokemonList);
                }
            });
        });
    }

    bindEditorEvents() {
        document.getElementById('gym-add-pokemon')?.addEventListener('click', () => {
            const pokemonList = [...(this._currentLeader.pokemon_list || [])];
            pokemonList.push({ pokemon_id: null, name: '', level: 20, moves: [] });
            this._currentLeader.pokemon_list = pokemonList;
            this.renderPokemonList(pokemonList);
        });

        document.getElementById('gym-save-leader')?.addEventListener('click', () => this.saveLeader());
        document.getElementById('gym-delete-leader')?.addEventListener('click', () => this.deleteLeader());

        document.getElementById('gym-pick-map-img')?.addEventListener('click', () => {
            const url = prompt('URL da imagem do mapa do ginásio:');
            if (url) {
                this._currentLeader.map_image_url = url;
                this.renderLeaderEditor();
            }
        });

        document.getElementById('gym-pick-battle-bg')?.addEventListener('click', () => {
            const url = prompt('URL da imagem de fundo de batalha:');
            if (url) {
                this._currentLeader.battle_bg_url = url;
                this.renderLeaderEditor();
            }
        });
    }

    async saveLeader() {
        if (!this._currentLeader) return;

        const name = document.getElementById('gym-ed-name')?.value;
        const gymNumber = parseInt(document.getElementById('gym-ed-number')?.value) || 1;
        const type = document.getElementById('gym-ed-type')?.value;
        const badgeName = document.getElementById('gym-ed-badge')?.value;
        const spriteUrl = document.getElementById('gym-ed-sprite')?.value;
        const mapImageUrl = document.getElementById('gym-ed-map-img')?.value;
        const battleBgUrl = document.getElementById('gym-ed-battle-bg')?.value;
        const mapEffect = document.getElementById('gym-ed-effect')?.value;
        const dialogue = document.getElementById('gym-ed-dialogue')?.value;

        try {
            const { error } = await window.db.from('gym_leaders').update({
                name,
                gym_number: gymNumber,
                type,
                badge_name: badgeName,
                sprite_url: spriteUrl,
                map_image_url: mapImageUrl,
                battle_bg_url: battleBgUrl,
                map_effect: mapEffect,
                dialogue,
                pokemon_list: this._currentLeader.pokemon_list || []
            }).eq('id', this._currentLeader.id);

            if (error) throw error;

            this._currentLeader = { ...this._currentLeader, name, gym_number: gymNumber, type, badge_name: badgeName, sprite_url: spriteUrl, map_image_url: mapImageUrl, battle_bg_url: battleBgUrl, map_effect: mapEffect, dialogue };
            await this.loadLeaders();
            this.selectLeader(this._currentLeader);
            alert('Líder salvo com sucesso!');
        } catch (e) {
            alert('Erro ao salvar: ' + e.message);
        }
    }

    async deleteLeader() {
        if (!this._currentLeader) return;
        if (!confirm('Tem certeza que deseja deletar este líder?')) return;

        try {
            await window.db.from('gym_leaders').delete().eq('id', this._currentLeader.id);
            this._currentLeader = null;
            this.clearEditor();
            await this.loadLeaders();
        } catch (e) {
            alert('Erro ao deletar: ' + e.message);
        }
    }

    clearEditor() {
        const editor = document.getElementById('gym-admin-editor');
        if (editor) {
            editor.innerHTML = `
                <div style="text-align:center;color:rgba(255,255,255,0.3);margin-top:40px;">
                    <div style="font-size:48px;margin-bottom:12px;">🏟️</div>
                    <p>Selecione um líder ou crie uma nova região</p>
                </div>
            `;
        }
    }
}

window.GymLeadersAdmin = GymLeadersAdmin;
