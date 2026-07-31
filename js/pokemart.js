const PM_CATEGORIES = {
  pokeball: { label: 'PokéBalls', filter: item => item.category === 'pokeball' && item.id !== 13 },
  medicine: { label: 'Medicina', filter: item => item.category === 'medicine' },
  stone: { label: 'Pedras', filter: item => item.category === 'evolution_stone' },
  tm: { label: 'TMs', filter: item => item.category === 'tm_hm' },
  tr: { label: 'TRs', filter: item => item.category === 'tr' },
  special: { label: 'Itens Especiais', filter: item => item.category === 'held' || item.category === 'held_item' || item.category === 'mega_stone' || item.category === 'battle_item' }
};

function pmRenderCards(category, query) {
  const grid = document.getElementById('pm-grid');
  const empty = document.getElementById('pm-empty');
  if (!grid) return;

  const cat = PM_CATEGORIES[category];
  if (!cat) return;

  let items = window.ALL_ITEMS.filter(cat.filter);

  if (query) {
    const q = query.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(q) || (i.desc || '').toLowerCase().includes(q));
  }

  if (!items.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  grid.innerHTML = items.map(item => `
    <div class="pm-card" data-id="${item.id}">
      <img class="pm-card-img" src="${item.sprite}" alt="${item.name}" onerror="this.src='assets/sprites/items/poke-ball.png'">
      <div class="pm-card-info">
        <div class="pm-card-name">${item.name}</div>
        <div class="pm-card-desc">${item.desc || ''}</div>
        <div class="pm-card-price">💰 ${item.price} Prata</div>
      </div>
      <div class="pm-card-buy">
        <input type="number" min="1" max="99" value="1" class="pm-qty" data-id="${item.id}">
        <button class="pm-buy-btn" data-id="${item.id}" ${item.price <= 0 ? 'disabled title="Indisponível"' : ''}>
          ${item.price <= 0 ? '🔒' : '🛒 Comprar'}
        </button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.pm-buy-btn').forEach(btn => {
    btn.addEventListener('click', () => pmBuy(parseInt(btn.dataset.id)));
  });

  grid.querySelectorAll('.pm-qty').forEach(inp => {
    inp.addEventListener('change', () => {
      if (parseInt(inp.value) < 1) inp.value = 1;
      if (parseInt(inp.value) > 99) inp.value = 99;
    });
  });
}

async function pmBuy(itemId) {
  const item = window.ALL_ITEMS.find(i => i.id === itemId);
  if (!item || item.price <= 0) return;

  const qtyInput = document.querySelector(`.pm-qty[data-id="${itemId}"]`);
  const qty = Math.max(1, Math.min(99, parseInt(qtyInput?.value || 1)));
  const totalCost = item.price * qty;

  const cur = await window.GameData.getCurrencies();
  if (cur.silver < totalCost) {
    alert(`Prata insuficiente! Necessário: ${totalCost}, disponível: ${cur.silver}`);
    return;
  }

  const newSilver = cur.silver - totalCost;
  await window.GameData.updateCurrencies({ ...cur, silver: newSilver });

  document.getElementById('c-silver').textContent = newSilver.toLocaleString();

  await window.GameData.addItem(item.id, qty);

  alert(`Comprou ${qty}x ${item.name} por ${totalCost} Prata!`);
}

window.openPokeMart = function () {
  const overlay = document.getElementById('pokemart-overlay');
  if (!overlay) return;

  overlay.classList.remove('hidden');

  window.GameData.getCurrencies().then(cur => {
    const el = document.getElementById('pm-prata');
    if (el) el.textContent = (cur.silver || 0).toLocaleString();
  });

  const activeTab = document.querySelector('.pm-tab.active');
  const cat = activeTab?.dataset.cat || 'pokeball';
  pmRenderCards(cat, document.getElementById('pm-search-input')?.value || '');
};

window.closePokeMart = function () {
  const overlay = document.getElementById('pokemart-overlay');
  if (overlay) overlay.classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('pokemart-overlay');
  if (!overlay) return;

  document.getElementById('pm-close')?.addEventListener('click', window.closePokeMart);
  document.getElementById('pm-close-banner')?.addEventListener('click', window.closePokeMart);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) window.closePokeMart();
  });

  document.querySelectorAll('.pm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pm-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      pmRenderCards(tab.dataset.cat, document.getElementById('pm-search-input')?.value || '');
    });
  });

  document.getElementById('pm-search-input')?.addEventListener('input', e => {
    const activeTab = document.querySelector('.pm-tab.active');
    pmRenderCards(activeTab?.dataset.cat || 'pokeball', e.target.value);
  });
});
