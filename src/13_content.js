// =====================================================================
//  CONTENT — creatures, model assignments, map themes, campaign story
// =====================================================================

// ---------------- extra units: wildlife, hostile camps, healer ----------------
// flags: flee (runs when hurt) · aggressive (fights back) · hostile:r (attacks anyone near its home)
//        livestock (calm, easy food) · boss · bounty (gold for the killer)
const W0 = { cls: 'animal', atk: 0, atkType: 'melee', marm: 0, parm: 0, range: 0.35, reload: 2, los: 4, cost: {}, time: 0, age: 9 };
const wild = (name, o) => Object.assign({ name }, W0, o);
Object.assign(UNITS, {
  sheep: wild('Sheep', { hp: 8, speed: 0.7, radius: 0.32, food: 100, livestock: true, desc: 'Village livestock. Calm and easy food.' }),
  horse: wild('Wild Horse', { hp: 20, speed: 2.4, radius: 0.42, food: 150, flee: true, desc: 'Fast and skittish. Hard to catch.' }),
  rabbit: wild('Rabbit', { hp: 3, speed: 2.0, radius: 0.18, food: 35, flee: true, desc: 'Small game.' }),
  fox: wild('Fox', { hp: 6, speed: 2.2, radius: 0.24, food: 50, flee: true, desc: 'Small, quick game.' }),
  wolf: wild('Wolf', { hp: 30, atk: 4, reload: 1.5, speed: 2.2, radius: 0.3, food: 60, hostile: 4.5, aggressive: true, desc: 'Pack predator. Attacks anyone who comes close.' }),
  bear: wild('Bear', { hp: 80, atk: 8, marm: 1, speed: 1.8, radius: 0.45, food: 250, aggressive: true, hostile: 2.5, desc: 'Powerful. Defends its territory. Lots of meat.' }),
  moose: wild('Moose', { hp: 22, speed: 1.8, radius: 0.48, food: 200, flee: true, desc: 'Large game. Flees when hunted.' }),
  antelope: wild('Antelope', { hp: 10, speed: 2.4, radius: 0.36, food: 120, flee: true, desc: 'Swift game.' }),
  buffalo: wild('Buffalo', { hp: 70, atk: 6, marm: 1, speed: 1.6, radius: 0.48, food: 250, aggressive: true, desc: 'Charges when attacked. Lots of meat.' }),
  duck: wild('Duck', { hp: 3, speed: 1.0, radius: 0.18, food: 30, flee: true, desc: 'Pond bird.' }),
  crab: wild('Crab', { hp: 4, speed: 0.9, radius: 0.18, food: 30, flee: true, desc: 'Beach critter.' }),
  seal: wild('Seal', { hp: 12, speed: 0.8, radius: 0.32, food: 90, flee: true, desc: 'Lazes on the shore.' }),
  turtle: wild('Sea Turtle', { hp: 10, speed: 0.5, radius: 0.28, food: 70, flee: true, desc: 'Slow beach game.' }),
  raptor: wild('Raptor', { hp: 45, atk: 6, reload: 1.3, speed: 2.6, radius: 0.32, food: 120, hostile: 5.5, aggressive: true, desc: 'Fast pack hunter. Attacks on sight.' }),
  trex: wild('The Tyrant', { hp: 450, atk: 22, marm: 3, parm: 3, reload: 2.2, speed: 2.0, radius: 0.9, food: 900, hostile: 6, aggressive: true, boss: true, bounty: 200, desc: 'Ancient apex beast awakened by the crystals. Guards a crystal hoard.' }),
  triceratops: wild('Triceratops', { hp: 180, atk: 12, marm: 2, parm: 2, speed: 1.6, radius: 0.7, food: 450, aggressive: true, desc: 'Peaceful until provoked. Huge amount of meat.' }),
  stegosaurus: wild('Stegosaurus', { hp: 150, atk: 10, marm: 2, parm: 1, speed: 1.3, radius: 0.7, food: 400, aggressive: true, desc: 'Spiked tail. Fights back.' }),
  parasaurolophus: wild('Parasaurolophus', { hp: 60, speed: 2.0, radius: 0.6, food: 300, flee: true, desc: 'Gentle giant. Flees when hunted.' }),
  apatosaurus: wild('Apatosaurus', { hp: 300, speed: 0.8, radius: 1.0, food: 700, livestock: true, desc: 'Colossal and calm. A feast for a whole village.' }),
  rhino: wild('Rhino', { hp: 90, atk: 9, marm: 2, speed: 1.7, radius: 0.5, food: 250, aggressive: true, desc: 'Charges when attacked.' }),
  elephant: wild('Elephant', { hp: 160, atk: 12, marm: 1, speed: 1.3, radius: 0.75, food: 450, aggressive: true, desc: 'Mighty beast. Fights back.' }),
  lizard: wild('Lizard', { hp: 2, speed: 1.6, radius: 0.12, food: 10, flee: true, desc: 'Critter.' }),
  snake: wild('Snake', { hp: 3, speed: 1.0, radius: 0.14, food: 10, flee: true, desc: 'Critter.' }),
  spider: wild('Giant Spider', { hp: 4, speed: 1.4, radius: 0.14, food: 10, flee: true, desc: 'Critter.' }),
  frog: wild('Frog', { hp: 2, speed: 1.2, radius: 0.12, food: 10, flee: true, desc: 'Marsh critter.' }),
  pirate: wild('Corsair', { cls: 'creep', hp: 60, atk: 6, marm: 1, parm: 1, reload: 1.8, speed: 1.8, radius: 0.28, food: 0, hostile: 4.5, aggressive: true, bounty: 25, desc: 'Pirate raider guarding stolen treasure.' }),
  pirate_captain: wild('Captain Redbeard', { cls: 'creep', hp: 180, atk: 12, marm: 2, parm: 2, reload: 1.8, speed: 1.8, radius: 0.32, food: 0, hostile: 5, aggressive: true, boss: true, bounty: 120, desc: 'Pirate lord of the Corsair Coast.' }),
  skeleton: wild('Risen Skeleton', { cls: 'creep', hp: 45, atk: 5, marm: 0, parm: 3, reload: 1.6, speed: 1.6, radius: 0.28, food: 0, hostile: 4.5, aggressive: true, bounty: 15, desc: 'The dead of the Hollow Marsh. Arrows barely hurt them.' }),
  skeleton_warrior: wild('Grave Knight', { cls: 'creep', hp: 90, atk: 9, marm: 2, parm: 4, reload: 1.8, speed: 1.6, radius: 0.3, food: 0, hostile: 5, aggressive: true, boss: true, bounty: 60, desc: 'Ancient knight bound to the crypt.' }),
  healer: { name: 'Herbalist', cls: 'support', hp: 35, atk: 0, atkType: 'melee', marm: 0, parm: 1, range: 0, reload: 9, speed: 1.75, los: 7, radius: 0.27, cost: { food: 60, gold: 50 }, time: 25, age: 1, heal: 3.5, healRange: 4.5,
    desc: 'Heals nearby wounded units. Does not fight.' },
});
for (const t in UNITS) if ((UNITS[t].cls === 'animal' || UNITS[t].cls === 'creep') && !ANIMALS.includes(t)) ANIMALS.push(t);
BUILDINGS.towncenter.trains = ['villager', 'scout', 'healer'];
const isCreep = u => !!u && UNITS[u.type] && UNITS[u.type].cls === 'creep';

