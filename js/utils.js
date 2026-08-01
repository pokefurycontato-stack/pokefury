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
export async function calculateDamage(attacker, defender, move) {
    if (!attacker?.stats || !defender?.stats) {
        return { damage: 0, effectiveness: 1, critical: false, missed: true };
    }
    if (move.category === 'status' || !move.power) {
        const accuracyCheck = Math.random() * 100 < (move.accuracy || 100);
        return { damage: 0, effectiveness: 1, critical: false, missed: !accuracyCheck };
    }
    const chart = await loadTypeEffectiveness();
    const level = attacker.level || 50;
    let attack = move.category === 'physical' ? attacker.stats.attack : attacker.stats.spAtk;
    let defense = move.category === 'physical' ? defender.stats.defense : defender.stats.spDef;

    const attackerItem = getHeldItemEffect(attacker.heldItemId);
    const defenderItem = getHeldItemEffect(defender.heldItemId);

    const attackerAbilityName = (typeof attacker.currentAbilityName === 'string' && attacker.currentAbilityName) || '';
    const defAbilityName = (typeof defender.currentAbilityName === 'string' && defender.currentAbilityName) || '';

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

    if (attackerAbilityName === 'huge power' || attackerAbilityName === 'pure power') {
        if (move.category === 'physical') attack *= 2;
    }
    if (attackerAbilityName === 'guts' && attacker.statusEffect && move.category === 'physical') {
        attack *= 1.5;
    }
    if (attackerAbilityName === 'hustle' && move.category === 'physical') {
        attack *= 1.5;
    }
    if (defAbilityName === 'marvel scale' && defender.statusEffect && move.category === 'physical') {
        defense *= 1.5;
    }
    if (defAbilityName === 'fur coat' && move.category === 'special') {
        defense *= 2;
    }

    let damage = ((2 * level / 5 + 2) * move.power * attack / defense) / 50 + 2;

    const effectiveness = getEffectiveness(chart, move.type, defender.types);
    damage *= effectiveness;

    const isSTAB = attacker.types && attacker.types.includes(move.type);
    let stabMult = isSTAB ? 1.5 : 1;
    if (attackerAbilityName === 'adaptability' && isSTAB) stabMult = 2;
    damage *= stabMult;

    if (attackerAbilityName === 'technician' && move.power && move.power <= 60) {
        damage *= 1.5;
    }

    const critical = Math.random() < 1 / 16 ? 1.5 : 1;
    damage *= critical;

    if (attackerItem) {
        if (attackerItem.effect === 'life_orb') damage *= 1.3;
        if (attackerItem.effect === 'expert_belt' && effectiveness > 1) damage *= 1.2;
        if (attackerItem.effect === 'muscle_band' && move.category === 'physical') damage *= 1.1;
        if (attackerItem.effect === 'wise_glasses' && move.category === 'special') damage *= 1.1;
    }

    const randomFactor = randomInt(85, 100) / 100;
    damage *= randomFactor;

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
