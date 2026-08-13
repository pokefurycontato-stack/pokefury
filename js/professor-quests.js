const PROFESSOR_QUEST_TYPES = [
    { value: 'battles_biome', label: 'Caçar no Bioma', fields: ['target_biome', 'target_count'] },
    { value: 'catch_pokemon', label: 'Capturar Pokémon', fields: ['target_pokemon_name', 'target_count'] },
    { value: 'catch_pokemon_biome', label: 'Capturar no Bioma', fields: ['target_biome', 'target_pokemon_name', 'target_count'] },
    { value: 'talk_to_npc', label: 'Falar com NPC', fields: ['target_npc_name'] },
    { value: 'battles_total', label: 'Batalhar (total)', fields: ['target_count'] },
    { value: 'pvp_casual', label: 'PvP Casual (vitórias)', fields: ['target_count'] }
];

const PROFESSOR_QUEST_BIOMES = [
    'Floresta', 'Montanha', 'Torre', 'Industrial', 'Penhasco', 'Praia', 'Vulcao', 'Geleira'
];

const PROFESSOR_REWARD_TYPES = [
    { value: 'silver', label: 'Prata' },
    { value: 'gold', label: 'Ouro' },
    { value: 'diamonds', label: 'Diamante' },
    { value: 'pokemon', label: 'Pokémon' },
    { value: 'item', label: 'Item' }
];

function professorQuestTypeLabel(type) {
    const found = PROFESSOR_QUEST_TYPES.find(t => t.value === type);
    return found ? found.label : type;
}

function professorRewardTypeLabel(type) {
    const found = PROFESSOR_REWARD_TYPES.find(t => t.value === type);
    return found ? found.label : type;
}

async function ensureProfessorQuestTables() {
    // Tables created via supabase-professor-quests.sql
}

async function loadProfessorQuests(npcId) {
    if (!window.db) return [];
    const { data } = await window.db.from('city_professor_quests')
        .select('*')
        .eq('npc_id', npcId)
        .order('order_index', { ascending: true })
        .limit(5000);
    return data || [];
}

async function loadProfessorQuest(questId) {
    if (!window.db) return null;
    const { data } = await window.db.from('city_professor_quests')
        .select('*')
        .eq('id', questId)
        .maybeSingle();
    return data;
}

async function loadQuestRewards(questId) {
    if (!window.db) return [];
    const { data } = await window.db.from('city_professor_quest_rewards')
        .select('*')
        .eq('quest_id', questId)
        .limit(100);
    return data || [];
}

async function saveProfessorQuest(quest) {
    if (!window.db) return null;
    const payload = {
        npc_id: quest.npc_id,
        order_index: quest.order_index ?? 0,
        quest_type: quest.quest_type,
        title: quest.title,
        description: quest.description || null,
        target_count: quest.target_count || 1,
        target_biome: quest.target_biome || null,
        target_pokemon_id: quest.target_pokemon_id || null,
        target_pokemon_name: quest.target_pokemon_name || null,
        target_npc_id: quest.target_npc_id || null,
        target_npc_name: quest.target_npc_name || null,
        dialogue_text: quest.dialogue_text || null,
        pvp_required: !!quest.pvp_required,
        is_active: quest.is_active !== false,
        updated_at: new Date().toISOString()
    };
    if (quest.id) {
        const { data } = await window.db.from('city_professor_quests')
            .update(payload)
            .eq('id', quest.id)
            .select()
            .single();
        return data;
    }
    const { data } = await window.db.from('city_professor_quests')
        .insert(payload)
        .select()
        .single();
    return data;
}

async function deleteProfessorQuest(questId) {
    if (!window.db) return;
    await window.db.from('city_professor_quest_rewards').delete().eq('quest_id', questId);
    await window.db.from('player_professor_quests').delete().eq('quest_id', questId);
    await window.db.from('city_professor_quests').delete().eq('id', questId);
}

async function saveQuestReward(reward) {
    if (!window.db) return null;
    const payload = {
        quest_id: reward.quest_id,
        reward_type: reward.reward_type,
        amount: reward.amount || 0,
        pokemon_id: reward.pokemon_id || null,
        item_id: reward.item_id || null,
        created_at: new Date().toISOString()
    };
    if (reward.id) {
        const { data } = await window.db.from('city_professor_quest_rewards')
            .update(payload)
            .eq('id', reward.id)
            .select()
            .single();
        return data;
    }
    const { data } = await window.db.from('city_professor_quest_rewards')
        .insert(payload)
        .select()
        .single();
    return data;
}

async function deleteQuestReward(rewardId) {
    if (!window.db) return;
    await window.db.from('city_professor_quest_rewards').delete().eq('id', rewardId);
}

async function loadPlayerActiveProfessorQuest(npcId) {
    if (!window.db) return null;
    const userId = window.GameData?.userId || window.db.auth?.user()?.data?.user?.id;
    const characterId = window.GameData?.currentCharacterId || window.pokefury?.currentCharacterId;
    if (!userId || !characterId) return null;
    const { data } = await window.db.from('player_professor_quests')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .eq('npc_id', npcId)
        .in('status', ['active', 'locked'])
        .order('id', { ascending: true })
        .limit(1);
    return data?.[0] || null;
}

