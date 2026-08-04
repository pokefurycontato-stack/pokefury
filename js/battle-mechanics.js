// ============================================================
// BATTLE MECHANICS - Complete Pokemon battle system v2
// Status, Weather, Terrain, Hazards, Abilities, Moves, Priority, Stats
// ============================================================

// --- STATUS CONDITIONS ---
export const STATUS = {
    BURN: 'burn',
    POISON: 'poison',
    TOXIC: 'toxic',
    PARALYSIS: 'paralysis',
    SLEEP: 'sleep',
    FREEZE: 'freeze',
    CONFUSION: 'confusion'
};

export const STATUS_INFO = {
    burn: { name: 'Queimadura', color: '#ff4444', emoji: '🔥', canAct: true, damagePercent: 1/16, attackMult: 0.5 },
    poison: { name: 'Veneno', color: '#aa44aa', emoji: '☠️', canAct: true, damagePercent: 1/8, attackMult: 1.0 },
    toxic: { name: 'Toxic', color: '#cc44cc', emoji: '💀', canAct: true, damagePercent: 1/16, toxicCounter: true, attackMult: 1.0 },
    paralysis: { name: 'Paralisia', color: '#ffcc00', emoji: '⚡', canAct: true, skipChance: 0.25, speedMult: 0.5, attackMult: 1.0 },
    sleep: { name: 'Sono', color: '#8888cc', emoji: '💤', canAct: false, minTurns: 1, maxTurns: 3, attackMult: 1.0 },
    freeze: { name: 'Congelado', color: '#88ccff', emoji: '🧊', canAct: false, thawChance: 0.2, attackMult: 1.0 },
    confusion: { name: 'Confuso', color: '#c084fc', emoji: '🌀', canAct: false, skipChance: 1 / 3, attackMult: 1.0 }
};

// --- STAT STAGE MULTIPLIERS ---
const STAT_STAGE_MULT = {
    '-6': 2/8, '-5': 2/7, '-4': 2/6, '-3': 2/5, '-2': 2/4, '-1': 2/3,
    '0': 1, '1': 3/2, '2': 4/2, '3': 5/2, '4': 6/2, '5': 7/2, '6': 8/2
};

export function getStatMult(stage) {
    const key = String(Math.max(-6, Math.min(6, stage)));
    return STAT_STAGE_MULT[key] || 1;
}

export function getAccuracyMult(stage) {
    return getStatMult(stage);
}

// ============================================================
// WEATHER SYSTEM
// ============================================================
export const WEATHER = {
    NONE: null,
    RAIN: 'rain',
    SUN: 'sun',
    SANDSTORM: 'sandstorm',
    SNOW: 'snow',
    HAIL: 'hail'
};

export const WEATHER_INFO = {
    rain: { name: 'Chuva', duration: 5, icon: '🌧️' },
    sun: { name: 'Sol Intenso', duration: 5, icon: '☀️' },
    sandstorm: { name: 'Tempestade de Areia', duration: 5, icon: '🏜️' },
    snow: { name: 'Neve', duration: 5, icon: '❄️' },
    hail: { name: 'Neve', duration: 5, icon: '❄️' }
};

// Weather damage per turn (1/16 of max HP)
const WEATHER_DAMAGE_TYPES = {
    sandstorm: ['rock', 'ground', 'steel'],
    hail: ['ice']
};

export function getWeatherDamageTypes(weather) {
    return WEATHER_DAMAGE_TYPES[weather] || [];
}

// Weather move type boosts/reductions: { type: multiplier }
export function getWeatherMoveBoost(weather) {
    if (weather === 'rain') return { water: 1.5, fire: 0.5, ice: 0.5 };
    if (weather === 'sun') return { fire: 1.5, water: 0.5 };
    return {};
}

// Weather speed multipliers for abilities
export function getWeatherSpeedMult(weather, abilityName) {
    const name = (abilityName || '').toLowerCase();
    if (weather === 'rain' && name === 'swift swim') return 2;
    if (weather === 'sun' && name === 'chlorophyll') return 2;
    if (weather === 'sandstorm' && name === 'sand rush') return 2;
    if ((weather === 'snow' || weather === 'hail') && name === 'slush rush') return 2;
    return 1;
}

// Weather special damage boosts for abilities
export function getWeatherSpAtkMult(weather, abilityName) {
    const name = (abilityName || '').toLowerCase();
    if (weather === 'sun' && name === 'solar power') return 1.5;
    return 1;
}

// Weather accuracy modifier for specific moves
export function getWeatherAccuracyBoost(weather, moveName) {
    const name = (moveName || '').toLowerCase();
    if (weather === 'rain') {
        if (name === 'thunder') return 100;
        if (name === 'blizzard') return 100;
    }
    if (weather === 'sun') {
        if (name === 'solar beam' || name === 'solarbeam') return 100;
    }
    return -1; // no change
}

// ============================================================
// TERRAIN SYSTEM
// ============================================================
export const TERRAIN = {
    NONE: null,
    PSYCHIC: 'psychic',
    GRASSY: 'grassy',
    ELECTRIC: 'electric',
    MISTY: 'misty'
};

export const TERRAIN_INFO = {
    psychic: { name: 'Psíquico', duration: 5, icon: '🔮' },
    grassy: { name: 'Grama', duration: 5, icon: '🌿' },
    electric: { name: 'Elétrico', duration: 5, icon: '⚡' },
    misty: { name: 'Névoa', duration: 5, icon: '🫧' }
};

// Terrain move type boosts
export function getTerrainMoveBoost(terrain) {
    if (terrain === 'psychic') return { psychic: 1.3 };
    if (terrain === 'grassy') return { grass: 1.3 };
    if (terrain === 'electric') return { electric: 1.3 };
    return {};
}

// ============================================================
// FIELD EFFECTS - Hazards & Screens (per-team)
// ============================================================
// Each team can have:
//   _stealthRock: boolean
//   _spikes: 0-3 layers
//   _toxicSpikes: 0-2 layers
//   _stickyWeb: boolean
//   _lightScreen: turns remaining
//   _reflect: turns remaining
//   _auroraVeil: turns remaining
//   _safeguard: turns remaining
//   _mist: turns remaining
//   _tailwind: turns remaining

export function initFieldEffects(teamObj) {
    if (!teamObj) return;
    teamObj._stealthRock = false;
    teamObj._spikes = 0;
    teamObj._toxicSpikes = 0;
    teamObj._stickyWeb = false;
    teamObj._lightScreen = 0;
    teamObj._reflect = 0;
    teamObj._auroraVeil = 0;
    teamObj._safeguard = 0;
    teamObj._mist = 0;
    teamObj._tailwind = 0;
}

// Process entry hazards on a pokemon entering battle
export function processEntryHazards(pokemon, teamEffects, isGrounded) {
    if (!pokemon || !teamEffects) return [];
    const messages = [];

    if (teamEffects._stealthRock) {
        const effectiveness = getHazardEffectiveness('rock', pokemon.types);
        const dmg = Math.floor(pokemon.stats.hp * 0.125 * effectiveness);
        if (dmg > 0) {
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} perdeu ${dmg} HP com Pedras Afiadas!`);
        }
    }

    if (teamEffects._spikes > 0 && isGrounded) {
        const dmg = Math.floor(pokemon.stats.hp * (teamEffects._spikes / 8));
        if (dmg > 0) {
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} perdeu ${dmg} HP com Spikes!`);
        }
    }

    if (teamEffects._toxicSpikes > 0 && isGrounded && !pokemon.statusEffect) {
        if (teamEffects._toxicSpikes >= 2) {
            pokemon.statusEffect = STATUS.TOXIC;
            pokemon._toxicCounter = 1;
            messages.push(`${pokemon.name} foi envenenado pelo Toxic Spikes!`);
        } else {
            pokemon.statusEffect = STATUS.POISON;
            messages.push(`${pokemon.name} foi envenenado pelo Toxic Spikes!`);
        }
    }

    if (teamEffects._stickyWeb && isGrounded) {
        pokemon._statStages = pokemon._statStages || {};
        pokemon._statStages.speed = Math.max(-6, (pokemon._statStages.speed || 0) - 1);
        messages.push(`${pokemon.name} foi desacelerado pela Sticky Web!`);
    }

    return messages;
}

function getHazardEffectiveness(hazardType, pokemonTypes) {
    if (hazardType === 'rock') {
        const chart = { fire: 2, ice: 2, flying: 2, bug: 2, normal: 1, water: 1, grass: 1, fighting: 1, poison: 1, ground: 1, psychic: 1, rock: 1, ghost: 1, dragon: 1, dark: 1, steel: 1, fairy: 1 };
        let mult = 1;
        for (const t of (pokemonTypes || [])) {
            mult *= (chart[t] || 1);
        }
        return mult;
    }
    return 1;
}

// Process screen damage reduction
export function getScreenDamageReduction(defender, moveCategory) {
    if (!defender || !defender._teamEffects) return 1;
    const team = defender._teamEffects;

    // Aurora Veil reduces both physical and special
    if (team._auroraVeil > 0) return 0.66;

    // Light Screen reduces special
    if (moveCategory === 'special' && team._lightScreen > 0) return 0.5;

    // Reflect reduces physical
    if (moveCategory === 'physical' && team._reflect > 0) return 0.5;

    return 1;
}

// Process end-of-turn field ticks
export function processFieldTurnEnd(teamEffects) {
    if (!teamEffects) return;
    if (teamEffects._lightScreen > 0) teamEffects._lightScreen--;
    if (teamEffects._reflect > 0) teamEffects._reflect--;
    if (teamEffects._auroraVeil > 0) teamEffects._auroraVeil--;
    if (teamEffects._safeguard > 0) teamEffects._safeguard--;
    if (teamEffects._mist > 0) teamEffects._mist--;
    if (teamEffects._tailwind > 0) teamEffects._tailwind--;
}

// ============================================================
// MOVE PRIORITY
// ============================================================
const MOVE_PRIORITY = {
    'protect': 4, 'detect': 4, 'endure': 4, 'spiky shield': 4, "king's shield": 4, 'baneful bunker': 4, 'obstruct': 4,
    'quick attack': 1, 'extreme speed': 2, 'aquajet': 1, 'bulletpunch': 1, 'mach punch': 1,
    'ice shard': 1, 'shadow sneak': 1, 'sucker punch': 1, 'vacuum wave': 1,
    'feint': 2, 'fake out': 3,
    'helping hand': 5, 'follow me': 2, 'rage powder': 2,
    'circle throw': -6, 'dragon tail': -6, 'roar': -6, 'whirlwind': -6,
    'teleport': -6, 'switcheroo': 0, 'trick': 0, 'uturn': 0, 'volt switch': 0, 'flip turn': 0
};

export function getMovePriority(move) {
    if (!move) return 0;
    const name = (move.name || '').toLowerCase();
    return MOVE_PRIORITY[name] || 0;
}

