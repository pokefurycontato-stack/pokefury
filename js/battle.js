import { calculateAllStats, calculateDamage, randomInt, generateIVs, generateEVs, processHeldItemOnHit, processLifeOrbRecoil, setChoiceLock, getChoiceLockedMove, getHeldItemEffect } from './utils.js';
import { getMoveEffect, getEffectiveMovePriority, canPokemonAct, processEndOfTurn, applySecondaryEffect, isProtected, clearProtect, applyStatStages, processContactAbilities, resetTurnState, STATUS, STATUS_INFO, applyWeatherDamageModifier, applyTerrainDamageModifier, applyScreenReduction, processEntryHazards, processEntryAbilities, getWeatherSpeed, cacheAbilityName, isGrounded } from './battle-mechanics.js';

const NATURE_NAMES = [
    'hardy','lonely','brave','adamant','naughty',
    'bold','docile','relaxed','impish','lax',
    'timid','hasty','serious','jolly','naive',
    'modest','mild','quiet','bashful','rash',
    'calm','gentle','sassy','careful','quirky'
];

export function randomNature() {
    return NATURE_NAMES[randomInt(0, NATURE_NAMES.length - 1)];
}

export async function createPokemon(apiData, level, savedIvs = null, savedEvs = null, savedNature = null, savedShiny = false) {
    const ivs = savedIvs || generateIVs();
    const evs = savedEvs || generateEVs();
    const nature = savedNature || randomNature();
    const isShiny = savedShiny || false;

    let levelMoves = [];
    try {
        const { data } = await window.db
            .from('pokemon_moves_v2')
            .select('move_id, level_learned')
            .eq('pokemon_id', apiData.id)
            .eq('learn_method', 'level-up')
            .lte('level_learned', level)
            .order('level_learned');

        if (data && data.length > 0) {
            const moveIds = data.map(m => m.move_id);

            const { data: moveDetails } = await window.db
                .from('moves')
                .select('id, name, type, category, power, accuracy, pp')
                .in('id', moveIds);

            const foundIds = new Set((moveDetails || []).map(m => m.id));
            const missingIds = moveIds.filter(id => !foundIds.has(id));

            const dbMoves = (moveDetails || []).map(m => ({
                id: m.id, name: m.name, type: m.type,
                category: m.category || 'physical', power: m.power || 0,
                accuracy: m.accuracy || 100, pp: m.pp || 35
            }));

            for (const mid of missingIds.slice(0, 4)) {
                try {
                    const res = await fetch(`https://pokeapi.co/api/v2/move/${mid}`);
                    if (!res.ok) continue;
                    const api = await res.json();
                    const cat = api.damage_class?.name || null;
                    if (!cat) continue;
                    dbMoves.push({
                        id: api.id, name: api.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        type: api.type?.name || 'normal',
                        category: cat === 'special' ? 'special' : cat === 'status' ? 'status' : 'physical',
                        power: api.power || 0, accuracy: api.accuracy || 100, pp: api.pp || 35
                    });
                } catch (e) {}
            }

            levelMoves = dbMoves.slice(0, 4);

            const hasTypeAttack = levelMoves.some(m => m.type === apiData.types[0] && m.power > 0);
            if (!hasTypeAttack) {
                const { data: allMoves } = await window.db
                    .from('pokemon_moves_v2')
                    .select('move_id, level_learned')
                    .eq('pokemon_id', apiData.id)
                    .eq('learn_method', 'level-up')
                    .order('level_learned');
                if (allMoves && allMoves.length > 0) {
                    const allMoveIds = allMoves.map(m => m.move_id);
                    const { data: allMoveDetails } = await window.db
                        .from('moves')
                        .select('id, name, type, category, power, accuracy, pp')
                        .in('id', allMoveIds);
                    if (allMoveDetails) {
                        const firstTypeMove = allMoveDetails.find(m => m.type === apiData.types[0] && m.power > 0);
                        if (firstTypeMove && !levelMoves.find(m => m.id === firstTypeMove.id)) {
                            levelMoves.unshift({
                                id: firstTypeMove.id, name: firstTypeMove.name, type: firstTypeMove.type,
                                category: firstTypeMove.category || 'physical', power: firstTypeMove.power || 0,
                                accuracy: firstTypeMove.accuracy || 100, pp: firstTypeMove.pp || 35
                            });
                            levelMoves = levelMoves.slice(0, 4);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[Battle] Error fetching level-up moves:', e);
    }

    if (levelMoves.length === 0) {
        try {
            const { data } = await window.db
                .from('pokemon_moves')
                .select('move_id')
                .eq('pokemon_id', apiData.id);
            if (data && data.length > 0) {
                const moveIds = data.map(r => r.move_id);
                const { data: moveDetails } = await window.db
                    .from('moves')
                    .select('id, name, type, category, power, accuracy, pp')
                    .in('id', moveIds);
                if (moveDetails) {
                    levelMoves = moveDetails.slice(0, 4).map(m => ({
                        id: m.id, name: m.name, type: m.type,
                        category: m.category || 'physical', power: m.power || 0,
                        accuracy: m.accuracy || 100, pp: m.pp || 35
                    }));
                }
            }
        } catch (e) {
            console.warn('[Battle] Error in fallback move load:', e);
        }
    }

    if (levelMoves.length === 0) {
        levelMoves.push({
            id: 33, name: 'Tackle', type: 'normal',
            category: 'physical', power: 40, accuracy: 100, pp: 35
        });
    }

    const stats = calculateAllStats(apiData.baseStats, level, ivs, evs, nature);

    return {
        species: apiData.species,
        name: apiData.name,
        id: apiData.id,
        types: apiData.types,
        height: apiData.height || 10,
        weight: apiData.weight || 100,
        level,
        currentHp: stats.hp,
        stats,
        baseStats: { ...apiData.baseStats },
        ivs,
        evs,
        nature,
        isShiny,
        isMega: false,
        heldItemId: null,
        happiness: 70,
        moves: levelMoves.map(move => ({
            ...move,
            id: move.id || move.name.toLowerCase().replace(/\s+/g, '-'),
            currentPp: move.pp || 35
        })),
        spriteUrls: apiData.spriteUrls,
        shinySpriteUrls: apiData.shinySpriteUrls,
        type: apiData.types[0],
        fainted: false,
        experience: 0,
        statusEffect: null,
        basePokemonId: apiData.basePokemonId || null,
        _statStages: { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 },
        currentAbility: null,
        currentAbilityName: null,
        teraType: apiData.teraType || apiData.types?.[0] || 'normal',
        isTerastallized: false,
        _preTeraTypes: null
    };
}

export function recalculateStats(pokemon, baseStats) {
    const newStats = calculateAllStats(baseStats, pokemon.level, pokemon.ivs, pokemon.evs, pokemon.nature);
    const hpDiff = newStats.hp - pokemon.stats.hp;
    pokemon.stats = newStats;
    pokemon.currentHp = Math.max(0, Math.min(newStats.hp, pokemon.currentHp + hpDiff));
    if (pokemon.currentHp <= 0) pokemon.fainted = true;
}

export async function createTeam(apiDataList) {
    const results = [];
    for (const { pokemon, level } of apiDataList) {
        results.push(await createPokemon(pokemon, level));
    }
    return results;
}

export function isTeamFainted(team) {
    return team.every(p => p.fainted);
}

export function getFirstAlive(team) {
    return team.find(p => !p.fainted);
}

export async function executeTurn(attacker, defender, move, battleState, damageMultiplier = 1) {
    if (!attacker || !defender || !move) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: true, fainted: false };
    }

    if (attacker._lockedMoveId && attacker._lockedTurns > 0) {
        const lockedMove = attacker.moves.find(m => String(m.id) === String(attacker._lockedMoveId));
        if (lockedMove) move = lockedMove;
        attacker._lockedTurns--;
        if (attacker._lockedTurns <= 0) attacker._lockedMoveId = null;
    }

    if (attacker._encoredMoveId && attacker._encored > 0) {
        const encoreMove = attacker.moves.find(m => String(m.id) === String(attacker._encoredMoveId));
        if (encoreMove) move = encoreMove;
    }
    const attackerAbility = (attacker.currentAbilityName || '').toLowerCase();
    let abilityMessage = '';
    if ((attackerAbility === 'protean' || attackerAbility === 'libero') && !attacker._proteanUsed && move.type && move.category !== 'status') {
        attacker.types = [move.type];
        attacker._proteanUsed = true;
        abilityMessage = `${attacker.name} mudou para o tipo ${move.type}!`;
    }
    if (move.category === 'status' && attacker._taunted > 0) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, blocked: true, messages: [`${attacker.name} está sob Taunt e não pode usar golpes de status!`] };
    }
    if (attacker._disabledMove && String(attacker._disabledMove.id) === String(move.id)) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, blocked: true, messages: [`${move.name} de ${attacker.name} está desabilitado!`] };
    }
    if (attacker._tormented && attacker._lastMove && String(attacker._lastMove.id) === String(move.id)) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, blocked: true, messages: [`${attacker.name} não pode repetir ${move.name} por causa de Torment!`] };
    }

    if (attacker._rechargeTurns > 0) {
        attacker._rechargeTurns--;
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, recharge: true, messages: [`${attacker.name} precisa recarregar!`] };
    }

    // Check if defender is protected
    if (isProtected(defender)) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, protected: true };
    }

    if (battleState?.terrain === 'psychic' && getEffectiveMovePriority(move, attacker, battleState) > 0 && isGrounded(defender)) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, terrainBlocked: true, messages: [`O Terreno Psíquico bloqueou ${move.name}!`] };
    }

    // Status moves
    if (move.category === 'status') {
        if (getHeldItemEffect(attacker.heldItemId)?.effect === 'assault_vest') {
            return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, blocked: true, messages: [`${attacker.name} não pode usar golpes de status com Assault Vest!`] };
        }
        if (defender._substituteHp > 0) {
            return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, blocked: true, messages: [`O Substitute protegeu ${defender.name}!`] };
        }
        const accuracyCheck = Math.random() * 100 < (move.accuracy || 100);
        if (!accuracyCheck) {
            return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: true, fainted: false };
        }
        const secondaryMessages = applySecondaryEffect(attacker, defender, move, 1, battleState);
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: false, fainted: false, statusMove: true, statusMessages: secondaryMessages };
    }

    const result = await calculateDamage(attacker, defender, move, battleState);

    if (result.missed) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: true, fainted: false };
    }
    if (result.immune) {
        const messages = [`${defender.name} é imune a ${move.name}!`];
        const reaction = result.abilityReaction;
        if (reaction?.heal) {
            const heal = Math.max(1, Math.floor(defender.stats.hp * reaction.heal));
            defender.currentHp = Math.min(defender.stats.hp, defender.currentHp + heal);
            messages.push(`${defender.name} recuperou ${heal} HP com sua habilidade!`);
        }
        if (reaction?.boost) {
            defender._statStages = defender._statStages || {};
            defender._statStages[reaction.boost] = Math.min(6, (defender._statStages[reaction.boost] || 0) + 1);
            messages.push(`${defender.name} teve ${reaction.boost} aumentado pela habilidade!`);
        }
        if (reaction?.flag === 'flashFire') {
            defender._flashFire = true;
            messages.push(`${defender.name} ativou Flash Fire!`);
        }
        return { attacker, defender, move, damage: 0, effectiveness: 0, critical: false, missed: false, fainted: false, immune: true, messages };
    }

    // Calculate damage with stat stages
    let damage = result.damage;
    damage = applyStatStages(attacker, defender, move, damage, result.critical);

    // Handle multi-hit moves
    const effect = getMoveEffect(move);

    let totalDamage = 0;
    let hits = 1;
    if (effect && effect.effect === 'multi_hit') {
        hits = randomInt(effect.minHits, effect.maxHits);
        for (let i = 0; i < hits; i++) {
            const hitResult = await calculateDamage(attacker, defender, move, battleState);
            if (!hitResult.missed) {
                let hitDmg = applyStatStages(attacker, defender, move, hitResult.damage, hitResult.critical);
                hitDmg = applyWeatherDamageModifier(attacker, move, hitDmg, battleState);
                hitDmg = applyTerrainDamageModifier(attacker, defender, move, hitDmg, battleState);
                hitDmg = applyScreenReduction(defender, move, hitDmg);
                totalDamage += hitDmg;
            }
        }
        damage = totalDamage;
    } else {
        damage = applyWeatherDamageModifier(attacker, move, damage, battleState);
        damage = applyTerrainDamageModifier(attacker, defender, move, damage, battleState);
        damage = applyScreenReduction(defender, move, damage);
    }

    if (damageMultiplier !== 1 && damage > 0) {
        damage = Math.max(1, Math.floor(damage * damageMultiplier));
    }

    if (defender._substituteHp > 0) {
        const substituteDamage = Math.min(defender._substituteHp, Math.max(0, damage));
        defender._substituteHp -= substituteDamage;
        const messages = [`O Substitute de ${defender.name} absorveu ${substituteDamage} de dano!`];
        if (defender._substituteHp <= 0) {
            defender._substituteHp = 0;
            messages.push(`O Substitute de ${defender.name} quebrou!`);
        }
        return { attacker, defender, move, damage: substituteDamage, effectiveness: result.effectiveness, critical: result.critical, missed: false, fainted: false, messages };
    }

    // Apply damage
    const onHitResult = processHeldItemOnHit(defender, attacker, damage);
    damage = onHitResult.damage;
    defender.currentHp = Math.max(0, defender.currentHp - damage);
    if (defender.currentHp <= 0) {
        defender.fainted = true;
    }

    // Track damage dealt for Shell Bell
    attacker._lastDamageDealt = (attacker._lastDamageDealt || 0) + damage;

    // Handle recoil
        const messages = [...onHitResult.messages];
        if (abilityMessage) messages.push(abilityMessage);
    if (effect && effect.effect === 'recoil' && damage > 0) {
        const recoilDmg = Math.max(1, Math.floor(damage * effect.recoil));
        attacker.currentHp = Math.max(0, attacker.currentHp - recoilDmg);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        messages.push(`${attacker.name} perdeu ${recoilDmg} HP com recuo!`);
    }

    // Handle drain
    if (effect && effect.effect === 'drain' && damage > 0) {
        const healAmt = Math.floor(damage * effect.drain);
        attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + healAmt);
        messages.push(`${attacker.name} drenou ${healAmt} HP!`);
    }

    // Apply secondary effects (status, stat drops, flinch, weather, terrain, hazards, screens)
    const abilityName = (attacker.currentAbilityName || '').toLowerCase();
    const secondaryMsgs = abilityName === 'sheer force'
        ? []
        : applySecondaryEffect(attacker, defender, move, result.effectiveness, battleState);
    messages.push(...secondaryMsgs);
    if (defender.currentAbilityName?.toLowerCase() === 'color change' && move.type) {
        defender.types = [move.type];
        messages.push(`${defender.name} mudou para o tipo ${move.type} com Color Change!`);
    }

    if (effect?.effect === 'recharge' && !defender.fainted) {
        attacker._rechargeTurns = 1;
        messages.push(`${attacker.name} precisa recarregar no próximo turno!`);
    }
    if (effect?.effect === 'multi_turn' && !attacker._lockedMoveId) {
        attacker._lockedMoveId = move.id;
        attacker._lockedTurns = randomInt(1, 3);
        messages.push(`${attacker.name} ficou preso usando ${move.name}!`);
    }

    // Process contact abilities (flame body, static, etc.)
    if (move.category === 'physical' || move.makesContact) {
        const contactMsgs = processContactAbilities(defender, attacker);
        messages.push(...contactMsgs);
    }

    // Track last move for Disable/Encore
    attacker._lastMove = move;

    // Life Orb recoil
    const lifeOrbMsg = processLifeOrbRecoil(attacker);
    if (lifeOrbMsg) messages.push(lifeOrbMsg);

    // Choice lock
    setChoiceLock(attacker, move);

    return {
        attacker,
        defender,
        move,
        damage,
        effectiveness: result.effectiveness,
        critical: result.critical,
        missed: false,
        fainted: defender.fainted,
        hits,
        messages
    };
}

