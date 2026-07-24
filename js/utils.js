let TYPE_EFFECTIVENESS = null;

async function loadTypeEffectiveness() {
    if (TYPE_EFFECTIVENESS) return TYPE_EFFECTIVENESS;
    const { data } = await window.db
        .from('type_effectiveness')
        .select('*');
    if (!data) return {};
    TYPE_EFFECTIVENESS = {};
    for (const row of data) {
        if (!TYPE_EFFECTIVENESS[row.attack_type]) TYPE_EFFECTIVENESS[row.attack_type] = {};
        TYPE_EFFECTIVENESS[row.attack_type][row.defense_type] = row.multiplier;
    }
    return TYPE_EFFECTIVENESS;
}

export { loadTypeEffectiveness };

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateIVs() {
    return {
        hp: randomInt(0, 31),
        attack: randomInt(0, 31),
        defense: randomInt(0, 31),
        spAtk: randomInt(0, 31),
        spDef: randomInt(0, 31),
        speed: randomInt(0, 31)
    };
}

export function generateEVs() {
    return { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
}

export function calculateStatWithIVs(baseStat, level, iv, ev, natureMultiplier = 1) {
    return Math.floor((((2 * baseStat + iv + Math.floor(ev / 4)) * level / 100) + 5) * natureMultiplier);
}

export function calculateHP(baseHp, level, iv, ev) {
    return Math.floor(((2 * baseHp + iv + Math.floor(ev / 4)) * level / 100) + level + 10);
}

export function getNatureMultiplier(natureName, statName) {
    const NATURES = {
        lonely:   { attack: 1.1, defense: 0.9 },
        brave:    { attack: 1.1, speed: 0.9 },
        adamant:  { attack: 1.1, spAtk: 0.9 },
        naughty:  { attack: 1.1, spDef: 0.9 },
        bold:     { defense: 1.1, attack: 0.9 },
        relaxed:  { defense: 1.1, speed: 0.9 },
        impish:   { defense: 1.1, spAtk: 0.9 },
        lax:      { defense: 1.1, spDef: 0.9 },
        timid:    { speed: 1.1, attack: 0.9 },
        hasty:    { speed: 1.1, defense: 0.9 },
        jolly:    { speed: 1.1, spAtk: 0.9 },
        naive:    { speed: 1.1, spDef: 0.9 },
        modest:   { spAtk: 1.1, attack: 0.9 },
        mild:     { spAtk: 1.1, defense: 0.9 },
        quiet:    { spAtk: 1.1, speed: 0.9 },
        rash:     { spAtk: 1.1, spDef: 0.9 },
        calm:     { spDef: 1.1, attack: 0.9 },
        gentle:   { spDef: 1.1, defense: 0.9 },
        sassy:    { spDef: 1.1, speed: 0.9 },
        careful:  { spDef: 1.1, spAtk: 0.9 }
    };

    const nature = NATURES[natureName];
    if (!nature || !nature[statName]) return 1.0;
    return nature[statName];
}

export function calculateAllStats(baseStats, level, ivs, evs, nature) {
    return {
        hp: calculateHP(baseStats.hp, level, ivs.hp, evs.hp),
        attack: calculateStatWithIVs(baseStats.attack, level, ivs.attack, evs.attack, getNatureMultiplier(nature, 'attack')),
        defense: calculateStatWithIVs(baseStats.defense, level, ivs.defense, evs.defense, getNatureMultiplier(nature, 'defense')),
        spAtk: calculateStatWithIVs(baseStats.spAtk, level, ivs.spAtk, evs.spAtk, getNatureMultiplier(nature, 'spAtk')),
        spDef: calculateStatWithIVs(baseStats.spDef, level, ivs.spDef, evs.spDef, getNatureMultiplier(nature, 'spDef')),
        speed: calculateStatWithIVs(baseStats.speed, level, ivs.speed, evs.speed, getNatureMultiplier(nature, 'speed'))
    };
}

export async function calculateDamage(attacker, defender, move) {
    const chart = await loadTypeEffectiveness();
    const level = attacker.level || 50;
    const attack = move.category === 'physical' ? attacker.stats.attack : attacker.stats.spAtk;
    const defense = move.category === 'physical' ? defender.stats.defense : defender.stats.spDef;

    let damage = ((2 * level / 5 + 2) * move.power * attack / defense) / 50 + 2;

    const effectiveness = getEffectiveness(chart, move.type, defender.types);
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

export function getEffectiveness(chart, attackType, defenderTypes) {
    let multiplier = 1;
    for (const defType of defenderTypes) {
        const chartRow = chart[attackType];
        if (chartRow && chartRow[defType] !== undefined) {
            multiplier *= chartRow[defType];
        }
    }
    return multiplier;
}

export function calculateStat(base, level, iv = 31) {
    return Math.floor(((2 * base + iv) * level / 100) + 5);
}
