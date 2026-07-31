// ============================================================
// BATTLE MECHANICS - Complete Pokemon battle system
// Status conditions, move effects, abilities, priority, stat stages
// ============================================================

// --- STATUS CONDITIONS ---
export const STATUS = {
    BURN: 'burn',
    POISON: 'poison',
    TOXIC: 'toxic',
    PARALYSIS: 'paralysis',
    SLEEP: 'sleep',
    FREEZE: 'freeze'
};

export const STATUS_INFO = {
    burn: { name: 'Queimadura', color: '#ff4444', emoji: '🔥', canAct: true, damagePercent: 1/16, attackMult: 0.5 },
    poison: { name: 'Veneno', color: '#aa44aa', emoji: '☠️', canAct: true, damagePercent: 1/8, attackMult: 1.0 },
    toxic: { name: 'Toxic', color: '#cc44cc', emoji: '💀', canAct: true, damagePercent: 1/16, toxicCounter: true, attackMult: 1.0 },
    paralysis: { name: 'Paralisia', color: '#ffcc00', emoji: '⚡', canAct: true, skipChance: 0.25, speedMult: 0.5, attackMult: 1.0 },
    sleep: { name: 'Sono', color: '#8888cc', emoji: '💤', canAct: false, minTurns: 1, maxTurns: 3, attackMult: 1.0 },
    freeze: { name: 'Congelado', color: '#88ccff', emoji: '🧊', canAct: false, thawChance: 0.2, attackMult: 1.0 }
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
    const key = String(Math.max(-6, Math.min(6, stage)));
    return STAT_STAGE_MULT[key] || 1;
}

// --- MOVE PRIORITY ---
const MOVE_PRIORITY = {
    'protect': 4, 'detect': 4, 'endure': 4,
    'quick attack': 1, 'extreme speed': 2, 'aquajet': 1, 'bulletpunch': 1, 'mach punch': 1,
    'ice shard': 1, 'shadow sneak': 1, 'sucker punch': 1, 'vacuum wave': 1,
    'feint': 2, 'fake out': 3,
    'helping hand': 5, 'follow me': 2, 'rage powder': 2,
    'brick break': 0, 'circle throw': -6, 'dragon tail': -6, 'roar': -6, 'whirlwind': -6,
    'teleport': -6
};

export function getMovePriority(move) {
    if (!move) return 0;
    const name = (move.name || '').toLowerCase();
    return MOVE_PRIORITY[name] || 0;
}

