import { TYPE_EFFECTIVENESS } from './data.js';

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateDamage(attacker, defender, move) {
    const level = attacker.level || 50;
    const attack = move.category === 'physical' ? attacker.stats.attack : attacker.stats.spAtk;
    const defense = move.category === 'physical' ? defender.stats.defense : defender.stats.spDef;

    let damage = ((2 * level / 5 + 2) * move.power * attack / defense) / 50 + 2;

    const effectiveness = getEffectiveness(move.type, defender.types);
    damage *= effectiveness;

    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    damage *= stab;

    const critical = Math.random() < 1 / 16 ? 1.5 : 1;
    damage *= critical;

    const randomFactor = randomInt(85, 100) / 100;
    damage *= randomFactor;

    const accuracyCheck = Math.random() * 100 < move.accuracy;

    return {
        damage: Math.max(1, Math.floor(damage)),
        effectiveness,
        critical: critical > 1,
        missed: !accuracyCheck
    };
}

export function getEffectiveness(attackType, defenderTypes) {
    let multiplier = 1;
    for (const defType of defenderTypes) {
        const chart = TYPE_EFFECTIVENESS[attackType];
        if (chart && chart[defType] !== undefined) {
            multiplier *= chart[defType];
        }
    }
    return multiplier;
}

export function calculateStat(base, level, iv = 31) {
    return Math.floor(((2 * base + iv) * level / 100) + 5);
}
