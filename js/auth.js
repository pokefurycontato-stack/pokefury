document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initAuth();
});

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.width = particle.style.height = Math.random() * 4 + 1 + 'px';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = Math.random() * 10 + 10 + 's';
        container.appendChild(particle);
    }
}

function initAuth() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const indicator = document.querySelector('.auth-tab-indicator');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            forms.forEach(f => f.classList.remove('active'));
            document.getElementById(target + '-form').classList.add('active');
            indicator.style.transform = target === 'register' ? 'translateX(100%)' : 'translateX(0)';
        });
    });

    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    document.getElementById('reg-password').addEventListener('input', (e) => {
        updatePasswordStrength(e.target.value);
    });

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleRegister();
    });
}

function updatePasswordStrength(password) {
    const fill = document.querySelector('.strength-fill');
    const text = document.querySelector('.strength-text');
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const levels = [
        { width: '0%', color: '#333', label: '' },
        { width: '20%', color: '#f44336', label: 'Muito fraca' },
        { width: '40%', color: '#ff9800', label: 'Fraca' },
        { width: '60%', color: '#ffeb3b', label: 'Média' },
        { width: '80%', color: '#8bc34a', label: 'Forte' },
        { width: '100%', color: '#4caf50', label: 'Muito forte' }
    ];
    const level = levels[strength];
    fill.style.width = level.width;
    fill.style.background = level.color;
    text.textContent = level.label;
}

function showError(formId, message) {
    const errorEl = document.getElementById(formId + '-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 6000);
}

async function handleLogin() {
    if (!window.db) {
        showError('login', 'Supabase não conectado.');
        return;
    }
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) {
        showError('login', 'Preencha todos os campos.');
        return;
    }
    const { data, error } = await window.db.auth.signInWithPassword({
        email: username,
        password: password
    });
    if (error) {
        showError('login', error.message.includes('Invalid') ? 'Conta não encontrada ou senha incorreta.' : 'Erro: ' + error.message);
        return;
    }
    window.GameData.setUserId(data.user.id);
    goToCharacterScreen();
}