// --- MOVE EFFECTS DATABASE ---
// Each entry: { effect: string, chance: number, ...params }
// effect types: 'status', 'stat_boost', 'stat_drop', 'protect', 'heal', 'recoil', 'drain', 'fixed_damage', 'multi_hit', 'charge'
const MOVE_EFFECTS = {
    // === PROTECT / DETECT ===
    321: { effect: 'protect' },     // Protect
    107: { effect: 'protect' },     // Detect
    203: { effect: 'protect' },     // Endure

    // === FIRE moves with burn chance ===
    52: { effect: 'status', status: STATUS.BURN, chance: 10 },    // Ember
    53: { effect: 'status', status: STATUS.BURN, chance: 10 },    // Flamethrower
    83: { effect: 'status', status: STATUS.BURN, chance: 10 },    // Fire Blast
    126: { effect: 'status', status: STATUS.BURN, chance: 30 },   // Fire Punch
    424: { effect: 'status', status: STATUS.BURN, chance: 10 },   // Lava Plume
    481: { effect: 'status', status: STATUS.BURN, chance: 20 },   // Flare Blitz
    257: { effect: 'status', status: STATUS.BURN, chance: 10 },   // Overheat
    534: { effect: 'status', status: STATUS.BURN, chance: 20 },   // Blue Flare
    545: { effect: 'status', status: STATUS.BURN, chance: 10 },   // Fusion Flare
    188: { effect: 'status', status: STATUS.BURN, chance: 10 },   // Heat Wave

    // === ICE moves with freeze chance ===
    58: { effect: 'status', status: STATUS.FREEZE, chance: 10 },   // Ice Beam
    8: { effect: 'status', status: STATUS.FREEZE, chance: 10 },    // Blizzard
    141: { effect: 'status', status: STATUS.FREEZE, chance: 10 },  // Ice Punch
    420: { effect: 'status', status: STATUS.FREEZE, chance: 10 },  // Ice Shard
    524: { effect: 'status', status: STATUS.FREEZE, chance: 30 },  // Freeze-Dry

    // === ELECTRIC moves with paralysis chance ===
    85: { effect: 'status', status: STATUS.PARALYSIS, chance: 10 },  // Thunderbolt
    86: { effect: 'status', status: STATUS.PARALYSIS, chance: 30 },  // Thunder
    104: { effect: 'status', status: STATUS.PARALYSIS, chance: 10 }, // Thunder Punch
    205: { effect: 'status', status: STATUS.PARALYSIS, chance: 30 }, // Thunder Wave (guaranteed)
    604: { effect: 'status', status: STATUS.PARALYSIS, chance: 10 }, // Discharge

    // === GRASS moves with poison chance ===
    77: { effect: 'status', status: STATUS.POISON, chance: 30 },   // Stun Spore -> actually paralyze, but poison powder is poison
    73: { effect: 'status', status: STATUS.POISON, chance: 10 },   // Poison Powder
    402: { effect: 'status', status: STATUS.POISON, chance: 10 },  // Poison Jab
    512: { effect: 'status', status: STATUS.POISON, chance: 10 },  // Gunk Shot

    // === TOXIC ===
    92: { effect: 'status', status: STATUS.TOXIC, chance: 100 },   // Toxic (always hits, OHKO-like accuracy)

    // === SLEEP moves ===
    47: { effect: 'status', status: STATUS.SLEEP, chance: 55 },    // Sing
    95: { effect: 'status', status: STATUS.SLEEP, chance: 60 },    // Hypnosis
    79: { effect: 'status', status: STATUS.SLEEP, chance: 75 },    // Sleep Powder
    149: { effect: 'status', status: STATUS.SLEEP, chance: 60 },   // Dark Void (Darkrai)

    // === PARALYSIS moves ===
    78: { effect: 'status', status: STATUS.PARALYSIS, chance: 75 }, // Stun Spore
    86: { effect: 'status', status: STATUS.PARALYSIS, chance: 30 }, // Thunder Wave
    205: { effect: 'status', status: STATUS.PARALYSIS, chance: 100 }, // Thunder Wave (guaranteed)

    // === STAT BOOST moves ===
    14: { effect: 'stat_boost', stat: 'attack', stages: 2 },     // Swords Dance
    97: { effect: 'stat_boost', stat: 'speed', stages: 2 },      // Agility
    96: { effect: 'stat_boost', stat: 'attack', stages: 1 },     // Meditate
    113: { effect: 'stat_boost', stat: 'spAtk', stages: 1 },     // Growth (also speed in sun)
    74: { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'spAtk', stages2: 1 }, // Growth
    106: { effect: 'stat_boost', stat: 'defense', stages: 1 },    // Harden
    110: { effect: 'stat_boost', stat: 'defense', stages: 1 },    // Withdraw
    111: { effect: 'stat_boost', stat: 'defense', stages: 2 },    // Iron Defense
    133: { effect: 'stat_boost', stat: 'spDef', stages: 2 },     // Amnesia
    317: { effect: 'stat_boost', stat: 'attack', stages: 2 },     // Belly Drum (set to +6 but lose 50% HP) - simplified
    105: { effect: 'stat_boost', stat: 'spDef', stages: 1 },     // Stockpile

    // === STAT DROP moves ===
    43: { effect: 'stat_drop', stat: 'defense', stages: 1 },      // Tail Whip
    45: { effect: 'stat_drop', stat: 'attack', stages: 1 },       // Growl
    44: { effect: 'stat_drop', stat: 'defense', stages: 1 },      // Leer
    103: { effect: 'stat_drop', stat: 'defense', stages: 2 },     // Screech
    81: { effect: 'stat_drop', stat: 'speed', stages: 1 },        // String Shot
    108: { effect: 'stat_drop', stat: 'accuracy', stages: 1 },    // Smokescreen
    28: { effect: 'stat_drop', stat: 'accuracy', stages: 1 },     // Sand Attack

    // === RECOIL moves ===
    38: { effect: 'recoil', recoil: 1/4 },   // Double-Edge (25% recoil)
    440: { effect: 'recoil', recoil: 1/3 },  // Wild Charge (33% recoil)
    412: { effect: 'recoil', recoil: 1/3 },  // Brave Bird (33% recoil)
    481: { effect: 'recoil', recoil: 1/3 },  // Flare Blitz (33% recoil)
    56: { effect: 'recoil', recoil: 1/4 },   // Take Down (25% recoil)
    456: { effect: 'recoil', recoil: 1/3 },  // Head Smash (33% recoil)
    457: { effect: 'recoil', recoil: 1/3 },  // Giga Impact (33% recoil)

    // === DRAIN moves ===
    409: { effect: 'drain', drain: 1/2 },   // Giga Drain (50% drain)
    710: { effect: 'drain', drain: 1/2 },   // Drain Punch (50% drain)
    577: { effect: 'drain', drain: 1/2 },   // Horn Leech (50% drain)
    739: { effect: 'drain', drain: 1/2 },   // Leech Life (50% drain)

    // === FIXED DAMAGE moves ===
    15: { effect: 'fixed_damage', fixedPower: true },  // Seismic Toss (level-based)
    69: { effect: 'fixed_damage', fixedPower: true },  // Night Shade (level-based)

    // === MULTI-HIT moves ===
    31: { effect: 'multi_hit', minHits: 2, maxHits: 5 },  // Fury Attack
    30: { effect: 'multi_hit', minHits: 2, maxHits: 5 },  // Fury Swipes
    42: { effect: 'multi_hit', minHits: 2, maxHits: 5 },  // Double Slap
    154: { effect: 'multi_hit', minHits: 2, maxHits: 5 }, // Bullet Seed
    198: { effect: 'multi_hit', minHits: 2, maxHits: 5 }, // Rock Blast
    529: { effect: 'multi_hit', minHits: 2, maxHits: 5 }, // Icicle Spear

    // === HEAL moves ===
    105: { effect: 'heal', healPercent: 0.5 },  // Recover
    135: { effect: 'heal', healPercent: 0.5 },  // Softboiled
    181: { effect: 'heal', healPercent: 0.5 },  // Milk Drink
    272: { effect: 'heal', healPercent: 0.5 },  // Wish
    218: { effect: 'heal', healPercent: 0.5 },  // Slack Off

    // === CHARGE moves ===
    516: { effect: 'charge' },  // Fly (turn 1 charge, turn 2 attack)
    448: { effect: 'charge' },  // Dig (turn 1 charge, turn 2 attack)
    590: { effect: 'charge' },  // Shadow Force (turn 1 charge, turn 2 attack)
    488: { effect: 'charge' },  // Sky Attack (turn 1 charge, turn 2 attack)

    // === FLINCH moves ===
    141: { effect: 'flinch', chance: 30 },  // Iron Head
    528: { effect: 'flinch', chance: 30 },  // Rock Slide
    8: { effect: 'flinch', chance: 10 },    // Blizzard
    531: { effect: 'flinch', chance: 20 },  // Dark Pulse
    348: { effect: 'flinch', chance: 20 },  // Dragon Rush

    // === CRITICAL moves ===
    210: { effect: 'crit_boost', stages: 1 },  // Razor Leaf (high crit)
    348: { effect: 'crit_boost', stages: 1 },  // Psycho Cut (high crit)
    292: { effect: 'crit_boost', stages: 1 },  // Cross Poison (high crit)

    // === ACCURACY moves ===
    150: { effect: 'accuracy_boost', stages: 1 },  // Agility (also boosts accuracy in some gens)
};

