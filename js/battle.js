import { MOVES, POKEMON_DATA } from './data.js';
import { calculateDamage, calculateStat, randomInt } from './utils.js';

export function createPokemon(species, level) {
    const data = POKEMON_DATA[species];
    const hp = calculateStat(data.baseStats.hp, level, 20);
    return {
        species,
        name: data.name,
        types: data.types,
        level,
        currentHp: hp,
        stats: {
            hp,
            attack: calculateStat(data.baseStats.attack, level),
            defense: calculateStat(data.baseStats.defense, level),
            spAtk: calculateStat(data.baseStats.spAtk, level),
            spDef: calculateStat(data.baseStats.spDef, level),
            speed: calculateStat(data.baseStats.speed, level)
        },
        moves: data.moves.slice(0, 4).map(moveId => ({
            ...MOVES[moveId],
            id: moveId,
            currentPp: MOVES[moveId].pp
        })),
        color: data.color,
        fainted: false
    };
}

export function createTeam(species, level) {
    return species.map(s => createPokemon(s, level));
}

export function isTeamFainted(team) {
    return team.every(p => p.fainted);
}

export function getFirstAlive(team) {
    return team.find(p => !p.fainted);
}

export function executeTurn(attacker, defender, move) {
    const result = calculateDamage(attacker, defender, move);

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