async function loadPlayerCompletedProfessorQuests(npcId) {
    if (!window.db) return [];
    const userId = window.GameData?.userId || window.db.auth?.user()?.data?.user?.id;
    const characterId = window.GameData?.currentCharacterId || window.pokefury?.currentCharacterId;
    if (!userId || !characterId) return [];
    const { data } = await window.db.from('player_professor_quests')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .eq('npc_id', npcId)
        .eq('status', 'completed')
        .order('id', { ascending: false })
        .limit(5000);
    return data || [];
}

async function setPlayerQuestProgress(questId, progress) {
    if (!window.db) return;
    const userId = window.GameData?.userId || window.db.auth?.user()?.data?.user?.id;
    const characterId = window.GameData?.currentCharacterId || window.pokefury?.currentCharacterId;
    if (!userId || !characterId) return;
    const { data: existing } = await window.db.from('player_professor_quests')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .eq('quest_id', questId)
        .maybeSingle();
    if (!existing) {
        await window.db.from('player_professor_quests').insert({
            user_id: userId,
            character_id: characterId,
            quest_id: questId,
            status: 'active',
            progress: Math.max(0, progress)
        });
        return;
    }
    const newProgress = Math.max(existing.progress || 0, progress);
    const status = newProgress >= 999999 ? 'completed' : existing.status;
    await window.db.from('player_professor_quests')
        .update({ progress: newProgress, status, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
}

async function getPlayerQuestState(questId) {
    if (!window.db) return null;
    const userId = window.GameData?.userId || window.db.auth?.user()?.data?.user?.id;
    const characterId = window.GameData?.currentCharacterId || window.pokefury?.currentCharacterId;
    if (!userId || !characterId) return null;
    const { data } = await window.db.from('player_professor_quests')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .eq('quest_id', questId)
        .maybeSingle();
    return data || null;
}

async function grantQuestRewards(questId) {
    if (!window.db) return [];
    const { data: q } = await window.db.from('city_professor_quests').select('*').eq('id', questId).maybeSingle();
    if (!q) return [];
    const charId = window.GameData?.currentCharacterId;
    const userId = window.GameData?.userId;
    if (!charId || !userId) return [];
    const rewards = await loadQuestRewards(questId);
    const msgs = [];
    for (const r of rewards) {
        // "money" (Dinheiro) equivale à moeda base 'silver' (Prata)
        const currencyType = r.reward_type === 'money' ? 'silver' : r.reward_type;
        if (currencyType === 'silver' || currencyType === 'gold' || currencyType === 'diamonds') {
            const amount = r.amount || 0;
            if (amount > 0) {
                const { error } = await window.db.rpc('add_currency', {
                    p_character_id: charId,
                    p_currency_type: currencyType,
                    p_amount: amount,
                    p_action: 'reward',
                    p_description: 'Quest reward'
                });
                if (!error) {
                    const labels = { silver: 'Prata', gold: 'Ouro', diamonds: 'Diamante' };
                    msgs.push(`+${amount} ${labels[currencyType]}`);
                }
            }
        } else if (r.reward_type === 'pokemon' && r.pokemon_id) {
            const { data: result, error } = await window.db.rpc('safe_grant_quest_pokemon', {
                p_character_id: charId,
                p_pokemon_id: r.pokemon_id,
                p_level: r.pokemon_level || 5,
                p_nature: r.nature || 'hardy',
                p_iv_hp: r.iv_hp || 0, p_iv_attack: r.iv_attack || 0, p_iv_defense: r.iv_defense || 0,
                p_iv_sp_atk: r.iv_sp_atk || 0, p_iv_sp_def: r.iv_sp_def || 0, p_iv_speed: r.iv_speed || 0
            });
            if (!error && result?.success) {
                if (result.stored_in_pc) {
                    if (window.GameData && typeof window.GameData.autoStorePokemonToPC === 'function') {
                        await window.GameData.autoStorePokemonToPC({
                            species: result.pokemon_name,
                            name: result.pokemon_name,
                            level: r.pokemon_level || 5,
                            currentHp: 0,
                            stats: { hp: 0 },
                            experience: 0,
                            moves: [],
                            nature: r.nature || 'hardy',
                            ivs: { hp: r.iv_hp || 0, attack: r.iv_attack || 0, defense: r.iv_defense || 0, spAtk: r.iv_sp_atk || 0, spDef: r.iv_sp_def || 0, speed: r.iv_speed || 0 },
                            evs: {}
                        });
                    }
                    msgs.push(`Time cheio! ${result.pokemon_name} foi para o PC.`);
                } else {
                    msgs.push(`Recebeu ${result.pokemon_name || 'Pokemon'}!`);
                }
            }
        } else if (r.reward_type === 'item' && r.item_id) {
            const amount = r.amount || 1;
            // O inventário real usa a tabela player_inventory via GameData.addItem
            const ok = window.GameData && typeof window.GameData.addItem === 'function'
                ? await window.GameData.addItem(r.item_id, amount)
                : false;
            if (ok) msgs.push(`Recebeu item x${amount}.`);
        }
    }
    return msgs;
}

async function ensureProfessorNpcId() {
    if (!window.db) return null;
    const { data } = await window.db.from('city_npcs').select('id').eq('npc_type', 'professor').limit(1);
    return data?.[0]?.id || null;
}

async function openProfessorAdminOverlay(npcId) { try {
    const existing = document.getElementById('city-professor-admin-overlay');
    if (existing) existing.remove();
    const quests = await loadProfessorQuests(npcId);
    const overlay = document.createElement('div');
    overlay.id = 'city-professor-admin-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:980;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px;';
    overlay.innerHTML = `<div style="background:#161b22;border:1px solid #30363d;border-radius:14px;width:100%;max-width:960px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #30363d;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:20px;">[Q]</span>
                    <span style="color:#fff;font-size:16px;font-weight:700;">Quests - Professor Carvalho</span>
                </div>
                <div style="display:flex;gap:8px;">
                    <button id="cb-professor-admin-add" style="padding:8px 14px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">+ Nova Quest</button>
                    <button id="cb-professor-admin-close" style="background:none;border:none;color:#f44336;font-size:18px;cursor:pointer;">X</button>
                </div>
            </div>
            <div style="flex:1;overflow-y:auto;padding:14px 18px;display:grid;grid-template-columns:1fr;gap:12px;">
                ${quests.length === 0 ? '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:20px;">Nenhuma quest criada ainda.</div>' : ''}
                ${quests.map((q, idx) => `
                    <div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <div style="color:#f59e0b;font-weight:700;font-size:13px;">#${idx + 1} - ${q.title}</div>
                            <div style="display:flex;gap:6px;">
                                <button data-move-up="${q.id}" style="padding:4px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:11px;cursor:pointer;">^</button>
                                <button data-move-down="${q.id}" style="padding:4px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:11px;cursor:pointer;">v</button>
                                <button data-edit="${q.id}" style="padding:4px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:11px;cursor:pointer;">Editar</button>
                                <button data-delete="${q.id}" style="padding:4px 10px;background:rgba(233,69,96,0.15);border:1px solid rgba(233,69,96,0.35);border-radius:6px;color:#e94560;font-size:11px;cursor:pointer;">Excluir</button>
                            </div>
                        </div>
                        <div style="color:rgba(255,255,255,0.5);font-size:12px;">${professorQuestTypeLabel(q.quest_type)} - ${q.target_biome ? 'Bioma: ' + q.target_biome + ' ' : ''}${q.target_pokemon_name ? 'Pokémon: ' + q.target_pokemon_name + ' ' : ''}${q.target_npc_name ? 'NPC: ' + q.target_npc_name + ' ' : ''}${q.target_count ? 'Qtd: ' + q.target_count : ''}</div>
                        <div style="color:rgba(255,255,255,0.4);font-size:11px;">${q.description || ''}</div>
                        <div style="color:rgba(255,255,255,0.6);font-size:12px;">Recompensas: <span id="rewards-${q.id}">carregando...</span></div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';

    const loadRewardsText = async (questId, containerId) => {
        const rewards = await loadQuestRewards(questId);
        const el = document.getElementById(containerId);
        if (!el) return;
        if (rewards.length === 0) {
            el.innerHTML = '<span style="color:#e94560">sem recompensa</span>';
            return;
        }
        el.innerHTML = rewards.map(r => {
            let txt = professorRewardTypeLabel(r.reward_type);
            if (r.reward_type === 'pokemon' && r.pokemon_id) {
                txt += ` #${r.pokemon_id} Nv.${r.pokemon_level || 5}`;
                if (r.nature) txt += ` ${r.nature}`;
            } else if (r.reward_type === 'item' && r.item_id) {
                txt += ` #${r.item_id} x${r.amount || 1}`;
            } else {
                txt += ` ${r.amount || 0}`;
            }
            return txt;
        }).join(', ');
    };

    for (const q of quests) {
        await loadRewardsText(q.id, `rewards-${q.id}`);
    }

    overlay.querySelector("#cb-professor-admin-close").onclick = () => overlay.remove();
    overlay.querySelector('#cb-professor-admin-add').onclick = () => openProfessorQuestForm({ npc_id: npcId, order_index: quests.length });
    overlay.querySelectorAll('[data-edit]').forEach(btn => {
        btn.onclick = async () => {
            const id = Number(btn.dataset.edit);
            const q = quests.find(x => x.id === id);
            if (!q) return;
            const rewards = await loadQuestRewards(id);
            openProfessorQuestForm({ ...q, rewards });
        };
    });
    overlay.querySelectorAll('[data-delete]').forEach(btn => {
        btn.onclick = async () => {
            const id = Number(btn.dataset.delete);
            if (!confirm('Excluir esta quest?')) return;
            await deleteProfessorQuest(id);
            btn.closest('div').parentElement.parentElement.remove();
        };
    });
    overlay.querySelectorAll('[data-move-up]').forEach(btn => {
        btn.onclick = async () => {
            const id = Number(btn.dataset.moveUp);
            const idx = quests.findIndex(x => x.id === id);
            if (idx <= 0) return;
            const tmp = quests[idx - 1];
            await saveProfessorQuest({ ...quests[idx - 1], order_index: idx });
            await saveProfessorQuest({ ...quests[idx], order_index: idx - 1 });
            quests[idx - 1] = { ...quests[idx], order_index: idx - 1 };
            quests[idx] = { ...tmp, order_index: idx };
            openProfessorAdminOverlay(npcId);
        };
    });
    overlay.querySelectorAll('[data-move-down]').forEach(btn => {
        btn.onclick = async () => {
            const id = Number(btn.dataset.moveDown);
            const idx = quests.findIndex(x => x.id === id);
            if (idx < 0 || idx >= quests.length - 1) return;
            const tmp = quests[idx + 1];
            await saveProfessorQuest({ ...quests[idx + 1], order_index: idx });
            await saveProfessorQuest({ ...quests[idx], order_index: idx + 1 });
            quests[idx + 1] = { ...quests[idx], order_index: idx + 1 };
            quests[idx] = { ...tmp, order_index: idx };
            openProfessorAdminOverlay(npcId);
        };
    });
    } catch(e) { console.error(e); }
}

async function openProfessorQuestForm(quest, rewards = []) {
    const existing = document.getElementById('city-professor-form-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'city-professor-form-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:990;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px;';

    const questType = quest.quest_type || 'battles_biome';
    const selectedType = PROFESSOR_QUEST_TYPES.find(t => t.value === questType) || PROFESSOR_QUEST_TYPES[0];

    function buildTypeFields(type) {
        const t = PROFESSOR_QUEST_TYPES.find(x => x.value === type) || PROFESSOR_QUEST_TYPES[0];
        let html = '';
        if (t.fields.includes('target_biome')) {
            html += `<label style="color:rgba(255,255,255,0.6);font-size:12px;">Bioma</label>
            <select id="cb-prof-quest-biome" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                <option value="">Selecione...</option>
                ${PROFESSOR_QUEST_BIOMES.map(b => `<option value="${b}" ${quest.target_biome === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>`;
        }
        if (t.fields.includes('target_pokemon_name')) {
            html += `<label style="color:rgba(255,255,255,0.6);font-size:12px;">Nome do Pokémon</label>
            <input id="cb-prof-quest-pokemon" value="${(quest.target_pokemon_name || '').replace(/"/g, '&quot;')}" placeholder="Ex: Charmander" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">`;
        }
        if (t.fields.includes('target_npc_name')) {
            html += `<label style="color:rgba(255,255,255,0.6);font-size:12px;">NPC</label>
            <div style="position:relative;">
                <input id="cb-prof-quest-npc-search" placeholder="Buscar NPC..." value="${(quest.target_npc_name || '').replace(/"/g, '&quot;')}" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                <div id="cb-prof-quest-npc-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:#161b22;border:1px solid #30363d;border-radius:0 0 8px 8px;max-height:150px;overflow-y:auto;z-index:10;"></div>
            </div>
            <input id="cb-prof-quest-npc" type="hidden" value="${quest.target_npc_id || ''}">
            <div id="cb-prof-quest-npc-preview" style="color:rgba(255,255,255,0.4);font-size:11px;">${quest.target_npc_name ? quest.target_npc_name : 'Nenhum selecionado'}</div>
            <label style="color:rgba(255,255,255,0.6);font-size:12px;">Dialogue do NPC (use #Jogador para o nome do personagem)</label>
            <textarea id="cb-prof-quest-dialogue" rows="3" placeholder="Ex: Olá #Jogador! O Professor Carvalho me pediu para te entregar isto..." style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">${(quest.dialogue_text || '').replace(/"/g, '&quot;')}</textarea>`;
        }
        if (t.fields.includes('target_count')) {
            html += `<label style="color:rgba(255,255,255,0.6);font-size:12px;">Quantidade</label>
            <input id="cb-prof-quest-target" type="number" value="${quest.target_count || 1}" min="1" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">`;
        }
        return html;
    }

    function buildRewardFields(rewardType, reward) {
        if (rewardType === 'pokemon') {
            return `
            <div style="display:flex;flex-direction:column;gap:6px;">
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Buscar Pokémon</label>
                <div style="position:relative;">
                    <input id="cb-prof-poke-search" placeholder="Digite o nome..." style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                    <div id="cb-prof-poke-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:#161b22;border:1px solid #30363d;border-radius:0 0 8px 8px;max-height:150px;overflow-y:auto;z-index:10;"></div>
                </div>
                <div id="cb-prof-poke-preview" style="color:rgba(255,255,255,0.4);font-size:11px;">Nenhum selecionado</div>
                <input id="cb-prof-poke-id" type="hidden" value="${reward?.pokemon_id || ''}">
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Nível</label>
                <input id="cb-prof-poke-level" type="number" min="1" max="100" value="${reward?.pokemon_level || 5}" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">IVs (0-31)</label>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">HP</label><input class="cb-prof-iv" data-stat="hp" type="number" min="0" max="31" value="${reward?.iv_hp ?? 15}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">Atk</label><input class="cb-prof-iv" data-stat="attack" type="number" min="0" max="31" value="${reward?.iv_attack ?? 15}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">Def</label><input class="cb-prof-iv" data-stat="defense" type="number" min="0" max="31" value="${reward?.iv_defense ?? 15}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">SpA</label><input class="cb-prof-iv" data-stat="spAtk" type="number" min="0" max="31" value="${reward?.iv_sp_atk ?? 15}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">SpD</label><input class="cb-prof-iv" data-stat="spDef" type="number" min="0" max="31" value="${reward?.iv_sp_def ?? 15}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">Spe</label><input class="cb-prof-iv" data-stat="speed" type="number" min="0" max="31" value="${reward?.iv_speed ?? 15}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                </div>
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">EVs (0-252)</label>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">HP</label><input class="cb-prof-ev" data-stat="hp" type="number" min="0" max="252" value="${reward?.ev_hp ?? 0}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">Atk</label><input class="cb-prof-ev" data-stat="attack" type="number" min="0" max="252" value="${reward?.ev_attack ?? 0}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">Def</label><input class="cb-prof-ev" data-stat="defense" type="number" min="0" max="252" value="${reward?.ev_defense ?? 0}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">SpA</label><input class="cb-prof-ev" data-stat="spAtk" type="number" min="0" max="252" value="${reward?.ev_sp_atk ?? 0}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">SpD</label><input class="cb-prof-ev" data-stat="spDef" type="number" min="0" max="252" value="${reward?.ev_sp_def ?? 0}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="color:rgba(255,255,255,0.3);font-size:9px;">Spe</label><input class="cb-prof-ev" data-stat="speed" type="number" min="0" max="252" value="${reward?.ev_speed ?? 0}" style="width:100%;padding:6px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#fff;font-size:12px;box-sizing:border-box;"></div>
                </div>
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Nature</label>
                <select id="cb-prof-poke-nature" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                    ${['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'].map(n => `<option value="${n}" ${reward?.nature === n ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
            </div>`;
        }
        if (rewardType === 'item') {
            return `
            <div style="display:flex;flex-direction:column;gap:6px;">
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Buscar Item</label>
                <div style="position:relative;">
                    <input id="cb-prof-item-search" placeholder="Digite o nome..." style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                    <div id="cb-prof-item-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:#161b22;border:1px solid #30363d;border-radius:0 0 8px 8px;max-height:150px;overflow-y:auto;z-index:10;"></div>
                </div>
                <div id="cb-prof-item-preview" style="color:rgba(255,255,255,0.4);font-size:11px;">Nenhum selecionado</div>
                <input id="cb-prof-item-id" type="hidden" value="${reward?.item_id || ''}">
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Quantidade</label>
                <input id="cb-prof-reward-amount" type="number" value="${reward?.amount || 1}" min="1" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
            </div>`;
        }
        return `
        <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="color:rgba(255,255,255,0.6);font-size:12px;">Quantidade</label>
            <input id="cb-prof-reward-amount" type="number" value="${reward?.amount || 0}" min="0" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
        </div>`;
    }

    overlay.innerHTML = `<div style="background:#161b22;border:1px solid #30363d;border-radius:14px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="color:#fff;font-size:16px;font-weight:700;">${quest.id ? 'Editar' : 'Nova'} Quest</span>
                <button id="cb-professor-form-close" style="background:none;border:none;color:#f44336;font-size:18px;cursor:pointer;">X</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Título</label>
                <input id="cb-prof-quest-title" value="${(quest.title || '').replace(/"/g, '&quot;')}" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Descrição</label>
                <textarea id="cb-prof-quest-desc" rows="3" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">${(quest.description || '').replace(/"/g, '&quot;')}</textarea>
                <label style="color:rgba(255,255,255,0.6);font-size:12px;">Tipo</label>
                <select id="cb-prof-quest-type" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                    ${PROFESSOR_QUEST_TYPES.map(t => `<option value="${t.value}" ${quest.quest_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                </select>
                <div id="cb-prof-type-fields">${buildTypeFields(questType)}</div>
                <div style="border-top:1px solid #30363d;padding-top:10px;display:flex;flex-direction:column;gap:10px;">
                    <label style="color:rgba(255,255,255,0.6);font-size:12px;font-weight:700;">Recompensa</label>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <label style="color:rgba(255,255,255,0.6);font-size:12px;">Tipo</label>
                        <select id="cb-prof-reward-type" style="width:100%;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:8px;color:#fff;font-size:13px;box-sizing:border-box;">
                            ${PROFESSOR_REWARD_TYPES.map(t => `<option value="${t.value}" ${rewards[0]?.reward_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>
                    </div>
                    <div id="cb-prof-reward-fields">${buildRewardFields(rewards[0]?.reward_type || 'silver', rewards[0])}</div>
                </div>
                <button id="cb-prof-save-quest" style="width:100%;padding:12px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">Salvar Quest</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';

    overlay.querySelector('#cb-professor-form-close').onclick = () => overlay.remove();

    overlay.querySelector('#cb-prof-quest-type').onchange = function() {
        const fieldsDiv = overlay.querySelector('#cb-prof-type-fields');
        fieldsDiv.innerHTML = buildTypeFields(this.value);
        setupRewardSearchHandlers(overlay);
    };

    overlay.querySelector('#cb-prof-reward-type').onchange = function() {
        const rewardFieldsDiv = overlay.querySelector('#cb-prof-reward-fields');
        rewardFieldsDiv.innerHTML = buildRewardFields(this.value, rewards[0]);
        setupRewardSearchHandlers(overlay);
    };

    function setupRewardSearchHandlers(ov) {
        const pokeSearch = ov.querySelector('#cb-prof-poke-search');
        if (pokeSearch) {
            let pokeDebounce = null;
            pokeSearch.oninput = () => {
                clearTimeout(pokeDebounce);
                const q = pokeSearch.value.trim().toLowerCase();
                const resultsDiv = ov.querySelector('#cb-prof-poke-results');
                if (q.length < 1) { resultsDiv.style.display = 'none'; return; }
                pokeDebounce = setTimeout(async () => {
                    const { data } = await window.db.from('pokemon').select('id, name').ilike('name', `%${q}%`).limit(10);
                    if (!data || data.length === 0) { resultsDiv.style.display = 'none'; return; }
                    resultsDiv.innerHTML = '';
                    resultsDiv.style.display = 'block';
                    for (const poke of data) {
                        const div = document.createElement('div');
                        div.style.cssText = 'padding:6px 12px;cursor:pointer;color:#fff;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05)';
                        div.textContent = `${poke.name} (#${poke.id})`;
                        div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.08)';
                        div.onmouseleave = () => div.style.background = 'transparent';
                        div.onclick = () => {
                            pokeSearch.value = poke.name;
                            resultsDiv.style.display = 'none';
                            ov.querySelector('#cb-prof-poke-id').value = poke.id;
                            ov.querySelector('#cb-prof-poke-preview').textContent = `Selecionado: ${poke.name} (#${poke.id})`;
                        };
                        resultsDiv.appendChild(div);
                    }
                }, 300);
            };
            pokeSearch.onblur = () => setTimeout(() => { const r = ov.querySelector('#cb-prof-poke-results'); if (r) r.style.display = 'none'; }, 200);
        }
        const itemSearch = ov.querySelector('#cb-prof-item-search');
        if (itemSearch) {
            let itemDebounce = null;
            itemSearch.oninput = () => {
                clearTimeout(itemDebounce);
                const q = itemSearch.value.trim().toLowerCase();
                const resultsDiv = ov.querySelector('#cb-prof-item-results');
                if (q.length < 1) { resultsDiv.style.display = 'none'; return; }
                itemDebounce = setTimeout(async () => {
                    const { data } = await window.db.from('items').select('id, name').ilike('name', `%${q}%`).limit(10);
                    if (!data || data.length === 0) { resultsDiv.style.display = 'none'; return; }
                    resultsDiv.innerHTML = '';
                    resultsDiv.style.display = 'block';
                    for (const item of data) {
                        const div = document.createElement('div');
                        div.style.cssText = 'padding:6px 12px;cursor:pointer;color:#fff;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05)';
                        div.textContent = `${item.name} (#${item.id})`;
                        div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.08)';
                        div.onmouseleave = () => div.style.background = 'transparent';
                        div.onclick = () => {
                            itemSearch.value = item.name;
                            resultsDiv.style.display = 'none';
                            ov.querySelector('#cb-prof-item-id').value = item.id;
                            ov.querySelector('#cb-prof-item-preview').textContent = `Selecionado: ${item.name} (#${item.id})`;
                        };
                        resultsDiv.appendChild(div);
                    }
                }, 300);
            };
            itemSearch.onblur = () => setTimeout(() => { const r = ov.querySelector('#cb-prof-item-results'); if (r) r.style.display = 'none'; }, 200);
        }
        const npcSearch = ov.querySelector('#cb-prof-quest-npc-search');
        if (npcSearch) {
            let npcDebounce = null;
            npcSearch.oninput = () => {
                clearTimeout(npcDebounce);
                const q = npcSearch.value.trim().toLowerCase();
                const resultsDiv = ov.querySelector('#cb-prof-quest-npc-results');
                if (q.length < 1) { resultsDiv.style.display = 'none'; return; }
                npcDebounce = setTimeout(async () => {
                    const { data } = await window.db.from('city_npcs').select('id, name, npc_type').ilike('name', `%${q}%`).limit(10);
                    if (!data || data.length === 0) { resultsDiv.style.display = 'none'; return; }
                    resultsDiv.innerHTML = '';
                    resultsDiv.style.display = 'block';
                    for (const npc of data) {
                        const div = document.createElement('div');
                        div.style.cssText = 'padding:6px 12px;cursor:pointer;color:#fff;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05)';
                        div.textContent = `${npc.name || 'NPC'} (${npc.npc_type})`;
                        div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.08)';
                        div.onmouseleave = () => div.style.background = 'transparent';
                        div.onclick = () => {
                            npcSearch.value = npc.name || 'NPC';
                            resultsDiv.style.display = 'none';
                            ov.querySelector('#cb-prof-quest-npc').value = npc.id;
                            ov.querySelector('#cb-prof-quest-npc-preview').textContent = `Selecionado: ${npc.name || 'NPC'}`;
                        };
                        resultsDiv.appendChild(div);
                    }
                }, 300);
            };
            npcSearch.onblur = () => setTimeout(() => { const r = ov.querySelector('#cb-prof-quest-npc-results'); if (r) r.style.display = 'none'; }, 200);
        }
    }
    setupRewardSearchHandlers(overlay);

    overlay.querySelector('#cb-prof-save-quest').onclick = async () => {
        const type = document.getElementById('cb-prof-quest-type').value;
        const payload = {
            ...(quest.id ? { id: quest.id } : {}),
            npc_id: quest.npc_id,
            order_index: quest.order_index ?? 0,
            quest_type: type,
            title: document.getElementById('cb-prof-quest-title').value,
            description: document.getElementById('cb-prof-quest-desc').value,
            is_active: true
        };
        if (type.includes('biome')) {
            payload.target_biome = document.getElementById('cb-prof-quest-biome')?.value || '';
        }
        if (type.includes('pokemon')) {
            payload.target_pokemon_name = document.getElementById('cb-prof-quest-pokemon')?.value || '';
        }
        if (type === 'talk_to_npc') {
            payload.target_npc_id = document.getElementById('cb-prof-quest-npc')?.value || '';
            payload.target_npc_name = document.getElementById('cb-prof-quest-npc-search')?.value || '';
            payload.dialogue_text = document.getElementById('cb-prof-quest-dialogue')?.value || '';
        }
        if (type !== 'talk_to_npc') {
            payload.target_count = parseInt(document.getElementById('cb-prof-quest-target')?.value || '1', 10);
        }
        if (!payload.title.trim()) {
            alert('Título é obrigatório');
            return;
        }
        const saved = await saveProfessorQuest(payload);
        if (saved) {
            const rewardType = document.getElementById('cb-prof-reward-type').value;
            const rewardData = { reward_type: rewardType, quest_id: saved.id };
            if (rewardType === 'pokemon') {
                rewardData.pokemon_id = parseInt(document.getElementById('cb-prof-poke-id')?.value) || null;
                rewardData.pokemon_level = parseInt(document.getElementById('cb-prof-poke-level')?.value) || 5;
                rewardData.nature = document.getElementById('cb-prof-poke-nature')?.value || 'Hardy';
                document.querySelectorAll('.cb-prof-iv').forEach(el => { rewardData['iv_' + el.dataset.stat] = parseInt(el.value) || 0; });
                document.querySelectorAll('.cb-prof-ev').forEach(el => { rewardData['ev_' + el.dataset.stat] = parseInt(el.value) || 0; });
                rewardData.amount = 1;
            } else if (rewardType === 'item') {
                rewardData.item_id = parseInt(document.getElementById('cb-prof-item-id')?.value) || null;
                rewardData.amount = parseInt(document.getElementById('cb-prof-reward-amount')?.value) || 1;
            } else {
                rewardData.amount = parseInt(document.getElementById('cb-prof-reward-amount')?.value) || 0;
            }
            if (rewards[0]) {
                await saveQuestReward({ ...rewards[0], ...rewardData });
            } else if (rewardData.amount > 0 || rewardType) {
                await saveQuestReward(rewardData);
            }
        }
        overlay.remove();
        if (window.ProfessorQuests && typeof window.ProfessorQuests.openProfessorAdminOverlay === 'function') {
            window.ProfessorQuests.openProfessorAdminOverlay(quest.npc_id);
        }
    };
}