// --- MOVES BY NAME (for moves not in DB by ID) ---
const MOVE_EFFECTS_BY_NAME = {
    'thunder wave': { effect: 'status', status: STATUS.PARALYSIS, chance: 100 },
    'will-o-wisp': { effect: 'status', status: STATUS.BURN, chance: 85 },
    'glare': { effect: 'status', status: STATUS.PARALYSIS, chance: 100 },
    'spore': { effect: 'status', status: STATUS.SLEEP, chance: 100 },
    'lovely kiss': { effect: 'status', status: STATUS.SLEEP, chance: 75 },
    'shock wave': { effect: 'none' },
    'swagger': { effect: 'stat_drop', stat: 'attack', stages: 2 },
    'flatter': { effect: 'stat_drop', stat: 'spAtk', stages: 2 },
    'cosmic power': { effect: 'stat_boost', stat: 'defense', stages: 1, stat2: 'spDef', stages2: 1 },
    'dragon dance': { effect: 'stat_boost', stat: 'attack', stages: 1, stat2: 'speed', stages2: 1 },
    'quiver dance': { effect: 'stat_boost', stat: 'spAtk', stages: 1, stat2: 'spDef', stages2: 2, stat3: 'speed', stages3: 1 },
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
    'scary face': { effect: 'stat_drop', stat: 'speed', stages: 2 },
    'iron tail': { effect: 'stat_drop', stat: 'defense', stages: 1, chance: 30 },
    'shadow claw': { effect: 'crit_boost', stages: 1 },
    'leaf blade': { effect: 'crit_boost', stages: 1 },
    'night slash': { effect: 'crit_boost', stages: 1 },
    'dragon claw': { effect: 'none' },
    'psychic': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'bug buzz': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'moonblast': { effect: 'stat_drop', stat: 'spAtk', stages: 1, chance: 30 },
    'dazzling gleam': { effect: 'none' },
    'sludge bomb': { effect: 'status', status: STATUS.POISON, chance: 30 },
    'sludge wave': { effect: 'status', status: STATUS.POISON, chance: 10 },
    'venoshock': { effect: 'none' },
    'smog': { effect: 'status', status: STATUS.POISON, chance: 40 },
    'cross poison': { effect: 'status', status: STATUS.POISON, chance: 20 },
    'poison jab': { effect: 'status', status: STATUS.POISON, chance: 30 },
    'gunk shot': { effect: 'status', status: STATUS.POISON, chance: 30 },
    'drain punch': { effect: 'drain', drain: 0.5 },
    'hex': { effect: 'none' },
    'shadow ball': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 20 },
    'flash cannon': { effect: 'stat_drop', stat: 'spDef', stages: 1, chance: 10 },
    'aura sphere': { effect: 'none' },
    'dragon pulse': { effect: 'none' },
    'dark pulse': { effect: 'flinch', chance: 20 },
    'steam eruption': { effect: 'status', status: STATUS.BURN, chance: 30 },
    'freeze-dry': { effect: 'status', status: STATUS.FREEZE, chance: 30 },
    'ice fang': { effect: 'status', status: STATUS.FREEZE, chance: 10, flinch: true, flinchChance: 10 },
    'fire fang': { effect: 'status', status: STATUS.BURN, chance: 10, flinch: true, flinchChance: 10 },
    'thunder fang': { effect: 'status', status: STATUS.PARALYSIS, chance: 10, flinch: true, flinchChance: 10 },
    'bite': { effect: 'flinch', chance: 30 },
    'crunch': { effect: 'flinch', chance: 20, stat_drop: { stat: 'defense', stages: 1, chance: 20 } },
    'iron head': { effect: 'flinch', chance: 30 },
    'rock slide': { effect: 'flinch', chance: 30 },
    'air slash': { effect: 'flinch', chance: 30 },
    'dragon rush': { effect: 'flinch', chance: 20 },
    'zen headbutt': { effect: 'flinch', chance: 20 },
    'headbutt': { effect: 'flinch', chance: 30 },
    'stomp': { effect: 'flinch', chance: 30 },
    'rolling kick': { effect: 'flinch', chance: 30 },
    'wing attack': { effect: 'none' },
    'knock off': { effect: 'none' },
    'psychic fangs': { effect: 'none' },
    'body press': { effect: 'none' },
    'infestation': { effect: 'none' },
    'dual wingbeat': { effect: 'multi_hit', minHits: 2, maxHits: 2 },
    'scale shot': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'population bomb': { effect: 'multi_hit', minHits: 2, maxHits: 10 },
    'triple axel': { effect: 'multi_hit', minHits: 2, maxHits: 3 },
    'beat up': { effect: 'multi_hit', minHits: 2, maxHits: 6 },
    'bullet seed': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'rock blast': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'icicle spear': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'tail slap': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'bonemerang': { effect: 'multi_hit', minHits: 2, maxHits: 2 },
    'double hit': { effect: 'multi_hit', minHits: 2, maxHits: 2 },
    'double kick': { effect: 'multi_hit', minHits: 2, maxHits: 2 },
    'arm thrust': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'fury attack': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'fury swipes': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'double slap': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'pin missile': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
    'water shuriken': { effect: 'multi_hit', minHits: 2, maxHits: 5 },
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
    'synthesis': { effect: 'heal', healPercent: 0.5 },
    'moonlight': { effect: 'heal', healPercent: 0.5 },
    'morning sun': { effect: 'heal', healPercent: 0.5 },
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
};

