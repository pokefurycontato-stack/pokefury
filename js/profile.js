/* =============================================================
   profile.js — Tela de Perfil do personagem
   Renderiza os elementos sobre a imagem perfil.png nas posições
   configuradas pelo admin (profile_layout).
   ============================================================= */

const PROFILE_ELEMENTS = [
  { key: 'sprite',     label: 'Foto do Sprite' },
  { key: 'name',       label: 'Nome' },
  { key: 'level',      label: 'Nível' },
  { key: 'silver',     label: 'Prata' },
  { key: 'gold',       label: 'Ouro' },
  { key: 'diamond',    label: 'Diamante' },
  { key: 'badges',     label: 'Insígnias' },
  { key: 'badgesPrev', label: 'Insígnias ◀ (região anterior)' },
  { key: 'badgesNext', label: 'Insígnias ▶ (próxima região)' },
  { key: 'title1',      label: 'Titulo 1' },
  { key: 'title2',      label: 'Titulo 2' },
  { key: 'title3',      label: 'Titulo 3' },
  { key: 'title4',      label: 'Titulo 4' },
  { key: 'title5',      label: 'Titulo 5' },
  { key: 'titlesMore',  label: 'Botao mais titulos (+)' },
  { key: 'benefits',    label: 'Beneficios' },
  { key: 'logout',      label: 'Sair da conta' },
  { key: 'switchChar',  label: 'Trocar de personagem' },
  { key: 'closeBtn',    label: 'Fechar perfil (X)' }
];

const PROFILE_BOOST_LABELS = {
  'vip': 'VIP',
  'center_anywhere': 'Centro Pokémon Portátil',
  'exp_pokemon': 'Boost de EXP de Pokémon',
  'exp_trainer': 'Boost de EXP de Personagem',
  'shiny_boost': 'Boost de Encontrar Shiny',
  'legendary_boost': 'Boost de Encontrar Lendários'
};

const PROFILE_BOOST_ORDER = ['vip', 'center_anywhere', 'exp_pokemon', 'exp_trainer', 'shiny_boost', 'legendary_boost'];

class ProfileScreen {
  constructor() {
    this.isOpen = false;
    this.config = null;
    this.bgNatural = { w: 1, h: 1 };
    this.regions = [];
    this.regionIndex = 0;
  }