function getStatName(stat) {
    const names = { attack: 'Ataque', defense: 'Defesa', spAtk: 'Sp.Atk', spDef: 'Sp.Def', speed: 'Velocidade' };
    return names[stat] || stat;
}

function getStageText(stages) {
    if (stages === 1) return 'em 1 estágio';
    if (stages === -1) return 'em 1 estágio';
    if (stages > 0) return `em ${stages} estágios`;
    return `em ${Math.abs(stages)} estágios`;
}

function applyStatusEffect(attacker, defender, move) {
    const name = (move.name || '').toLowerCase();
    attacker._statStages = attacker._statStages || { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
    defender._statStages = defender._statStages || { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
    const messages = [];

    if (name.includes('harden') || name.includes('withdraw') || name.includes('iron defense')) {
        attacker._statStages.defense = Math.min(6, attacker._statStages.defense + 1);
        messages.push(`A Defesa de ${attacker.name} aumentou ${getStageText(1)}!`);
    } else if (name.includes('tail whip') || name.includes('leer') || name.includes('screech')) {
        defender._statStages.defense = Math.max(-6, defender._statStages.defense - 1);
        messages.push(`A Defesa de ${defender.name} diminuiu ${getStageText(-1)}!`);
    } else if (name.includes('growl') || name.includes('string shot')) {
        defender._statStages.attack = Math.max(-6, defender._statStages.attack - 1);
        messages.push(`O Ataque de ${defender.name} diminuiu ${getStageText(-1)}!`);
    } else if (name.includes('swords dance')) {
        attacker._statStages.attack = Math.min(6, attacker._statStages.attack + 1);
        messages.push(`O Ataque de ${attacker.name} aumentou ${getStageText(1)}!`);
    } else if (name.includes('agility')) {
        attacker._statStages.speed = Math.min(6, attacker._statStages.speed + 1);
        messages.push(`A Velocidade de ${attacker.name} aumentou ${getStageText(1)}!`);
    } else if (name.includes('double team')) {
        attacker._statStages.speed = Math.min(6, attacker._statStages.speed + 1);
        messages.push(`A Velocidade de ${attacker.name} aumentou ${getStageText(1)}!`);
    } else if (name.includes('smokescreen') || name.includes('sand attack')) {
        defender._statStages.speed = Math.max(-6, defender._statStages.speed - 1);
        messages.push(`A Velocidade de ${defender.name} diminuiu ${getStageText(-1)}!`);
    } else if (name.includes('smog') || name.includes('poison powder') || name.includes('stun spore') || name.includes('sleep powder')) {
        messages.push(`${attacker.name} usou ${move.name}!`);
    } else {
        messages.push(`${attacker.name} usou ${move.name}!`);
    }

    return messages;
}

export function determineTurnOrder(pokemon1, pokemon2, battleState = null) {
    const getSpeed = pokemon => {
        let speed = battleState ? getWeatherSpeed(pokemon, battleState) : (pokemon.stats.speed || 0);
        if (getHeldItemEffect(pokemon.heldItemId)?.effect === 'choice_scarf') speed *= 1.5;
        return speed;
    };
    const speed1 = getSpeed(pokemon1);
    const speed2 = getSpeed(pokemon2);
    if (speed1 > speed2) return [pokemon1, pokemon2];
    if (speed2 > speed1) return [pokemon2, pokemon1];
    return Math.random() < 0.5 ? [pokemon1, pokemon2] : [pokemon2, pokemon1];
}

export function getAIMove(aiPokemon) {
    const available = aiPokemon.moves.filter(m => m.currentPp > 0);
    if (available.length === 0) return null;
    return available[randomInt(0, available.length - 1)];
}

export function getEffectivenessText(effectiveness) {
    if (effectiveness > 1) return 'Super efetivo!';
    if (effectiveness < 1 && effectiveness > 0) return 'Não é muito efetivo...';
    if (effectiveness === 0) return 'Não afetou o oponente!';
    return '';
}

export function expForLevel(level) {
    return Math.floor(Math.pow(level, 3) * 0.8);
}

export async function learnLevelUpMoves(pokemon, fromLevel, toLevel) {
    if (!window.db || !pokemon.id) return [];

    const learnable = [];
    try {
        const { data } = await window.db
            .from('pokemon_moves_v2')
            .select('move_id, level_learned')
            .eq('pokemon_id', pokemon.id)
            .eq('learn_method', 'level-up')
            .gte('level_learned', fromLevel + 1)
            .lte('level_learned', toLevel);

        if (data && data.length > 0) {
            const moveIds = data.map(m => m.move_id);
            const { data: moveDetails } = await window.db
                .from('moves')
                .select('id, name, type, category, power, accuracy, pp')
                .in('id', moveIds);

            const foundIds = new Set((moveDetails || []).map(m => m.id));
            const missingIds = moveIds.filter(id => !foundIds.has(id));

            const dbMoves = (moveDetails || []).map(m => ({
                id: m.id, name: m.name, type: m.type,
                category: m.category || 'physical', power: m.power || 0,
                accuracy: m.accuracy || 100, pp: m.pp || 35
            }));

            for (const mid of missingIds) {
                try {
                    const res = await fetch(`https://pokeapi.co/api/v2/move/${mid}`);
                    if (!res.ok) continue;
                    const api = await res.json();
                    const cat = api.damage_class?.name || null;
                    if (!cat) continue;
                    dbMoves.push({
                        id: api.id, name: api.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        type: api.type?.name || 'normal',
                        category: cat === 'special' ? 'special' : cat === 'status' ? 'status' : 'physical',
                        power: api.power || 0, accuracy: api.accuracy || 100, pp: api.pp || 35
                    });
                } catch (e) {}
            }

            for (const m of dbMoves) {
                const alreadyKnows = pokemon.moves.some(pm => Number(pm.id) === m.id);
                if (!alreadyKnows) {
                    learnable.push(m);
                }
            }
        }
    } catch (e) {
        console.warn('[Battle] Error checking level-up moves:', e);
    }

    return learnable;
}

export async function checkAbilityChange(pokemon) {
    if (!window.db || !pokemon.id) return null;

    try {
        const { data } = await window.db
            .from('pokemon_abilities')
            .select('ability_id, is_hidden, abilities(name)')
            .eq('pokemon_id', pokemon.id)
            .order('slot');

        if (data && data.length > 0) {
            const normalAbilities = data.filter(a => !a.is_hidden);
            if (normalAbilities.length > 0) {
                if (!pokemon.currentAbility) {
                    pokemon.currentAbility = normalAbilities[0].ability_id;
                }
                if (!pokemon.currentAbilityName) {
                    pokemon.currentAbilityName = normalAbilities[0].abilities?.name || '';
                }
                if (pokemon.currentAbility && pokemon.currentAbilityName) {
                    cacheAbilityName(pokemon.currentAbility, pokemon.currentAbilityName);
                }
                return normalAbilities[0].abilities?.name;
            }
        }
    } catch (e) {}

    return null;
}

export function awardExp(team, enemyLevel, activePokemon) {
    const messages = [];
    let baseExp = Math.floor((enemyLevel * 15) / 9) * 3;

    // Pokémon EXP boost (2x)
    if (window.boostsManager && window.boostsManager.isActive('exp_pokemon')) {
        baseExp *= 2;
    }

    for (const p of team) {
        if (p.fainted) continue;

        const isAttacker = activePokemon && p === activePokemon;
        const hasExpShare = p.heldItemId === 99;

        if (!isAttacker && !hasExpShare) continue;

        let expGain = baseExp;
        // Lucky Egg: +50% EXP
        if (p.heldItemId === 219) expGain = Math.floor(expGain * 1.5);

        const prevLevel = p.level;
        p.experience = (p.experience || 0) + expGain;

        while (p.level < 100) {
            const needed = expForLevel(p.level + 1);
            if (p.experience >= needed) {
                p.experience = p.experience - needed;
                p.level++;
                const oldMaxHp = p.stats.hp;
                recalculateStats(p, p.baseStats || p.stats);
                p.currentHp = Math.min(p.stats.hp, p.currentHp + (p.stats.hp - oldMaxHp));
            } else {
                break;
            }
        }

        if (p.level > prevLevel) {
            messages.push(`${p.name} subiu para Nv. ${p.level}!`);
        }
    }

    return messages;
}