// ---------------- which baked model each unit uses ----------------
const CHAR_FOR = {
  villager: ['man', 'w_worker'],
  swordsman: ['king'], spearman: ['w_soldier'], archer: ['w_hooded'], crossbow: ['w_adventurer'], healer: ['w_witch'],
  scout: ['horse_q'], knight: ['horse_white'], warden: ['king'], ironbreaker: ['w_soldier'], sharpshooter: ['w_adventurer'], lancer: ['horse_white'], horsearcher: ['horse_q'], ram: ['siege_cannon'], catapult: ['catapult_m'],
  deer: ['deer'], stag: ['stag'], bull: ['bull'], cow: ['cow', 'cow2'], goat: ['goat'], turkey: ['turkey'], hen: ['hen', 'rooster', 'a_chicken'],
  sheep: ['a_sheep'], horse: ['a_horse'], rabbit: ['a_rabbit'], fox: ['a_fox'], wolf: ['a_wolf', 'a_coyote'], bear: ['a_bear'], moose: ['a_moose_antlers'],
  antelope: ['a_antelope'], buffalo: ['a_buffalo_sunrise'], duck: ['a_duck'], crab: ['a_crab'], seal: ['a_seal'], turtle: ['a_turtle'],
  raptor: ['d_velociraptor'], trex: ['d_t_rex'], triceratops: ['d_triceratops'], stegosaurus: ['d_stegosaurus'], parasaurolophus: ['d_parasaurolophus'], apatosaurus: ['d_apatosaurus'],
  rhino: ['a_rhino'], elephant: ['a_elephant'], lizard: ['a_lizard'], snake: ['a_snake'], spider: ['a_spider'], frog: ['a_frog'],
  pirate: ['pr_henry', 'pr_anne', 'pr_mako', 'pr_sharky'], pirate_captain: ['pr_pirate_captain'], skeleton: ['pr_skeleton'], skeleton_warrior: ['pr_skeleton_2'],
};
// the Crimson March uses its own look for these units
const CHAR_FOE = { villager: ['w_punk', 'w_suit'], swordsman: ['c_rider'], spearman: ['w_sci_fi_character'] };
// every realm has its own colour wash, house style, barracks style and people
const REALM_LOOK = {
  azure: { tint: [0.9, 0.97, 1.1], glb: { house: { all: 'house_1' }, barracks: { all: 'barracks' } } },
  crimson: { tint: [1.13, 0.87, 0.8], glb: { house: { all: 'house_2' }, barracks: { all: 'f_barracks' } } },
  wind: { tint: [1.08, 1.0, 0.8], glb: { house: { all: { parts: [['tent', -0.3, -0.2, 0.5, 0.95], ['tent_half', 0.5, 0.45, -0.6, 0.7], ['campfire', 0.55, -0.5, 0, 0.7]] } }, barracks: { all: 'f_barracks' } } },
  stone: { tint: [0.82, 0.86, 0.93], glb: { house: { all: 'house_3' }, barracks: { all: 'barracks' }, tower: { all: { parts: [['castle_tower', 0, 0, 0, 0.62]] } } } },
  amber: { tint: [1.12, 1.0, 0.74], glb: { house: { all: ['house_2', 'house_1'] }, barracks: { 0: 'f_barracks', 1: 'f_barracks', 2: 'barracks' } } },
};
const REALM_CHARS = {
  crimson: CHAR_FOE,
  wind: { villager: ['w_worker'], swordsman: ['w_adventurer'], spearman: ['w_hooded'] },
  stone: { villager: ['man'], swordsman: ['w_soldier'], spearman: ['w_sci_fi_character'] },
  amber: { villager: ['w_suit', 'w_worker'], swordsman: ['king'], spearman: ['w_adventurer'] },
};
// some downloaded models face sideways; yaw correction applied when drawing
const MODEL_YAW = {};
// per-model display scale (horses are modelled larger than the riders)
const MODEL_SCALE = { horse_q: 0.82, horse_white: 0.85 };
// mounted units: horse model + rider model in the saddle
const RIDER = { lancer: { model: 'w_soldier', y: 0.19, z: 0.0, s: 0.95 }, horsearcher: { model: 'w_hooded', y: 0.17, z: 0.0, s: 0.95 }, scout: { model: 'c_rider', y: 0.17, z: 0.0, s: 0.95 }, knight: { model: 'king', y: 0.19, z: 0.0, s: 0.95 } };
// building models by age (array = random variant per building)
const BUILDING_GLB = {
  towncenter: { 0: 'inn', 1: 'inn', 2: 'fortress' }, house: { all: ['house_1', 'house_2', 'house_3'] }, lumbercamp: { all: 'sawmill' }, mill: { all: 'mill_m' },
  blacksmith: { all: 'smithy' }, barracks: { 0: 'f_barracks', 1: 'f_barracks', 2: 'barracks' }, stable: { all: 'f_stable' }, range: { all: 'archery_range' },
  tower: { all: 'archery_towers' }, castle: { all: 'castle' }, wonder: { all: 'castle_fortress' },
  wall: { all: { parts: [['wall_tower', 0, 0, 0, 1]], bare: true } }, gate: { all: { parts: [['castle_gate', 0, 0, 0, 1]], bare: true } },
  farm: { all: { parts: [['farm_dirt', 0, 0, 0, 1], ['crops', 0, 0, 0, 1]], bare: true, lift: 0.02 } },
  belltower: { all: 'bell_tower' }, warhall: { all: 'wooden_fortress' }, yurt: { all: 'tent' }, clanhall: { all: 'town_hall_2' },
  tradepost: { all: { parts: [['market_1', -0.1, -0.1, 0, 1], ['m_crate', 0.66, 0.62, 0.4, 1], ['m_barrel', -0.7, 0.66, 0, 1], ['gold_bag', 0.1, 0.72, 0, 1]] } },
  miningcamp: { all: { parts: [['open_barn', 0, -0.1, 0, 1], ['minecart', 0.55, 0.62, 0.6, 1], ['rock_m1', -0.58, 0.6, 0, 0.55]] } },
};