export function getEffectiveMovePriority(move, pokemon, battleState = null) {
    let priority = getMovePriority(move);
    const ability = (pokemon?.currentAbilityName || getAbilityName(pokemon?.currentAbility)).toLowerCase();
    const effect = getMoveEffect(move);
    if (ability === 'prankster' && move?.category === 'status') priority += 1;
    if (ability === 'gale wings' && move?.type === 'flying' && pokemon.currentHp >= pokemon.stats.hp) priority += 1;
    if (ability === 'triage' && (effect?.effect === 'heal' || effect?.effect === 'drain')) priority += 3;
    if (effect?.effect === 'terrain_priority' && battleState?.terrain === effect.terrainType) priority += effect.priority || 1;
    return priority;
}

// ============================================================
// MOVE EFFECTS DATABASE (by ID - numeric)
// ============================================================
const MOVE_EFFECTS = {
    321: { effect: 'protect' },
    107: { effect: 'protect' },
    203: { effect: 'protect' },

    52: { effect: 'status', status: STATUS.BURN, chance: 10 },
    53: { effect: 'status', status: STATUS.BURN, chance: 10 },
    83: { effect: 'status', status: STATUS.BURN, chance: 10 },
    126: { effect: 'status', status: STATUS.BURN, chance: 30 },
    424: { effect: 'status', status: STATUS.BURN, chance: 20 },
    481: { effect: 'status', status: STATUS.BURN, chance: 10 },
    257: { effect: 'status', status: STATUS.BURN, chance: 10 },
    534: { effect: 'status', status: STATUS.BURN, chance: 20 },
    545: { effect: 'status', status: STATUS.BURN, chance: 10 },
    188: { effect: 'status', status: STATUS.BURN, chance: 10 },

    58: { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    8: { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    141: { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    420: { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    524: { effect: 'status', status: STATUS.FREEZE, chance: 30 },

    85: { effect: 'status', status: STATUS.PARALYSIS, chance: 10 },
    86: { effect: 'status', status: STATUS.PARALYSIS, chance: 30 },
    104: { effect: 'status', status: STATUS.PARALYSIS, chance: 10 },
    205: { effect: 'status', status: STATUS.PARALYSIS, chance: 100 },
    604: { effect: 'status', status: STATUS.PARALYSIS, chance: 10 },

    73: { effect: 'status', status: STATUS.POISON, chance: 10 },
    402: { effect: 'status', status: STATUS.POISON, chance: 30 },
    512: { effect: 'status', status: STATUS.POISON, chance: 30 },

    92: { effect: 'status', status: STATUS.TOXIC, chance: 100 },

    47: { effect: 'status', status: STATUS.SLEEP, chance: 55 },
    95: { effect: 'status', status: STATUS.SLEEP, chance: 60 },
    79: { effect: 'status', status: STATUS.SLEEP, chance: 75 },
    149: { effect: 'status', status: STATUS.SLEEP, chance: 60 },

    78: { effect: 'status', status: STATUS.PARALYSIS, chance: 75 },

    14: { effect: 'stat_boost', stat: 'attack', stages: 2 },
    97: { effect: 'stat_boost', stat: 'speed', stages: 2 },
    96: { effect: 'stat_boost', stat: 'attack', stages: 1 },
    113: { effect: 'stat_boost', stat: 'spAtk', stages: 1 },
    74: { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'spAtk', stages2: 1 },
    106: { effect: 'stat_boost', stat: 'defense', stages: 1 },
    110: { effect: 'stat_boost', stat: 'defense', stages: 1 },
    111: { effect: 'stat_boost', stat: 'defense', stages: 2 },
    133: { effect: 'stat_boost', stat: 'spDef', stages: 2 },
    105: { effect: 'heal', healPercent: 0.5 },

    43: { effect: 'stat_drop', stat: 'defense', stages: 1 },
    45: { effect: 'stat_drop', stat: 'attack', stages: 1 },
    44: { effect: 'stat_drop', stat: 'defense', stages: 1 },
    103: { effect: 'stat_drop', stat: 'defense', stages: 2 },
    81: { effect: 'stat_drop', stat: 'speed', stages: 1 },
    108: { effect: 'stat_drop', stat: 'accuracy', stages: 1 },
    28: { effect: 'stat_drop', stat: 'accuracy', stages: 1 },

    38: { effect: 'recoil', recoil: 1/4 },
    440: { effect: 'recoil', recoil: 1/3 },
    412: { effect: 'recoil', recoil: 1/3 },
    456: { effect: 'recoil', recoil: 1/3 },
    56: { effect: 'recoil', recoil: 1/4 },

    409: { effect: 'drain', drain: 1/2 },
    710: { effect: 'drain', drain: 1/2 },
    577: { effect: 'drain', drain: 1/2 },
    739: { effect: 'drain', drain: 1/2 },

    15: { effect: 'fixed_damage', fixedPower: true },
    69: { effect: 'fixed_damage', fixedPower: true },

    31: { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    30: { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    42: { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    154: { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    198: { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    529: { effect: 'multi_hit', minHits: 2, maxHits: 5 },

    135: { effect: 'heal', healPercent: 0.5 },
    181: { effect: 'heal', healPercent: 0.5 },
    272: { effect: 'heal', healPercent: 0.5 },
    218: { effect: 'heal', healPercent: 0.5 },

    516: { effect: 'charge' },
    448: { effect: 'charge' },
    590: { effect: 'charge' },
    488: { effect: 'charge' },

    141: { effect: 'flinch', chance: 30 },
    528: { effect: 'flinch', chance: 30 },
    531: { effect: 'flinch', chance: 20 },
    348: { effect: 'flinch', chance: 20 },

    210: { effect: 'crit_boost', stages: 1 },
    292: { effect: 'crit_boost', stages: 1 },

    150: { effect: 'accuracy_boost', stages: 1 },
};

// --- MOVE EFFECTS BY NAME ---
const MOVE_EFFECTS_BY_NAME = {
    'substitute': { effect: 'substitute' },
    'haze': { effect: 'clear_stages' },
    'clear smog': { effect: 'clear_defender_stages' },
    'psych up': { effect: 'copy_stages' },
    'topsy-turvy': { effect: 'invert_defender_stages' },
    'curse': { effect: 'curse' },
    'perish song': { effect: 'perish_song' },
    'leech seed': { effect: 'leech_seed' },
    'thunder wave': { effect: 'status', status: STATUS.PARALYSIS, chance: 100 },
    'will-o-wisp': { effect: 'status', status: STATUS.BURN, chance: 85 },
    'glare': { effect: 'status', status: STATUS.PARALYSIS, chance: 100 },
    'spore': { effect: 'status', status: STATUS.SLEEP, chance: 100 },
    'lovely kiss': { effect: 'status', status: STATUS.SLEEP, chance: 75 },
    'sleep powder': { effect: 'status', status: STATUS.SLEEP, chance: 75 },
    'stun spore': { effect: 'status', status: STATUS.PARALYSIS, chance: 75 },
    'poison powder': { effect: 'status', status: STATUS.POISON, chance: 100 },

    'swagger': { effect: 'confusion_boost', stat: 'attack', stages: 2 },
    'flatter': { effect: 'confusion_boost', stat: 'spAtk', stages: 1 },
    'confuse ray': { effect: 'confusion', chance: 100 },
    'supersonic': { effect: 'confusion', chance: 55 },
    'sweet kiss': { effect: 'confusion', chance: 75 },
    'cosmic power': { effect: 'stat_boost', stat: 'defense', stages: 1, stat2: 'spDef', stages2: 1 },
    'dragon dance': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'speed', stages2: 1 },
    'quiver dance': { effect: 'stat_boost', stat: 'spAtk', stages: 1, stat2: 'spDef', stages2: 1, stat3: 'speed', stages3: 1 },
    'shell smash': { effect: 'stat_boost', stat: 'attack', stages: 2, stat2: 'spAtk', stages2: 2, stat3: 'speed', stages3: 2 },
    'bulk up': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'defense', stages2: 1 },
    'calm mind': { effect: 'stat_boost', stat: 'spAtk', stages: 1, stat2: 'spDef', stages2: 1 },
    'nasty plot': { effect: 'stat_boost', stat: 'spAtk', stages: 2 },
    'iron defense': { effect: 'stat_boost', stat: 'defense', stages: 2 },
    'acid armor': { effect: 'stat_boost', stat: 'defense', stages: 2 },
    'barrier': { effect: 'stat_boost', stat: 'defense', stages: 2 },
    'coil': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'defense', stages2: 1, stat3: 'accuracy', stages3: 1 },
    'shift gear': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'speed', stages2: 2 },
    'work up': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'spAtk', stages2: 1 },
    'howl': { effect: 'stat_boost', stat: 'attack', stages: 1 },
    'swords dance': { effect: 'stat_boost', stat: 'attack', stages: 2 },
    'agility': { effect: 'stat_boost', stat: 'speed', stages: 2 },
    'rock polish': { effect: 'stat_boost', stat: 'speed', stages: 2 },
    'belly drum': { effect: 'belly_drum' },
    'growth': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'spAtk', stages2: 1 },

    'scary face': { effect: 'stat_drop', stat: 'speed', stages: 2 },
    'iron tail': { effect: 'stat_drop', stat: 'defense', stages: 1, chance: 30 },
    'shadow claw': { effect: 'crit_boost', stages: 1 },
    'leaf blade': { effect: 'crit_boost', stages: 1 },
    'night slash': { effect: 'crit_boost', stages: 1 },
    'psycho cut': { effect: 'crit_boost', stages: 1 },
    'stone edge': { effect: 'crit_boost', stages: 1 },
    'cross poison': { effect: 'crit_boost', stages: 1, status: STATUS.POISON, statusChance: 20 },
    'air slash': { effect: 'flinch', chance: 30 },
    'dragon claw': { effect: 'none' },
    'psychic': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'bug buzz': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'moonblast': { effect: 'stat_drop', stat: 'spAtk', stages: 1, chance: 30 },
    'dazzling gleam': { effect: 'none' },
    'sludge bomb': { effect: 'status', status: STATUS.POISON, chance: 30 },
    'sludge wave': { effect: 'status', status: STATUS.POISON, chance: 10 },
    'venoshock': { effect: 'none', powerBoostIfPoisoned: 2 },
    'smog': { effect: 'status', status: STATUS.POISON, chance: 40 },
    'poison jab': { effect: 'status', status: STATUS.POISON, chance: 30 },
    'gunk shot': { effect: 'status', status: STATUS.POISON, chance: 30 },
    'drain punch': { effect: 'drain', drain: 0.5 },
    'absorb': { effect: 'drain', drain: 0.5 },
    'mega drain': { effect: 'drain', drain: 0.5 },
    'giga drain': { effect: 'drain', drain: 0.5 },
    'leech life': { effect: 'drain', drain: 0.5 },
    'horn leech': { effect: 'drain', drain: 0.5 },
    'parasitic bite': { effect: 'drain', drain: 0.5 },
    'bitter blade': { effect: 'drain', drain: 0.5 },
    'hex': { effect: 'none', powerBoostIfStatused: 2 },
    'shadow ball': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 20 },
    'flash cannon': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'aura sphere': { effect: 'none' },
    'dragon pulse': { effect: 'none' },
    'dark pulse': { effect: 'flinch', chance: 20 },
    'steam eruption': { effect: 'status', status: STATUS.BURN, chance: 30 },
    'freeze-dry': { effect: 'status', status: STATUS.FREEZE, chance: 30 },
    'ice fang': { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    'fire fang': { effect: 'status', status: STATUS.BURN, chance: 10 },
    'thunder fang': { effect: 'status', status: STATUS.PARALYSIS, chance: 10 },
    'bite': { effect: 'flinch', chance: 30 },
    'crunch': { effect: 'flinch', chance: 20, stat_drop: { stat: 'defense', stages: 1, chance: 20 } },
    'iron head': { effect: 'flinch', chance: 30 },
    'rock slide': { effect: 'flinch', chance: 30 },
    'dragon rush': { effect: 'flinch', chance: 20 },
    'zen headbutt': { effect: 'flinch', chance: 20 },
    'headbutt': { effect: 'flinch', chance: 30 },
    'stomp': { effect: 'flinch', chance: 30 },
    'rolling kick': { effect: 'flinch', chance: 30 },
    'wing attack': { effect: 'none' },
    'knock off': { effect: 'remove_item' },
    'thief': { effect: 'steal_item' },
    'trick': { effect: 'swap_items' },
    'switcheroo': { effect: 'swap_items' },
    'psychic fangs': { effect: 'none', breaksScreens: true },
    'body press': { effect: 'none' },
    'infestation': { effect: 'none' },
    'dual wingbeat': { effect: 'multi_hit', minHits: 2, maxHits: 2 },
    'scale shot': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'population bomb': { effect: 'multi_hit', minHits: 2, maxHits: 10 },
    'triple axel': { effect: 'multi_hit', minHits: 2, maxHits: 3 },
    'beat up': { effect: 'multi_hit', minHits: 2, maxHits: 6 },
    'swift': { effect: 'none' },
    'surf': { effect: 'none' },
    'earthquake': { effect: 'none' },
    'hyper beam': { effect: 'recharge' },
    'giga impact': { effect: 'recharge' },
    'blast burn': { effect: 'recharge' },
    'frenzy plant': { effect: 'recharge' },
    'hydro cannon': { effect: 'recharge' },
    'rock wrecker': { effect: 'recharge' },
    'roost': { effect: 'heal', healPercent: 0.5 },
    'transform': { effect: 'transform' },
    'synthesis': { effect: 'heal', healPercent: 0.5, weatherBoost: { sun: 2/3, rain: 0.25, sandstorm: 0.25, hail: 0.25 } },
    'moonlight': { effect: 'heal', healPercent: 0.5, weatherBoost: { sun: 2/3, rain: 0.25, sandstorm: 0.25, hail: 0.25 } },
    'morning sun': { effect: 'heal', healPercent: 0.5, weatherBoost: { sun: 2/3, rain: 0.25, sandstorm: 0.25, hail: 0.25 } },
    'rest': { effect: 'rest' },
    'flame charge': { effect: 'stat_boost', stat: 'speed', stages: 1, chance: 100 },
    'charge beam': { effect: 'stat_boost', stat: 'spAtk', stages: 1, chance: 70 },
    'ancient power': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'defense', stages2: 1, stat3: 'spAtk', stages3: 1, stat4: 'spDef', stages4: 1, stat5: 'speed', stages5: 1, chance: 10 },
    'ominous wind': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'defense', stages2: 1, stat3: 'spAtk', stages3: 1, stat4: 'spDef', stages4: 1, stat5: 'speed', stages5: 1, chance: 10 },
    'silver wind': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'defense', stages2: 1, stat3: 'spAtk', stages3: 1, stat4: 'spDef', stages4: 1, stat5: 'speed', stages5: 1, chance: 10 },
    'thunderbolt': { effect: 'status', status: STATUS.PARALYSIS, chance: 10 },
    'thunder': { effect: 'status', status: STATUS.PARALYSIS, chance: 30 },
    'ice beam': { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    'blizzard': { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    'body slam': { effect: 'status', status: STATUS.PARALYSIS, chance: 30 },
    'lava plume': { effect: 'status', status: STATUS.BURN, chance: 30 },
    'scald': { effect: 'status', status: STATUS.BURN, chance: 30 },
    'flame wheel': { effect: 'status', status: STATUS.BURN, chance: 10 },
    'ember': { effect: 'status', status: STATUS.BURN, chance: 10 },
    'flamethrower': { effect: 'status', status: STATUS.BURN, chance: 10 },
    'fire blast': { effect: 'status', status: STATUS.BURN, chance: 10 },
    'fire punch': { effect: 'status', status: STATUS.BURN, chance: 10 },
    'ice punch': { effect: 'status', status: STATUS.FREEZE, chance: 10 },
    'thunder punch': { effect: 'status', status: STATUS.PARALYSIS, chance: 10 },

    // Weather setting moves
    'rain dance': { effect: 'weather', weather: 'rain' },
    'sunny day': { effect: 'weather', weather: 'sun' },
    'sandstorm': { effect: 'weather', weather: 'sandstorm' },
    'hail': { effect: 'weather', weather: 'snow' },
    'snowscape': { effect: 'weather', weather: 'snow' },

    // Self stat drop moves
    'close combat': { effect: 'stat_drop', stat: 'defense', stages: 1, selfStatDrop: { stat: 'spDef', stages: 1 } },
    'focus blast': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'overheat': { effect: 'stat_drop', stat: 'spAtk', stages: 2, selfOnly: true },
    'draco meteor': { effect: 'stat_drop', stat: 'spAtk', stages: 2, selfOnly: true },
    'leaf storm': { effect: 'stat_drop', stat: 'spAtk', stages: 2, selfOnly: true },
    'petal dance': { effect: 'multi_turn' },
    'superpower': { effect: 'stat_drop', stat: 'attack', stages: 1, selfStatDrop: { stat: 'defense', stages: 1 } },
    'hammer arm': { effect: 'stat_drop', stat: 'speed', stages: 1, selfOnly: true },
    'headlong rush': { effect: 'stat_drop', stat: 'defense', stages: 1, selfStatDrop: { stat: 'spDef', stages: 1 } },
    'shell smash': { effect: 'stat_boost', stat: 'attack', stages: 2, stat2: 'spAtk', stages2: 2, stat3: 'speed', stages3: 2, selfDefDrop: { stat: 'defense', stages: 1, stat2: 'spDef', stages2: 1 } },

    // Other special moves
    'energy ball': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'earth power': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'ancient power': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'defense', stages2: 1, stat3: 'spAtk', stages3: 1, stat4: 'spDef', stages4: 1, stat5: 'speed', stages5: 1, chance: 10 },
    'power gem': { effect: 'none' },
    'dazzling gleam': { effect: 'none' },
    'play rough': { effect: 'stat_drop', stat: 'attack', stages: 1, chance: 10 },

    // Terrain setting moves
    'psychic terrain': { effect: 'terrain', terrain: 'psychic' },
    'grassy terrain': { effect: 'terrain', terrain: 'grassy' },
    'electric terrain': { effect: 'terrain', terrain: 'electric' },
    'misty terrain': { effect: 'terrain', terrain: 'misty' },

    // Hazard moves
    'stealth rock': { effect: 'hazard', hazard: 'stealthRock' },
    'spikes': { effect: 'hazard', hazard: 'spikes' },
    'toxic spikes': { effect: 'hazard', hazard: 'toxicSpikes' },
    'sticky web': { effect: 'hazard', hazard: 'stickyWeb' },

    // Screen moves
    'light screen': { effect: 'screen', screen: 'lightScreen', duration: 5 },
    'reflect': { effect: 'screen', screen: 'reflect', duration: 5 },
    'aurora veil': { effect: 'screen', screen: 'auroraVeil', duration: 5 },

    // Field status moves
    'safeguard': { effect: 'field_status', field: '_safeguard', duration: 5 },
    'mist': { effect: 'field_status', field: '_mist', duration: 5 },
    'tailwind': { effect: 'field_status', field: '_tailwind', duration: 4 },

    // Hazard removal
    'defog': { effect: 'hazard_remove', removeBoth: true },
    'rapid spin': { effect: 'rapid_spin' },

    // Pivot moves
    'uturn': { effect: 'pivot' },
    'volt switch': { effect: 'pivot' },
    'flip turn': { effect: 'pivot' },
    'shed tail': { effect: 'pivot' },

    // Variable power
    'low kick': { effect: 'variable_power', baseOn: 'weight' },
    'grass knot': { effect: 'variable_power', baseOn: 'weight' },
    'gyro ball': { effect: 'variable_power', baseOn: 'speed' },
    'heavy slam': { effect: 'variable_power', baseOn: 'weight' },
    'heat crash': { effect: 'variable_power', baseOn: 'weight' },
    'flail': { effect: 'variable_power', baseOn: 'low_hp' },
    'reversal': { effect: 'variable_power', baseOn: 'low_hp' },
    ' endeavor': { effect: 'endeavor' },
    'weather ball': { effect: 'weather_ball' },

    // One-hit KO
    'fissure': { effect: 'ohko' },
    'horn drill': { effect: 'ohko' },
    'sheer cold': { effect: 'ohko' },
    'guillotine': { effect: 'ohko' },

    // Multi-turn moves
    'outrage': { effect: 'multi_turn' },
    'petal dance': { effect: 'multi_turn' },
    'thrash': { effect: 'multi_turn' },
    'rollout': { effect: 'multi_turn' },
    'ice ball': { effect: 'multi_turn' },

    // Binding moves
    'fire spin': { effect: 'bind', bindDamage: 1/8 },
    'whirlpool': { effect: 'bind', bindDamage: 1/8 },
    'sand tomb': { effect: 'bind', bindDamage: 1/8 },
    'wrap': { effect: 'bind', bindDamage: 1/16 },
    'clamp': { effect: 'bind', bindDamage: 1/8 },
    'infestation': { effect: 'bind', bindDamage: 1/8 },
    'wrap': { effect: 'bind', bindDamage: 1/16 },

    // Fixed damage moves
    'dragon rage': { effect: 'fixed_damage', fixedDamage: 40 },
    'sonic boom': { effect: 'fixed_damage', fixedDamage: 20 },
    'seismic toss': { effect: 'fixed_damage', fixedPower: true },
    'night shade': { effect: 'fixed_damage', fixedPower: true },
    'super fang': { effect: 'fixed_damage', halfHp: true },

    // Heal moves
    'recover': { effect: 'heal', healPercent: 0.5 },
    'softboiled': { effect: 'heal', healPercent: 0.5 },
    'milk drink': { effect: 'heal', healPercent: 0.5 },
    'wish': { effect: 'heal', healPercent: 0.5, delayed: true },
    'slack off': { effect: 'heal', healPercent: 0.5 },
    'shore up': { effect: 'heal', healPercent: 0.5, sandBoost: true },
    'strength sap': { effect: 'strength_sap' },
    'purify': { effect: 'purify' },

    // Status cure moves
    'heal bell': { effect: 'heal_bell' },
    'aromatherapy': { effect: 'heal_bell' },
    'refresh': { effect: 'refresh' },

    // Taunt/Torment/Encore/Disable
    'taunt': { effect: 'taunt' },
    'torment': { effect: 'torment' },
    'encore': { effect: 'encore' },
    'disable': { effect: 'disable' },

    // Priority terrain
    'grassy glide': { effect: 'terrain_priority', terrainType: 'grassy', priority: 1 },
};

// ============================================================
// ABILITY EFFECTS DATABASE (expanded)
// ============================================================
export const ABILITY_EFFECTS = {
    // === CONTACT ABILITIES ===
    'flame body': { trigger: 'contacted', effect: 'status', status: STATUS.BURN, chance: 30 },
    'static': { trigger: 'contacted', effect: 'status', status: STATUS.PARALYSIS, chance: 30 },
    'poison point': { trigger: 'contacted', effect: 'status', status: STATUS.POISON, chance: 30 },
    'cute charm': { trigger: 'contacted', effect: 'none' },
    'effect spore': { trigger: 'contacted', effect: 'random_status', chance: 30 },
    'poison touch': { trigger: 'contacted', effect: 'status', status: STATUS.POISON, chance: 30 },
    'cursed body': { trigger: 'contacted', effect: 'disable', chance: 30 },

    // === DAMAGE ON CONTACT ===
    'iron barbs': { trigger: 'contacted', effect: 'damage', damage: 1/8 },
    'rough skin': { trigger: 'contacted', effect: 'damage', damage: 1/8 },
    'aftermath': { trigger: 'contacted_fainted', effect: 'damage', damage: 0.25 },

    // === SPEED MOD ON CONTACT ===
    'gooey': { trigger: 'contacted', effect: 'stat_drop_target', stat: 'speed', stages: 1 },
    'tangled feet': { trigger: 'contacted', effect: 'stat_drop_target', stat: 'speed', stages: 1 },
    'weak armor': { trigger: 'contacted', effect: 'self_stat_swap', defDrop: 1, speedBoost: 2 },

    // === WEATHER ENTRY ===
    'drizzle': { trigger: 'entry', effect: 'weather', weather: 'rain' },
    'drought': { trigger: 'entry', effect: 'weather', weather: 'sun' },
    'snow warning': { trigger: 'entry', effect: 'weather', weather: 'snow' },
    'sand stream': { trigger: 'entry', effect: 'weather', weather: 'sandstorm' },

    // === TERRAIN ENTRY ===
    'psychic surge': { trigger: 'entry', effect: 'terrain', terrain: 'psychic' },
    'grassy surge': { trigger: 'entry', effect: 'terrain', terrain: 'grassy' },
    'electric surge': { trigger: 'entry', effect: 'terrain', terrain: 'electric' },
    'misty surge': { trigger: 'entry', effect: 'terrain', terrain: 'misty' },

    // === STAT BOOST ON ENTRY ===
    'intimidate': { trigger: 'entry', effect: 'stat_drop_opponent', stat: 'attack', stages: 1 },
    'download': { trigger: 'entry', effect: 'download' },

    // === DAMAGE BOOST (low HP) ===
    'blaze': { trigger: 'damage_boost', type: 'fire', condition: 'low_hp', multiplier: 1.5 },
    'torrent': { trigger: 'damage_boost', type: 'water', condition: 'low_hp', multiplier: 1.5 },
    'overgrow': { trigger: 'damage_boost', type: 'grass', condition: 'low_hp', multiplier: 1.5 },
    'swarm': { trigger: 'damage_boost', type: 'bug', condition: 'low_hp', multiplier: 1.5 },

    // === TYPE/CONDITIONAL DAMAGE BOOST ===
    'adaptability': { trigger: 'stab_boost', multiplier: 2.0 },
    'technician': { trigger: 'technician', powerThreshold: 60, multiplier: 1.5 },
    'huge power': { trigger: 'stat_override', stat: 'attack', multiplier: 2 },
    'pure power': { trigger: 'stat_override', stat: 'attack', multiplier: 2 },
    'solar power': { trigger: 'weather_stat', weather: 'sun', stat: 'spAtk', multiplier: 1.5, hpDrain: 1/8 },
    'sand force': { trigger: 'weather_damage_boost', weather: 'sandstorm', types: ['rock', 'ground', 'steel'], multiplier: 1.3 },

    // === WEATHER SPEED BOOST ===
    'swift swim': { trigger: 'weather_speed', weather: 'rain', multiplier: 2 },
    'chlorophyll': { trigger: 'weather_speed', weather: 'sun', multiplier: 2 },
    'sand rush': { trigger: 'weather_speed', weather: 'sandstorm', multiplier: 2 },
    'slush rush': { trigger: 'weather_speed', weather: 'snow', multiplier: 2 },

    // === WEATHER CONDITIONAL ===
    'rain dish': { trigger: 'end_of_turn', condition: 'rain', effect: 'heal', healPercent: 1/16 },
    'ice body': { trigger: 'end_of_turn', condition: 'snow', effect: 'heal', healPercent: 1/16 },
    'dry skin': { trigger: 'weather_heal', rainHeal: 1/8, sunDmg: 1/8, fireWeakness: 1.25 },
    'leaf guard': { trigger: 'weather_status_immune', weather: 'sun', statuses: [STATUS.BURN, STATUS.POISON, STATUS.PARALYSIS, STATUS.SLEEP, STATUS.FREEZE] },
    'water compaction': { trigger: 'weather_stat', weather: 'rain', stat: 'defense', stages: 1 },

    // === DEFENSIVE ABILITIES ===
    'thick fat': { trigger: 'type_resist', types: ['fire', 'ice'], multiplier: 0.5 },
    'levitate': { trigger: 'type_immune', types: ['ground'] },
    'water absorb': { trigger: 'type_immune', types: ['water'], healOnImmune: 0.25 },
    'volt absorb': { trigger: 'type_immune', types: ['electric'], healOnImmune: 0.25 },
    'lightning rod': { trigger: 'type_immune', types: ['electric'], spAtkBoostOnImmune: 1 },
    'motor drive': { trigger: 'type_immune', types: ['electric'], speedBoostOnImmune: 1 },
    'sap sipper': { trigger: 'type_immune', types: ['grass'], attackBoostOnImmune: 1 },
    'bulletproof': { trigger: 'type_immune', types: ['ball', 'bomb'] },
    'soundproof': { trigger: 'type_immune', types: ['sound'] },
    'wonder guard': { trigger: 'wonder_guard' },
    'multiscale': { trigger: 'multiscale' },
    'solid rock': { trigger: 'solid_rock' },
    'marvel scale': { trigger: 'marvel_scale' },
    'fur coat': { trigger: 'fur_coat' },
    'fluffy': { trigger: 'fluffy' },
    'ice scales': { trigger: 'ice_scales' },
    'filter': { trigger: 'filter' },
    'prism armor': { trigger: 'filter' },

    // === STAT MOD ON ENTRY ===
    'speed boost': { trigger: 'end_of_turn', effect: 'stat_boost', stat: 'speed', stages: 1 },

    // === HEALING ===
    'poison heal': { trigger: 'status', status: STATUS.POISON, effect: 'heal_instead', healPercent: 1/8 },
    'magic guard': { trigger: 'passive_damage_immune', immune: ['burn_damage', 'poison_damage', 'weather_damage', 'recoil', 'life_orb'] },
    'regenerator': { trigger: 'switch_out', healPercent: 1/3 },

    // === STAT IMMUNE ===
    'water veil': { trigger: 'status_immune', statuses: [STATUS.BURN] },
    'limber': { trigger: 'status_immune', statuses: [STATUS.PARALYSIS] },
    'immunity': { trigger: 'status_immune', statuses: [STATUS.POISON, STATUS.TOXIC] },
    'magma armor': { trigger: 'status_immune', statuses: [STATUS.FREEZE] },
    'insomnia': { trigger: 'status_immune', statuses: [STATUS.SLEEP] },
    'vital spirit': { trigger: 'status_immune', statuses: [STATUS.SLEEP] },
    'own tempo': { trigger: 'status_immune', statuses: ['confusion'] },
    'oblivious': { trigger: 'status_immune', statuses: ['attract'] },
    'clear body': { trigger: 'stat_drop_immune' },
    'white smoke': { trigger: 'stat_drop_immune' },
    'full metal body': { trigger: 'stat_drop_immune' },
    'hyper cutter': { trigger: 'stat_drop_immune', stats: ['attack'] },
    'big pecks': { trigger: 'stat_drop_immune', stats: ['defense'] },
    'pasteveil': { trigger: 'status_immune', statuses: [STATUS.POISON] },

    // === MISC IMMUNE ===
    'overcoat': { trigger: 'weather_immune' },
    'flower veil': { trigger: 'weather_immune' },
    'safety goggles': { trigger: 'weather_immune' },

    // === STATUS BOOST ===
    'serene grace': { trigger: 'status_chance_boost', multiplier: 2 },
    'shell armor': { trigger: 'crit_immune' },
    'battle armor': { trigger: 'crit_immune' },
    'sturdy': { trigger: 'ohko_immune', also: 'survive_ohko_at_full' },
    'inner focus': { trigger: 'flinch_immune' },
    'stamina': { trigger: 'contacted', effect: 'self_stat_boost', stat: 'defense', stages: 1 },

    // === MULTI-STRIKE ===
    'skill link': { trigger: 'multi_strike', always_max: true },
    'parental bond': { trigger: 'parental_bond', hits: 2 },

    // === PRIORITY ===
    'prankster': { trigger: 'priority_boost', category: 'status', priority: 1 },
    'gale wings': { trigger: 'priority_boost', type: 'flying', priority: 1, condition: 'full_hp' },
    'triage': { trigger: 'heal_priority', priority: 3 },
    'grassy surge (glide)': { trigger: 'terrain_priority', terrainType: 'grassy' },

    // === ACCURACY ===
    'compound eyes': { trigger: 'accuracy_boost', multiplier: 1.3 },
    'hustle': { trigger: 'accuracy_hustle', attackMult: 1.5, accuracyMult: 0.8 },
    'no guard': { trigger: 'no_guard', alwaysHits: true },
    'keen eye': { trigger: 'accuracy_immune' },

    // === ON KO ===
    'moxie': { trigger: 'on_ko', stat: 'attack', stages: 1 },
    'beast boost': { trigger: 'on_ko_highest', stages: 1 },
    'soul heart': { trigger: 'ally_faint', stat: 'spAtk', stages: 1 },

    // === SWITCH ===
    'regenerator': { trigger: 'switch_out', healPercent: 1/3 },
    'emergency exit': { trigger: 'low_hp_switch', threshold: 0.5 },
    'wimp out': { trigger: 'low_hp_switch', threshold: 0.5 },

    // === STAT AWARE ===
    'unaware': { trigger: 'unaware' },
    'simple': { trigger: 'simple' },
    'defiant': { trigger: 'stat_lowered', stat: 'attack', stages: 2 },
    'competitive': { trigger: 'stat_lowered', stat: 'spAtk', stages: 2 },

    // === STATUS REFLECT ===
    'magic bounce': { trigger: 'status_move_reflect' },
    'magic guard': { trigger: 'passive_damage_immune', immune: ['burn_damage', 'poison_damage', 'weather_damage', 'recoil', 'life_orb'] },

    // === TYPE CHANGE ===
    'protean': { trigger: 'on_attack', effect: 'change_type_to_move' },
    'libero': { trigger: 'on_attack', effect: 'change_type_to_move' },

    // === OTHER ===
    'neutralizing gas': { trigger: 'entry', effect: 'suppress_abilities' },
    'mold breaker': { trigger: 'bypass_abilities' },
    'teravolt': { trigger: 'bypass_abilities' },
    'turboblaze': { trigger: 'bypass_abilities' },
    'unnerve': { trigger: 'entry', effect: 'prevent_berry' },
    'anticipation': { trigger: 'entry', effect: 'none' },
    'forewarn': { trigger: 'entry', effect: 'none' },
    'trace': { trigger: 'entry', effect: 'none' },
    'imposter': { trigger: 'entry', effect: 'none' },
    'forecast': { trigger: 'weather_change', effect: 'change_type_weather' },
    'color change': { trigger: 'hit_by_move', effect: 'change_type_to_move' },
    'redefine': { trigger: 'hit_by_move', effect: 'change_type_to_move' },
    'mimicry': { trigger: 'terrain_change', effect: 'change_type_terrain' },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getMoveEffect(move) {
    if (!move) return null;
    if (move.id && MOVE_EFFECTS[move.id]) return MOVE_EFFECTS[move.id];
    const name = (move.name || '').toLowerCase().trim();
    return MOVE_EFFECTS_BY_NAME[name] || null;
}

export function activateTerastal(pokemon) {
    if (!pokemon || pokemon.isTerastallized || !pokemon.teraType || pokemon.fainted) return false;
    pokemon._preTeraTypes = [...(pokemon.types || [])];
    pokemon.types = [pokemon.teraType];
    pokemon.isTerastallized = true;
    return true;
}

const _abilityIdToName = new Map();

export function cacheAbilityName(id, name) {
    if (id && name) _abilityIdToName.set(Number(id), name.toLowerCase().trim());
}

export function getAbilityName(abilityId) {
    if (!abilityId) return '';
    if (typeof abilityId === 'string') return abilityId.toLowerCase();
    const cached = _abilityIdToName.get(Number(abilityId));
    if (cached) return cached;
    for (const [name, effect] of Object.entries(ABILITY_EFFECTS)) {
        if (effect._id === abilityId) return name;
    }
    return '';
}

function getStatBoostMsg(name, stat, stages) {
    const statNames = { attack: 'Ataque', defense: 'Defesa', spAtk: 'Sp.Atk', spDef: 'Sp.Def', speed: 'Velocidade', accuracy: 'Precisão' };
    const statName = statNames[stat] || stat;
    if (stages >= 2) return `O ${statName} de ${name} subiu muito!`;
    if (stages === 1) return `O ${statName} de ${name} subiu!`;
    return '';
}

function getStatDropMsg(name, stat, stages) {
    const statNames = { attack: 'Ataque', defense: 'Defesa', spAtk: 'Sp.Atk', spDef: 'Sp.Def', speed: 'Velocidade', accuracy: 'Precisão' };
    const statName = statNames[stat] || stat;
    if (stages >= 2) return `O ${statName} de ${name} caiu muito!`;
    if (stages === 1) return `O ${statName} de ${name} caiu!`;
    return '';
}

export function isGrounded(pokemon) {
    if (!pokemon) return true;
    const name = (pokemon.currentAbilityName || getAbilityName(pokemon.currentAbility)).toLowerCase();
    if (name === 'levitate') return false;
    if (pokemon.types && pokemon.types.includes('flying')) return false;
    return true;
}

export function hasTypeImmunity(abilityName, moveType) {
    const effect = ABILITY_EFFECTS[abilityName];
    if (!effect || effect.trigger !== 'type_immune') return false;
    return (effect.types || []).includes(moveType);
}

// ============================================================
// CAN POKEMON ACT (Sleep/Freeze/Paralysis)
// ============================================================
export function canPokemonAct(pokemon) {
    if (!pokemon || pokemon.fainted) return { canAct: false, message: '' };

    const status = pokemon.statusEffect;
    if (!status) return { canAct: true, message: '' };

    const info = STATUS_INFO[status];
    if (!info) return { canAct: true, message: '' };

    if (status === STATUS.SLEEP) {
        const sleepTurns = pokemon._sleepTurns || 0;
        const maxTurns = info.maxTurns;
        if (sleepTurns < maxTurns) {
            pokemon._sleepTurns = sleepTurns + 1;
            return { canAct: false, message: `${pokemon.name} está dormindo!` };
        } else {
            pokemon.statusEffect = null;
            pokemon._sleepTurns = 0;
            return { canAct: true, message: `${pokemon.name} acordou!` };
        }
    }

    if (status === STATUS.FREEZE) {
        if (Math.random() < info.thawChance) {
            pokemon.statusEffect = null;
            return { canAct: true, message: `${pokemon.name} descongelou!` };
        }
        return { canAct: false, message: `${pokemon.name} está congelado!` };
    }

    if (status === STATUS.PARALYSIS) {
        if (Math.random() < info.skipChance) {
            return { canAct: false, message: `${pokemon.name} está paralisado e não pode se mover!` };
        }
    }

    if (status === STATUS.CONFUSION) {
        const turns = pokemon._confusionTurns || 1;
        if (Math.random() < (info.skipChance || 1 / 3)) {
            const damage = Math.max(1, Math.floor(pokemon.stats.hp / 8));
            pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            pokemon._confusionTurns = turns + 1;
            return { canAct: false, message: `${pokemon.name} está confuso e se machucou! (-${damage} HP)` };
        }
        pokemon._confusionTurns = turns - 1;
        if (pokemon._confusionTurns <= 0) {
            pokemon.statusEffect = null;
            pokemon._confusionTurns = 0;
            return { canAct: true, message: `${pokemon.name} deixou de estar confuso!` };
        }
    }

    return { canAct: true, message: '' };
}

// ============================================================
// PROCESS END OF TURN (Status Damage + Weather/Terrain effects)
// ============================================================
export function processEndOfTurn(pokemon, battleState) {
    if (!pokemon || pokemon.fainted) return [];
    const messages = [];
    const abilityNameAtStart = battleState?._neutralizingGas ? '' : getAbilityName(pokemon.currentAbility);
    const magicGuard = abilityNameAtStart === 'magic guard';

    if (pokemon.statusEffect && abilityNameAtStart === 'shed skin' && Math.random() < 1 / 3) {
        pokemon.statusEffect = null;
        messages.push(`${pokemon.name} curou seu status com Shed Skin!`);
    }
    if (pokemon.statusEffect && abilityNameAtStart === 'hydration' && battleState?.weather === 'rain') {
        pokemon.statusEffect = null;
        messages.push(`${pokemon.name} curou seu status com Hydration!`);
    }

    // Status damage
    const status = pokemon.statusEffect;
    if (status && !magicGuard) {
        const info = STATUS_INFO[status];

        if (status === STATUS.BURN) {
            const dmg = Math.max(1, Math.floor(pokemon.stats.hp * info.damagePercent));
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} é ferido pela queimadura! (-${dmg} HP)`);
        }

        if (status === STATUS.POISON) {
            const dmg = Math.max(1, Math.floor(pokemon.stats.hp * info.damagePercent));
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} é ferido pelo veneno! (-${dmg} HP)`);
        }

        if (status === STATUS.TOXIC) {
            if (!pokemon._toxicCounter) pokemon._toxicCounter = 1;
            const dmg = Math.max(1, Math.floor(pokemon.stats.hp * (1/16) * pokemon._toxicCounter));
            pokemon._toxicCounter++;
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} é ferido pelo toxic! (-${dmg} HP)`);
        }

        // Poison Heal ability
        const abilityName = getAbilityName(pokemon.currentAbility);
        if (abilityName === 'poison heal' && (status === STATUS.POISON || status === STATUS.TOXIC)) {
            const healAmt = Math.max(1, Math.floor(pokemon.stats.hp * 1/8));
            pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
            messages.push(`${pokemon.name} recuperou ${healAmt} HP com Curativa Venenosa!`);
        }
    }

    if (pokemon._boundTurns > 0 && !magicGuard) {
        const bindDamage = Math.max(1, Math.floor(pokemon.stats.hp * (pokemon._boundDamage || 1 / 8)));
        pokemon.currentHp = Math.max(0, pokemon.currentHp - bindDamage);
        if (pokemon.currentHp <= 0) pokemon.fainted = true;
        pokemon._boundTurns--;
        messages.push(`${pokemon.name} sofreu dano do aprisionamento! (-${bindDamage} HP)`);
        if (pokemon._boundTurns <= 0) {
            pokemon._boundDamage = 0;
            messages.push(`${pokemon.name} se libertou do aprisionamento!`);
        }
    }

    if (pokemon._cursed && !magicGuard) {
        const damage = Math.max(1, Math.floor(pokemon.stats.hp / 4));
        pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
        if (pokemon.currentHp <= 0) pokemon.fainted = true;
        messages.push(`${pokemon.name} sofreu dano da maldição! (-${damage} HP)`);
    }
    if (pokemon._leechSeeded && !magicGuard) {
        const damage = Math.max(1, Math.floor(pokemon.stats.hp / 8));
        pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
        if (pokemon.currentHp <= 0) pokemon.fainted = true;
        const source = pokemon._leechSeedSource;
        if (source && !source.fainted) source.currentHp = Math.min(source.stats.hp, source.currentHp + damage);
        messages.push(`${pokemon.name} perdeu ${damage} HP para Leech Seed!`);
        if (source) messages.push(`${source.name} recuperou ${damage} HP com Leech Seed!`);
    }
    if (pokemon._perishTurns > 0) {
        pokemon._perishTurns--;
        messages.push(`${pokemon.name} tem ${pokemon._perishTurns} turnos restantes pela Perish Song!`);
        if (pokemon._perishTurns <= 0) {
            pokemon.currentHp = 0;
            pokemon.fainted = true;
            messages.push(`${pokemon.name} desmaiou pela Perish Song!`);
        }
    }

    // Weather damage
    if (battleState && battleState.weather) {
        const weather = battleState.weather;
        const abilityName = getAbilityName(pokemon.currentAbility);

        // Immunity abilities
        if (magicGuard || abilityName === 'overcoat' || abilityName === 'flower veil') {
            // No weather damage
        } else if (weather === 'sandstorm') {
            const immuneTypes = ['rock', 'ground', 'steel'];
            if (!pokemon.types || !pokemon.types.some(t => immuneTypes.includes(t))) {
                const dmg = Math.max(1, Math.floor(pokemon.stats.hp / 16));
                pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
                if (pokemon.currentHp <= 0) pokemon.fainted = true;
                messages.push(`${pokemon.name} é ferido pela tempestade de areia! (-${dmg} HP)`);
            }
        } else if (weather === 'hail') {
            if (!pokemon.types || !pokemon.types.includes('ice')) {
                const dmg = Math.max(1, Math.floor(pokemon.stats.hp / 16));
                pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
                if (pokemon.currentHp <= 0) pokemon.fainted = true;
                messages.push(`${pokemon.name} é ferido pela neve! (-${dmg} HP)`);
            }
        }

        // Dry Skin sun damage
        if (abilityName === 'dry skin' && weather === 'sun') {
            const dmg = Math.max(1, Math.floor(pokemon.stats.hp / 8));
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} é ferido pelo sol intenso! (-${dmg} HP)`);
        }

        // Solar Power HP drain
        if (abilityName === 'solar power' && weather === 'sun') {
            const dmg = Math.max(1, Math.floor(pokemon.stats.hp / 8));
            pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
            if (pokemon.currentHp <= 0) pokemon.fainted = true;
            messages.push(`${pokemon.name} perdeu HP pelo Poder Solar! (-${dmg} HP)`);
        }

        // Rain Dish
        if (abilityName === 'rain dish' && weather === 'rain') {
            const healAmt = Math.max(1, Math.floor(pokemon.stats.hp / 16));
            pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
            messages.push(`${pokemon.name} recuperou ${healAmt} HP com Prato de Chuva!`);
        }

        // Ice Body
        if (abilityName === 'ice body' && (weather === 'snow' || weather === 'hail')) {
            const healAmt = Math.max(1, Math.floor(pokemon.stats.hp / 16));
            pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
            messages.push(`${pokemon.name} recuperou ${healAmt} HP com Corpo de Gelo!`);
        }
    }

    // Terrain Grassy Terrain healing
    if (battleState && battleState.terrain === 'grassy' && isGrounded(pokemon)) {
        const healAmt = Math.max(1, Math.floor(pokemon.stats.hp / 16));
        pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmt);
        messages.push(`${pokemon.name} recuperou ${healAmt} HP pelo Terreno de Grama!`);
    }

    // Speed Boost ability
    const abilityName = getAbilityName(pokemon.currentAbility);
    if (abilityName === 'speed boost') {
        pokemon._statStages = pokemon._statStages || {};
        pokemon._statStages.speed = Math.min(6, (pokemon._statStages.speed || 0) + 1);
        messages.push(`${pokemon.name} teve sua Velocidade aumentada!`);
    }

    for (const state of ['_taunted', '_encored', '_disabled']) {
        if (pokemon[state] > 0) {
            pokemon[state]--;
            if (pokemon[state] <= 0) {
                pokemon[state] = 0;
                if (state === '_encored') pokemon._encoredMoveId = null;
                if (state === '_disabled') pokemon._disabledMove = null;
                messages.push(`${pokemon.name} não está mais sob ${state.slice(1)}!`);
            }
        }
    }
    pokemon._tormented = 0;

    return messages;
}

