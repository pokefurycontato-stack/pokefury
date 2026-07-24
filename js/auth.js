document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await window.db.auth.getSession();
    if (session) {
        window.GameData.setUserId(session.user.id);
        showGame(session.user);
        return;
    }

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
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 4000);
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showError('login', 'Preencha todos os campos.');
        return;
    }

    const email = username.toLowerCase().replace(/\s/g, '') + '@pokefury.app';

    const { data, error } = await window.db.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        if (error.message.includes('Invalid login')) {
            showError('login', 'Conta não encontrada ou senha incorreta.');
        } else {
            showError('login', 'Erro ao fazer login. Tente novamente.');
        }
        return;
    }

    const userData = {
        username,
        email: data.user.email,
        id: data.user.id
    };

    window.GameData.setUserId(data.user.id);
    showGame(userData);
}

async function handleRegister() {
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

    const authEmail = username.toLowerCase().replace(/\s/g, '') + '@pokefury.app';

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
        if (error.message.includes('already registered')) {
            showError('register', 'Este nome de treinador já existe.');
        } else {
            showError('register', 'Erro ao criar conta. Tente novamente.');
        }
        return;
    }

    if (data.user) {
        await window.db.from('game_saves').insert({
            user_id: data.user.id,
            player_name: username,
            starter_pokemon: null
        });
    }

    const userData = {
        username,
        email: authEmail,
        id: data.user.id
    };

    window.GameData.setUserId(data.user.id);
    showGame(userData);
}

function showGame(userData) {
    const authScreen = document.getElementById('auth-screen');
    const gameContainer = document.getElementById('game-container');

    authScreen.classList.add('fade-out');

    setTimeout(() => {
        authScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        gameContainer.classList.add('fade-in');

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await window.db.auth.signOut();
                location.reload();
            });
        }
    }, 500);
}