// ---------------- map themes ----------------
const rng5 = p => [1, 2, 3, 4, 5].map(i => p + i);
const MAP_THEMES = {
  vale: {
    name: 'Green Vale', pack: null, desc: 'Rolling meadows, birch groves and clear lakes.',
    water: 0.07, sand: 0.04, hills: 0.13, hillAmp: 26, forest: 0.27, dirt: 0.1,
    trees: [...rng5('tree_'), ...rng5('birch_'), ...rng5('maple_'), ...rng5('utree_')], edgeTrees: [...rng5('pine_'), ...rng5('tree_')],
    tuft: ['grass', 'grass_wispy', 'grass_wispy_2', 'ugrass_1', 'ugrass_2', 'clover', 'clover_2', 'tall_grass'],
    flower: ['flower_group', 'flower_group_2', 'flower_single', 'flower_single_2', 'flower_petal', 'uflowers_1', 'uflowers_2', 'uflowers_3', 'uflowers_4', 'uflowers_5'],
    shrub: ['bush', 'bush_flowers', 'bushes_1', 'bushes_2', 'bushes_3', 'flower_bush_1', 'flower_bush_2', 'fern', 'plant', 'plant_big', 'mushroom', 'mushroom_l'],
    pebble: ['pebble_1', 'pebble_2', 'pebble_3', 'rock_m1'],
    gold: ['gold_ore'], stone: ['resource_stone', 'rock_1', 'rock_2', 'rock_3'],
    hunt: ['deer', 'deer', 'stag', 'rabbit', 'fox', 'turkey', 'goat', 'moose', 'horse'], big: ['bull', 'bear', 'buffalo'], livestock: ['cow', 'sheep', 'hen', 'hen'],
    camp: 'wolves', props: ['pond', 'pond', 'nature', 'castle_tower', 'waterfall'],
    palette: { grass: 0x66a03c, meadow: 0x95bb4e, deep: 0x4f8a34, forest: 0x3f6a28, dirt: 0x9c7a4c, sand: 0xdccb92, rock: 0x8c8a72 }, sky: 0xbcd6e8, sun: 0xffe9c4,
  },
  highlands: {
    name: 'Iron Highlands', pack: null, desc: 'Steep hills, pine forests and old ruins.',
    water: 0.05, sand: 0.02, hills: 0.3, hillAmp: 40, forest: 0.3, dirt: 0.12,
    trees: [...rng5('pine_'), ...rng5('birch_'), ...rng5('tree_')], edgeTrees: rng5('pine_'),
    tuft: ['grass', 'grass_wispy', 'grass_wispy_2', 'tall_grass', 'ugrass_1'], flower: ['flower_single', 'flower_single_2', 'flower_petal', 'uflowers_6', 'uflowers_7'],
    shrub: ['bush', 'bushes_1', 'bushes_2', 'fern', 'plant', 'mushroom', 'rock_m2'], pebble: ['pebble_1', 'pebble_2', 'pebble_3', 'rock_m1', 'rock_m3'],
    gold: ['gold_ore'], stone: ['resource_stone', 'rock_4', 'rock_5', 'rock_1'],
    hunt: ['deer', 'goat', 'goat', 'moose', 'stag', 'rabbit', 'fox'], big: ['bear', 'bear', 'bull'], livestock: ['sheep', 'sheep', 'cow', 'hen'],
    camp: 'wolves', props: ['castle_tower', 'castle_tower', 'waterfall', 'pond'],
    palette: { grass: 0x5f9440, meadow: 0x8aa850, deep: 0x4a7a36, forest: 0x395f28, dirt: 0x8f7a58, sand: 0xc8b88a, rock: 0x86847a }, sky: 0xc4d4e2, sun: 0xfff0d8,
  },
  coast: {
    name: 'Corsair Coast', pack: 'coast', desc: 'Sunny beaches, palm groves and pirate coves.', coastal: true,
    water: 0.1, sand: 0.1, hills: 0.1, hillAmp: 20, forest: 0.22, dirt: 0.06,
    trees: [...rng5('tree_'), ...rng5('maple_'), ...rng5('utree_')], beachTrees: ['palm_1', 'palm_2', 'palm_3', ...rng5('upalm_')], edgeTrees: [...rng5('upalm_'), 'palm_1', 'palm_2'],
    tuft: ['grass', 'grass_wispy', 'ugrass_1', 'ugrass_2', 'clover'], flower: ['flower_group', 'uflowers_1', 'uflowers_3', 'flower_single'],
    shrub: ['bush', 'bushes_1', 'bush_flowers', 'plant', 'plant_big', 'fern'], pebble: ['pebble_1', 'pebble_2', 'pr_rock'],
    gold: ['gold_ore'], stone: ['pr_rocks', 'pr_rocks_2', 'resource_stone'],
    hunt: ['crab', 'crab', 'seal', 'turtle', 'deer', 'goat', 'turkey', 'rabbit'], big: ['bull'], livestock: ['cow', 'hen', 'hen', 'sheep'],
    camp: 'pirates', props: ['pond', 'nature', 'waterfall'],
    palette: { grass: 0x6fae44, meadow: 0xa3c45a, deep: 0x5a9a3a, forest: 0x46783a, dirt: 0xb08a58, sand: 0xd2b981, rock: 0x9a9480 }, sky: 0xb4dcf0, sun: 0xfff2d0,
  },
  wilds: {
    name: 'Primeval Wilds', pack: 'wilds', desc: 'Twisted jungle, glowing crystals and ancient beasts.',
    water: 0.07, sand: 0.03, hills: 0.18, hillAmp: 30, forest: 0.32, dirt: 0.12,
    trees: [...rng5('twisted_'), ...rng5('maple_'), ...rng5('tree_')], edgeTrees: [...rng5('twisted_'), ...rng5('tree_')],
    tuft: ['tall_grass', 'grass', 'grass_wispy', 'ugrass_2', 'fern'], flower: ['flower_group_2', 'uflowers_4', 'uflowers_5', 'crystal_7', 'crystal_8'],
    shrub: ['plant_big', 'plant', 'fern', 'bushes_2', 'bushes_3', 'mushroom_l', 'crystal_5', 'crystal_6'], pebble: ['pebble_1', 'pebble_3', 'rock_m2'],
    gold: ['crystal_1', 'crystal_2', 'crystal_3', 'crystal_4'], stone: ['rock_1', 'rock_2', 'rock_3', 'resource_stone'],
    hunt: ['parasaurolophus', 'parasaurolophus', 'lizard', 'snake', 'antelope', 'deer'], big: ['triceratops', 'stegosaurus', 'rhino', 'elephant', 'apatosaurus'], livestock: ['cow', 'hen', 'goat'],
    camp: 'raptors', props: ['nature', 'waterfall', 'pond'],
    palette: { grass: 0x5a9a32, meadow: 0x8fb43e, deep: 0x3f7a28, forest: 0x2f5a20, dirt: 0x8a6a40, sand: 0xc8b47a, rock: 0x7f7a66 }, sky: 0xc8dcc0, sun: 0xfff0c0,
  },
  marsh: {
    name: 'Hollow Marsh', pack: 'marsh', desc: 'Fog-bound bogs, dead woods and restless graves.',
    water: 0.13, sand: 0.05, hills: 0.1, hillAmp: 18, forest: 0.24, dirt: 0.22,
    trees: [...rng5('dead_'), ...rng5('udead_'), 'autumn_1', 'autumn_2', 'autumn_3', 'autumn_4', 'autumn_5', 'autumn_6', 'h_dead_tree', 'h_dead_tree_2', 'dead_tree_l'], edgeTrees: ['autumn_1', 'autumn_2', 'autumn_3', 'autumn_4', ...rng5('dead_')],
    tuft: ['tall_grass', 'grass_wispy', 'grass_wispy_2', 'grass'], flower: ['mushroom', 'mushroom_l', 'pumpkin', 'pumpkin_y', 'flower_petal'],
    shrub: ['h_dead_small', 'fern', 'plant', 'bushes_3', 'gravestone', 'grave_marker', 'jacko', 'post_lantern'], pebble: ['pebble_1', 'pebble_2', 'h_rocks', 'ribcage'],
    gold: ['gold_ore'], stone: ['h_rocks', 'rock_2', 'resource_stone'],
    hunt: ['frog', 'frog', 'snake', 'spider', 'deer', 'turkey'], big: ['bear', 'buffalo'], livestock: ['sheep', 'hen', 'cow'],
    camp: 'graveyard', props: ['pond', 'pond', 'castle_tower'],
    palette: { grass: 0x5f7a3c, meadow: 0x7a7f44, deep: 0x4a5f34, forest: 0x3a4a2a, dirt: 0x6f5a40, sand: 0x9a8a6a, rock: 0x6f6a5f }, sky: 0x9aa4ae, sun: 0xe8d8c0, dark: true,
  },
};
const MAP_SIZES = { small: { n: 96, name: 'Small' }, normal: { n: 128, name: 'Normal' }, large: { n: 160, name: 'Large' }, huge: { n: 200, name: 'Huge' } };