// ============================================================
// APPLY MOVE SECONDARY EFFECT
// ============================================================
export function applySecondaryEffect(attacker, defender, move, effectiveness, battleState) {
    const effect = getMoveEffect(move);
    if (!effect) return [];

    const messages = [];

    // Protect
    if (effect.effect === 'protect') {
        const streak = attacker._protectStreak || 0;
        if (Math.random() < (1 / Math.pow(2, streak))) {
            attacker._protected = true;
            messages.push(`${attacker.name} se protegeu!`);
        } else {
            attacker._protected = false;
            messages.push(`${attacker.name} falhou ao usar Protect!`);
        }
        return messages;
    }

    if (effect.effect === 'substitute') {
        const cost = Math.floor(attacker.stats.hp / 4);
        if (attacker._substituteHp > 0) messages.push(`${attacker.name} já possui um Substitute!`);
        else if (attacker.currentHp <= cost) messages.push(`${attacker.name} não tem HP suficiente para criar Substitute!`);
        else {
            attacker.currentHp -= cost;
            attacker._substituteHp = cost;
            messages.push(`${attacker.name} criou um Substitute! (-${cost} HP)`);
        }
        return messages;
    }

    if (effect.effect === 'clear_stages') {
        attacker._statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0 };
        defender._statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0 };
        messages.push('Todos os estágios de atributos foram zerados!');
        return messages;
    }
    if (effect.effect === 'clear_defender_stages') {
        defender._statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0, accuracy: 0 };
        messages.push(`Os estágios de ${defender.name} foram zerados!`);
        return messages;
    }
    if (effect.effect === 'copy_stages') {
        attacker._statStages = { ...(defender._statStages || {}) };
        messages.push(`${attacker.name} copiou os estágios de atributos de ${defender.name}!`);
        return messages;
    }
    if (effect.effect === 'invert_defender_stages') {
        defender._statStages = Object.fromEntries(Object.entries(defender._statStages || {}).map(([stat, value]) => [stat, -value]));
        messages.push(`Os estágios de ${defender.name} foram invertidos!`);
        return messages;
    }
    if (effect.effect === 'curse') {
        if (attacker.types?.includes('ghost')) {
            attacker.currentHp = Math.max(1, attacker.currentHp - Math.floor(attacker.stats.hp / 2));
            defender._cursed = true;
            messages.push(`${defender.name} foi amaldiçoado!`);
        } else {
            attacker._statStages = attacker._statStages || {};
            attacker._statStages.attack = Math.min(6, (attacker._statStages.attack || 0) + 1);
            attacker._statStages.defense = Math.min(6, (attacker._statStages.defense || 0) + 1);
            attacker._statStages.speed = Math.max(-6, (attacker._statStages.speed || 0) - 1);
            messages.push(`${attacker.name} usou Curse e alterou seus atributos!`);
        }
        return messages;
    }
    if (effect.effect === 'perish_song') {
        attacker._perishTurns = 3;
        defender._perishTurns = 3;
        messages.push('Todos os Pokémon ouviram a Canção do Fim!');
        return messages;
    }
    if (effect.effect === 'leech_seed') {
        if (defender.types?.includes('grass')) {
            messages.push(`${defender.name} é imune a Leech Seed!`);
        } else if (!defender._leechSeeded) {
            defender._leechSeeded = true;
            defender._leechSeedSource = attacker;
            messages.push(`${defender.name} foi atingido por Leech Seed!`);
        }
        return messages;
    }

    if (effect.effect === 'remove_item') {
        if (defender.heldItemId) {
            defender.heldItemId = null;
            messages.push(`${defender.name} perdeu o item segurado!`);
        }
        return messages;
    }
    if (effect.effect === 'steal_item') {
        if (!attacker.heldItemId && defender.heldItemId) {
            attacker.heldItemId = defender.heldItemId;
            defender.heldItemId = null;
            messages.push(`${attacker.name} roubou o item do oponente!`);
        }
        return messages;
    }
    if (effect.effect === 'swap_items') {
        if (attacker.heldItemId || defender.heldItemId) {
            const item = attacker.heldItemId;
            attacker.heldItemId = defender.heldItemId || null;
            defender.heldItemId = item || null;
            messages.push(`${attacker.name} e ${defender.name} trocaram seus itens!`);
        }
        return messages;
    }

    // Belly Drum
    if (effect.effect === 'belly_drum') {
        attacker._statStages = attacker._statStages || {};
        attacker._statStages.attack = 6;
        const cost = Math.floor(attacker.stats.hp / 2);
        attacker.currentHp = Math.max(1, attacker.currentHp - cost);
        messages.push(`${attacker.name} usou Belly Drum! Ataque maximizado! (-${cost} HP)`);
        return messages;
    }

    // Stat boost (self)
    if (effect.effect === 'stat_boost') {
        attacker._statStages = attacker._statStages || {};
        const statsToBoost = [
            { stat: effect.stat, stages: effect.stages },
            effect.stat2 ? { stat: effect.stat2, stages: effect.stages2 } : null,
            effect.stat3 ? { stat: effect.stat3, stages: effect.stages3 } : null,
            effect.stat4 ? { stat: effect.stat4, stages: effect.stages4 } : null,
            effect.stat5 ? { stat: effect.stat5, stages: effect.stages5 } : null,
        ].filter(Boolean);

        // Growth doubles in Sun
        const name = (move.name || '').toLowerCase();
        if (name === 'growth' && battleState && battleState.weather === 'sun') {
            for (const s of statsToBoost) s.stages *= 2;
            messages.push(`O Sol Intenso potencializou Growth!`);
        }

        const chance = effect.chance || 100;
        if (Math.random() * 100 < chance) {
            for (const { stat, stages } of statsToBoost) {
                attacker._statStages[stat] = Math.min(6, (attacker._statStages[stat] || 0) + stages);
                messages.push(`${getStatBoostMsg(attacker.name, stat, stages)}`);
            }
        }
        return messages;
    }

    // Stat drop (defender)
    if (effect.effect === 'stat_drop') {
        defender._statStages = defender._statStages || {};

        const statAbility = getAbilityName(defender.currentAbility);
        const statAbilityEffect = ABILITY_EFFECTS[statAbility];
        if (statAbilityEffect?.trigger === 'stat_drop_immune' && (!statAbilityEffect.stats || statAbilityEffect.stats.includes(effect.stat))) {
            messages.push(`${defender.name} não teve ${effect.stat} reduzido por ${statAbility}!`);
            return messages;
        }

        // Check Mist
        if (defender._teamEffects && defender._teamEffects._mist > 0) {
            messages.push(`${defender.name} está protegido pela Névoa!`);
            return messages;
        }

        const chance = effect.chance || 100;
        if (Math.random() * 100 < chance) {
            defender._statStages[effect.stat] = Math.max(-6, (defender._statStages[effect.stat] || 0) - effect.stages);
            messages.push(`${getStatDropMsg(defender.name, effect.stat, effect.stages)}`);
        }
        return messages;
    }

    // Status condition
    if (effect.effect === 'status') {
        const chance = effect.statusChance || effect.chance || 100;
        if (Math.random() * 100 < chance) {
            if (!defender.statusEffect) {
                const statusImmuneTypes = {
                    [STATUS.BURN]: ['fire'],
                    [STATUS.PARALYSIS]: ['electric'],
                    [STATUS.FREEZE]: ['ice'],
                    [STATUS.POISON]: ['poison', 'steel'],
                    [STATUS.TOXIC]: ['poison', 'steel']
                };
                if (statusImmuneTypes[effect.status]?.some(type => defender.types?.includes(type))) {
                    messages.push(`${defender.name} é imune a ${effect.status}!`);
                    return messages;
                }
                if (battleState?.terrain === 'misty' && isGrounded(defender)) {
                    messages.push(`${defender.name} está protegido pelo Misty Terrain!`);
                    return messages;
                }
                // Safeguard check
                if (defender._teamEffects && defender._teamEffects._safeguard > 0) {
                    messages.push(`${defender.name} está protegido pelo Safeguard!`);
                    return messages;
                }

                // Ability immunity check
                if (defender.currentAbility) {
                    const abilityName = getAbilityName(defender.currentAbility);
                    const abilityEffect = ABILITY_EFFECTS[abilityName];
                    if (abilityEffect && abilityEffect.trigger === 'status_immune') {
                        if (abilityEffect.statuses && abilityEffect.statuses.includes(effect.status)) {
                            messages.push(`${defender.name} é imune ao status por ${abilityName}!`);
                            return messages;
                        }
                    }
                    // Leaf Guard in Sun
                    if (abilityEffect && abilityEffect.trigger === 'weather_status_immune') {
                        if (battleState && battleState.weather === abilityEffect.weather) {
                            if (abilityEffect.statuses && abilityEffect.statuses.includes(effect.status)) {
                                messages.push(`${defender.name} é protegido por ${abilityName}!`);
                                return messages;
                            }
                        }
                    }
                }

                defender.statusEffect = effect.status;
                if (effect.status === STATUS.SLEEP) defender._sleepTurns = 0;
                if (effect.status === STATUS.TOXIC) defender._toxicCounter = 1;
                const statusInfo = STATUS_INFO[effect.status];
                messages.push(`${defender.name} foi ${statusInfo ? statusInfo.name.toLowerCase() : effect.status}!`);
            }
        }
        return messages;
    }

    // Flinch
    if (effect.effect === 'confusion') {
        const chance = effect.chance || 100;
        const abilityName = getAbilityName(defender.currentAbility);
        if (Math.random() * 100 < chance && abilityName !== 'own tempo' && !defender.statusEffect) {
            defender.statusEffect = STATUS.CONFUSION;
            defender._confusionTurns = 1 + Math.floor(Math.random() * 4);
            messages.push(`${defender.name} ficou confuso!`);
        }
        return messages;
    }

    if (effect.effect === 'confusion_boost') {
        const abilityName = getAbilityName(defender.currentAbility);
        if (abilityName === 'own tempo') {
            messages.push(`${defender.name} é imune à confusão por Own Tempo!`);
            return messages;
        }
        defender._statStages = defender._statStages || {};
        defender._statStages[effect.stat] = Math.min(6, (defender._statStages[effect.stat] || 0) + effect.stages);
        defender.statusEffect = STATUS.CONFUSION;
        defender._confusionTurns = 1 + Math.floor(Math.random() * 4);
        messages.push(`${defender.name} teve ${effect.stat} aumentado e ficou confuso!`);
        return messages;
    }

    // Flinch
    if (effect.effect === 'flinch') {
        const chance = effect.chance || 100;
        if (Math.random() * 100 < chance) {
            // Inner Focus prevents flinch
            const abilityName = getAbilityName(defender.currentAbility);
            if (abilityName !== 'inner focus') {
                defender._flinched = true;
            }
        }
        return messages;
    }

    // Transform
    if (effect.effect === 'transform') {
        if (attacker._transformed) {
            messages.push(`${attacker.name} já está transformado!`);
            return messages;
        }

        attacker._transformed = true;
        attacker._originalName = attacker.name;
        attacker._originalTypes = [...attacker.types];
        attacker._originalStats = { ...attacker.stats };
        attacker._originalMoves = attacker.moves.map(m => ({ ...m }));
        attacker._originalSpriteUrl = attacker.spriteUrls ? { ...attacker.spriteUrls } : null;
        attacker._originalAbility = attacker.currentAbility;
        attacker._originalAbilityName = attacker.currentAbilityName;

        attacker.name = defender.name;
        attacker.types = [...defender.types];
        attacker.stats = { ...defender.stats };
        const hpRatio = attacker.currentHp / (attacker._originalStats?.hp || attacker.stats.hp);
        attacker.currentHp = Math.max(1, Math.floor(attacker.stats.hp * hpRatio));
        attacker.moves = defender.moves.map(m => ({ ...m, currentPp: m.pp || 35 }));
        if (defender.spriteUrls) attacker.spriteUrls = { ...defender.spriteUrls };
        if (defender.currentAbility) {
            attacker.currentAbility = defender.currentAbility;
            attacker.currentAbilityName = defender.currentAbilityName;
        }
        attacker._statStages = { attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };

        messages.push(`${attacker._originalName} se transformou em ${attacker.name}!`);
        return messages;
    }

    // Heal
    if (effect.effect === 'heal') {
        let healMult = effect.healPercent || 0.5;
        // Weather boost for Morning Sun/Synthesis/Moonlight
        if (effect.weatherBoost && battleState && battleState.weather) {
            const weatherMult = effect.weatherBoost[battleState.weather];
            if (weatherMult) healMult = healMult * (weatherMult / 0.5);
        }
        const healAmount = Math.floor(attacker.stats.hp * healMult);
        attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + healAmount);
        messages.push(`${attacker.name} recuperou ${healAmount} HP!`);
        return messages;
    }

    // Rest
    if (effect.effect === 'rest') {
        attacker.currentHp = attacker.stats.hp;
        attacker.statusEffect = STATUS.SLEEP;
        attacker._sleepTurns = 0;
        messages.push(`${attacker.name} dormiu e recuperou todo o HP!`);
        return messages;
    }

    // Weather
    if (effect.effect === 'weather') {
        if (battleState) {
            battleState.weather = effect.weather;
            battleState.weatherTurns = 5;
            const info = WEATHER_INFO[effect.weather];
            messages.push(`${info ? info.icon : ''} ${info ? info.name : effect.weather} começou!`);
        }
        return messages;
    }

    // Terrain
    if (effect.effect === 'terrain') {
        if (battleState) {
            battleState.terrain = effect.terrain;
            battleState.terrainTurns = 5;
            const info = TERRAIN_INFO[effect.terrain];
            messages.push(`${info ? info.icon : ''} Terreno ${info ? info.name : effect.terrain} ativado!`);
        }
        return messages;
    }

    // Hazard
    if (effect.effect === 'hazard') {
        if (defender._teamEffects) {
            if (effect.hazard === 'stealthRock') {
                if (!defender._teamEffects._stealthRock) {
                    defender._teamEffects._stealthRock = true;
                    messages.push('Pedras Afiadas foram colocadas!');
                }
            } else if (effect.hazard === 'spikes') {
                if (defender._teamEffects._spikes < 3) {
                    defender._teamEffects._spikes++;
                    messages.push(`Spikes foram colocados! (camada ${defender._teamEffects._spikes})`);
                }
            } else if (effect.hazard === 'toxicSpikes') {
                if (defender._teamEffects._toxicSpikes < 2) {
                    defender._teamEffects._toxicSpikes++;
                    messages.push(`Toxic Spikes foram colocados! (camada ${defender._teamEffects._toxicSpikes})`);
                }
            } else if (effect.hazard === 'stickyWeb') {
                if (!defender._teamEffects._stickyWeb) {
                    defender._teamEffects._stickyWeb = true;
                    messages.push('Sticky Web foi colocado!');
                }
            }
        }
        return messages;
    }

    // Screen
    if (effect.effect === 'screen') {
        if (attacker._teamEffects) {
            attacker._teamEffects[effect.screen] = effect.duration || 5;
            const screenNames = { lightScreen: 'Luz Barrier', reflect: 'Refletido', auroraVeil: 'Véu Aurora' };
            messages.push(`${screenNames[effect.screen] || effect.screen} foi colocado!`);
        }
        return messages;
    }

    // Field status (Safeguard, Mist, Tailwind)
    if (effect.effect === 'field_status') {
        if (attacker._teamEffects) {
            attacker._teamEffects[effect.field] = effect.duration || 5;
            const fieldNames = { _safeguard: 'Safeguard', _mist: 'Névoa', _tailwind: 'Vento Calado' };
            messages.push(`${fieldNames[effect.field] || effect.field} foi ativado!`);
        }
        return messages;
    }

    if (effect.effect === 'bind') {
        defender._boundTurns = 4 + Math.floor(Math.random() * 2);
        defender._boundDamage = effect.bindDamage || 1 / 8;
        messages.push(`${defender.name} ficou preso por ${defender._boundTurns} turnos!`);
        return messages;
    }

    // Hazard remove
    if (effect.effect === 'hazard_remove') {
        if (attacker._teamEffects) {
            attacker._teamEffects._stealthRock = false;
            attacker._teamEffects._spikes = 0;
            attacker._teamEffects._toxicSpikes = 0;
            attacker._teamEffects._stickyWeb = false;
            messages.push('Os hazards foram removidos!');
        }
        if (effect.removeBoth && defender._teamEffects) {
            defender._teamEffects._stealthRock = false;
            defender._teamEffects._spikes = 0;
            defender._teamEffects._toxicSpikes = 0;
            defender._teamEffects._stickyWeb = false;
            defender._teamEffects._lightScreen = 0;
            defender._teamEffects._reflect = 0;
            defender._teamEffects._auroraVeil = 0;
            messages.push('Os hazards do oponente foram removidos!');
        }
        return messages;
    }

    if (effect.effect === 'rapid_spin') {
        if (attacker._teamEffects) {
            attacker._teamEffects._stealthRock = false;
            attacker._teamEffects._spikes = 0;
            attacker._teamEffects._toxicSpikes = 0;
            attacker._teamEffects._stickyWeb = false;
        }
        attacker._statStages = attacker._statStages || {};
        attacker._statStages.speed = Math.min(6, (attacker._statStages.speed || 0) + 1);
        messages.push(`${attacker.name} limpou os hazards e aumentou sua Speed!`);
        return messages;
    }

    // Taunt
    if (effect.effect === 'taunt') {
        defender._taunted = 3;
        messages.push(`${defender.name} foi provocado!`);
        return messages;
    }

    // Disable
    if (effect.effect === 'disable') {
        defender._disabled = true;
        defender._disabledMove = defender._lastMove;
        messages.push(`${defender.name} teve seu movimento desativado!`);
        return messages;
    }

    // Weather Ball
    if (effect.effect === 'weather_ball') {
        // Handled in damage calc
        return messages;
    }

    // Encore
    if (effect.effect === 'encore') {
        defender._encored = 3;
        defender._encoredMoveId = defender._lastMove?.id || null;
        messages.push(`${defender.name} está sob efeito de Encore!`);
        return messages;
    }

    if (effect.effect === 'torment') {
        defender._tormented = 1;
        messages.push(`${defender.name} está sob efeito de Torment!`);
        return messages;
    }

    // Strength Sap
    if (effect.effect === 'strength_sap') {
        const stages = defender._statStages || {};
        const atkStage = stages.attack || 0;
        const atkMult = getStatMult(atkStage);
        const healAmt = Math.floor(attacker.stats.hp * atkMult * 0.3);
        defender._statStages = defender._statStages || {};
        defender._statStages.attack = Math.max(-6, (defender._statStages.attack || 0) - 1);
        attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + healAmt);
        messages.push(`${attacker.name} drenou ${healAmt} HP! Ataque de ${defender.name} caiu!`);
        return messages;
    }

    return messages;
}