async function openPlayerQuestOverlay(npcId) {
    const existing = document.getElementById('city-player-quests-overlay');
    if (existing) existing.remove();
    const active = await loadPlayerActiveProfessorQuest(npcId);
    const completed = await loadPlayerCompletedProfessorQuests(npcId);
    const allQuests = await loadProfessorQuests(npcId);
    const completedQuestIds = new Set(completed.map(c => c.quest_id));
    const activeQuestIds = new Set(active ? [active.quest_id] : []);
    const available = allQuests.filter(q => q.is_active && !completedQuestIds.has(q.id) && !activeQuestIds.has(q.id));
    const overlay = document.createElement('div');
    overlay.id = 'city-player-quests-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:970;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px;';
    overlay.innerHTML = `<div style="background:#161b22;border:1px solid #30363d;border-radius:14px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:20px;">[Q]</span>
                    <span style="color:#fff;font-size:16px;font-weight:700;">Professor Carvalho</span>
                </div>
                <button id="city-player-quests-close" style="background:none;border:none;color:#f44336;font-size:18px;cursor:pointer;">X</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
                ${active ? `
                    <div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
                        <div style="color:#f59e0b;font-weight:700;font-size:13px;">Quest Atual</div>
                        <div style="color:#fff;font-size:14px;font-weight:600;">${active.quest_title || 'Quest'}</div>
                        <div style="color:rgba(255,255,255,0.5);font-size:12px;">${active.quest_description || ''}</div>
                        <div style="color:rgba(255,255,255,0.7);font-size:12px;">Progresso: <b>${active.progress || 0}</b></div>
                        <button id="city-claim-quest-btn" data-quest-id="${active.quest_id}" style="padding:8px;background:linear-gradient(135deg,#22c55e,#16a34a);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">${active.status === 'completed' ? 'Resgatar Recompensa' : 'Acompanhar'}</button>
                    </div>
                ` : '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:10px;">Nenhuma quest ativa.</div>'}
                ${available.length > 0 ? `
                    <div style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Quests Disponiveis</div>
                    ${available.map(q => `
                        <div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
                            <div style="color:#22c55e;font-weight:700;font-size:13px;">${q.title}</div>
                            <div style="color:rgba(255,255,255,0.5);font-size:12px;">${q.description || ''}</div>
                            <div style="color:rgba(255,255,255,0.4);font-size:11px;">${professorQuestTypeLabel(q.quest_type)}${q.target_count ? ' - Qtd: ' + q.target_count : ''}</div>
                            <button class="city-accept-quest-btn" data-quest-id="${q.id}" data-npc-id="${npcId}" style="padding:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Aceitar Quest</button>
                        </div>
                    `).join('')}
                ` : ''}
                ${completed.length > 0 ? `
                    <div style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Concluídas</div>
                    ${completed.map(c => `
                        <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:10px;color:rgba(255,255,255,0.6);font-size:12px;">
                            ${c.quest_title || 'Quest #' + c.quest_id} - ${c.status === 'completed' ? 'Concluída' : c.status}
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';

    const claimBtn = overlay.querySelector('#city-claim-quest-btn');
    if (claimBtn) {
        claimBtn.onclick = async () => {
            const qid = Number(claimBtn.dataset.questId);
            const state = await getPlayerQuestState(qid);
            if (!state || state.status !== 'completed') return;
            const msgs = await grantQuestRewards(qid);
            if (!msgs.length) msgs.push('Recompensa resgatada!');
            alert(msgs.join('\n'));
            await window.db.from('player_professor_quests').update({ status: 'claimed', updated_at: new Date().toISOString() }).eq('id', state.id);
            window.Titles?.recordStat?.('quests_completed', 1);
            openPlayerQuestOverlay(npcId);
        };
    }
    overlay.querySelector('#city-player-quests-close').onclick = () => overlay.remove();

    overlay.querySelectorAll('.city-accept-quest-btn').forEach(btn => {
        btn.onclick = async () => {
            const questId = Number(btn.dataset.questId);
            const questNpcId = btn.dataset.npcId;
            const userId = window.GameData?.userId || window.db.auth?.user()?.data?.user?.id;
            const characterId = window.GameData?.currentCharacterId || window.pokefury?.currentCharacterId;
            if (!userId || !characterId) return;
            const { error } = await window.db.from('player_professor_quests').insert({
                user_id: userId,
                character_id: characterId,
                npc_id: questNpcId,
                quest_id: questId,
                status: 'active',
                progress: 0
            });
            if (error) { alert('Erro ao aceitar quest: ' + error.message); return; }
            openPlayerQuestOverlay(npcId);
        };
    });
}

async function incrementProfessorQuestProgress(type, count = 1, biome = null, pokemonId = null) {
    if (!window.db) return;
    const npcId = await ensureProfessorNpcId();
    if (!npcId) return;
    const quests = await loadProfessorQuests(npcId);
    for (const q of quests) {
        if (!q.is_active) continue;
        if (q.quest_type !== type) continue;
        // Quests de bioma: só contam se o bioma atual bater com o alvo da quest
        if (q.quest_type === 'battles_biome' || q.quest_type === 'catch_pokemon_biome') {
            if (!biome) continue;
            if (q.target_biome && biome !== q.target_biome) continue;
        }
        if ((q.quest_type === 'catch_pokemon' || q.quest_type === 'catch_pokemon_biome') && q.target_pokemon_id && pokemonId && pokemonId !== q.target_pokemon_id) continue;
        const state = await getPlayerQuestState(q.id);
        if (state && state.status === 'completed') continue;
        const newProgress = (state?.progress || 0) + count;
        const done = newProgress >= (q.target_count || 1);
        await setPlayerQuestProgress(q.id, done ? (q.target_count || 1) : newProgress);
    }
}

window.ProfessorQuests = {
    ensureProfessorQuestTables,
    loadProfessorQuests,
    loadProfessorQuest,
    loadQuestRewards,
    saveProfessorQuest,
    deleteProfessorQuest,
    saveQuestReward,
    deleteQuestReward,
    loadPlayerActiveProfessorQuest,
    loadPlayerCompletedProfessorQuests,
    setPlayerQuestProgress,
    getPlayerQuestState,
    grantQuestRewards,
    ensureProfessorNpcId,
    openProfessorAdminOverlay,
    openProfessorQuestForm,
    openPlayerQuestOverlay,
    incrementProfessorQuestProgress,
    professorQuestTypeLabel,
    professorRewardTypeLabel,
    PROFESSOR_QUEST_TYPES,
    PROFESSOR_REWARD_TYPES
};