// ---------------- campaign: "The Shattering of Ironvale" ----------------
const CAMPAIGN = [
  { id: 1, title: 'The Green Vale', theme: 'vale', size: 'normal', diff: 'easy', seed: 11071,
    intro: ['Three winters ago the sky split over Ironvale. Shards of living crystal rained across the land, and where they fell, old things began to stir.',
      'You are the Steward of the Azure Kingdom, sent with a handful of settlers to the Green Vale. But Warlord Varn of the Crimson March has already raised his banners on the far side of the valley.',
      'Build your village, keep your people fed, and drive the Crimson March from the vale.'],
    objectives: [{ id: 'feudal', text: 'Advance to the Feudal Age' }, { id: 'win', text: 'Destroy the Crimson March' }, { id: 'treasure', text: 'Recover a treasure from the wolf dens', optional: true }],
    beats: [{ at: 20, text: 'Steward: "Gather berries and hunt the deer — winter waits for no one."' }, { at: 240, text: 'Scout: "Wolves prowl the dens beyond the woods. They guard something shiny..."' }, { event: 'feudal', text: 'Steward: "Our walls rise! Now train soldiers — Varn will come."' }, { event: 'attacked', text: 'Captain: "The Crimson March is upon us! To arms!"' }],
    outro: 'Varn retreats to the coast, but a darker tide is rising. The Crimson March has made a pact with the corsairs of the south...' },
  { id: 2, title: 'Corsair Coast', theme: 'coast', size: 'normal', diff: 'standard', seed: 22093,
    intro: ['Varn fled south to the Corsair Coast, where Captain Redbeard and his pirates hoard crystal-gold looted from shipwrecks.',
      'Pirate coves dot the beaches. Their treasure could fund an army — if you can take it from them.',
      'Seize the coves, claim the treasure, and crush the Crimson March before it buys the pirates\' loyalty.'],
    objectives: [{ id: 'treasure2', text: 'Recover 2 pirate treasures' }, { id: 'win', text: 'Destroy the Crimson March' }, { id: 'captain', text: 'Defeat Captain Redbeard', optional: true }],
    beats: [{ at: 30, text: 'Scout: "Pirate camps line the shore. Bring soldiers — corsairs fight dirty."' }, { event: 'boss', text: 'Steward: "Redbeard has fallen! The coast breathes free."' }, { event: 'attacked', text: 'Captain: "Crimson banners on the beach! Defend the town!"' }],
    outro: 'Among Redbeard\'s charts you find a map inland — to the Primeval Wilds, where the largest crystal fell. Varn marches there to claim its power.' },
  { id: 3, title: 'Primeval Wilds', theme: 'wilds', size: 'large', diff: 'standard', seed: 33187,
    intro: ['The great crystal fell deep in the Wilds. Its glow has awakened beasts from a forgotten age: thunder-lizards that shake the earth.',
      'Crystal veins here are worth more than gold. But raptors hunt in packs, and a Tyrant guards the richest hoard.',
      'Harvest the crystals, survive the beasts, and stop Varn from claiming the heart of the Wilds.'],
    objectives: [{ id: 'gold1500', text: 'Gather 1500 crystal-gold' }, { id: 'win', text: 'Destroy the Crimson March' }, { id: 'tyrant', text: 'Slay the Tyrant', optional: true }],
    beats: [{ at: 25, text: 'Scout: "Something enormous walks beyond the ridge... keep villagers close to home."' }, { event: 'boss', text: 'Steward: "The Tyrant is slain! Its hoard of crystals is ours."' }, { event: 'attacked', text: 'Captain: "Varn\'s war-band strikes! Hold the line!"' }],
    outro: 'Broken, Varn flees into the Hollow Marsh — and in desperation, he wakes the dead.' },
  { id: 4, title: 'Hollow Marsh', theme: 'marsh', size: 'large', diff: 'hard', seed: 44211,
    intro: ['The Hollow Marsh is where Ironvale buries its kings. Varn has broken the crypts and bound the dead to his cause.',
      'Skeletons guard the graveyards; their treasure is the gold of forgotten crowns.',
      'End this war. Destroy the Crimson March — or raise a Wonder so great that Ironvale will never forget who saved it.'],
    objectives: [{ id: 'iron', text: 'Advance to the Iron Age' }, { id: 'winOrWonder', text: 'Destroy the Crimson March or win with a Wonder' }, { id: 'graves', text: 'Cleanse 2 graveyards', optional: true }],
    beats: [{ at: 30, text: 'Herbalist: "The air reeks of the grave. Train herbalists — your soldiers will need them."' }, { event: 'iron', text: 'Steward: "Iron and stone! Now we can end this."' }, { event: 'attacked', text: 'Captain: "The Crimson March attacks — the dead march with them!"' }],
    outro: 'Varn\'s banner falls into the black water. The crystals dim, the dead rest again, and Ironvale is whole. Long live the Steward.' },
];
CAMPAIGN.forEach((c, i) => { c.camp = 'shatter'; c.num = i + 1; c.pf = 'azure'; c.ef = 'crimson'; });