// ============================================================
// PROTECT CHECK
// ============================================================
export function isProtected(defender) {
    return defender && defender._protected === true;
}

export function clearProtect(pokemon) {
    if (!pokemon) return;
    if (pokemon._protected) pokemon._protectStreak = (pokemon._protectStreak || 0) + 1;
    else pokemon._protectStreak = 0;
    pokemon._protected = false;
}

// ============================================================
// APPLY STAT STAGES TO DAMAGE CALC
// ============================================================
export function applyStatStages(attacker, defender, move, baseDamage, critical = false) {
    const aStages = attacker._statStages || {};
    const dStages = defender._statStages || {};
    const attackerAbility = getAbilityName(attacker.currentAbility);
    const defenderAbility = getAbilityName(defender.currentAbility);
    const ignoreAttackerStages = defenderAbility === 'unaware';
    const ignoreDefenderStages = attackerAbility === 'unaware';

    let atkMult = 1;
    let defMult = 1;

    if (move.category === 'physical') {
        atkMult = getStatMult(ignoreAttackerStages ? 0 : (critical ? Math.max(0, aStages.attack || 0) : (aStages.attack || 0)));
        defMult = getStatMult(ignoreDefenderStages ? 0 : (critical ? Math.min(0, dStages.defense || 0) : (dStages.defense || 0)));
        if (attacker.statusEffect === STATUS.BURN) atkMult *= 0.5;
    } else if (move.category === 'special') {
        atkMult = getStatMult(ignoreAttackerStages ? 0 : (critical ? Math.max(0, aStages.spAtk || 0) : (aStages.spAtk || 0)));
        defMult = getStatMult(ignoreDefenderStages ? 0 : (critical ? Math.min(0, dStages.spDef || 0) : (dStages.spDef || 0)));
    }

    return Math.max(1, Math.floor(baseDamage * atkMult / defMult));
}

