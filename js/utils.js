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

export function calculateStat(base, level, iv = 31) {
    return Math.floor(((2 * base + iv) * level / 100) + 5);
}

// ============================================================
// TOTAL POWER (Poder Total)
// ============================================================
const NATURE_BOOST = {
    lonely: 'attack', brave: 'attack', adamant: 'attack', naughty: 'attack',
    bold: 'defense', relaxed: 'defense', impish: 'defense', lax: 'defense',
    timid: 'speed', hasty: 'speed', jolly: 'speed', naive: 'speed',
    modest: 'spAtk', mild: 'spAtk', quiet: 'spAtk', rash: 'spAtk',
    calm: 'spDef', gentle: 'spDef', sassy: 'spDef', careful: 'spDef'
};

export function getHighestBaseStat(baseStats) {
    if (!baseStats) return null;
    const order = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];
    let best = 'hp';
    let bestVal = -1;
    for (const s of order) {
        const v = baseStats[s] || 0;
        if (v > bestVal) { bestVal = v; best = s; }
    }
    return best;
}

export function sumStatObject(obj) {
    if (!obj) return 0;
    return (obj.hp || 0) + (obj.attack || 0) + (obj.defense || 0) +
           (obj.spAtk || 0) + (obj.spDef || 0) + (obj.speed || 0);
}

export function calculatePokemonPower(pokemon) {
    if (!pokemon) return 0;
    const statSum = sumStatObject(pokemon.stats);
    const ivSum = sumStatObject(pokemon.ivs);
    const evSum = sumStatObject(pokemon.evs);
    let natureBonus = 0;
    const boostStat = NATURE_BOOST[pokemon.nature];
    if (boostStat && pokemon.baseStats && getHighestBaseStat(pokemon.baseStats) === boostStat) {
        natureBonus = 150;
    }
    return Math.round(statSum + ivSum * 3 + evSum * 0.5 + natureBonus);
}

