import { calculateDamage, calculateStat, randomInt } from './utils.js';

export async function createPokemon(apiData, level) {
    const allMoves = await PokeAPI.ensurePokemonMoves(apiData.id);

    const learnedMoves = allMoves.filter(m => m.power > 0);
    const levelMoves = learnedMoves.slice(0, 4);

    if (levelMoves.length === 0) {
        levelMoves.push({
            id: 33, name: 'Tackle', type: 'normal',
            category: 'physical', power: 40, accuracy: 100, pp: 35
        });
    }

    const hp = calculateStat(apiData.baseStats.hp, level, 20);

    return {
        species: apiData.species,
        name: apiData.name,
        id: apiData.id,
        types: apiData.types,
        level,
        currentHp: hp,
        stats: {
            hp,
            attack: calculateStat(apiData.baseStats.attack, level),
            defense: calculateStat(apiData.baseStats.defense, level),
            spAtk: calculateStat(apiData.baseStats.spAtk, level),
            spDef: calculateStat(apiData.baseStats.spDef, level),
            speed: calculateStat(apiData.baseStats.speed, level)
        },
        moves: levelMoves.map(move => ({
            ...move,
            id: move.id || move.name.toLowerCase().replace(/\s+/g, '-'),
            currentPp: move.pp
        })),
        spriteUrls: apiData.spriteUrls,
        type: apiData.types[0],
        fainted: false
    };
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