// ============================================================
// APPLY WEATHER TO DAMAGE
// ============================================================
export function applyWeatherDamageModifier(attacker, move, baseDamage, battleState) {
    if (!battleState || !battleState.weather) return baseDamage;
    const boosts = getWeatherMoveBoost(battleState.weather);
    const moveType = (move.type || '').toLowerCase();
    if (boosts[moveType]) {
        return Math.floor(baseDamage * boosts[moveType]);
    }
    return baseDamage;
}

// ============================================================
// APPLY TERRAIN TO DAMAGE
// ============================================================
export function applyTerrainDamageModifier(attacker, defender, move, baseDamage, battleState) {
    if (!battleState || !battleState.terrain) return baseDamage;
    const boosts = getTerrainMoveBoost(battleState.terrain);
    const moveType = (move.type || '').toLowerCase();
    const grounded = isGrounded(defender);
    if (boosts[moveType] && grounded) {
        return Math.floor(baseDamage * boosts[moveType]);
    }
    // Psychic Terrain blocks priority
    if (battleState.terrain === 'psychic' && grounded) {
        const priority = getMovePriority(move);
        if (priority > 0) return 0; // blocked
    }
    return baseDamage;
}

// ============================================================
// APPLY SCREEN DAMAGE REDUCTION
// ============================================================
export function applyScreenReduction(defender, move, baseDamage) {
    const reduction = getScreenDamageReduction(defender, move.category);
    return Math.floor(baseDamage * reduction);
}