// --- ABILITY EFFECTS ---
export const ABILITY_EFFECTS = {
    // Contact abilities (chance to activate when hit by contact move)
    'flame body': { trigger: 'contacted', effect: 'status', status: STATUS.BURN, chance: 30 },
    'static': { trigger: 'contacted', effect: 'status', status: STATUS.PARALYSIS, chance: 30 },
    'poison point': { trigger: 'contacted', effect: 'status', status: STATUS.POISON, chance: 30 },
    'cute charm': { trigger: 'contacted', effect: 'none' },
    'effect spore': { trigger: 'contacted', effect: 'random_status', chance: 30 },

    // On attack abilities
    'iron barbs': { trigger: 'contacted', effect: 'damage', damage: 1/8 },
    'rough skin': { trigger: 'contacted', effect: 'damage', damage: 1/8 },

    // Weather abilities
    'drizzle': { trigger: 'entry', effect: 'weather', weather: 'rain' },
    'drought': { trigger: 'entry', effect: 'weather', weather: 'sun' },
    'snow warning': { trigger: 'entry', effect: 'weather', weather: 'hail' },
    'sand stream': { trigger: 'entry', effect: 'weather', weather: 'sandstorm' },

    // Damage boost abilities
    'blaze': { trigger: 'damage_boost', type: 'fire', condition: 'low_hp', multiplier: 1.5 },
    'torrent': { trigger: 'damage_boost', type: 'water', condition: 'low_hp', multiplier: 1.5 },
    'overgrow': { trigger: 'damage_boost', type: 'grass', condition: 'low_hp', multiplier: 1.5 },
    'swarm': { trigger: 'damage_boost', type: 'bug', condition: 'low_hp', multiplier: 1.5 },

    // Type boost abilities
    'adaptability': { trigger: 'stab_boost', multiplier: 2.0 },
    'technician': { trigger: 'technician', powerThreshold: 60, multiplier: 1.5 },
    'huge power': { trigger: 'stat_override', stat: 'attack', multiplier: 2 },
    'pure power': { trigger: 'stat_override', stat: 'attack', multiplier: 2 },

    // Defensive abilities
    'thick fat': { trigger: 'type_resist', types: ['fire', 'ice'], multiplier: 0.5 },
    'levitate': { trigger: 'type_immune', types: ['ground'] },
    'water absorb': { trigger: 'type_immune', types: ['water'], healOnImmune: 0.25 },
    'volt absorb': { trigger: 'type_immune', types: ['electric'], healOnImmune: 0.25 },
    'lightning rod': { trigger: 'type_immune', types: ['electric'], spAtkBoostOnImmune: 1 },
    'motor drive': { trigger: 'type_immune', types: ['electric'], speedBoostOnImmune: 1 },
    'sap sipper': { trigger: 'type_immune', types: ['grass'], attackBoostOnImmune: 1 },
    'bulletproof': { trigger: 'type_immune', types: ['ball', 'bomb'] },
    'soundproof': { trigger: 'type_immune', types: ['sound'] },

    // Speed abilities
    'speed boost': { trigger: 'end_of_turn', effect: 'stat_boost', stat: 'speed', stages: 1 },

    // Healing abilities
    'rain dish': { trigger: 'end_of_turn', condition: 'rain', effect: 'heal', healPercent: 1/16 },
    'ice body': { trigger: 'end_of_turn', condition: 'hail', effect: 'heal', healPercent: 1/16 },
    'poison heal': { trigger: 'status', status: STATUS.POISON, effect: 'heal_instead', healPercent: 1/8 },
    'magic guard': { trigger: 'passive_damage_immune', immune: ['burn_damage', 'poison_damage', 'weather_damage'] },

    // Status immunity abilities
    'water veil': { trigger: 'status_immune', statuses: [STATUS.BURN] },
    'limber': { trigger: 'status_immune', statuses: [STATUS.PARALYSIS] },
    'immunity': { trigger: 'status_immune', statuses: [STATUS.POISON, STATUS.TOXIC] },
    'magma armor': { trigger: 'status_immune', statuses: [STATUS.FREEZE] },
    'insomnia': { trigger: 'status_immune', statuses: [STATUS.SLEEP] },
    'vital spirit': { trigger: 'status_immune', statuses: [STATUS.SLEEP] },
    'leaf guard': { trigger: 'status_immune', statuses: [STATUS.BURN, STATUS.POISON, STATUS.PARALYSIS, STATUS.SLEEP, STATUS.FREEZE] },
    'own tempo': { trigger: 'status_immune', statuses: ['confusion'] },
    'oblivious': { trigger: 'status_immune', statuses: ['attract'] },

    // Status chance boost abilities
    'serene grace': { trigger: 'status_chance_boost', multiplier: 2 },
    'shell armor': { trigger: 'crit_immune' },
    'battle armor': { trigger: 'crit_immune' },

    // Sturdy
    'sturdy': { trigger: 'ohko_immune' },

    // Multi-strike abilities
    'skill link': { trigger: 'multi_strike', always_max: true },
    'parental bond': { trigger: 'parental_bond', hits: 2 },

    // Priority abilities
    'prankster': { trigger: 'priority_boost', category: 'status', priority: 1 },
    'gale wings': { trigger: 'priority_boost', type: 'flying', priority: 1, condition: 'full_hp' },
    'triage': { trigger: 'heal_priority', priority: 3 },

    // Accuracy abilities
    'compound eyes': { trigger: 'accuracy_boost', multiplier: 1.3 },
    'hustle': { trigger: 'accuracy_hustle', attackMult: 1.5, accuracyMult: 0.8 },
    'no guard': { trigger: 'no_guard', alwaysHits: true },

    // Weather damage immunity
    'overcoat': { trigger: 'weather_immune' },
    'flower veil': { trigger: 'weather_immune' },
};

