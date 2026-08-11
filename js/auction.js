// ============================================================
// AUCTION SYSTEM - Compra e Venda de Pokemon entre Jogadores
// ============================================================

(function () {
  if (window.Auction) return;
  const Auction = {
    channel: null,
    currentTab: 'buy',
    filters: { name: '', type: '', level: '', shinyOnly: false },
    _subscribed: false,

    async open() {
      await this.loadOffers();
      await this.loadMyOffers();
      this.showUI();
      if (!this._subscribed) this.subscribeRealtime();
    },

    async loadMyOffers() {
      this.myOffers = [];
      try {
        const { data } = await window.db.from('auction_offers').select('*').eq('status', 'active').eq('seller_user_id', window.GameData?.userId).order('created_at', { ascending: false });
        if (data) this.myOffers = data;
      } catch (e) {}
    },

    close() {
      const el = document.getElementById('auction-overlay');
      if (el) el.remove();
    },

    showUI() {
      this.close();
      const overlay = document.createElement('div');
      overlay.id = 'auction-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:960;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
      overlay.innerHTML = `
        <div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;width:95%;max-width:1050px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #30363d;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:18px;font-weight:700;color:#fff;">Leilao de Pokemons</div>
              <div style="display:flex;gap:4px;">
                <button class="auction-tab active" data-tab="buy" style="padding:6px 16px;border-radius:8px;border:1px solid #30363d;background:#1c2333;color:#c9d1d9;cursor:pointer;font-size:13px;font-weight:600;">Compra</button>
                <button class="auction-tab" data-tab="sell" style="padding:6px 16px;border-radius:8px;border:1px solid #30363d;background:#1c2333;color:#c9d1d9;cursor:pointer;font-size:13px;font-weight:600;">Venda</button>
              </div>
            </div>
            <button onclick="window.Auction.close()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px;">Fechar</button>
          </div>
          <div id="auction-buy-panel" style="padding:16px;overflow-y:auto;flex:1;">
            ${this.buildFiltersHTML()}
            <div id="auction-list" style="display:flex;flex-wrap:wrap;gap:8px;max-height:calc(90vh - 200px);overflow-y:auto;"></div>
          </div>
          <div id="auction-sell-panel" style="display:none;padding:16px;overflow-y:auto;flex:1;">
            ${this.buildSellHTML()}
          </div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.querySelectorAll('.auction-tab').forEach(btn => {
        btn.onclick = () => this.switchTab(btn.dataset.tab);
      });

      document.getElementById('auction-search-btn').onclick = () => this.applyFilters();
      document.getElementById('auction-f-level').onkeydown = (e) => { if (e.key === 'Enter') this.applyFilters(); };
      document.getElementById('auction-f-name').onkeydown = (e) => { if (e.key === 'Enter') this.applyFilters(); };

      document.getElementById('auction-sell-select-btn').onclick = () => this.openPokemonSelector();
      document.getElementById('auction-confirm-sell').onclick = () => this.confirmSell();

      this.renderOffers();
      this.renderMyOffers();
    },

    async _fetchSellerNames() {
      const ids = [...new Set(this.offers.map(o => o.seller_character_id).filter(Boolean))];
      if (ids.length === 0) return;
      try {
        const { data } = await window.db.from('game_saves').select('id,player_name').in('id', ids);
        if (data) {
          const map = {};
          data.forEach(g => { map[g.id] = g.player_name; });
          this._sellerNames = map;
        }
      } catch (e) {}
    },

    buildFiltersHTML() {
      return `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
          <input id="auction-f-name" placeholder="Nome do Pokemon" style="padding:6px 10px;border-radius:8px;border:1px solid #30363d;background:#161b22;color:#fff;font-size:12px;width:150px;">
          <input id="auction-f-type" placeholder="Tipo (ex: Fire)" style="padding:6px 10px;border-radius:8px;border:1px solid #30363d;background:#161b22;color:#fff;font-size:12px;width:110px;">
          <input id="auction-f-level" type="number" placeholder="Nivel" style="padding:6px 10px;border-radius:8px;border:1px solid #30363d;background:#161b22;color:#fff;font-size:12px;width:70px;">
          <label style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;">
            <input type="checkbox" id="auction-f-shiny"> Shiny
          </label>
          <button id="auction-search-btn" style="padding:6px 16px;border-radius:8px;border:none;background:#238636;color:#fff;cursor:pointer;font-size:12px;font-weight:600;">Pesquisar</button>
        </div>`;
    },

    buildSellHTML() {
      return `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button id="auction-sell-select-btn" style="padding:10px 20px;border-radius:8px;border:1px solid #30363d;background:#1c2333;color:#fff;cursor:pointer;font-size:13px;text-align:left;">Escolha seu Pokemon...</button>
          <div id="auction-sell-preview" style="display:none;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px;">
            <div id="auction-sell-preview-content"></div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:12px;">
              <input id="auction-sell-price" type="number" placeholder="Valor" style="padding:8px 12px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:13px;width:140px;" min="1">
              <select id="auction-sell-currency" style="padding:8px 12px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:13px;">
                <option value="silver">Prata</option>
                <option value="gold">Ouro</option>
                <option value="diamonds">Diamante</option>
              </select>
              <button id="auction-confirm-sell" style="padding:8px 20px;border-radius:8px;border:none;background:#e94560;color:#fff;cursor:pointer;font-size:13px;font-weight:700;">Colocar a Venda</button>
            </div>
          </div>
          <div id="auction-my-offers" style="border-top:1px solid #30363d;padding-top:12px;">
            <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-bottom:6px;">Seus pokemons a venda:</div>
            <div id="auction-my-offers-list"></div>
          </div>
        </div>`;
    },

    applyFilters() {
      this.filters.name = (document.getElementById('auction-f-name')?.value || '').trim().toLowerCase();
      this.filters.type = (document.getElementById('auction-f-type')?.value || '').trim().toLowerCase();
      this.filters.level = parseInt(document.getElementById('auction-f-level')?.value) || 0;
      this.filters.shinyOnly = document.getElementById('auction-f-shiny')?.checked || false;
      this.renderOffers();
    },

    async loadOffers() {
      this.offers = [];
      try {
        const { data, error } = await window.db.from('auction_offers').select('*').eq('status', 'active').order('created_at', { ascending: false });
        if (error) {
          console.warn('[Auction] loadOffers error:', error.message, error.code);
          return;
        }
        this.offers = data || [];
        await this._fetchSellerNames();
      } catch (e) {
        console.warn('[Auction] loadOffers exception:', e);
      }
      this.renderOffers();
    },

    subscribeRealtime() {
      this._subscribed = true;
      this._pendingSaleNotifications = [];
      this.channel = window.db.channel('auction-realtime');
      this.channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auction_offers' }, (payload) => {
        const old = payload.old;
        const updated = payload.new;
        if (old.status === 'active' && updated.status === 'sold') {
          const userId = window.GameData?.userId;
          if (userId && updated.seller_user_id === userId) {
            this._queueSaleNotification(updated);
          }
        }
        this.loadOffers();
        this.loadMyOffers();
      }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auction_offers' }, () => {
        this.loadOffers();
        this.loadMyOffers();
      }).subscribe();
    },

    _queueSaleNotification(offer) {
      this._pendingSaleNotifications.push(offer);
      this._checkSaleNotifications();
    },

    _checkSaleNotifications() {
      const game = window.pokefury;
      if (game && game.state === 'battle') {
        setTimeout(() => this._checkSaleNotifications(), 1000);
        return;
      }
      while (this._pendingSaleNotifications.length > 0) {
        const offer = this._pendingSaleNotifications.shift();
        this._showSalePopup(offer);
      }
    },

    _showSalePopup(offer) {
      const currencyLabel = offer.currency_type === 'silver' ? 'Prata' : offer.currency_type === 'gold' ? 'Ouro' : 'Diamante';
      const popup = document.createElement('div');
      popup.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
      popup.innerHTML = `<div style="background:linear-gradient(135deg,#0d1117,#1c2333);border:2px solid #4ecdc4;border-radius:16px;padding:28px;text-align:center;max-width:420px;box-shadow:0 0 40px rgba(78,205,196,0.2);">
        <div style="font-size:40px;margin-bottom:10px;">💰</div>
        <div style="color:#4ecdc4;font-size:20px;font-weight:700;margin-bottom:6px;">Pokemon Vendido!</div>
        <div style="color:#fff;font-size:15px;margin-bottom:4px;">Seu <b>${offer.pokemon_name}</b> Nv.${offer.level} foi vendido com sucesso!</div>
        <div style="color:#4ecdc4;font-size:22px;font-weight:700;margin:12px 0;">+${offer.price.toLocaleString()} ${currencyLabel}</div>
        <div style="color:rgba(255,255,255,0.5);font-size:12px;">O valor foi adicionado a voce!</div>
        <button onclick="this.parentElement.parentElement.remove(); if(window.game?.refreshCurrencies) window.game.refreshCurrencies()" style="margin-top:16px;padding:10px 28px;border-radius:10px;border:none;background:#238636;color:#fff;cursor:pointer;font-size:14px;font-weight:700;">OK</button>
      </div>`;
      document.body.appendChild(popup);
    },

    renderOffers() {
      const list = document.getElementById('auction-list');
      if (!list) return;
      let filtered = this.offers;
      if (this.filters.name) filtered = filtered.filter(o => o.pokemon_name.toLowerCase().includes(this.filters.name));
      if (this.filters.type) filtered = filtered.filter(o => (o.types || '').toLowerCase().includes(this.filters.type));
      if (this.filters.level > 0) filtered = filtered.filter(o => o.level === this.filters.level);
      if (this.filters.shinyOnly) filtered = filtered.filter(o => o.is_shiny);

      if (filtered.length === 0) {
        list.innerHTML = '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:40px;">Nenhum Pokemon a venda no momento.</div>';
        return;
      }

      const PokeAPI = window.PokeAPI;
      list.innerHTML = filtered.map(o => {
        const spriteUrl = PokeAPI ? PokeAPI.getAnimatedFrontUrl(o.pokemon_id) : '';
        const currencyLabel = o.currency_type === 'silver' ? 'Prata' : o.currency_type === 'gold' ? 'Ouro' : 'Diamante';
        const shinyBadge = o.is_shiny ? '<span style="background:#ffd700;color:#000;font-size:9px;padding:1px 4px;border-radius:3px;margin-left:4px;">Shiny</span>' : '';
        return `<div class="auction-card" style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:10px;width:160px;cursor:pointer;transition:border-color 0.2s;" onmouseenter="this.style.borderColor='#58a6ff'" onmouseleave="this.style.borderColor='#30363d'" onclick="window.Auction.showPokemonDetail('${o.id}')">
          <div style="display:flex;justify-content:center;margin-bottom:6px;">
            <img src="${spriteUrl}" style="width:64px;height:64px;object-fit:contain;" onerror="this.style.display='none'">
          </div>
          <div style="color:#fff;font-size:12px;font-weight:700;text-align:center;">${o.pokemon_name}${shinyBadge}</div>
          <div style="color:rgba(255,255,255,0.5);font-size:10px;text-align:center;">Nv. ${o.level}</div>
          <div style="color:#4ecdc4;font-size:12px;font-weight:700;text-align:center;margin-top:4px;">${o.price.toLocaleString()} ${currencyLabel}</div>
          <div style="color:rgba(255,255,255,0.3);font-size:9px;text-align:center;margin-top:2px;">Vendedor: ${o.seller_name || 'Treinador'}</div>
        </div>`;
      }).join('');
    },

    switchTab(tab) {
      this.currentTab = tab;
      document.getElementById('auction-buy-panel').style.display = tab === 'buy' ? 'block' : 'none';
      document.getElementById('auction-sell-panel').style.display = tab === 'sell' ? 'block' : 'none';
      document.querySelectorAll('.auction-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
        b.style.background = b.dataset.tab === tab ? '#1f3a5f' : '#1c2333';
        b.style.borderColor = b.dataset.tab === tab ? '#58a6ff' : '#30363d';
      });
    },

    async openPokemonSelector() {
      if (!window.GameData?.currentCharacterId) return;
      const userId = window.GameData.userId || (await window.db.auth.getUser())?.data?.user?.id;
      if (!userId) return;

      const popup = document.createElement('div');
      popup.id = 'auction-sell-selector';
      popup.style.cssText = 'position:fixed;inset:0;z-index:970;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
      popup.innerHTML = `<div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;width:90%;max-width:700px;max-height:80vh;display:flex;flex-direction:column;padding:16px;">
        <div style="color:#fff;font-size:15px;font-weight:700;margin-bottom:10px;">Selecione o Pokemon para vender</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;overflow-y:auto;flex:1;" id="auction-pokemon-select-list"><div style="color:rgba(255,255,255,0.3);text-align:center;width:100%;padding:20px;">Carregando...</div></div>
        <button onclick="document.getElementById('auction-sell-selector').remove()" style="margin-top:10px;padding:8px;border-radius:8px;border:1px solid #30363d;background:#1c2333;color:#fff;cursor:pointer;">Cancelar</button>
      </div>`;
      document.body.appendChild(popup);

      const list = popup.querySelector('#auction-pokemon-select-list');
      const pokemons = [];
      try {
        const [pTeam, pPC] = await Promise.all([
          window.db.from('pokemon_team').select('*').eq('user_id', userId),
          window.db.from('pokemon_pc').select('*').eq('user_id', userId)
        ]);
        if (pTeam.data) pokemons.push(...pTeam.data.map(p => ({ ...p, source: 'team', source_id: p.id, name: p.pokemon_name || p.species })));
        if (pPC.data) pokemons.push(...pPC.data.map(p => ({ ...p, source: 'pc', source_id: p.id, name: p.species })));
      } catch (e) {}

      if (pokemons.length === 0) {
        list.innerHTML = '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:20px;">Nenhum pokemon disponivel.</div>';
        return;
      }

      const PokeAPI = window.PokeAPI;
      list.innerHTML = pokemons.map(p => {
        const spriteUrl = PokeAPI ? PokeAPI.getAnimatedFrontUrl(p.pokemon_id) : '';
        const shinyBadge = p.is_shiny ? '<span style="color:#ffd700;font-size:9px;"> Shiny</span>' : '';
        return `<div class="auction-sell-item" style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:8px;width:140px;cursor:pointer;text-align:center;" data-source="${p.source}" data-source-id="${p.source_id}" onclick="window.Auction.selectSellPokemon(this)" onmouseenter="this.style.borderColor='#58a6ff'" onmouseleave="this.style.borderColor='#30363d'">
          <img src="${spriteUrl}" style="width:48px;height:48px;" onerror="this.style.display='none'">
          <div style="color:#fff;font-size:11px;font-weight:600;">${p.name}${shinyBadge}</div>
          <div style="color:rgba(255,255,255,0.4);font-size:9px;">Nv.${p.level} | ${p.source === 'team' ? 'Time' : 'PC'}</div>
        </div>`;
      }).join('');
    },

    async selectSellPokemon(el) {
      const source = el.dataset.source;
      const sourceId = el.dataset.sourceId;
      const popup = document.getElementById('auction-sell-selector');
      if (popup) popup.remove();

      let pokemon;
      try {
        const { data } = source === 'team'
          ? await window.db.from('pokemon_team').select('*').eq('id', sourceId).single()
          : await window.db.from('pokemon_pc').select('*').eq('id', sourceId).single();
        pokemon = data;
      } catch (e) {}

      if (!pokemon) return;
      this._sellPokemon = { source, sourceId: sourceId, data: pokemon };

      const preview = document.getElementById('auction-sell-preview');
      const content = document.getElementById('auction-sell-preview-content');
      const PokeAPI = window.PokeAPI;

      let pokemonData = null;
      try { pokemonData = await PokeAPI?.ensurePokemon(pokemon.pokemon_id); } catch (e) {}

      const spriteUrl = PokeAPI ? PokeAPI.getAnimatedFrontUrl(pokemon.pokemon_id) : '';
      const calcStat = (base, iv, ev, level) => Math.floor(((2 * base + (iv || 0) + Math.floor((ev || 0) / 4)) * level) / 100) + 5;
      const hpStat = (base, iv, ev, level) => Math.floor(((2 * base + (iv || 0) + Math.floor((ev || 0) / 4)) * level) / 100) + level + 10;

      const level = pokemon.level || 1;
      const bhp = pokemonData?.hp || 0;
      const batk = pokemonData?.attack || 0;
      const bdef = pokemonData?.defense || 0;
      const bspa = pokemonData?.spAtk || 0;
      const bspd = pokemonData?.spDef || 0;
      const bspe = pokemonData?.speed || 0;

      const abilities = pokemonData?.abilities || [];
      const abilityName = abilities[0] || 'Nenhuma';

      content.innerHTML = `
        <div style="display:flex;gap:14px;align-items:flex-start;">
          <img src="${spriteUrl}" style="width:80px;height:80px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'">
          <div style="flex:1;">
            <div style="color:#fff;font-size:16px;font-weight:700;">${pokemon.pokemon_name || pokemon.species}${pokemon.is_shiny ? ' <span style="color:#ffd700">Shiny</span>' : ''}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:12px;">Nivel ${level} | ${pokemon.types || ''}</div>
            <div style="color:rgba(255,255,255,0.3);font-size:10px;">Nature: ${pokemon.nature || 'hardy'} | Habilidade: ${abilityName}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;font-size:10px;">
              <div style="color:rgba(255,255,255,0.6);">HP: ${hpStat(bhp, pokemon.iv_hp, pokemon.ev_hp, level) + (level>1 ? 0 : 0)} (IV:${pokemon.iv_hp||0}/EV:${pokemon.ev_hp||0})</div>
              <div style="color:rgba(255,255,255,0.6);">ATK: ${calcStat(batk, pokemon.iv_attack, pokemon.ev_attack, level)} (IV:${pokemon.iv_attack||0}/EV:${pokemon.ev_attack||0})</div>
              <div style="color:rgba(255,255,255,0.6);">DEF: ${calcStat(bdef, pokemon.iv_defense, pokemon.ev_defense, level)} (IV:${pokemon.iv_defense||0}/EV:${pokemon.ev_defense||0})</div>
              <div style="color:rgba(255,255,255,0.6);">SPA: ${calcStat(bspa, pokemon.iv_sp_atk, pokemon.ev_sp_atk, level)} (IV:${pokemon.iv_sp_atk||0}/EV:${pokemon.ev_sp_atk||0})</div>
              <div style="color:rgba(255,255,255,0.6);">SPD: ${calcStat(bspd, pokemon.iv_sp_def, pokemon.ev_sp_def, level)} (IV:${pokemon.iv_sp_def||0}/EV:${pokemon.ev_sp_def||0})</div>
              <div style="color:rgba(255,255,255,0.6);">SPE: ${calcStat(bspe, pokemon.iv_speed, pokemon.ev_speed, level)} (IV:${pokemon.iv_speed||0}/EV:${pokemon.ev_speed||0})</div>
            </div>
          </div>
        </div>`;
      preview.style.display = 'block';
      document.getElementById('auction-sell-price').value = '';
    },

    async confirmSell() {
      const price = parseInt(document.getElementById('auction-sell-price')?.value) || 0;
      const currency = document.getElementById('auction-sell-currency')?.value || 'silver';
      if (price <= 0 || !this._sellPokemon) return;

      const poke = this._sellPokemon;
      const name = poke.data.pokemon_name || poke.data.species;
      const currencyLabel = currency === 'silver' ? 'Prata' : currency === 'gold' ? 'Ouro' : 'Diamante';

      const confirm = await new Promise(resolve => {
        const popup = document.createElement('div');
        popup.style.cssText = 'position:fixed;inset:0;z-index:980;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
        popup.innerHTML = `<div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;padding:24px;text-align:center;max-width:400px;">
          <div style="color:#fff;font-size:16px;margin-bottom:8px;">Confirmar venda?</div>
          <div style="color:rgba(255,255,255,0.6);font-size:13px;">${name} Lv.${poke.data.level}</div>
          <div style="color:#4ecdc4;font-size:18px;font-weight:700;margin:10px 0;">${price.toLocaleString()} ${currencyLabel}</div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
            <button id="auction-cancel-btn" style="padding:8px 20px;border-radius:8px;border:1px solid #30363d;background:#1c2333;color:#fff;cursor:pointer;">Voltar</button>
            <button id="auction-confirm-btn" style="padding:8px 20px;border-radius:8px;border:none;background:#e94560;color:#fff;cursor:pointer;font-weight:700;">Confirmar</button>
          </div></div>`;
        document.body.appendChild(popup);
        popup.querySelector('#auction-cancel-btn').onclick = () => { popup.remove(); resolve(false); };
        popup.querySelector('#auction-confirm-btn').onclick = () => { popup.remove(); resolve(true); };
      });

      if (!confirm) return;

      try {
        const { data, error } = await window.db.rpc('auction_create_offer', {
          p_character_id: window.GameData.currentCharacterId,
          p_pokemon_source: poke.source,
          p_pokemon_source_id: poke.sourceId,
          p_price: price,
          p_currency_type: currency
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.success) {
          alert(`${name} colocado a venda por ${price.toLocaleString()} ${currencyLabel}!`);
          this._sellPokemon = null;
          document.getElementById('auction-sell-preview').style.display = 'none';
          this.loadOffers();
          this.loadMyOffers();
          setTimeout(() => { if (window.pokefury?.updatePartyPanel) window.pokefury.updatePartyPanel(); }, 100);
        }
      } catch (e) {
        alert('Erro: ' + (e.message || 'Falha ao criar oferta'));
      }
    },

    async showPokemonDetail(offerId) {
      const offer = this.offers.find(o => o.id === offerId);
      if (!offer) return;

      const PokeAPI = window.PokeAPI;
      const spriteUrl = PokeAPI ? PokeAPI.getAnimatedFrontUrl(offer.pokemon_id) : '';
      const currencyLabel = offer.currency_type === 'silver' ? 'Prata' : offer.currency_type === 'gold' ? 'Ouro' : 'Diamante';

      let pokemonData = null;
      try { pokemonData = await PokeAPI?.ensurePokemon(offer.pokemon_id); } catch (e) {}
      const calcStat = (base, iv, ev, level) => Math.floor(((2 * base + (iv || 0) + Math.floor((ev || 0) / 4)) * level) / 100) + 5;
      const hpStat = (base, iv, ev, level) => Math.floor(((2 * base + (iv || 0) + Math.floor((ev || 0) / 4)) * level) / 100) + level + 10;
      const level = offer.level;
      const abilityName = (pokemonData?.abilities || [])[0] || 'Nenhuma';

      const popup = document.createElement('div');
      popup.style.cssText = 'position:fixed;inset:0;z-index:970;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
      popup.innerHTML = `<div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;padding:20px;max-width:500px;width:90%;">
        <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;">
          <img src="${spriteUrl}" style="width:96px;height:96px;object-fit:contain;" onerror="this.style.display='none'">
          <div>
            <div style="color:#fff;font-size:18px;font-weight:700;">${offer.pokemon_name}${offer.is_shiny ? ' <span style="color:#ffd700">Shiny</span>' : ''}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:12px;">Nivel ${level} | ${offer.types || ''}</div>
            <div style="color:rgba(255,255,255,0.3);font-size:10px;">Nature: ${offer.nature || 'hardy'} | ${abilityName}</div>
            <div style="color:#4ecdc4;font-size:18px;font-weight:700;margin-top:8px;">${offer.price.toLocaleString()} ${currencyLabel}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:12px;">
          <div>HP: ${hpStat(pokemonData?.hp||0, offer.iv_hp, offer.ev_hp, level)} (IV:${offer.iv_hp})</div>
          <div>ATK: ${calcStat(pokemonData?.attack||0, offer.iv_attack, offer.ev_attack, level)} (IV:${offer.iv_attack})</div>
          <div>DEF: ${calcStat(pokemonData?.defense||0, offer.iv_defense, offer.ev_defense, level)} (IV:${offer.iv_defense})</div>
          <div>SPA: ${calcStat(pokemonData?.spAtk||0, offer.iv_sp_atk, offer.ev_sp_atk, level)} (IV:${offer.iv_sp_atk})</div>
          <div>SPD: ${calcStat(pokemonData?.spDef||0, offer.iv_sp_def, offer.ev_sp_def, level)} (IV:${offer.iv_sp_def})</div>
          <div>SPE: ${calcStat(pokemonData?.speed||0, offer.iv_speed, offer.ev_speed, level)} (IV:${offer.iv_speed})</div>
        </div>
        <button id="auction-buy-btn" style="width:100%;padding:10px;border-radius:8px;border:none;background:#238636;color:#fff;cursor:pointer;font-size:14px;font-weight:700;">Comprar por ${offer.price.toLocaleString()} ${currencyLabel}</button>
        <button style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid #30363d;background:#1c2333;color:#fff;cursor:pointer;font-size:12px;" onclick="this.parentElement.parentElement.remove()">Fechar</button>
      </div>`;
      document.body.appendChild(popup);

      popup.querySelector('#auction-buy-btn').onclick = async () => {
        try {
          const { data, error } = await window.db.rpc('auction_buy_offer', {
            p_character_id: window.GameData.currentCharacterId,
            p_offer_id: offerId
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          if (data?.success) {
            const where = data.stored_in_pc ? ' (enviado ao PC)' : ' (adicionado ao time)';
            alert(`${offer.pokemon_name} comprado com sucesso!${where}`);
            popup.remove();
            this.loadOffers();
            if (window.pokefury?.updatePartyPanel) window.pokefury.updatePartyPanel();
            if (window.game?.refreshCurrencies) window.game.refreshCurrencies();
          }
        } catch (e) {
          alert('Erro: ' + (e.message || 'Falha na compra'));
        }
      };
    },

    renderMyOffers() {
      const list = document.getElementById('auction-my-offers-list');
      if (!list) return;
      if (!this.myOffers || this.myOffers.length === 0) {
        list.innerHTML = '<div style="color:rgba(255,255,255,0.2);font-size:11px;">Nenhum pokemon a venda no momento.</div>';
        return;
      }
      list.innerHTML = this.myOffers.map(o => {
        const currencyLabel = o.currency_type === 'silver' ? 'Prata' : o.currency_type === 'gold' ? 'Ouro' : 'Diamante';
        return `<div style="display:flex;align-items:center;gap:8px;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:6px 10px;margin-bottom:4px;">
          <span style="color:#fff;font-size:12px;flex:1;">${o.pokemon_name} Nv.${o.level}</span>
          <span style="color:#4ecdc4;font-size:11px;font-weight:600;">${o.price.toLocaleString()} ${currencyLabel}</span>
          <button onclick="window.Auction.cancelOffer('${o.id}')" style="padding:4px 10px;border-radius:6px;border:1px solid #f44336;background:rgba(244,67,54,0.15);color:#f44336;cursor:pointer;font-size:11px;">Cancelar</button>
        </div>`;
      }).join('');
    },

    async cancelOffer(offerId) {
      try {
        const { data, error } = await window.db.rpc('auction_cancel_offer', {
          p_character_id: window.GameData.currentCharacterId,
          p_offer_id: offerId
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.success) {
          alert(`${data.pokemon_name} foi devolvido ao seu time/PC!`);
          this.loadOffers();
          this.loadMyOffers();
          if (window.pokefury?.updatePartyPanel) window.pokefury.updatePartyPanel();
        }
      } catch (e) {
        alert('Erro: ' + (e.message || 'Falha ao cancelar'));
      }
    }
  };

  window.Auction = Auction;
})();
