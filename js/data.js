export const TYPE_EFFECTIVENESS = {
    normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
    fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
    dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

export const TYPE_COLORS = {
    normal: '#686868', fire: '#f08030', water: '#6890f0', grass: '#78c850',
    electric: '#f8d030', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
    ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
    rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
    steel: '#b8b8d0', fairy: '#ee99ac'
};

export const POKEMON_DATA = {
    emberpup: {
        id: 1, name: 'Emberpup', types: ['fire'],
        baseStats: { hp: 44, attack: 48, defense: 43, spAtk: 60, spDef: 50, speed: 65 },
        moves: ['tackle', 'ember', 'bite', 'flamethrower'],
        color: '#f08030', evolvesTo: 'blazehound'
    },
    blazehound: {
        id: 2, name: 'Blazehound', types: ['fire'],
        baseStats: { hp: 59, attack: 64, defense: 58, spAtk: 80, spDef: 65, speed: 80 },
        moves: ['tackle', 'ember', 'flamethrower', 'fire-fang'],
        color: '#d04020', evolvesTo: null
    },
    aquafin: {
        id: 3, name: 'Aquafin', types: ['water'],
        baseStats: { hp: 50, attack: 48, defense: 50, spAtk: 60, spDef: 55, speed: 43 },
        moves: ['tackle', 'water-gun', 'bite', 'surf'],
        color: '#6890f0', evolvesTo: 'tidalorca'
    },
    tidalorca: {
        id: 4, name: 'Tidalorca', types: ['water'],
        baseStats: { hp: 70, attack: 68, defense: 65, spAtk: 80, spDef: 70, speed: 58 },
        moves: ['water-gun', 'surf', 'ice-beam', 'hydro-pump'],
        color: '#3858a0', evolvesTo: null
    },
    leafling: {
        id: 5, name: 'Leafling', types: ['grass'],
        baseStats: { hp: 45, attack: 49, defense: 49, spAtk: 65, spDef: 65, speed: 45 },
        moves: ['tackle', 'vine-whip', 'razor-leaf', 'solar-beam'],
        color: '#78c850', evolvesTo: 'forestking'
    },
    forestking: {
        id: 6, name: 'Forestking', types: ['grass'],
        baseStats: { hp: 60, attack: 62, defense: 63, spAtk: 80, spDef: 80, speed: 60 },
        moves: ['vine-whip', 'razor-leaf', 'solar-beam', 'leaf-storm'],
        color: '#408020', evolvesTo: null
    },
    sparkitty: {
        id: 7, name: 'Sparkitty', types: ['electric'],
        baseStats: { hp: 40, attack: 45, defense: 40, spAtk: 65, spDef: 45, speed: 70 },
        moves: ['tackle', 'thunder-shock', 'quick-attack', 'thunder'],
        color: '#f8d030', evolvesTo: 'voltiger'
    },
    voltiger: {
        id: 8, name: 'Voltiger', types: ['electric'],
        baseStats: { hp: 60, attack: 65, defense: 55, spAtk: 85, spDef: 60, speed: 95 },
        moves: ['thunder-shock', 'quick-attack', 'thunder', 'thunderbolt'],
        color: '#c8a000', evolvesTo: null
    },
    froslug: {
        id: 9, name: 'Froslug', types: ['ice'],
        baseStats: { hp: 55, attack: 50, defense: 50, spAtk: 65, spDef: 60, speed: 40 },
        moves: ['tackle', 'ice-shard', 'ice-beam', 'blizzard'],
        color: '#98d8d8', evolvesTo: 'glaciern'
    },
    glaciern: {
        id: 10, name: 'Glaciern', types: ['ice', 'dragon'],
        baseStats: { hp: 75, attack: 70, defense: 65, spAtk: 90, spDef: 75, speed: 55 },
        moves: ['ice-shard', 'ice-beam', 'blizzard', 'dragon-pulse'],
        color: '#5090a0', evolvesTo: null
    }
};

export const MOVES = {
    tackle:      { name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 },
    ember:       { name: 'Ember', type: 'fire', category: 'special', power: 40, accuracy: 100, pp: 25 },
    bite:        { name: 'Bite', type: 'dark', category: 'physical', power: 60, accuracy: 100, pp: 25 },
    flamethrower:{ name: 'Flamethrower', type: 'fire', category: 'special', power: 90, accuracy: 100, pp: 15 },
    'fire-fang': { name: 'Fire Fang', type: 'fire', category: 'physical', power: 65, accuracy: 95, pp: 15 },
    'water-gun': { name: 'Water Gun', type: 'water', category: 'special', power: 40, accuracy: 100, pp: 25 },
    surf:        { name: 'Surf', type: 'water', category: 'special', power: 90, accuracy: 100, pp: 15 },
    'hydro-pump':{ name: 'Hydro Pump', type: 'water', category: 'special', power: 110, accuracy: 80, pp: 5 },
    'ice-beam':  { name: 'Ice Beam', type: 'ice', category: 'special', power: 90, accuracy: 100, pp: 10 },
    blizzard:    { name: 'Blizzard', type: 'ice', category: 'special', power: 110, accuracy: 70, pp: 5 },
    'vine-whip': { name: 'Vine Whip', type: 'grass', category: 'physical', power: 45, accuracy: 100, pp: 25 },
    'razor-leaf':{ name: 'Razor Leaf', type: 'grass', category: 'physical', power: 55, accuracy: 95, pp: 25 },
    'solar-beam':{ name: 'Solar Beam', type: 'grass', category: 'special', power: 120, accuracy: 100, pp: 10 },
    'leaf-storm':{ name: 'Leaf Storm', type: 'grass', category: 'special', power: 130, accuracy: 90, pp: 5 },
    'thunder-shock':{ name: 'Thunder Shock', type: 'electric', category: 'special', power: 40, accuracy: 100, pp: 30 },
    'quick-attack':{ name: 'Quick Attack', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 30 },
    thunder:     { name: 'Thunder', type: 'electric', category: 'special', power: 110, accuracy: 70, pp: 10 },
    thunderbolt: { name: 'Thunderbolt', type: 'electric', category: 'special', power: 90, accuracy: 100, pp: 15 },
    'ice-shard': { name: 'Ice Shard', type: 'ice', category: 'physical', power: 40, accuracy: 100, pp: 30 },
    'dragon-pulse':{ name: 'Dragon Pulse', type: 'dragon', category: 'special', power: 85, accuracy: 100, pp: 10 }
};

export const STARTER_OPTIONS = ['emberpup', 'aquafin', 'leafling'];