// --- HELPER: Get move effect ---
export function getMoveEffect(move) {
    if (!move) return null;
    if (move.id && MOVE_EFFECTS[move.id]) return MOVE_EFFECTS[move.id];
    const name = (move.name || '').toLowerCase().trim();
    return MOVE_EFFECTS_BY_NAME[name] || null;
}

// --- CHECK IF POKEMON CAN ACT ---
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

    return { canAct: true, message: '' };
}

// --- PROCESS END OF TURN (Status Damage) ---
export function processEndOfTurn(pokemon) {
    if (!pokemon || pokemon.fainted) return [];
    const messages = [];
    const status = pokemon.statusEffect;
    if (!status) return messages;

    const info = STATUS_INFO[status];
    if (!info) return messages;

    // Burn damage
    if (status === STATUS.BURN) {
        const dmg = Math.max(1, Math.floor(pokemon.stats.hp * info.damagePercent));
        pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
        if (pokemon.currentHp <= 0) pokemon.fainted = true;
        messages.push(`${pokemon.name} é ferido pela queimadura! (-${dmg} HP)`);
    }

    // Poison damage
    if (status === STATUS.POISON) {
        const dmg = Math.max(1, Math.floor(pokemon.stats.hp * info.damagePercent));
        pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
        if (pokemon.currentHp <= 0) pokemon.fainted = true;
        messages.push(`${pokemon.name} é ferido pelo veneno! (-${dmg} HP)`);
    }

    // Toxic damage (increases each turn)
    if (status === STATUS.TOXIC) {
        if (!pokemon._toxicCounter) pokemon._toxicCounter = 1;
        const dmg = Math.max(1, Math.floor(pokemon.stats.hp * (1/16) * pokemon._toxicCounter));
        pokemon._toxicCounter++;
        pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
        if (pokemon.currentHp <= 0) pokemon.fainted = true;
        messages.push(`${pokemon.name} é ferido pelo toxic! (-${dmg} HP)`);
    }

    return messages;
}

