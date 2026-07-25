document.addEventListener('DOMContentLoaded', async () => {
    createParticles();
    initAuth();
});

function createParticles() {
    const container = document.getElementById('particles');
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

    const email = username;

    console.log('[PokeFury] Tentando login com:', email);

    const { data, error } = await window.db.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error('[PokeFury] Erro no login:', error.message);
        if (error.message.includes('Invalid login') || error.message.includes('invalid')) {
            showError('login', 'Conta não encontrada ou senha incorreta.');
        } else {
            showError('login', 'Erro: ' + error.message);
        }
        return;
    }

    console.log('[PokeFury] Login sucesso:', data.user.id);
    window.GameData.setUserId(data.user.id);
    showGame({ username, email: data.user.email, id: data.user.id });
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

    if (!username || !email || !password || !confirm) {
        showError('register', 'Preencha todos os campos.');
        return;
    }

    if (username.length < 3) {
        showError('register', 'Nome deve ter no mínimo 3 caracteres.');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('register', 'E-mail inválido.');
        return;
    }

    if (password.length < 6) {
        showError('register', 'Senha deve ter no mínimo 6 caracteres.');
        return;
    }

    if (password !== confirm) {
        showError('register', 'As senhas não coincidem.');
        return;
    }

    const authEmail = email;

    console.log('[PokeFury] Tentando registrar:', authEmail);

    const { data, error } = await window.db.auth.signUp({
        email: authEmail,
        password: password,
        options: {
            data: {
                username: username,
                display_email: email
            }
        }
    });

    if (error) {
        console.error('[PokeFury] Erro no registro:', error.message);
        if (error.message.includes('already') || error.message.includes('registered')) {
            showError('register', 'Este nome de treinador já existe.');
        } else {
            showError('register', 'Erro: ' + error.message);
        }
        return;
    }

    console.log('[PokeFury] Registro sucesso:', data);

    if (data.user) {
        const { error: profileError } = await window.db.from('profiles').upsert({
            id: data.user.id,
            username: username,
            display_email: email
        }, { onConflict: 'id' });
        if (profileError) console.error('[PokeFury] Erro ao criar perfil:', profileError);
    }

    window.GameData.setUserId(data.user.id);
    showGame({ username: username, email: authEmail, id: data.user.id });
}

function showGame(userData) {
    const authScreen = document.getElementById('auth-screen');
    const charScreen = document.getElementById('character-screen');

    authScreen.classList.add('fade-out');

    setTimeout(() => {
        authScreen.classList.add('hidden');
        charScreen.classList.remove('hidden');
        charScreen.classList.add('fade-in');
        loadCharScreen(userData);
    }, 500);
}

async function loadCharScreen(userData) {
    const charSelect = document.getElementById('char-select');
    const charCreate = document.getElementById('char-create');

    charCreate.classList.add('hidden');
    charSelect.classList.remove('hidden');

    const list = document.getElementById('char-list');
    list.innerHTML = '';

    try {
        const { data } = await window.db.auth.getUser();
        if (!data || !data.user) {
            showCharCreateScreen();
            return;
        }

        const { data: saves } = await window.db
            .from('game_saves')
            .select('*')
            .eq('user_id', data.user.id);

        if (!saves || saves.length === 0) {
            showCharCreateScreen();
            return;
        }

        for (const save of saves) {
            const card = document.createElement('div');
            card.className = 'char-card';

            let spriteHtml = '<div class="char-card-sprite-placeholder">?</div>';
            if (save.starter_pokemon) {
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
                    console.warn('[PokeFury] Erro ao carregar sprite:', e);
                }
            }

            let typeBadges = '';
            if (save.starter_pokemon) {
                try {
                    const pokeData = await window.PokeAPI.ensurePokemon(save.starter_pokemon);
                    const TYPE_COLORS = { normal:'#A8A878', fire:'#F08030', water:'#6890F0', electric:'#F8D030', grass:'#78C850', ice:'#98D8D8', fighting:'#C03028', poison:'#A040A0', ground:'#E0C068', flying:'#A890F0', psychic:'#F85888', bug:'#A8B820', rock:'#B8A038', ghost:'#705898', dragon:'#7038F8', dark:'#705848', steel:'#B8B8D0', fairy:'#EE99AC' };
                    typeBadges = (pokeData.types || []).map(t =>
                        `<span class="type-badge type-${t}" style="background:${TYPE_COLORS[t] || '#686868'}">${t}</span>`
                    ).join('');
                } catch (e) {}
            }

            card.innerHTML = `
                ${spriteHtml}
                <div class="char-card-info">
                    <div class="char-card-name">${save.player_name || 'Treinador'}</div>
                    <div class="char-card-meta">${save.starter_pokemon ? 'Starter: ' + save.starter_pokemon : 'Sem starter'}</div>
                    <div class="char-card-types">${typeBadges}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (window.pokefury && window.pokefury.loadCharacter) {
                    window.pokefury.loadCharacter(save);
                }
            });

            list.appendChild(card);
        }
    } catch (e) {
        console.error('[PokeFury] Erro ao carregar personagens:', e);
        showCharCreateScreen();
    }
}

function showCharCreateScreen() {
    document.getElementById('char-select').classList.add('hidden');
    document.getElementById('char-create').classList.remove('hidden');
}

window.showCharCreateScreen = showCharCreateScreen;