// ============================================================
// PROCESS ENTRY ABILITIES (Intimidate, Weather, Terrain, etc.)
// ============================================================
export function processEntryAbilities(pokemon, opponent, battleState) {
    if (!pokemon) return [];
    const messages = [];
    const abilityName = (pokemon.currentAbilityName || '').toLowerCase().trim() || getAbilityName(pokemon.currentAbility);
    if (battleState?._neutralizingGas && abilityName !== 'neutralizing gas') return [];
    const effect = ABILITY_EFFECTS[abilityName];
    if (!effect) return messages;

    if (effect.trigger === 'entry') {
        if (effect.effect === 'weather' && battleState) {
            battleState.weather = effect.weather;
            battleState.weatherTurns = 5;
            const info = WEATHER_INFO[effect.weather];
            messages.push(`${info ? info.icon : ''} ${info ? info.name : effect.weather} começou!`);
        }
        if (effect.effect === 'terrain' && battleState) {
            battleState.terrain = effect.terrain;
            battleState.terrainTurns = 5;
            const info = TERRAIN_INFO[effect.terrain];
            messages.push(`${info ? info.icon : ''} Terreno ${info ? info.name : effect.terrain} ativado!`);
        }
        if (effect.effect === 'stat_drop_opponent' && opponent) {
            const opponentAbility = getAbilityName(opponent.currentAbility);
            const opponentAbilityEffect = ABILITY_EFFECTS[opponentAbility];
            if (opponentAbilityEffect?.trigger === 'stat_drop_immune' && (!opponentAbilityEffect.stats || opponentAbilityEffect.stats.includes(effect.stat))) {
                messages.push(`${opponent.name} ignorou Intimidate por ${opponentAbility}!`);
                return messages;
            }
            opponent._statStages = opponent._statStages || {};
            opponent._statStages[effect.stat] = Math.max(-6, (opponent._statStages[effect.stat] || 0) - effect.stages);
            messages.push(`${abilityName} de ${pokemon.name} reduziu o ${effect.stat === 'attack' ? 'Ataque' : effect.stat} de ${opponent.name}!`);
        }
        if (effect.effect === 'suppress_abilities') {
            battleState._neutralizingGas = true;
            messages.push('Gás Neutralizante suprime todas as habilidades!');
        }
    }

    return messages;
}