// --- APPLY MOVE SECONDARY EFFECT ---
export function applySecondaryEffect(attacker, defender, move, effectiveness) {
    const effect = getMoveEffect(move);
    if (!effect) return [];

    const messages = [];
    const name = (move.name || '').toLowerCase();

    // Protect
    if (effect.effect === 'protect') {
        attacker._protected = true;
        messages.push(`${attacker.name} se protegeu!`);
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
        const chance = effect.chance || 100;
        if (Math.random() * 100 < chance) {
            defender._statStages[effect.stat] = Math.max(-6, (defender._statStages[effect.stat] || 0) - effect.stages);
            messages.push(`${getStatDropMsg(defender.name, effect.stat, effect.stages)}`);
        }
        return messages;
    }

    // Status condition
    if (effect.effect === 'status') {
        const chance = effect.chance || 100;
        if (Math.random() * 100 < chance) {
            if (!defender.statusEffect) {
                // Check if defender is immune to this status
                if (defender.currentAbility) {
                    const abilityName = getAbilityName(defender.currentAbility);
                    const abilityEffect = ABILITY_EFFECTS[abilityName];
                    if (abilityEffect && abilityEffect.trigger === 'status_immune') {
                        if (abilityEffect.statuses.includes(effect.status)) {
                            messages.push(`${defender.name} é imune ao status por ${abilityName}!`);
                            return messages;
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

    // Recoil
    if (effect.effect === 'recoil') {
        // Handled in damage application
        return messages;
    }

    // Drain
    if (effect.effect === 'drain') {
        // Handled in damage application
        return messages;
    }

    // Flinch
    if (effect.effect === 'flinch') {
        const chance = effect.chance || 100;
        if (Math.random() * 100 < chance) {
            defender._flinched = true;
        }
        return messages;
    }

    // Multi-hit
    if (effect.effect === 'multi_hit') {
        // Handled in damage application
        return messages;
    }

    // Heal
    if (effect.effect === 'heal') {
        const healAmount = Math.floor(pokemon.stats.hp * effect.healPercent);
        pokemon.currentHp = Math.min(pokemon.stats.hp, pokemon.currentHp + healAmount);
        messages.push(`${pokemon.name} recuperou ${healAmount} HP!`);
        return messages;
    }

    // Rest
    if (effect.effect === 'rest') {
        pokemon.currentHp = pokemon.stats.hp;
        pokemon.statusEffect = STATUS.SLEEP;
        pokemon._sleepTurns = 0;
        messages.push(`${pokemon.name} dormiu e recuperou todo o HP!`);
        return messages;
    }

    return messages;
}

// --- APPLY PROTECT CHECK ---
export function isProtected(defender) {
    return defender._protected === true;
}

// --- CLEAR PROTECT (call at start of turn) ---
export function clearProtect(pokemon) {
    pokemon._protected = false;
}

// --- APPLY STAT STAGES TO DAMAGE CALC ---
export function applyStatStages(attacker, defender, move, baseDamage) {
    const aStages = attacker._statStages || {};
    const dStages = defender._statStages || {};

    let atkMult = 1;
    let defMult = 1;

    if (move.category === 'physical') {
        atkMult = getStatMult(aStages.attack || 0);
        defMult = getStatMult(dStages.defense || 0);
        if (attacker.statusEffect === STATUS.BURN) atkMult *= 0.5;
    } else if (move.category === 'special') {
        atkMult = getStatMult(aStages.spAtk || 0);
        defMult = getStatMult(dStages.spDef || 0);
    }

    return Math.max(1, Math.floor(baseDamage * atkMult / defMult));
}

// --- APPLY STATUS DAMAGE MODIFIERS ---
export function getStatusDamageModifier(attacker, defender) {
    let modifier = 1;
    if (attacker.statusEffect === STATUS.BURN && attacker._statStages) {
        // Burn reduces physical attack by 50%
    }
    return modifier;
}

// --- APPLY ABILITY ON CONTACT ---
export function processContactAbilities(defender, attacker) {
    if (!defender || !defender.currentAbility) return [];
    const abilityName = getAbilityName(defender.currentAbility);
    const abilityEffect = ABILITY_EFFECTS[abilityName];
    if (!abilityEffect || abilityEffect.trigger !== 'contacted') return [];

    const messages = [];
    if (Math.random() * 100 < (abilityEffect.chance || 0)) {
        if (abilityEffect.effect === 'status') {
            if (!attacker.statusEffect) {
                attacker.statusEffect = abilityEffect.status;
                const statusInfo = STATUS_INFO[abilityEffect.status];
                messages.push(`${abilityName} de ${defender.name} causou ${statusInfo ? statusInfo.name.toLowerCase() : abilityEffect.status} em ${attacker.name}!`);
            }
        } else if (abilityEffect.effect === 'damage') {
            const dmg = Math.max(1, Math.floor(attacker.stats.hp * abilityEffect.damage));
            attacker.currentHp = Math.max(0, attacker.currentHp - dmg);
            if (attacker.currentHp <= 0) attacker.fainted = true;
            messages.push(`${abilityName} de ${defender.name} causou ${dmg} de dano a ${attacker.name}!`);
        }
    }
    return messages;
}

// --- GET ABILITY NAME FROM ID ---
function getAbilityName(abilityId) {
    if (typeof abilityId === 'string') return abilityId.toLowerCase();
    // Try to find by ID from ABILITY_EFFECTS
    for (const [name, effect] of Object.entries(ABILITY_EFFECTS)) {
        if (effect._id === abilityId) return name;
    }
    return '';
}

// --- STAT BOOST/DROP MESSAGES ---
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

// --- RESET TURN STATE (call at start of each turn) ---
export function resetTurnState(pokemon) {
    if (!pokemon) return;
    pokemon._flinched = false;
    pokemon._protected = false;
    pokemon._charging = false;
}
