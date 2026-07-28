import { calculateAllStats, calculateDamage, randomInt, generateIVs, generateEVs } from './utils.js';

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
            if (moveDetails) {
                const validMoves = moveDetails.filter(m => m.power > 0);
                levelMoves = validMoves.slice(0, 4).map(m => ({
                    id: m.id,
                    name: m.name,
                    type: m.type,
                    category: m.category,
                    power: m.power,
                    accuracy: m.accuracy,
                    pp: m.pp
                }));
            }
        }
    } catch (e) {
        console.warn('[Battle] Error fetching level-up moves:', e);
    }

    if (levelMoves.length === 0) {
        const allMoves = await PokeAPI.ensurePokemonMoves(apiData.id);
        const learnedMoves = allMoves.filter(m => m.power > 0);
        levelMoves = learnedMoves.slice(0, 4);
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
            currentPp: move.pp
        })),
        spriteUrls: apiData.spriteUrls,
        shinySpriteUrls: apiData.shinySpriteUrls,
        type: apiData.types[0],
        fainted: false,
        experience: expForLevel(1) + (level - 1) * 50
    };
}

export function recalculateStats(pokemon, baseStats) {
    const newStats = calculateAllStats(baseStats, pokemon.level, pokemon.ivs, pokemon.evs, pokemon.nature);
    const hpDiff = newStats.hp - pokemon.stats.hp;
    pokemon.stats = newStats;
    pokemon.currentHp = Math.max(0, Math.min(newStats.hp, pokemon.currentHp + hpDiff));
    if (pokemon.currentHp <= 0) pokemon.fainted = false;
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

export async function executeTurn(attacker, defender, move) {
    if (!attacker || !defender || !move) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: true, fainted: false };
    }
    const result = await calculateDamage(attacker, defender, move);

    if (result.missed) {
        return { attacker, defender, move, damage: 0, effectiveness: 1, critical: false, missed: true, fainted: false };
    }

    defender.currentHp = Math.max(0, defender.currentHp - result.damage);
    if (defender.currentHp <= 0) {
        defender.fainted = true;
    }

    return {
        attacker,
        defender,
        move,
        damage: result.damage,
        effectiveness: result.effectiveness,
        critical: result.critical,
        missed: false,
        fainted: defender.fainted
    };
}

export function determineTurnOrder(pokemon1, pokemon2) {
    if (pokemon1.stats.speed > pokemon2.stats.speed) return [pokemon1, pokemon2];
    if (pokemon2.stats.speed > pokemon1.stats.speed) return [pokemon2, pokemon1];
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

    const messages = [];
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
                .select('id, name')
                .in('id', moveIds);
            const moveMap = {};
            if (moveDetails) moveDetails.forEach(m => { moveMap[m.id] = m.name; });

            for (const m of data) {
                const moveName = moveMap[m.move_id] || `Move ${m.move_id}`;
                if (pokemon.moves.length < 4) {
                    pokemon.moves.push({ id: String(m.move_id), name: moveName, currentPp: 35 });
                    messages.push(`${pokemon.name} aprendeu ${moveName}!`);
                } else {
                    messages.push(`${pokemon.name} quer aprender ${moveName}, mas já tem 4 movimentos!`);
                }
            }
        }
    } catch (e) {
        console.warn('[Battle] Error learning level-up moves:', e);
    }

    return messages;
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
            if (normalAbilities.length > 0 && !pokemon.currentAbility) {
                pokemon.currentAbility = normalAbilities[0].ability_id;
                return normalAbilities[0].abilities?.name;
            }
        }
    } catch (e) {}

    return null;
}

export function awardExp(team, enemyLevel, activePokemon) {
    const messages = [];
    const baseExp = Math.floor((enemyLevel * 15) / 3);

    for (const p of team) {
        if (p.fainted) continue;

        const isAttacker = activePokemon && p === activePokemon;
        const hasExpShare = p.heldItemId === 99;

        if (!isAttacker && !hasExpShare) continue;

        const prevLevel = p.level;
        p.experience = (p.experience || 0) + baseExp;

        while (p.level < 100) {
            const needed = expForLevel(p.level + 1);
            if (p.experience >= needed) {
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