if (typeof window !== 'undefined') {
    window.calculatePokemonPower = calculatePokemonPower;
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

// ============================================================
// HELD ITEM LOOKUP
// ============================================================
export function getHeldItemEffect(itemId) {
    if (!itemId) return null;
    if (window.ALL_ITEMS) {
        return window.ALL_ITEMS.find(i => i.id === itemId) || null;
    }
    return null;
}

export function getPokemonItemEffect(pokemon) {
    if (!pokemon || !pokemon.heldItemId) return null;
    const item = getHeldItemEffect(pokemon.heldItemId);
    return item ? item.effect : null;
}

// ============================================================
// DAMAGE CALCULATION with held items
// ============================================================
export async function calculateDamage(attacker, defender, move, battleState = null) {
    if (!attacker?.stats || !defender?.stats) {
        return { damage: 0, effectiveness: 1, critical: false, missed: true };
    }
    const isTeraBlast = String(move.name || '').toLowerCase() === 'tera blast';
    let moveType = isTeraBlast && attacker.isTerastallized ? attacker.teraType : move.type;
    const moveCategory = isTeraBlast && attacker.isTerastallized
        ? ((attacker.stats.attack || 0) > (attacker.stats.spAtk || 0) ? 'physical' : 'special')
        : move.category;
    const moveName = String(move.name || '').toLowerCase().trim();
    const dynamicMove = ['endeavor', 'dragon rage', 'sonic boom', 'seismic toss', 'night shade', 'super fang', 'fissure', 'horn drill', 'sheer cold', 'guillotine'];
    if (moveCategory === 'status' || (!move.power && !dynamicMove.includes(moveName))) {
        const accuracyCheck = Math.random() * 100 < (move.accuracy || 100);
        return { damage: 0, effectiveness: 1, critical: false, missed: !accuracyCheck };
    }
    const chart = await loadTypeEffectiveness();
    const level = attacker.level || 50;
    let attack = moveCategory === 'physical' ? attacker.stats.attack : attacker.stats.spAtk;
    let defense = moveCategory === 'physical' ? defender.stats.defense : defender.stats.spDef;

    const attackerItem = getHeldItemEffect(attacker.heldItemId);
    const defenderItem = getHeldItemEffect(defender.heldItemId);

    const abilitiesSuppressed = !!battleState?._neutralizingGas;
    const attackerAbilityName = abilitiesSuppressed ? '' : ((typeof attacker.currentAbilityName === 'string' && attacker.currentAbilityName) || '');
    const defAbilityName = abilitiesSuppressed ? '' : ((typeof defender.currentAbilityName === 'string' && defender.currentAbilityName) || '');
    const bypassAbilities = ['mold breaker', 'teravolt', 'turboblaze'].includes(attackerAbilityName);
    const typeAbilities = {
        pixilate: { type: 'fairy', multiplier: 1.2 }, refrigerate: { type: 'ice', multiplier: 1.2 },
        aerilate: { type: 'flying', multiplier: 1.2 }, galvanize: { type: 'electric', multiplier: 1.2 }
    };
    const soundMoves = ['boomburst', 'bug buzz', 'clangorous soul', 'disarming voice', 'echoed voice', 'growl', 'hyper voice', 'metal sound', 'perish song', 'roar', 'round', 'screech', 'sing', 'snarl', 'snore', 'supersonic', 'uproar'];
    const bulletMoves = ['aura sphere', 'bullet seed', 'electro ball', 'focus blast', 'gyro ball', 'ice ball', 'mist ball', 'mud bomb', 'octazooka', 'rock blast', 'seed bomb', 'shadow ball', 'sludge bomb', 'weather ball', 'zap cannon'];
    if (defAbilityName === 'soundproof' && soundMoves.includes(moveName)) return { damage: 0, effectiveness: 0, critical: false, missed: false, immune: true };
    if (defAbilityName === 'bulletproof' && bulletMoves.includes(moveName)) return { damage: 0, effectiveness: 0, critical: false, missed: false, immune: true };

    const abilityImmuneTypes = {
        levitate: ['ground'],
        'water absorb': ['water'],
        'volt absorb': ['electric'],
        'lightning rod': ['electric'],
        'motor drive': ['electric'],
        'sap sipper': ['grass'], 'flash fire': ['fire'], 'storm drain': ['water'], 'earth eater': ['ground'], 'dry skin': ['water']
    };
    if (!bypassAbilities && abilityImmuneTypes[defAbilityName]?.includes(moveType)) {
        const reactions = {
            'water absorb': { heal: 0.25 },
            'volt absorb': { heal: 0.25 },
            'lightning rod': { boost: 'spAtk' },
            'motor drive': { boost: 'speed' },
            'sap sipper': { boost: 'attack' }, 'storm drain': { boost: 'spAtk' }, 'flash fire': { flag: 'flashFire' }, 'dry skin': { heal: 0.25 }
        };
        return { damage: 0, effectiveness: 0, critical: false, missed: false, immune: true, abilityReaction: reactions[defAbilityName] || null };
    }

    if (['fissure', 'horn drill', 'sheer cold', 'guillotine'].includes(moveName)) {
        const chance = Math.max(0, Math.min(100, 30 + (attacker.level || 1) - (defender.level || 1)));
        if (Math.random() * 100 >= chance) return { damage: 0, effectiveness: 1, critical: false, missed: true };
        return { damage: defender.currentHp, effectiveness: 1, critical: false, missed: false, fainted: true, ohko: true };
    }

    let movePower = move.power;
    if (moveType === 'normal' && typeAbilities[attackerAbilityName]) {
        moveType = typeAbilities[attackerAbilityName].type;
        movePower *= typeAbilities[attackerAbilityName].multiplier;
    } else if (attackerAbilityName === 'normalize') {
        moveType = 'normal';
        movePower *= 1.2;
    }
    if (moveName === 'weather ball' && battleState?.weather) {
        const weatherTypes = { rain: 'water', sun: 'fire', sandstorm: 'rock', snow: 'ice', hail: 'ice' };
        moveType = weatherTypes[battleState.weather] || moveType;
        movePower = 100;
    }
    if (moveName === 'stored power' || moveName === 'power trip') {
        const stages = attacker._statStages || {};
        movePower = 20 + 20 * Object.values(stages).filter(v => v > 0).reduce((sum, v) => sum + v, 0);
    }
    if (moveName === 'hex' && defender.statusEffect) movePower = 130;
    if (moveName === 'facade' && attacker.statusEffect) movePower = 140;
    if (moveName === 'knock off' && defender.heldItemId) movePower = Math.floor(movePower * 1.5);
    if (moveName === 'gyro ball') movePower = Math.min(150, Math.max(1, Math.floor(25 * (defender.stats.speed || 1) / Math.max(1, attacker.stats.speed || 1))));
    if (moveName === 'low kick' || moveName === 'grass knot') {
        const weight = defender.weight || 100;
        movePower = weight >= 200 ? 120 : weight >= 100 ? 100 : weight >= 50 ? 80 : weight >= 25 ? 60 : weight >= 10 ? 40 : 20;
    }
    if (moveName === 'heavy slam' || moveName === 'heat crash') {
        const ratio = (attacker.weight || 100) / Math.max(1, defender.weight || 100);
        movePower = ratio >= 5 ? 120 : ratio >= 4 ? 100 : ratio >= 3 ? 80 : ratio >= 2 ? 60 : 40;
    }
    if (moveName === 'flail' || moveName === 'reversal') {
        const hpRatio = attacker.currentHp / Math.max(1, attacker.stats.hp);
        movePower = hpRatio <= 1 / 16 ? 200 : hpRatio <= 1 / 8 ? 150 : hpRatio <= 1 / 5 ? 100 : hpRatio <= 1 / 3 ? 80 : hpRatio <= 0.5 ? 40 : 20;
    }

    if (attackerItem) {
        if (attackerItem.effect === 'choice_band' && move.category === 'physical') attack *= 1.5;
        if (attackerItem.effect === 'choice_specs' && move.category === 'special') attack *= 1.5;
    }
    if (defenderItem) {
        if (defenderItem.effect === 'assault_vest' && move.category === 'special') defense *= 1.5;
        if (defenderItem.effect === 'eviolite' && defender.isFullyEvolved === false) {
            defense *= 1.5;
        }
    }

    if (defAbilityName === 'marvel scale' && defender.statusEffect && moveCategory === 'physical') defense *= 1.5;
    if (defAbilityName === 'fur coat' && moveCategory === 'physical') defense *= 2;
    if (defAbilityName === 'ice scales' && moveCategory === 'special') defense *= 2;
    if (attackerAbilityName === 'solar power' && battleState?.weather === 'sun' && moveCategory === 'special') attack *= 1.5;

    // Gen 9 Snow grants Ice-types 1.5x Defense against physical moves.
    if (battleState?.weather === 'snow' && moveCategory === 'physical' && defender.types?.includes('ice')) {
        defense *= 1.5;
    }

    if (attackerAbilityName === 'huge power' || attackerAbilityName === 'pure power') {
        if (move.category === 'physical') attack *= 2;
    }
    if (attackerAbilityName === 'guts' && attacker.statusEffect && move.category === 'physical') {
        attack *= 1.5;
    }
    if (attackerAbilityName === 'hustle' && move.category === 'physical') {
        attack *= 1.5;
    }
    let damage;
    if (moveName === 'dragon rage') damage = 40;
    else if (moveName === 'sonic boom') damage = 20;
    else if (moveName === 'seismic toss' || moveName === 'night shade') damage = level;
    else if (moveName === 'super fang') damage = Math.floor(defender.currentHp / 2);
    else if (moveName === 'endeavor') damage = Math.max(0, defender.currentHp - attacker.currentHp);
    else damage = ((2 * level / 5 + 2) * movePower * attack / defense) / 50 + 2;

    let effectiveness = getEffectiveness(chart, moveType, defender.types);
    if (!bypassAbilities && defAbilityName === 'thick fat' && (moveType === 'fire' || moveType === 'ice')) effectiveness *= 0.5;
    if (!bypassAbilities && defAbilityName === 'water bubble' && moveType === 'fire') effectiveness *= 0.5;
    if (!bypassAbilities && defAbilityName === 'heatproof' && moveType === 'fire') effectiveness *= 0.5;
    if (!bypassAbilities && defAbilityName === 'wonder guard' && effectiveness <= 1) {
        return { damage: 0, effectiveness, critical: false, missed: false, immune: true };
    }
    damage *= effectiveness;
    if (attackerAbilityName === 'flash fire' && moveType === 'fire' && attacker._flashFire) damage *= 1.5;
    if (attackerAbilityName === 'water bubble' && moveType === 'water') damage *= 2;
    if (attackerAbilityName === 'dry skin' && moveType === 'fire') damage *= 1.25;
    if (attackerAbilityName === 'sand force' && battleState?.weather === 'sandstorm' && ['rock', 'ground', 'steel'].includes(moveType)) damage *= 1.3;
    if (attackerAbilityName === 'tinted lens' && effectiveness > 0 && effectiveness < 1) damage *= 2;
    if (!bypassAbilities && defAbilityName === 'multiscale' && defender.currentHp >= defender.stats.hp) damage *= 0.5;
    if (!bypassAbilities && effectiveness > 1 && ['filter', 'solid rock', 'prism armor'].includes(defAbilityName)) damage *= 0.75;

    const isSTAB = attacker.types && attacker.types.includes(moveType);
    let stabMult = isSTAB ? 1.5 : 1;
    if (attackerAbilityName === 'adaptability' && isSTAB) stabMult = 2;
    if (attacker.isTerastallized && moveType === attacker.teraType) {
        stabMult = attacker._preTeraTypes?.includes(moveType) ? 2 : 1.5;
        if (attackerAbilityName === 'adaptability') stabMult = 2.25;
    }
    damage *= stabMult;

    const biteMoves = ['bite', 'crunch', 'fire fang', 'ice fang', 'thunder fang', 'poison fang', 'hyper fang', 'jaw lock'];
    const punchMoves = ['bullet punch', 'drain punch', 'dynamic punch', 'fire punch', 'focus punch', 'ice punch', 'mach punch', 'meteor mash', 'power-up punch', 'shadow punch', 'sky uppercut', 'thunder punch'];
    const pulseMoves = ['aura sphere', 'dark pulse', 'dragon pulse', 'heal pulse', 'origin pulse', 'terrain pulse', 'water pulse'];
    const slicingMoves = ['aerial ace', 'air slash', 'cut', 'fury cutter', 'leaf blade', 'night slash', 'psycho cut', 'razor leaf', 'sacred sword', 'slash', 'stone axe', 'x-scissor'];
    if (attackerAbilityName === 'strong jaw' && biteMoves.includes(moveName)) damage *= 1.5;
    if (attackerAbilityName === 'iron fist' && punchMoves.includes(moveName)) damage *= 1.2;
    if (attackerAbilityName === 'mega launcher' && pulseMoves.includes(moveName)) damage *= 1.5;
    if (attackerAbilityName === 'sharpness' && slicingMoves.includes(moveName)) damage *= 1.5;
    if (attackerAbilityName === 'tough claws' && move.category === 'physical') damage *= 1.3;
    const sheerForceMoves = ['flamethrower', 'fire blast', 'thunderbolt', 'thunder', 'ice beam', 'blizzard', 'scald', 'rock slide', 'iron head', 'air slash', 'dark pulse', 'shadow ball', 'energy ball', 'earth power', 'sludge bomb', 'poison jab', 'water pulse', 'dragon pulse'];
    if (attackerAbilityName === 'sheer force' && sheerForceMoves.includes(moveName)) damage *= 1.3;

    if (attackerAbilityName === 'technician' && movePower && movePower <= 60) {
        damage *= 1.5;
    }

    const criticalBlocked = defAbilityName === 'battle armor' || defAbilityName === 'shell armor';
    const critical = !criticalBlocked && Math.random() < 1 / 16 ? (attackerAbilityName === 'sniper' ? 2.25 : 1.5) : 1;
    damage *= critical;

    if (attackerItem) {
        if (attackerItem.effect === 'life_orb') damage *= 1.3;
        if (attackerItem.effect === 'expert_belt' && effectiveness > 1) damage *= 1.2;
        if (attackerItem.effect === 'muscle_band' && move.category === 'physical') damage *= 1.1;
        if (attackerItem.effect === 'wise_glasses' && move.category === 'special') damage *= 1.1;
    }

    const randomFactor = randomInt(85, 100) / 100;
    damage *= randomFactor;

    if (defAbilityName === 'sturdy' && defender.currentHp >= defender.stats.hp && damage >= defender.currentHp) {
        damage = Math.max(0, defender.currentHp - 1);
    }

    let accuracy = move.accuracy || 100;
    if (attackerItem && attackerItem.effect === 'wide_lens') accuracy = Math.min(100, accuracy * 1.1);
    const accuracyCheck = Math.random() * 100 < accuracy;

    return {
        damage: Math.max(1, Math.floor(damage)),
        effectiveness,
        critical: critical > 1,
        missed: !accuracyCheck
    };
}

// ============================================================
// HELD ITEM - TURN END EFFECTS
// ============================================================
export function processHeldItemTurnEnd(pokemon) {
    if (!pokemon || pokemon.fainted) return [];
    const messages = [];
    const item = getHeldItemEffect(pokemon.heldItemId);
    if (!item) return messages;

    if (item.effect === 'leftovers') {
        const healAmt = Math.max(1, Math.floor(pokemon.stats.hp / 16));
        if (pokemon.currentHp < pokemon.stats.hp) {
            pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
            messages.push(`${pokemon.name} recuperou HP com Leftovers! (+${healAmt})`);
        }
    }

    if (item.effect === 'shell_bell' && pokemon._lastDamageDealt > 0) {
        const healAmt = Math.max(1, Math.floor(pokemon._lastDamageDealt / 8));
        if (pokemon.currentHp < pokemon.stats.hp) {
            pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
            messages.push(`${pokemon.name} recuperou HP com Shell Bell! (+${healAmt})`);
        }
        pokemon._lastDamageDealt = 0;
    }

    const berryEffects = {
        'oran_berry': { heal: 10, threshold: 0.5, name: 'Oran Berry' },
        'sitrus_berry': { heal: 0.25, threshold: 0.5, name: 'Sitrus Berry' },
        'figy_berry': { heal: 0.33, threshold: 0.5, name: 'Figy Berry', confuse: true },
        'wiki_berry': { heal: 0.33, threshold: 0.5, name: 'Wiki Berry', confuse: true },
        'mago_berry': { heal: 0.33, threshold: 0.5, name: 'Mago Berry', confuse: true },
        'aguav_berry': { heal: 0.33, threshold: 0.5, name: 'Aguav Berry', confuse: true },
        'iapapa_berry': { heal: 0.33, threshold: 0.5, name: 'Iapapa Berry', confuse: true },
    };

    if (berryEffects[item.effect] && !pokemon._berryUsed) {
        const bEffect = berryEffects[item.effect];
        if (pokemon.currentHp / pokemon.stats.hp <= bEffect.threshold) {
            let healAmt;
            if (item.effect === 'oran_berry') {
                healAmt = bEffect.heal;
            } else {
                healAmt = Math.floor(pokemon.stats.hp * bEffect.heal);
            }
            pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
            pokemon._berryUsed = true;
            messages.push(`${pokemon.name} usou ${bEffect.name}! (+${healAmt} HP)`);
            if (bEffect.confuse) {
                messages.push(`${pokemon.name} ficou confuso!`);
            }
        }
    }

    // Stat berries (+1 stat when HP drops below 25%)
    if (item.effect && item.effect.startsWith('stat_berry_') && !pokemon._berryUsed) {
        const hpRatio = pokemon.currentHp / pokemon.stats.hp;
        if (hpRatio <= 0.25) {
            const stat = item.effect.replace('stat_berry_', '');
            pokemon._statStages = pokemon._statStages || {};
            pokemon._statStages[stat] = Math.min(6, (pokemon._statStages[stat] || 0) + 1);
            pokemon._berryUsed = true;
            const statNames = { attack: 'Ataque', defense: 'Defesa', spAtk: 'Sp.Atk', spDef: 'Sp.Def', speed: 'Velocidade' };
            messages.push(`${pokemon.name} usou ${item.name}! ${statNames[stat] || stat} +1!`);
        }
    }

    // Black Sludge
    if (item.effect === 'black_sludge') {
        const isPoison = pokemon.types && (pokemon.types.includes('poison') || pokemon.types.includes('steel'));
        if (isPoison) {
            const healAmt = Math.max(1, Math.floor(pokemon.stats.hp / 16));
            if (pokemon.currentHp < pokemon.stats.hp) {
                pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
                messages.push(`${pokemon.name} recuperou HP com Black Sludge! (+${healAmt})`);
            }
        } else {
            const dmg = Math.max(1, Math.floor(pokemon.stats.hp / 16));
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} foi ferido pelo Black Sludge! (-${dmg})`);
        }
    }

    // Toxic Orb
    if (item.effect === 'toxic_orb' && !pokemon.statusEffect) {
        pokemon.statusEffect = 'toxic';
        pokemon._toxicCounter = 1;
        messages.push(`${pokemon.name} foi envenenado pelo Toxic Orb!`);
    }

    // Flame Orb
    if (item.effect === 'flame_orb' && !pokemon.statusEffect) {
        pokemon.statusEffect = 'burn';
        messages.push(`${pokemon.name} foi queimado pelo Flame Orb!`);
    }

    // Enigma Berry (heal 25% when hit super effective)
    if (item.effect === 'enigma_berry' && !pokemon._berryUsed && pokemon._lastHitSuperEffective) {
        const healAmt = Math.floor(pokemon.stats.hp * 0.25);
        pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
        pokemon._berryUsed = true;
        pokemon._lastHitSuperEffective = false;
        messages.push(`${pokemon.name} usou Enigma Berry! (+${healAmt} HP)`);
    }

    return messages;
}

// ============================================================
// HELD ITEM - ON BEING HIT
// ============================================================
export function processHeldItemOnHit(pokemon, attacker, damage) {
    if (!pokemon || !attacker) return { messages: [], damage };
    const messages = [];
    let finalDamage = damage;
    const item = getHeldItemEffect(pokemon.heldItemId);

    if (!item) return { messages, damage: finalDamage };

    if (item.effect === 'focus_sash' && !pokemon._focusSashUsed && pokemon.currentHp >= pokemon.stats.hp && damage >= pokemon.currentHp) {
        finalDamage = pokemon.currentHp - 1;
        pokemon._focusSashUsed = true;
        messages.push(`${pokemon.name} aguentou com o Focus Sash!`);
    }

    if (item.effect === 'focus_band' && !pokemon._focusBandUsed && Math.random() < 0.3 && damage >= pokemon.currentHp) {
        finalDamage = pokemon.currentHp - 1;
        pokemon._focusBandUsed = true;
        messages.push(`${pokemon.name} aguentou com o Focus Band!`);
    }

    if (item.effect === 'rocky_helmet' && attacker) {
        const helmetDmg = Math.max(1, Math.floor(attacker.stats.hp / 6));
        attacker.currentHp = Math.max(0, attacker.currentHp - helmetDmg);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        messages.push(`${pokemon.name} machucou ${attacker.name} com o Rocky Helmet! (-${helmetDmg})`);
    }

    // Type-resist berries: reduce super effective damage by 50%
    if (item.effect && item.effect.startsWith('type_berry_')) {
        const berryType = item.effect.replace('type_berry_', '');
        const moveType = attacker && attacker._lastMoveType ? attacker._lastMoveType.toLowerCase() : '';
        if (moveType === berryType && finalDamage > 0) {
            finalDamage = Math.floor(finalDamage * 0.5);
            messages.push(`${pokemon.name} resistiu com ${item.name}!`);
        }
    }

    // Jaboca Berry: damage attacker when hit by physical
    if (item.effect === 'jaboca_berry' && attacker && attacker._lastMoveCategory === 'physical') {
        const dmg = Math.max(1, Math.floor(attacker.stats.hp / 8));
        attacker.currentHp = Math.max(0, attacker.currentHp - dmg);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        messages.push(`${pokemon.name} machucou ${attacker.name} com Jaboca Berry! (-${dmg})`);
    }

    // Rowap Berry: damage attacker when hit by special
    if (item.effect === 'rowap_berry' && attacker && attacker._lastMoveCategory === 'special') {
        const dmg = Math.max(1, Math.floor(attacker.stats.hp / 8));
        attacker.currentHp = Math.max(0, attacker.currentHp - dmg);
        if (attacker.currentHp <= 0) attacker.fainted = true;
        messages.push(`${pokemon.name} machucou ${attacker.name} com Rowap Berry! (-${dmg})`);
    }

    return { messages, damage: finalDamage };
}

// ============================================================
// QUICK CLAW - 20% chance to go first
// ============================================================
export function checkQuickClaw(pokemon) {
    if (!pokemon) return false;
    const item = getHeldItemEffect(pokemon.heldItemId);
    if (item && item.effect === 'quick_claw') {
        return Math.random() < 0.2;
    }
    return false;
}

// ============================================================
// LIFE ORB RECOIL - 10% HP after attacking
// ============================================================
export function processLifeOrbRecoil(pokemon) {
    if (!pokemon) return null;
    const item = getHeldItemEffect(pokemon.heldItemId);
    if (item && item.effect === 'life_orb') {
        const recoilDmg = Math.max(1, Math.floor(pokemon.stats.hp / 10));
        pokemon.currentHp = Math.max(0, pokemon.currentHp - recoilDmg);
        if (pokemon.currentHp <= 0) pokemon.fainted = true;
        return `${pokemon.name} perdeu ${recoilDmg} HP com Life Orb!`;
    }
    return null;
}

// ============================================================
// CHOICE ITEMS - move lock
// ============================================================
export function getChoiceLockedMove(pokemon) {
    if (!pokemon) return null;
    const item = getHeldItemEffect(pokemon.heldItemId);
    if (item && (item.effect === 'choice_band' || item.effect === 'choice_specs' || item.effect === 'choice_scarf')) {
        return pokemon._choiceLockedMove || null;
    }
    return null;
}

export function setChoiceLock(pokemon, move) {
    if (!pokemon) return;
    const item = getHeldItemEffect(pokemon.heldItemId);
    if (item && (item.effect === 'choice_band' || item.effect === 'choice_specs' || item.effect === 'choice_scarf')) {
        pokemon._choiceLockedMove = move;
    }
}

export function clearChoiceLock(pokemon) {
    if (!pokemon) return;
    pokemon._choiceLockedMove = null;
}

export function getPokemonScale(pokemon) {
    if (!pokemon) return 1;
    const h = pokemon.height || 10;
    const min = 0.4;
    const max = 2.5;
    const t = Math.log(1 + h / 5) / Math.log(1 + 50 / 5);
    return Math.max(min, Math.min(max, min + t * (max - min)));
}

// Ajuste de sprite por pokemon (regras visuais exclusivas).
// Retorna { scaleX, scaleY } ou null. Ex: Kyogre sempre mais largo que alto.
export function getPokemonSpriteAdjust(pokemonId) {
    const id = Number(pokemonId);
    if (id === 382) return { scaleX: 1.6, scaleY: 1 };    // Kyogre: sempre mais largo que alto
    if (id === 23) return { scaleX: 0.5, scaleY: 0.5 };    // Ekans: metade do tamanho
    return null;
}
if (typeof window !== 'undefined') { window.getPokemonSpriteAdjust = getPokemonSpriteAdjust; }
