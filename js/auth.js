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

const SUPABASE_URL = 'https://odevwnnpzsoltbrrjdts.supabase.co';
const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public`;

const ALL_STARTER_IDS = [
    1, 4, 7,
    152, 155, 158,
    252, 255, 258,
    387, 390, 393,
    495, 498, 501,
    650, 653, 656,
    722, 725, 728,
    810, 813, 816,
    906, 909, 912
];

const STARTER_GEN_LABELS = {
    1: 'Kanto', 4: 'Kanto', 7: 'Kanto',
    152: 'Johto', 155: 'Johto', 158: 'Johto',
    252: 'Hoenn', 255: 'Hoenn', 258: 'Hoenn',
    387: 'Sinnoh', 390: 'Sinnoh', 393: 'Sinnoh',
    495: 'Unova', 498: 'Unova', 501: 'Unova',
    650: 'Kalos', 653: 'Kalos', 656: 'Kalos',
    722: 'Alola', 725: 'Alola', 728: 'Alola',
    810: 'Galar', 813: 'Galar', 816: 'Galar',
    906: 'Paldea', 909: 'Paldea', 912: 'Paldea'
};

const TRAINER_AVATARS_MALE = [
    'trainers/male-01.png', 'trainers/male-02.png', 'trainers/male-03.png',
    'trainers/male-04.png', 'trainers/male-05.png', 'trainers/male-06.png',
    'trainers/male-07.png', 'trainers/male-08.png', 'trainers/male-09.png',
    'trainers/male-10.png'
];

const TRAINER_AVATARS_FEMALE = [
    'trainers/female-01.png', 'trainers/female-02.png', 'trainers/female-03.png',
    'trainers/female-04.png', 'trainers/female-05.png', 'trainers/female-06.png',
    'trainers/female-07.png', 'trainers/female-08.png', 'trainers/female-09.png',
    'trainers/female-10.png'
];

const MAX_CHARACTERS = 10;

let selectedGender = 'male';
let selectedAvatarUrl = null;
let cachedStarters = null;

async function loadAllStarters() {
    if (cachedStarters) return cachedStarters;
    try {
        const promises = ALL_STARTER_IDS.map(id => window.PokeAPI.ensurePokemon(id));
        cachedStarters = await Promise.all(promises);
        return cachedStarters;
    } catch (e) {
        console.error('[PokeFury] Error loading starters:', e);
        return [];
    }
}

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
        const characters = await window.GameData.getCharacters();
        const validCharacters = characters.filter(c => c.starter_pokemon);

        if (validCharacters.length === 0) {
            showCreatePanel();
            return;
        }

        charSelect.classList.remove('hidden');
        charCreate.classList.add('hidden');

        const list = document.getElementById('char-list');
        list.innerHTML = '';

        const newCharBtn = document.getElementById('btn-new-character');
        if (validCharacters.length >= MAX_CHARACTERS) {
            newCharBtn.style.display = 'none';
        } else {
            newCharBtn.style.display = '';
        }

        for (const save of validCharacters) {
            const card = document.createElement('div');
            card.className = 'char-card';

            let avatarHtml = '<div class="char-card-sprite-placeholder">?</div>';
            if (save.avatar_url) {
                avatarHtml = `<img src="${save.avatar_url}" class="char-card-avatar" alt="${save.player_name}">`;
            } else {
                try {
                    const pokeData = await window.PokeAPI.ensurePokemon(save.starter_pokemon);
                    const spriteUrl = pokeData.spriteUrls?.front || pokeData.spriteUrls?.home || pokeData.spriteUrls?.official;
                    if (spriteUrl) {
                        await window.PokeAPI.preloadSprite(spriteUrl);
                        const img = window.PokeAPI.imageCache[spriteUrl];
                        if (img && img.complete) {
                            avatarHtml = `<img src="${spriteUrl}" class="char-card-sprite" alt="${pokeData.name}">`;
                        }
                    }
                } catch (e) {}
            }

            let typeBadges = '';
            try {
                const pokeData = await window.PokeAPI.ensurePokemon(save.starter_pokemon);
                typeBadges = (pokeData.types || []).map(t =>
                    `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t] || '#686868'}">${t}</span>`
                ).join('');
            } catch (e) {}

            const genderIcon = save.player_gender === 'female' ? '♀' : '♂';
            const genderColor = save.player_gender === 'female' ? '#e94560' : '#3498db';

            card.innerHTML = `
                ${avatarHtml}
                <div class="char-card-info">
                    <div class="char-card-name">${save.player_name || 'Treinador'} <span style="color:${genderColor};font-size:14px;">${genderIcon}</span></div>
                    <div class="char-card-meta">Starter: ${save.starter_pokemon}</div>
                    <div class="char-card-types">${typeBadges}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                window.GameData.setCurrentCharacter(save.id);
                if (window.pokefury) {
                    window.pokefury.loadCharacter(save);
                } else {
                    console.error('[PokeFury] Game não pronto');
                }
            });

            list.appendChild(card);
        }

    } catch (e) {
        console.error('[PokeFury] Erro ao carregar personagens:', e);
        showCreatePanel();
    }
}

async function showCreatePanel() {
    document.getElementById('char-select').classList.add('hidden');
    document.getElementById('char-create').classList.remove('hidden');

    const charCountEl = document.getElementById('char-count');
    if (charCountEl) {
        const chars = await window.GameData.getCharacters();
        charCountEl.textContent = `${chars.length} / ${MAX_CHARACTERS} personagens`;
    }

    selectedGender = 'male';
    selectedAvatarUrl = null;

    renderAvatarGrid('male');
    renderStarterGrid();
}

function renderAvatarGrid(gender) {
    const avatarGrid = document.getElementById('avatar-grid');
    avatarGrid.innerHTML = '';

    const genderRow = document.createElement('div');
    genderRow.className = 'char-gender-grid';
    genderRow.innerHTML = `
        <div class="gender-card ${gender === 'male' ? 'selected' : ''}" data-gender="male">
            <div class="gender-icon">♂</div>
            <div class="gender-label">Masculino</div>
        </div>
        <div class="gender-card ${gender === 'female' ? 'selected' : ''}" data-gender="female">
            <div class="gender-icon">♀</div>
            <div class="gender-label">Feminino</div>
        </div>
    `;
    avatarGrid.appendChild(genderRow);

    genderRow.querySelectorAll('.gender-card').forEach(card => {
        card.addEventListener('click', () => {
            genderRow.querySelectorAll('.gender-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedGender = card.dataset.gender;
            selectedAvatarUrl = null;
            loadAvatarOptions(card.dataset.gender);
        });
    });

    loadAvatarOptions(gender);
}

function loadAvatarOptions(gender) {
    const avatarGrid = document.getElementById('avatar-grid');
    const existingGrid = avatarGrid.querySelector('.avatar-options-grid');
    if (existingGrid) existingGrid.remove();

    const avatarList = gender === 'female' ? TRAINER_AVATARS_FEMALE : TRAINER_AVATARS_MALE;

    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'avatar-options-grid';

    avatarList.forEach((path, i) => {
        const url = `${STORAGE_URL}/${path}`;
        const item = document.createElement('div');
        item.className = 'avatar-option';
        item.dataset.url = url;
        item.innerHTML = `<img src="${url}" alt="Avatar ${i + 1}" onerror="this.parentElement.style.display='none'">`;

        item.addEventListener('click', () => {
            optionsGrid.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            item.classList.add('selected');
            selectedAvatarUrl = url;
        });

        optionsGrid.appendChild(item);
    });

    avatarGrid.appendChild(optionsGrid);
}

async function renderStarterGrid() {
    const starterGrid = document.getElementById('starter-grid');
    starterGrid.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:20px;">Carregando Pokémon iniciais...</p>';

    const starters = await loadAllStarters();

    starterGrid.innerHTML = '';

    const grouped = {};
    starters.forEach(poke => {
        const gen = STARTER_GEN_LABELS[poke.id] || 'Gen ?';
        if (!grouped[gen]) grouped[gen] = [];
        grouped[gen].push(poke);
    });

    for (const [gen, pokes] of Object.entries(grouped)) {
        const genHeader = document.createElement('div');
        genHeader.className = 'starter-gen-header';
        genHeader.textContent = gen;
        starterGrid.appendChild(genHeader);

        const genRow = document.createElement('div');
        genRow.className = 'starter-gen-row';

        pokes.forEach((poke, i) => {
            const card = document.createElement('div');
            card.className = 'starter-card';
            card.dataset.species = poke.species;
            const spriteUrl = poke.spriteUrls?.front || poke.spriteUrls?.home || poke.spriteUrls?.official;
            const typeBadges = poke.types.map(t =>
                `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t] || '#686868'}">${t}</span>`
            ).join('');
            card.innerHTML = `
                <img src="${spriteUrl}" class="starter-sprite" alt="${poke.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><text y=%2240%22 x=%2210%22 font-size=%2230%22>?</text></svg>'">
                <div class="starter-name">${poke.name}</div>
                <div class="starter-types">${typeBadges}</div>
            `;
            card.addEventListener('click', () => {
                starterGrid.querySelectorAll('.starter-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
            genRow.appendChild(card);
        });

        starterGrid.appendChild(genRow);
    }

    const firstCard = starterGrid.querySelector('.starter-card');
    if (firstCard) firstCard.classList.add('selected');
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

    const newChar = await window.GameData.createCharacter({
        playerName: name,
        starterPokemon: species,
        playerGender: selectedGender,
        avatarUrl: selectedAvatarUrl
    });

    if (!newChar) {
        alert('Erro ao criar personagem.');
        return;
    }

    window.GameData.setCurrentCharacter(newChar.id);

    if (window.pokefury) {
        window.pokefury.playerName = name;
        window.pokefury.playerGender = selectedGender;
        window.pokefury.avatarUrl = selectedAvatarUrl;
        window.pokefury.startGame(species);
    } else {
        console.error('[PokeFury] Game não pronto');
    }
}