// ============================================================
// PROCESS WEATHER SPEED (called during turn order)
// ============================================================
export function getWeatherSpeed(pokemon, battleState) {
    if (!pokemon || !battleState || !battleState.weather) return pokemon ? (pokemon.stats?.speed || 0) : 0;
    const abilityName = battleState?._neutralizingGas ? '' : getAbilityName(pokemon.currentAbility);
    let speed = pokemon.stats?.speed || 0;
    speed *= getWeatherSpeedMult(battleState.weather, abilityName);
    return speed;
}

// ============================================================
// PROCESS CONTACT ABILITIES
// ============================================================
export function processContactAbilities(defender, attacker) {
    if (!defender || (!defender.currentAbility && !defender.currentAbilityName)) return [];
    const defenderAbilityName = (defender.currentAbilityName || getAbilityName(defender.currentAbility)).toLowerCase();
    const attackerAbilityName = (attacker?.currentAbilityName || getAbilityName(attacker?.currentAbility)).toLowerCase();
    if (defenderAbilityName === 'neutralizing gas' || attackerAbilityName === 'neutralizing gas') return [];
    const abilityName = (defender.currentAbilityName || getAbilityName(defender.currentAbility)).toLowerCase();
    const abilityEffect = ABILITY_EFFECTS[abilityName];
    if (!abilityEffect) return [];

    const messages = [];

    if (abilityEffect.trigger === 'contacted' || abilityEffect.trigger === 'contact') {
        if (abilityEffect.effect === 'random_status') {
            if (Math.random() * 100 < (abilityEffect.chance || 0) && !attacker.statusEffect) {
                const statuses = [STATUS.PARALYSIS, STATUS.POISON, STATUS.SLEEP];
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                attacker.statusEffect = status;
                messages.push(`${abilityName} de ${defender.name} causou ${STATUS_INFO[status]?.name.toLowerCase() || status}!`);
            }
            return messages;
        }
        if (abilityEffect.effect === 'status') {
            if (Math.random() * 100 < (abilityEffect.chance || 0)) {
                if (!attacker.statusEffect) {
                    attacker.statusEffect = abilityEffect.status;
                    const statusInfo = STATUS_INFO[abilityEffect.status];
                    messages.push(`${abilityName} de ${defender.name} causou ${statusInfo ? statusInfo.name.toLowerCase() : abilityEffect.status} em ${attacker.name}!`);
                }
            }
        } else if (abilityEffect.effect === 'damage') {
            const dmg = Math.max(1, Math.floor(attacker.stats.hp * abilityEffect.damage));
            attacker.currentHp = Math.max(0, attacker.currentHp - dmg);
            if (attacker.currentHp <= 0) attacker.fainted = true;
            messages.push(`${abilityName} de ${defender.name} causou ${dmg} de dano a ${attacker.name}!`);
        } else if (abilityEffect.effect === 'stat_drop_target') {
            if (Math.random() * 100 < (abilityEffect.chance || 100)) {
                attacker._statStages = attacker._statStages || {};
                attacker._statStages[abilityEffect.stat] = Math.max(-6, (attacker._statStages[abilityEffect.stat] || 0) - abilityEffect.stages);
                messages.push(`${abilityName} de ${defender.name} reduziu a Velocidade de ${attacker.name}!`);
            }
        } else if (abilityEffect.effect === 'self_stat_swap') {
            defender._statStages = defender._statStages || {};
            defender._statStages.defense = Math.max(-6, (defender._statStages.defense || 0) - (abilityEffect.defDrop || 1));
            defender._statStages.speed = Math.min(6, (defender._statStages.speed || 0) + (abilityEffect.speedBoost || 2));
            messages.push(`${abilityName} de ${defender.name}: Defesa caiu, Velocidade subiu!`);
        } else if (abilityEffect.effect === 'self_stat_boost') {
            defender._statStages = defender._statStages || {};
            defender._statStages[abilityEffect.stat] = Math.min(6, (defender._statStages[abilityEffect.stat] || 0) + abilityEffect.stages);
            const statNames = { attack: 'Ataque', defense: 'Defesa', spAtk: 'Sp.Atk', spDef: 'Sp.Def', speed: 'Velocidade' };
            messages.push(`${abilityName} de ${defender.name}: ${statNames[abilityEffect.stat] || abilityEffect.stat} subiu!`);
        } else if (abilityEffect.effect === 'disable') {
            if (Math.random() * 100 < (abilityEffect.chance || 0)) {
                if (attacker._lastMove) {
                    attacker._disabled = true;
                    attacker._disabledMove = attacker._lastMove;
                    messages.push(`${abilityName} de ${defender.name} desativou ${attacker._lastMove.name}!`);
                }
            }
        }
    }

    return messages;
}

// ============================================================
// PROCESS UNAWARE (ignore stat stages)
// ============================================================
export function getUnawareMultiplier(attacker, defender, move) {
    const attackerAbility = getAbilityName(attacker.currentAbility);
    const defenderAbility = getAbilityName(defender.currentAbility);

    let atkMult = 1;
    let defMult = 1;

    if (attackerAbility === 'unaware') {
        defMult = 1; // ignore defender stages
    }
    if (defenderAbility === 'unaware') {
        atkMult = 1; // ignore attacker stages
    }

    return { atkMult, defMult };
}

// ============================================================
// RESET TURN STATE
// ============================================================
export function resetTurnState(pokemon) {
    if (!pokemon) return;
    pokemon._flinched = false;
    pokemon._protected = false;
    pokemon._charging = false;
}