async function handleRegister() {
    if (!window.db) {
        showError('register', 'Supabase não conectado.');
        return;
    }
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!username || !email || !password || !confirm) { showError('register', 'Preencha todos os campos.'); return; }
    if (username.length < 3) { showError('register', 'Nome deve ter no mínimo 3 caracteres.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('register', 'E-mail inválido.'); return; }
    if (password.length < 6) { showError('register', 'Senha deve ter no mínimo 6 caracteres.'); return; }
    if (password !== confirm) { showError('register', 'As senhas não coincidem.'); return; }

    const { data, error } = await window.db.auth.signUp({
        email: email,
        password: password,
        options: { data: { username: username, display_email: email } }
    });
    if (error) {
        showError('register', error.message.includes('already') ? 'Este nome de treinador já existe.' : 'Erro: ' + error.message);
        return;
    }
    if (data.user) {
        await window.db.from('profiles').upsert({ id: data.user.id, username, display_email: email }, { onConflict: 'id' }).catch(() => {});
    }
    window.GameData.setUserId(data.user.id);
    goToCharacterScreen();
}

const TYPE_COLORS = { normal:'#A8A878', fire:'#F08030', water:'#6890F0', electric:'#F8D030', grass:'#78C850', ice:'#98D8D8', fighting:'#C03028', poison:'#A040A0', ground:'#E0C068', flying:'#A890F0', psychic:'#F85888', bug:'#A8B820', rock:'#B8A038', ghost:'#705898', dragon:'#7038F8', dark:'#705848', steel:'#B8B8D0', fairy:'#EE99AC' };

function goToCharacterScreen() {
    const authScreen = document.getElementById('auth-screen');
    const charScreen = document.getElementById('character-screen');
    authScreen.classList.add('fade-out');
    setTimeout(() => {
        authScreen.classList.add('hidden');
        charScreen.classList.remove('hidden');
        charScreen.classList.add('fade-in');
        loadCharacterScreen();
    }, 500);
}

async function loadCharacterScreen() {
    const charSelect = document.getElementById('char-select');
    const charCreate = document.getElementById('char-create');

    document.getElementById('btn-new-character').onclick = () => {
        showCreatePanel();
    };

    document.getElementById('btn-logout-char').onclick = async () => {
        await window.db.auth.signOut();
        location.reload();
    };

    document.getElementById('btn-start-adventure').onclick = () => {
        createCharacter();
    };

    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) {
            showCreatePanel();
            return;
        }

        const { data: saves } = await window.db
            .from('game_saves')
            .select('*')
            .eq('user_id', user.id);

        if (!saves || saves.length === 0 || !saves[0].starter_pokemon) {
            showCreatePanel();
            return;
        }

        const save = saves[0];
        charSelect.classList.remove('hidden');
        charCreate.classList.add('hidden');

        const list = document.getElementById('char-list');
        list.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'char-card';

        let spriteHtml = '<div class="char-card-sprite-placeholder">?</div>';
        try {
            const pokeData = await window.PokeAPI.ensurePokemon(save.starter_pokemon);
            const spriteUrl = pokeData.spriteUrls?.front || pokeData.spriteUrls?.home || pokeData.spriteUrls?.official;
            if (spriteUrl) {
                await window.PokeAPI.preloadSprite(spriteUrl);
                const img = window.PokeAPI.imageCache[spriteUrl];
                if (img && img.complete) {
                    spriteHtml = `<img src="${spriteUrl}" class="char-card-sprite" alt="${pokeData.name}">`;
                }
            }
        } catch (e) {
            console.warn('[PokeFury] Sprite load error:', e);
        }

        let typeBadges = '';
        try {
            const pokeData = await window.PokeAPI.ensurePokemon(save.starter_pokemon);
            typeBadges = (pokeData.types || []).map(t =>
                `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t] || '#686868'}">${t}</span>`
            ).join('');
        } catch (e) {}

        card.innerHTML = `
            ${spriteHtml}
            <div class="char-card-info">
                <div class="char-card-name">${save.player_name || 'Treinador'}</div>
                <div class="char-card-meta">Starter: ${save.starter_pokemon}</div>
                <div class="char-card-types">${typeBadges}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            if (window.pokefury) {
                window.pokefury.loadCharacter(save);
            } else {
                console.error('[PokeFury] Game não pronto');
            }
        });

        list.appendChild(card);

    } catch (e) {
        console.error('[PokeFury] Erro ao carregar personagem:', e);
        showCreatePanel();
    }
}

function showCreatePanel() {
    document.getElementById('char-select').classList.add('hidden');
    document.getElementById('char-create').classList.remove('hidden');

    const avatarGrid = document.getElementById('avatar-grid');
    avatarGrid.innerHTML = '';

    const genderGrid = document.createElement('div');
    genderGrid.className = 'char-gender-grid';
    genderGrid.innerHTML = `
        <div class="gender-card selected" data-gender="male">
            <div class="gender-icon">M</div>
            <div class="gender-label">Masculino</div>
        </div>
        <div class="gender-card" data-gender="female">
            <div class="gender-icon">F</div>
            <div class="gender-label">Feminino</div>
        </div>
    `;
    avatarGrid.appendChild(genderGrid);

    genderGrid.querySelectorAll('.gender-card').forEach(card => {
        card.addEventListener('click', () => {
            genderGrid.querySelectorAll('.gender-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            if (window.pokefury) window.pokefury.playerGender = card.dataset.gender;
        });
    });

    const starterGrid = document.getElementById('starter-grid');
    starterGrid.innerHTML = '';

    const starters = (window.pokefury && window.pokefury.starterDataCache) ? window.pokefury.starterDataCache : [];
    if (starters.length === 0) {
        starterGrid.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:20px;">Carregando Pokémon iniciais...</p>';
        return;
    }

    starters.forEach((poke, i) => {
        const card = document.createElement('div');
        card.className = 'starter-card';
        card.dataset.species = poke.species;
        const spriteUrl = poke.spriteUrls?.front || poke.spriteUrls?.home || poke.spriteUrls?.official;
        const typeBadges = poke.types.map(t =>
            `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t] || '#686868'}">${t}</span>`
        ).join('');
        card.innerHTML = `
            <img src="${spriteUrl}" class="starter-sprite" alt="${poke.name}">
            <div class="starter-name">${poke.name}</div>
            <div class="starter-types">${typeBadges}</div>
        `;
        card.addEventListener('click', () => {
            starterGrid.querySelectorAll('.starter-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
        if (i === 0) card.classList.add('selected');
        starterGrid.appendChild(card);
    });
}

async function createCharacter() {
    const nameInput = document.getElementById('char-name');
    const name = nameInput.value.trim();
    if (!name || name.length < 2) {
        nameInput.style.borderColor = '#f44336';
        return;
    }
    nameInput.style.borderColor = '';

    const selectedCard = document.querySelector('#starter-grid .starter-card.selected');
    if (!selectedCard) {
        alert('Escolha um Pokémon inicial!');
        return;
    }

    const species = selectedCard.dataset.species;
    const { data: { user } } = await window.db.auth.getUser();
    if (!user) return;

    const { error } = await window.db.from('game_saves').upsert({
        user_id: user.id,
        player_name: name,
        starter_pokemon: species
    }, { onConflict: 'user_id' });

    if (error) {
        console.error('[PokeFury] Erro ao salvar:', error);
        alert('Erro ao salvar: ' + error.message);
        return;
    }

    try {
        await window.db.from('game_saves').update({ player_gender: 'male' }).eq('user_id', user.id);
    } catch (e) {}

    if (window.pokefury) {
        window.pokefury.playerName = name;
        window.pokefury.startGame(species);
    } else {
        console.error('[PokeFury] Game não pronto');
    }
}