  async open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const screen = document.getElementById('profile-screen');
    if (!screen) return;
    screen.classList.remove('hidden');
    // Pausa o render da cidade (evita repaint que reinicia os GIFs)
    this._pauseCityForProfile();
    await this.loadConfig();
    await this.loadRegions();
    await this.render();
  }

  close() {
    this.isOpen = false;
    const screen = document.getElementById('profile-screen');
    if (screen) screen.classList.add('hidden');
    this._resumeCityAfterProfile();
  }

  _pauseCityForProfile() {
    const city = window.cityScreen;
    if (city && city.running) {
      this._cityWasRunning = true;
      city.running = false;
    }
    // Esconde os pokemons selvagens (GIFs) da cidade pra não reiniciar os GIFs do perfil
    const wildLayer = document.getElementById('city-wild-pokemon-layer');
    if (wildLayer) {
      this._wildLayerDisplay = wildLayer.style.display;
      wildLayer.style.display = 'none';
    }
  }

  _resumeCityAfterProfile() {
    const city = window.cityScreen;
    if (city && this._cityWasRunning && !city.running) {
      city.running = true;
      city.loop();
    }
    this._cityWasRunning = false;
    const wildLayer = document.getElementById('city-wild-pokemon-layer');
    if (wildLayer && this._wildLayerDisplay !== undefined) {
      wildLayer.style.display = this._wildLayerDisplay;
      this._wildLayerDisplay = undefined;
    }
  }

  async loadConfig() {
    let cfg = null;
    if (window.db) {
      try {
        const { data } = await window.db.from('profile_layout').select('config').eq('id', 1).maybeSingle();
        if (data && data.config && data.config.elements) cfg = data.config;
      } catch (e) { console.error('[Profile] loadConfig:', e); }
    }
    this.config = cfg || {
      bg: 'assets/ferramentas/perfil.png',
      elements: {
        sprite: {x:40,y:40,w:120,h:120}, name: {x:40,y:180,w:200,h:32}, level: {x:40,y:216,w:120,h:28},
        silver: {x:40,y:260,w:160,h:26}, gold: {x:40,y:292,w:160,h:26}, diamond: {x:40,y:324,w:160,h:26},
        badges: {x:40,y:380,w:260,h:120}, badgesPrev: {x:34,y:430,w:40,h:40}, badgesNext: {x:266,y:430,w:40,h:40},
        title1: {x:340,y:380,w:200,h:24}, title2: {x:340,y:406,w:200,h:24}, title3: {x:340,y:432,w:200,h:24},
        title4: {x:340,y:458,w:200,h:24}, title5: {x:340,y:484,w:200,h:24},
        titlesMore: {x:560,y:380,w:40,h:40}, benefits: {x:340,y:40,w:220,h:300},
        logout: {x:40,y:460,w:160,h:36}, switchChar: {x:40,y:500,w:160,h:36},
        closeBtn: {x:560,y:10,w:40,h:40}
      }
    };
  }

  async loadRegions() {
    this.regions = [];
    this.regionIndex = 0;
    if (!window.db) return;
    try {
      const { data, error } = await window.db.from('regions').select('id,name').order('sort_order', { ascending: true });
      if (!error && data) this.regions = data;
    } catch (e) { /* sem regiões */ }
  }

  async resolveSpriteUrl() {
    const game = window.pokefury;
    if (game?.avatarUrl) return game.avatarUrl;
    if (game?.currentCharacterId && window.db) {
      try {
        const { data } = await window.db.rpc('get_equipped_skin', {
          p_character_id: game.currentCharacterId,
          p_skin_type: 'player_skin'
        });
        if (data && data.length > 0 && data[0] && data[0].sprite_url) return data[0].sprite_url;
      } catch (e) { /* fallback */ }
    }
    const gender = game?.playerGender === 'female' ? 'feminino' : 'masculino';
    return `assets/perso_${gender}.webp`;
  }

  async getCurrencies() {
    if (window.GameData && window.GameData.getCurrencies) {
      try { return await window.GameData.getCurrencies(); } catch (e) { /* fallback */ }
    }
    return { diamonds: 0, gold: 0, silver: 0 };
  }

  getActiveBenefits() {
    const out = [];
    const bm = window.boostsManager;
    if (!bm || !bm.boosts) return out;
    for (const type of PROFILE_BOOST_ORDER) {
      if (bm.isActive(type)) {
        out.push({ type, label: PROFILE_BOOST_LABELS[type] || type, remaining: bm.getRemainingText(type) });
      }
    }
    return out;
  }

  async render() {
    console.log('[Profile] render() called');
    const game = window.pokefury;
    const stage = document.getElementById('profile-stage');
    const bg = document.getElementById('profile-bg');
    const els = document.getElementById('profile-elements');
    if (!stage || !bg || !els) return;
    const cfg = this.config || { bg: 'assets/ferramentas/perfil.png', elements: {} };

    bg.src = cfg.bg || 'assets/ferramentas/perfil.png';
    await new Promise((resolve) => {
      if (bg.complete && bg.naturalWidth) return resolve();
      bg.onload = resolve;
      bg.onerror = resolve;
    });
    this.bgNatural = { w: bg.naturalWidth || 1, h: bg.naturalHeight || 1 };

    const maxW = Math.min(window.innerWidth * 0.9, 900);
    const maxH = window.innerHeight * 0.85;
    let w = maxW;
    let h = (this.bgNatural.h / this.bgNatural.w) * w;
    if (h > maxH) { h = maxH; w = (this.bgNatural.w / this.bgNatural.h) * h; }
    stage.style.width = Math.round(w) + 'px';
    stage.style.height = Math.round(h) + 'px';

    const elems = cfg.elements || {};
    els.innerHTML = '';

    const name = game?.playerName || 'Treinador';
    const level = game?.trainerLevel || 1;
    const cur = await this.getCurrencies();
    const spriteUrl = await this.resolveSpriteUrl();
    const benefits = this.getActiveBenefits();
    const currentRegion = this.regions[this.regionIndex]?.name || '';
    const lastTitles = window.Titles ? await window.Titles.loadLastTitles(5) : [];

    const addEl = (key, innerHTML) => {
      const r = elems[key];
      if (!r) return;
      const d = document.createElement('div');
      d.className = 'pf-el';
      d.innerHTML = innerHTML;
      d.style.left = (r.x / this.bgNatural.w * 100) + '%';
      d.style.top = (r.y / this.bgNatural.h * 100) + '%';
      d.style.width = (r.w / this.bgNatural.w * 100) + '%';
      d.style.height = (r.h / this.bgNatural.h * 100) + '%';
      els.appendChild(d);
    };

    addEl('sprite', `<img class="pf-sprite" src="${spriteUrl}" alt="Sprite" style="width:100%;height:100%;object-fit:contain;">`);
    addEl('name', `<div class="pf-text pf-name" style="display:flex;align-items:center;justify-content:center;height:100%;color:#000;font-weight:700;">${escapeHtml(name)}</div>`);
    addEl('level', `<div class="pf-text" style="display:flex;align-items:center;justify-content:center;height:100%;color:#000;font-weight:600;">Nv. ${level}</div>`);
    addEl('silver', `<div class="pf-text pf-currency pf-silver" style="display:flex;align-items:center;justify-content:center;height:100%;color:#000;">${(cur.silver || 0).toLocaleString('pt-BR')}</div>`);
    addEl('gold', `<div class="pf-text pf-currency pf-gold" style="display:flex;align-items:center;justify-content:center;height:100%;color:#000;">${(cur.gold || 0).toLocaleString('pt-BR')}</div>`);
    addEl('diamond', `<div class="pf-text pf-currency pf-diamond" style="display:flex;align-items:center;justify-content:center;height:100%;color:#000;">${(cur.diamonds || 0).toLocaleString('pt-BR')}</div>`);

    addEl('badges', `<div class="pf-text pf-badges" style="display:flex;align-items:flex-start;justify-content:center;padding-top:4px;height:100%;color:#000;font-weight:600;">${escapeHtml(currentRegion)}</div>`);
    addEl('badgesPrev', `<button onclick="window.profileScreen.prevRegion()" style="width:100%;height:100%;background:none;border:none;cursor:pointer;"></button>`);
    addEl('badgesNext', `<button onclick="window.profileScreen.nextRegion()" style="width:100%;height:100%;background:none;border:none;cursor:pointer;"></button>`);

    for (let i = 1; i <= 5; i++) {
      const t = lastTitles[i - 1];
      let inner = '';
      if (t) {
        const style = window.Titles ? window.Titles.getRarityStyle(t.id) : { color: '#000', glow: 'none' };
        const isMythic = style.color === '#ff4d6d';
        inner = `<div class="pf-text pf-title-slot ${isMythic ? 'title-rainbow' : ''}" style="display:flex;align-items:center;justify-content:center;height:100%;font-weight:700;font-size:11px;color:${style.color};text-shadow:${isMythic ? '' : style.glow};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;">${escapeHtml(t.name)}</div>`;
      } else {
        inner = `<div class="pf-text pf-title-slot" style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(0,0,0,0.3);font-weight:500;"></div>`;
      }
      addEl('title' + i, inner);
    }
    addEl('titlesMore', `<button class="pf-btn" onclick="window.profileScreen.openTitles()" style="width:100%;height:100%;background:none;border:none;cursor:pointer;color:#fff;font-size:16px;">+</button>`);

    const benefitHtml = benefits.length
      ? benefits.map(b => `<div class="pf-benefit"><span>${escapeHtml(b.label)}</span><span class="pf-benefit-time">${escapeHtml(b.remaining)}</span></div>`).join('')
      : '';
    addEl('benefits', `<div class="pf-benefits">${benefitHtml}</div>`);

    addEl('logout', `<button onclick="window.profileScreen.logout()" style="width:100%;height:100%;background:none;border:none;cursor:pointer;"></button>`);
    addEl('switchChar', `<button onclick="window.profileScreen.switchCharacter()" style="width:100%;height:100%;background:none;border:none;cursor:pointer;"></button>`);
    addEl('closeBtn', `<button onclick="window.profileScreen.close()" style="width:100%;height:100%;background:none;border:none;cursor:pointer;"></button>`);

    this.renderTeam();
  }

  async renderTeam() {
    const list = document.getElementById('profile-team-list');
    if (!list) return;

    const game = window.pokefury;
    const team = game?.playerTeam || [];
    const sig = JSON.stringify(team.map(p => p ? [p.id, p.currentHp, p.heldItemId, p.level, p.fainted] : null));
    if (sig === this._teamSig && list.dataset.rendered === '1') {
      console.log('[Profile] renderTeam SKIP (unchanged)');
      return;
    }
    console.log('[Profile] renderTeam RENDER, sig changed:', sig !== this._teamSig ? 'yes' : 'no');
    this._teamSig = sig;
    list.dataset.rendered = '1';

    list.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">Carregando...</div>';
    try {
      if (!team.length) {
        list.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">Nenhum pokemon no time</div>';
        return;
      }
      list.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        const p = team[i];
        const slot = document.createElement('div');
        slot.style.cssText = 'display:flex;align-items:flex-start;gap:6px;padding:4px;margin-bottom:3px;border-radius:6px;background:rgba(255,255,255,0.05);';
        if (p && p.fainted) slot.style.opacity = '0.45';

        if (p) {
          const staticUrl = p.spriteUrls?.front || p.spriteUrls?.home || p.spriteUrls?.official || '';
          let spriteUrl = staticUrl;
          if (window.PokeAPI && p.id) {
            const blobUrl = await window.PokeAPI.getGifBlobUrl(p.id);
            spriteUrl = blobUrl || window.PokeAPI.getAnimatedFrontUrl(p.id) || staticUrl;
          }
          const hpPct = p.stats?.hp > 0 ? (p.currentHp / p.stats.hp) * 100 : 0;
          const hpColor = hpPct <= 25 ? '#f44336' : hpPct <= 50 ? '#ff9800' : '#4caf50';

          let itemIconHtml = '';
          if (p.heldItemId) {
            const itemData = window.ALL_ITEMS ? window.ALL_ITEMS.find(it => it.id === p.heldItemId) : null;
            const itemSprite = itemData?.sprite || '';
            if (itemSprite) {
              itemIconHtml = `<img src="${itemSprite}" style="position:absolute;bottom:0;right:0;width:16px;height:16px;border-radius:3px;background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.3);object-fit:contain;z-index:2" title="${itemData?.name || 'Item equipado'}">`;
            } else {
              itemIconHtml = `<div style="position:absolute;bottom:0;right:0;width:16px;height:16px;border-radius:3px;background:rgba(233,69,96,0.8);display:flex;align-items:center;justify-content:center;font-size:9px;z-index:2" title="Item equipado">📦</div>`;
            }
          }

          slot.innerHTML = `
            <div style="position:relative;width:44px;height:44px;flex-shrink:0;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);">
                <img src="assets/pokeballsil.png" style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:22px;height:22px;opacity:0.3" alt="">
                <img src="${spriteUrl}" data-static="${staticUrl}" style="position:absolute;top:2px;left:50%;margin-left:-19px;width:38px;height:38px;image-rendering:pixelated" alt="${p.name}" onerror="if(this.dataset.static && this.src !== this.dataset.static){this.src=this.dataset.static;}else{this.style.display='none'}">
                ${itemIconHtml}
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
                <div style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name} <span style="opacity:0.4">Lv${p.level}</span></div>
                <div style="width:100%;height:8px;background:rgba(0,0,0,0.6);border-radius:4px;overflow:hidden"><div style="height:100%;border-radius:4px;width:${hpPct}%;background:${hpColor}"></div></div>
                <div style="font-family:Inter,sans-serif;font-size:9px;color:rgba(255,255,255,0.7);line-height:1">HP ${p.currentHp || 0}/${p.stats?.hp || 0}</div>
            </div>`;
        } else {
          slot.innerHTML = `
            <div style="position:relative;width:44px;height:44px;flex-shrink:0;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15)">
                <img src="assets/pokeballsil.png" style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:22px;height:22px;opacity:0.3" alt="">
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:rgba(255,255,255,0.3)">Vazio</div>
            </div>`;
        }
        list.appendChild(slot);
      }
    } catch (e) {
      list.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">Erro ao carregar time</div>';
    }
  }

  prevRegion() {
    if (this.regions.length === 0) return;
    this.regionIndex = (this.regionIndex - 1 + this.regions.length) % this.regions.length;
    this.updateBadges();
  }

  nextRegion() {
    if (this.regions.length === 0) return;
    this.regionIndex = (this.regionIndex + 1) % this.regions.length;
    this.updateBadges();
  }

  updateBadges() {
    const els = document.getElementById('profile-elements');
    if (!els) return;
    const badgeEls = els.querySelectorAll('.pf-badges');
    const regionName = this.regions[this.regionIndex]?.name || '';
    badgeEls.forEach(el => { el.textContent = regionName; });
  }

  openTitles() {
    if (window.Titles) window.Titles.openTitlesPopup();
  }

  logout() {
    this.close();
    if (window.pokefury?.signOut) window.pokefury.signOut();
    else if (window.db?.auth?.signOut) window.db.auth.signOut();
    localStorage.removeItem('pokefury_session');
    location.reload();
  }

  async switchCharacter() {
    this.close();
    const userId = window.GameData?.userId || window.db?.auth?.user()?.data?.user?.id;
    if (!userId || !window.db) return;
    const { data: characters } = await window.db.from('game_saves').select('*').eq('user_id', userId);
    const allChars = (characters || []).filter(c => c && c.starter_pokemon);
    const currentId = window.GameData?.currentCharacterId;
    this._showCharList(allChars, currentId, userId);
  }

  _showCharList(allChars, currentId, userId) {
    const existing = document.getElementById('switch-char-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'switch-char-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;';
    let cardsHtml = allChars.map(c => {
      const isCurrent = c.id === currentId;
      return `
      <div class="switch-char-card" data-id="${c.id}" style="background:${isCurrent ? '#1a2332' : '#161b22'}border:2px solid ${isCurrent ? '#38bdf8' : '#30363d'};border-radius:12px;padding:16px;cursor:${isCurrent ? 'default' : 'pointer'};text-align:center;min-width:150px;max-width:180px;flex:1;opacity:${isCurrent ? '0.6' : '1'};transition:border-color 0.2s;">
        ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;margin-bottom:8px;">` : `<div style="width:70px;height:70px;border-radius:50%;background:#30363d;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:28px;">?</div>`}
        <div style="color:#fff;font-weight:700;font-size:13px;">${escapeHtml(c.player_name)}</div>
        <div style="color:rgba(255,255,255,0.5);font-size:11px;">Nv. ${c.trainer_level || 1} ${isCurrent ? '(atual)' : ''}</div>
      </div>`;
    }).join('');
    overlay.innerHTML = `
      <div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;padding:24px;max-width:700px;width:100%;">
        <div style="color:#fff;font-size:18px;font-weight:700;text-align:center;margin-bottom:16px;">Trocar de Personagem</div>
        <div id="switch-char-list" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:16px;">${cardsHtml}</div>
        <div style="text-align:center;display:flex;gap:10px;justify-content:center;">
          <button id="switch-char-new" style="padding:8px 20px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:700;">+ Novo Personagem</button>
          <button id="switch-char-cancel" style="padding:8px 20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;cursor:pointer;font-size:13px;">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.switch-char-card').forEach(card => {
      if (card.style.cursor === 'default') return;
      card.addEventListener('mouseenter', () => { if (card.style.cursor === 'pointer') card.style.borderColor = '#38bdf8'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = '#30363d'; });
      card.addEventListener('click', async () => {
        overlay.remove();
        const save = allChars.find(c => String(c.id) === String(card.dataset.id));
        if (save && window.pokefury) {
          window.GameData?.setCurrentCharacter?.(save.id);
          window.pokefury.currentCharacterId = save.id;
          await window.pokefury.loadCharacter(save);
          window.location.reload();
        }
      });
    });
    document.getElementById('switch-char-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('switch-char-new').addEventListener('click', () => {
      overlay.remove();
      this._showCreateChar(userId);
    });
  }

  async _showCreateChar(userId) {
    const STORAGE_BASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public';
    const AVATARS_MALE = ['trainers/red.png','trainers/ethan.png','trainers/brendan.png','trainers/hilbert.png','trainers/calem.png','trainers/elio.png','trainers/victor.png','trainers/brendan-masters.png','trainers/ash.png','trainers/n.png'];
    const AVATARS_FEMALE = ['trainers/lyra.png','trainers/may.png','trainers/dawn.png','trainers/serena.png','trainers/selene.png','trainers/gloria.png','trainers/akari.png','trainers/dawn-masters.png','trainers/serena-masters.png','trainers/korrina.png'];
    const overlay = document.createElement('div');
    overlay.id = 'switch-char-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;padding:24px;max-width:700px;width:100%;">
        <div style="color:#fff;font-size:18px;font-weight:700;text-align:center;margin-bottom:16px;">Novo Personagem</div>
        <div style="margin-bottom:12px;">
          <label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px;">Nome do Treinador</label>
          <input id="sc-char-name" type="text" maxlength="20" placeholder="Nome..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #30363d;background:#161b22;color:#fff;font-size:14px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px;">Gênero</label>
          <div style="display:flex;gap:8px;">
            <button class="sc-gender-btn selected" data-gender="male" style="flex:1;padding:8px;border-radius:8px;border:2px solid #38bdf8;background:#1a2332;color:#fff;cursor:pointer;font-size:13px;">Masculino</button>
            <button class="sc-gender-btn" data-gender="female" style="flex:1;padding:8px;border-radius:8px;border:2px solid #30363d;background:#161b22;color:#fff;cursor:pointer;font-size:13px;">Feminino</button>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px;">Avatar</label>
          <div id="sc-avatar-grid" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        </div>
        <div style="margin-bottom:16px;">
          <label style="color:rgba(255,255,255,0.6);font-size:12px;display:block;margin-bottom:4px;">Pokémon Inicial</label>
          <div id="sc-starter-grid" style="display:flex;flex-wrap:wrap;gap:6px;max-height:200px;overflow-y:auto;padding:4px;"></div>
        </div>
        <div style="text-align:center;display:flex;gap:10px;justify-content:center;">
          <button id="sc-create-btn" style="padding:8px 20px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:700;">Criar Personagem</button>
          <button id="sc-back-btn" style="padding:8px 20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;cursor:pointer;font-size:13px;">Voltar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    let selectedGender = 'male';
    let selectedStarter = null;
    let selectedAvatarUrl = null;
    const renderAvatars = (gender) => {
      const grid = document.getElementById('sc-avatar-grid');
      grid.innerHTML = '';
      selectedAvatarUrl = null;
      const list = gender === 'female' ? AVATARS_FEMALE : AVATARS_MALE;
      list.forEach((path, i) => {
        const url = `${STORAGE_BASE_URL}/${path}`;
        const item = document.createElement('div');
        item.style.cssText = 'width:50px;height:50px;border-radius:50%;border:2px solid #30363d;cursor:pointer;overflow:hidden;transition:border-color 0.2s;';
        item.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'">`;
        item.addEventListener('click', () => {
          grid.querySelectorAll('div').forEach(o => { o.style.borderColor = '#30363d'; });
          item.style.borderColor = '#38bdf8';
          selectedAvatarUrl = url;
        });
        grid.appendChild(item);
      });
    };
    renderAvatars('male');
    overlay.querySelectorAll('.sc-gender-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.sc-gender-btn').forEach(b => { b.classList.remove('selected'); b.style.borderColor = '#30363d'; b.style.background = '#161b22'; });
        btn.classList.add('selected'); btn.style.borderColor = '#38bdf8'; btn.style.background = '#1a2332';
        selectedGender = btn.dataset.gender;
        renderAvatars(btn.dataset.gender);
      });
    });
    const starterGrid = document.getElementById('sc-starter-grid');
    starterGrid.innerHTML = '<p style="color:rgba(255,255,255,0.4);width:100%;text-align:center;">Carregando...</p>';
    try {
      const starters = typeof loadAllStarters === 'function' ? await loadAllStarters() : [];
      starterGrid.innerHTML = '';
      starters.forEach(poke => {
        const card = document.createElement('div');
        card.style.cssText = 'background:#161b22;border:2px solid #30363d;border-radius:8px;padding:6px;cursor:pointer;text-align:center;width:70px;';
        const spriteUrl = poke.spriteUrls?.front || poke.spriteUrls?.home || '';
        card.innerHTML = `<img src="${spriteUrl}" style="width:40px;height:40px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><text y=%2228%22 x=%228%22 font-size=%2220%22>?</text></svg>'"><div style="color:#fff;font-size:10px;margin-top:2px;">${escapeHtml(poke.name)}</div>`;
        card.addEventListener('click', () => {
          starterGrid.querySelectorAll('div').forEach(c => { c.style.borderColor = '#30363d'; });
          card.style.borderColor = '#38bdf8';
          selectedStarter = poke.species || poke.name;
        });
        starterGrid.appendChild(card);
      });
    } catch (e) {
      starterGrid.innerHTML = '<p style="color:rgba(255,255,255,0.4);width:100%;text-align:center;">Erro ao carregar</p>';
    }
    document.getElementById('sc-back-btn').addEventListener('click', async () => {
      overlay.remove();
      const { data: characters } = await window.db.from('game_saves').select('*').eq('user_id', userId);
      this._showCharList((characters || []).filter(c => c && c.starter_pokemon), window.GameData?.currentCharacterId, userId);
    });
    document.getElementById('sc-create-btn').addEventListener('click', async () => {
      const name = document.getElementById('sc-char-name').value.trim();
      if (!name || name.length < 2) { document.getElementById('sc-char-name').style.borderColor = '#f44336'; return; }
      if (!selectedStarter) { alert('Escolha um Pokémon inicial!'); return; }
      const newChar = await window.GameData.createCharacter({
        playerName: name,
        starterPokemon: selectedStarter,
        playerGender: selectedGender,
        avatarUrl: selectedAvatarUrl
      });
      if (!newChar) { alert('Erro ao criar personagem.'); return; }
      overlay.remove();
      window.GameData?.setCurrentCharacter?.(newChar.id);
      window.location.reload();
    });
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.profileScreen = new ProfileScreen();