// ---------------- realms (civilizations) ----------------
const FACTIONS = {
  azure: { name: 'Azure Kingdom', motto: 'Stone endures.', style: 'Builders and defenders',
    lore: 'The old river kingdom of the vale. Its stewards trust walls, wells and full granaries more than glory.',
    bonuses: ['Buildings have +20% hit points', 'Towers, castles and Town Centers shoot +1 range', 'Farms hold +50 food'],
    apply: p => { p.mod.bldHp = 1.2; p.mod.bldRange += 1; p.mod.farmFood += 50; } },
  crimson: { name: 'Crimson March', motto: 'The charge decides.', style: 'Cavalry lords',
    lore: 'Border barons who hold their land from the saddle. Warlord Varn united them with a promise of crystal-gold.',
    bonuses: ['Cavalry have +15% hit points and +1 attack', 'Infantry and cavalry +1 melee armor', 'Food gathering +8%'],
    apply: p => { p.mod.hpMul.cavalry = 1.15; p.mod.atk.cavalry += 1; p.mod.marm.cavalry += 1; p.mod.marm.infantry += 1; p.mod.gather.food *= 1.08; } },
  wind: { name: 'Windrider Clans', motto: 'Nothing that stands still is free.', style: 'Swift nomads and hunters',
    lore: 'Herders of the high steppe who follow the grass and the seasons. They count wealth in horses, not walls.',
    bonuses: ['All units move 8% faster (cavalry 14%)', 'Hunted meat is gathered 30% faster', 'Villagers carry +3 and have +5 hit points'],
    apply: p => { p.mod.spd.all = 1.08; p.mod.spd.cavalry = 1.14; p.mod.kind.carcass = 1.3; p.mod.carry += 3; p.mod.vilHp += 5; } },
  stone: { name: 'Stoneholt Clans', motto: 'An oath is cut in rock.', style: 'Miners and shield-walls',
    lore: 'Hill-folk of the Iron Highlands. Every clan hall is built over the mine that feeds it.',
    bonuses: ['Stone and gold mining +20%', 'Infantry have +10% hit points and +1/+1 armor', 'Buildings have +10% hit points'],
    apply: p => { p.mod.gather.stone *= 1.2; p.mod.gather.gold *= 1.2; p.mod.hpMul.infantry = 1.1; p.mod.marm.infantry += 1; p.mod.parm.infantry += 1; p.mod.bldHp = 1.1; } },
  amber: { name: 'Amber League', motto: 'Coin sees further than arrows.', style: 'Merchants and marksmen',
    lore: 'Free cities of the southern coast, bound by trade charters. They hire the best bows that gold can buy.',
    bonuses: ['Archers and crossbowmen +1 range and +1 attack', 'Gold +15% and wood +10% gathering', 'Villagers carry +2'],
    apply: p => { p.mod.range += 1; p.mod.atk.archer += 1; p.mod.gather.gold *= 1.15; p.mod.gather.wood *= 1.1; p.mod.carry += 2; } },
};
// ---------------- realm-unique units and buildings ----------------
Object.assign(UNITS, {
  warden: { name: 'Vale Warden', realm: 'azure', cls: 'infantry', hp: 85, atk: 7, atkType: 'melee', marm: 3, parm: 3, range: 0.3, reload: 2.1, speed: 1.55, los: 5, radius: 0.3, cost: { wood: 45, gold: 40 }, time: 24, age: 1,
    bonus: { cavalry: 4, building: 3 }, desc: 'Azure Kingdom only. Heavily armoured shield-bearer that holds the line against anything.' },
  lancer: { name: 'March Lancer', realm: 'crimson', cls: 'cavalry', hp: 85, atk: 8, atkType: 'melee', marm: 1, parm: 2, range: 0.35, reload: 1.8, speed: 3.0, los: 6, radius: 0.42, cost: { wood: 50, gold: 50 }, time: 26, age: 1,
    bonus: { infantry: 3, archer: 5, siege: 6 }, desc: 'Crimson March only. Heavy cavalry available already in the Feudal Age. Rides down archers and infantry.' },
  horsearcher: { name: 'Wind Archer', realm: 'wind', cls: 'cavalry', hp: 58, atk: 6, atkType: 'pierce', marm: 0, parm: 1, range: 4.5, reload: 1.9, speed: 3.0, los: 8, radius: 0.42, cost: { wood: 40, gold: 45 }, time: 25, age: 1,
    bonus: { infantry: 3, villager: 1 }, proj: 'arrow', desc: 'Windrider Clans only. Mounted archer: fast, ranged and hard to catch. Weak to spearmen.' },
  ironbreaker: { name: 'Ironbreaker', realm: 'stone', cls: 'infantry', hp: 85, atk: 8, atkType: 'melee', marm: 2, parm: 2, range: 0.3, reload: 2.2, speed: 1.5, los: 5, radius: 0.3, cost: { wood: 45, gold: 45 }, time: 26, age: 1,
    bonus: { building: 10, siege: 8 }, desc: 'Stoneholt Clans only. Slow, armoured hammer-man who smashes buildings and siege engines.' },
  sharpshooter: { name: 'League Sharpshooter', realm: 'amber', cls: 'archer', hp: 40, atk: 9, atkType: 'pierce', marm: 0, parm: 1, range: 7.5, reload: 2.4, speed: 1.8, los: 9, radius: 0.27, cost: { wood: 40, gold: 50 }, time: 26, age: 1,
    bonus: { infantry: 5, cavalry: 2 }, proj: 'arrow', desc: 'Amber League only. Very long range and a heavy bolt, but slow to reload and fragile.' },
});
MILITARY.push('warden', 'lancer', 'horsearcher', 'ironbreaker', 'sharpshooter');
Object.assign(BUILDINGS, {
  belltower: { name: 'Bell Tower', realm: 'azure', limit: 3, size: 2, hp: 1400, marm: 2, parm: 8, cost: { wood: 60, stone: 150 }, time: 50, age: 1, attack: { atk: 6, range: 10, reload: 2, arrows: 2 }, garrison: 8, los: 13,
    desc: 'Tall watch-tower with very long sight and range that looses two arrows at a time. Up to 3.' },
  warhall: { name: 'War Hall', realm: 'crimson', limit: 1, size: 4, hp: 2600, marm: 3, parm: 8, cost: { wood: 240, stone: 80 }, time: 70, age: 1, pop: 10, attack: { atk: 5, range: 6, reload: 2, arrows: 1 }, garrison: 10, los: 8, trains: ['lancer', 'scout', 'knight'],
    desc: 'Fortified muster hall: +10 population, shoots arrows and trains all cavalry including March Lancers.' },
  yurt: { name: 'Yurt', realm: 'wind', size: 2, hp: 400, marm: 0, parm: 4, cost: { wood: 25 }, time: 12, age: 0, pop: 6, drop: ['food'], los: 4,
    desc: 'Cheap felt home: +6 population, quick to raise, and hunters can drop food here.' },
  clanhall: { name: 'Clan Hall', realm: 'stone', limit: 1, size: 4, hp: 3000, marm: 4, parm: 9, cost: { wood: 200, stone: 250 }, time: 70, age: 1, pop: 10, drop: ['stone', 'gold'], garrison: 12, los: 7, trains: ['ironbreaker', 'spearman'],
    desc: 'Stronghold of the clan: +10 population, drop-off for stone and gold, garrison for 12, trains Ironbreakers.' },
  tradepost: { name: 'Trade Post', realm: 'amber', limit: 3, size: 2, hp: 800, marm: 1, parm: 6, cost: { wood: 150, gold: 50 }, time: 40, age: 1, income: { gold: 0.45 }, los: 5,
    desc: 'Caravan stop that earns a steady trickle of gold (about 27 per minute) without any villagers. Up to 3.' },
});
BUILDINGS.barracks.trains.push('warden', 'ironbreaker'); BUILDINGS.stable.trains.push('lancer', 'horsearcher'); BUILDINGS.range.trains.push('sharpshooter');
const REALM_BUILD = { azure: 'belltower', crimson: 'warhall', wind: 'yurt', stone: 'clanhall', amber: 'tradepost' };
const REALM_UNIT = { azure: 'warden', crimson: 'lancer', wind: 'horsearcher', stone: 'ironbreaker', amber: 'sharpshooter' };
const UNIT_SCALE = { warden: 1.14, ironbreaker: 1.16, sharpshooter: 1.08, lancer: 1.06 };
const realmOk = (def, p) => !def.realm || def.realm === p.faction;
for (const k in FACTIONS) FACTIONS[k].bonuses.push('Unique: ' + UNITS[REALM_UNIT[k]].name + ' (unit) and ' + BUILDINGS[REALM_BUILD[k]].name + ' (building)');
function applyFaction(p, key) { const f = FACTIONS[key] || FACTIONS.azure; p.faction = FACTIONS[key] ? key : 'azure'; p.name = f.name; f.apply(p); p.ver++; }

// ---------------- more sagas ----------------
CAMPAIGN.push(
  // ===== Riders of the Long Wind (Windrider Clans) =====
  { id: 11, camp: 'wind', num: 1, pf: 'wind', ef: 'stone', title: 'The Gathering of Clans', theme: 'highlands', size: 'normal', diff: 'easy', seed: 51017,
    intro: ['When the sky broke over Ironvale, the crystal rain poisoned the summer pastures of the high steppe. The herds are dying and the clans are scattering.',
      'Sarnai, a young herd-mother of the Grey Mare clan, plants her banner beside the last clean river and calls the riders to her. But the Stoneholt Clans hold the passes below and will not share their valleys.',
      'Gather your people, raise riders, and break the Stoneholt gate so the herds can come down from the dying steppe.'],
    objectives: [{ id: 'feudal', text: 'Advance to the Feudal Age' }, { id: 'army12', text: 'Raise a war-band of 12 soldiers' }, { id: 'win', text: 'Defeat the Stoneholt Clans' }, { id: 'treasure', text: 'Take the hoard from the wolf dens', optional: true }],
    beats: [{ at: 20, text: 'Sarnai: "Hunt first. A clan that eats will follow you anywhere."' }, { event: 'feudal', text: 'Elder Bataar: "The clans answer your banner, Windmother. Now give them horses."' }, { event: 'attacked', text: 'Rider: "Shield-walls at the camp! The hill-folk have found us!"' }],
    outro: 'The pass is open and the herds stream down into green country. For the first time in a generation the clans ride under one banner — and the rich cities of the coast lie only a season away.' },
  { id: 12, camp: 'wind', num: 2, pf: 'wind', ef: 'amber', title: 'The Amber Road', theme: 'coast', size: 'normal', diff: 'standard', seed: 52033,
    intro: ['The Amber League closes its markets to the clans: no grain, no iron, no salt. "Barbarians pay in advance," their charter-masters say.',
      'Sarnai answers by riding the Amber Road itself. Corsairs prey on the same coast, and their coves are full of League gold.',
      'Take what the League will not sell. Seize the corsair hoards, fill your saddlebags, and humble the merchant-princes.'],
    objectives: [{ id: 'treasure2', text: 'Plunder 2 corsair hoards' }, { id: 'gold1500', text: 'Gather 1500 gold' }, { id: 'win', text: 'Defeat the Amber League' }, { id: 'captain', text: 'Defeat Captain Redbeard', optional: true }],
    beats: [{ at: 30, text: 'Sarnai: "Their crossbows out-reach us. Close fast, or do not close at all."' }, { event: 'boss', text: 'Elder Bataar: "The corsair lord is dead. Even the sea fears you now."' }, { event: 'attacked', text: 'Rider: "League bolts are falling on the yurts!"' }],
    outro: 'The League signs a new charter — this time on Sarnai\'s terms. But word of her victories has reached the Azure Kingdom, and the stewards of the vale begin to raise their walls higher.' },
  { id: 13, camp: 'wind', num: 3, pf: 'wind', ef: 'azure', title: 'Walls of Azure', theme: 'vale', size: 'large', diff: 'hard', seed: 53071,
    intro: ['The Azure Kingdom will not treat with riders. Its envoys offer the clans the marsh and the wastes, and nothing else.',
      'Stone walls and arrow towers have never been broken by horsemen alone. Sarnai\'s smiths must learn the craft of siege.',
      'Reach the Iron Age, build engines to crack the Azure walls, and win your people a home in the Green Vale.'],
    objectives: [{ id: 'iron', text: 'Advance to the Iron Age' }, { id: 'siege3', text: 'Field 3 siege engines' }, { id: 'win', text: 'Defeat the Azure Kingdom' }, { id: 'treasure', text: 'Recover a treasure', optional: true }],
    beats: [{ at: 30, text: 'Sarnai: "A wall is only a promise that someone was afraid. Let us show them why."' }, { event: 'iron', text: 'Smith: "The engines are ready, Windmother. Point, and the walls will listen."' }, { event: 'attacked', text: 'Rider: "Azure knights from the gate! Form up!"' }],
    outro: 'The gates of the vale stand open. Sarnai does not burn the kingdom — she grazes her herds beside its fields, and the singers call it the Peace of the Long Wind.' },
  // ===== The Stoneholt Oath (Stoneholt Clans) =====
  { id: 21, camp: 'stone', num: 1, pf: 'stone', ef: 'wind', title: 'Deep Roots', theme: 'highlands', size: 'normal', diff: 'easy', seed: 61019,
    intro: ['Thane Brannoch is dead, and his daughter Hild inherits a hall with an empty treasury and a mine that is nearly worked out.',
      'Windrider raiders test every new thane. If Hild cannot hold her own valley, no clan will keep its oath to her.',
      'Dig in. Raise watch towers, reopen the mines, and drive the raiders back up the mountain.'],
    objectives: [{ id: 'towers2', text: 'Build 2 Watch Towers' }, { id: 'feudal', text: 'Advance to the Feudal Age' }, { id: 'win', text: 'Defeat the Windrider raiders' }, { id: 'treasure', text: 'Reclaim the lost clan-hoard', optional: true }],
    beats: [{ at: 20, text: 'Hild: "Stone first, then gold. We build what we cannot afford to lose."' }, { event: 'feudal', text: 'Old Garrow: "Your father would not have managed it faster, Thane. Do not tell him I said so."' }, { event: 'attacked', text: 'Sentry: "Riders in the lower fields! Light the beacons!"' }],
    outro: 'The valley holds. One by one the hill clans send their oath-stones to Hild\'s hall. But the oldest stone of all — the Oathstone of the first thane — lies in a crypt in the Hollow Marsh, and the dead there no longer sleep.' },
  { id: 22, camp: 'stone', num: 2, pf: 'stone', ef: 'crimson', title: 'The Hollow King', theme: 'marsh', size: 'normal', diff: 'standard', seed: 62041,
    intro: ['The Crimson March has broken open the royal crypts of the marsh, hunting for crown-gold to pay its riders.',
      'With the graves disturbed, the dead walk. And somewhere among those crypts lies the Oathstone that binds the clans together.',
      'Cleanse the graveyards, raise a hall strong enough to stand in this cursed place, and throw the March out of the marsh.'],
    objectives: [{ id: 'graves', text: 'Cleanse 2 graveyards of their treasure' }, { id: 'tc3', text: 'Upgrade your Town Center to Level 3' }, { id: 'win', text: 'Defeat the Crimson March' }, { id: 'captain', text: 'Lay the Grave Knight to rest', optional: true }],
    beats: [{ at: 30, text: 'Hild: "Arrows pass through bone. Send shields and axes against the dead."' }, { event: 'boss', text: 'Old Garrow: "He was a king once. Now he can rest like one."' }, { event: 'attacked', text: 'Sentry: "Crimson lancers on the causeway!"' }],
    outro: 'The crypts are sealed and the March rides home with empty saddlebags. But the Oathstone is gone — sold, the grave-robbers confess, to a collector of the Amber League, who carried it into the Primeval Wilds.' },
  { id: 23, camp: 'stone', num: 3, pf: 'stone', ef: 'amber', title: 'The Oathstone', theme: 'wilds', size: 'large', diff: 'hard', seed: 63083,
    intro: ['In the Wilds the Amber League has built a fortress-market around the great crystal, and the Oathstone sits in its vault as a curiosity.',
      'The League\'s marksmen are the finest in Ironvale, and the jungle itself is full of teeth.',
      'Take back the Oathstone by force — or raise a Wonder to house it, so grand that every clan will know where its oath belongs.'],
    objectives: [{ id: 'iron', text: 'Advance to the Iron Age' }, { id: 'winOrWonder', text: 'Defeat the Amber League or win with a Wonder' }, { id: 'tyrant', text: 'Slay the Tyrant', optional: true }],
    beats: [{ at: 30, text: 'Hild: "Keep the miners inside the palisade. Whatever made those tracks is still hungry."' }, { event: 'iron', text: 'Old Garrow: "Iron in the forge and stone in the wall. Now we are Stoneholt again."' }, { event: 'attacked', text: 'Sentry: "League crossbows in the tree line!"' }],
    outro: 'Hild sets the Oathstone in the heart of her hall. The clans swear on it together, as they have not done in a hundred years, and the mountains have one voice again.' },
);
const CAMPAIGNS = [
  { key: 'shatter', title: 'The Shattering of Ironvale', realm: 'azure', hero: 'The Steward', blurb: 'Crystal rain has woken old powers. Lead the Azure Kingdom against Warlord Varn across the vale, the coast, the wilds and the marsh.' },
  { key: 'wind', title: 'Riders of the Long Wind', realm: 'wind', hero: 'Sarnai, the Windmother', blurb: 'The steppe is dying. Unite the Windrider Clans and win them a new home — through mountain passes, merchant roads and the walls of a kingdom.' },
  { key: 'stone', title: 'The Stoneholt Oath', realm: 'stone', hero: 'Thane Hild', blurb: 'A young thane inherits an empty hall. Hold the valley, brave the haunted marsh and recover the stone that binds the hill clans.' },
];
const campaignOf = c => CAMPAIGNS.find(x => x.key === c.camp) || CAMPAIGNS[0];
const chapterOpts = c => ({ seed: c.seed, difficulty: c.diff, theme: c.theme, size: c.size, chapter: c.id, pf: c.pf, ef: c.ef });
// the world's history, shown in the Chronicle
const CHRONICLE = [
  ['The First Thanes', 'Before any kingdom, hill clans cut their oaths into a single great stone and swore to hold the high passes together. Their halls became Stoneholt.'],
  ['The River Kingdom', 'Farmers of the Green Vale raised walls against the raiding seasons and chose stewards to keep the granaries. In time the stewards wore blue and called their land the Azure Kingdom.'],
  ['The Free Charters', 'On the southern coast, harbour towns bought their freedom with amber and banded together as the Amber League. Their caravans bound the realms more tightly than any treaty.'],
  ['The March Lords', 'On the eastern border, cavalry barons were granted land to guard the vale. Guarding became ruling, and the Crimson March answered to no one.'],
  ['The Long Wind', 'Beyond the mountains the Windrider Clans followed their herds across the steppe, trading horses for iron and owing nothing to anyone with a roof.'],
  ['The Shattering', 'Three winters ago the sky split. Shards of living crystal fell across Ironvale. Where they landed, pastures died, beasts of a forgotten age stirred, and the buried dead grew restless. Every realm now reaches for the crystals — to use them, to sell them, or simply to survive them.'],
];
function campaignProgress(key = 'shatter') {
  try { const m = JSON.parse(localStorage.getItem('ironvale.campaigns') || '{}'); if (m[key]) return m[key]; if (key === 'shatter') return +(localStorage.getItem('ironvale.campaign') || 1); } catch (e) { /* ignore */ }
  return 1;
}
function setCampaignProgress(key, n) {
  try { const m = JSON.parse(localStorage.getItem('ironvale.campaigns') || '{}'); m[key] = Math.max(n, campaignProgress(key)); localStorage.setItem('ironvale.campaigns', JSON.stringify(m)); } catch (e) { /* ignore */ }
}
