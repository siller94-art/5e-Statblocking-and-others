/**
 * Base stats for the SRD weapons and armor, keyed by the dnd5e base-item ids
 * (CONFIG.DND5E.weaponIds / armorIds / shieldIds). Used to fill in a magic item's
 * mundane stats when the text only says "Weapon (longsword)" or "Armor (plate)".
 * Weapon fields: type, damage [dice, type], props, weight (lb), cost [value, denom],
 * range [normal, long] (thrown/ammunition), versatile die, mastery (2024).
 */

export const WEAPONS = {
  // Simple melee
  club:          { type: "simpleM", damage: ["1d4", "bludgeoning"], props: ["lgt"], weight: 2, cost: [1, "sp"], mastery: "slow" },
  dagger:        { type: "simpleM", damage: ["1d4", "piercing"], props: ["fin", "lgt", "thr"], range: [20, 60], weight: 1, cost: [2, "gp"], mastery: "nick" },
  greatclub:     { type: "simpleM", damage: ["1d8", "bludgeoning"], props: ["two"], weight: 10, cost: [2, "sp"], mastery: "push" },
  handaxe:       { type: "simpleM", damage: ["1d6", "slashing"], props: ["lgt", "thr"], range: [20, 60], weight: 2, cost: [5, "gp"], mastery: "vex" },
  javelin:       { type: "simpleM", damage: ["1d6", "piercing"], props: ["thr"], range: [30, 120], weight: 2, cost: [5, "sp"], mastery: "slow" },
  lighthammer:   { type: "simpleM", damage: ["1d4", "bludgeoning"], props: ["lgt", "thr"], range: [20, 60], weight: 2, cost: [2, "gp"], mastery: "nick" },
  mace:          { type: "simpleM", damage: ["1d6", "bludgeoning"], props: [], weight: 4, cost: [5, "gp"], mastery: "sap" },
  quarterstaff:  { type: "simpleM", damage: ["1d6", "bludgeoning"], props: ["ver"], versatile: "1d8", weight: 4, cost: [2, "sp"], mastery: "topple" },
  sickle:        { type: "simpleM", damage: ["1d4", "slashing"], props: ["lgt"], weight: 2, cost: [1, "gp"], mastery: "nick" },
  spear:         { type: "simpleM", damage: ["1d6", "piercing"], props: ["thr", "ver"], range: [20, 60], versatile: "1d8", weight: 3, cost: [1, "gp"], mastery: "sap" },
  // Simple ranged
  dart:          { type: "simpleR", damage: ["1d4", "piercing"], props: ["fin", "thr"], range: [20, 60], weight: 0.25, cost: [5, "cp"], mastery: "vex" },
  lightcrossbow: { type: "simpleR", damage: ["1d8", "piercing"], props: ["amm", "lod", "two"], range: [80, 320], weight: 5, cost: [25, "gp"], mastery: "slow" },
  shortbow:      { type: "simpleR", damage: ["1d6", "piercing"], props: ["amm", "two"], range: [80, 320], weight: 2, cost: [25, "gp"], mastery: "vex" },
  sling:         { type: "simpleR", damage: ["1d4", "bludgeoning"], props: ["amm"], range: [30, 120], weight: 0, cost: [1, "sp"], mastery: "slow" },
  // Martial melee
  battleaxe:     { type: "martialM", damage: ["1d8", "slashing"], props: ["ver"], versatile: "1d10", weight: 4, cost: [10, "gp"], mastery: "topple" },
  flail:         { type: "martialM", damage: ["1d8", "bludgeoning"], props: [], weight: 2, cost: [10, "gp"], mastery: "sap" },
  glaive:        { type: "martialM", damage: ["1d10", "slashing"], props: ["hvy", "rch", "two"], weight: 6, cost: [20, "gp"], mastery: "graze" },
  greataxe:      { type: "martialM", damage: ["1d12", "slashing"], props: ["hvy", "two"], weight: 7, cost: [30, "gp"], mastery: "cleave" },
  greatsword:    { type: "martialM", damage: ["2d6", "slashing"], props: ["hvy", "two"], weight: 6, cost: [50, "gp"], mastery: "graze" },
  halberd:       { type: "martialM", damage: ["1d10", "slashing"], props: ["hvy", "rch", "two"], weight: 6, cost: [20, "gp"], mastery: "cleave" },
  lance:         { type: "martialM", damage: ["1d10", "piercing"], props: ["hvy", "rch", "two"], weight: 6, cost: [10, "gp"], mastery: "topple" },
  longsword:     { type: "martialM", damage: ["1d8", "slashing"], props: ["ver"], versatile: "1d10", weight: 3, cost: [15, "gp"], mastery: "sap" },
  maul:          { type: "martialM", damage: ["2d6", "bludgeoning"], props: ["hvy", "two"], weight: 10, cost: [10, "gp"], mastery: "topple" },
  morningstar:   { type: "martialM", damage: ["1d8", "piercing"], props: [], weight: 4, cost: [15, "gp"], mastery: "sap" },
  pike:          { type: "martialM", damage: ["1d10", "piercing"], props: ["hvy", "rch", "two"], weight: 18, cost: [5, "gp"], mastery: "push" },
  rapier:        { type: "martialM", damage: ["1d8", "piercing"], props: ["fin"], weight: 2, cost: [25, "gp"], mastery: "vex" },
  scimitar:      { type: "martialM", damage: ["1d6", "slashing"], props: ["fin", "lgt"], weight: 3, cost: [25, "gp"], mastery: "nick" },
  shortsword:    { type: "martialM", damage: ["1d6", "piercing"], props: ["fin", "lgt"], weight: 2, cost: [10, "gp"], mastery: "vex" },
  trident:       { type: "martialM", damage: ["1d8", "piercing"], props: ["thr", "ver"], range: [20, 60], versatile: "1d10", weight: 4, cost: [5, "gp"], mastery: "topple" },
  warpick:       { type: "martialM", damage: ["1d8", "piercing"], props: ["ver"], versatile: "1d10", weight: 2, cost: [5, "gp"], mastery: "sap" },
  warhammer:     { type: "martialM", damage: ["1d8", "bludgeoning"], props: ["ver"], versatile: "1d10", weight: 5, cost: [15, "gp"], mastery: "push" },
  whip:          { type: "martialM", damage: ["1d4", "slashing"], props: ["fin", "rch"], weight: 3, cost: [2, "gp"], mastery: "slow" },
  // Martial ranged
  blowgun:       { type: "martialR", damage: ["1", "piercing"], props: ["amm", "lod"], range: [25, 100], weight: 1, cost: [10, "gp"], mastery: "vex" },
  handcrossbow:  { type: "martialR", damage: ["1d6", "piercing"], props: ["amm", "lgt", "lod"], range: [30, 120], weight: 3, cost: [75, "gp"], mastery: "vex" },
  heavycrossbow: { type: "martialR", damage: ["1d10", "piercing"], props: ["amm", "hvy", "lod", "two"], range: [100, 400], weight: 18, cost: [50, "gp"], mastery: "push" },
  longbow:       { type: "martialR", damage: ["1d8", "piercing"], props: ["amm", "hvy", "two"], range: [150, 600], weight: 2, cost: [50, "gp"], mastery: "slow" },
  musket:        { type: "martialR", damage: ["1d12", "piercing"], props: ["amm", "lod", "two"], range: [40, 120], weight: 10, cost: [500, "gp"], mastery: "slow" },
  pistol:        { type: "martialR", damage: ["1d10", "piercing"], props: ["amm", "lod"], range: [30, 90], weight: 3, cost: [250, "gp"], mastery: "vex" }
};

/** Armor fields: type, ac, dex (max Dex bonus; null = no cap, 0 = none), str, stealth, weight, cost. */
export const ARMOR = {
  padded:      { type: "light",  ac: 11, dex: null, stealth: true,  weight: 8,  cost: [5, "gp"] },
  leather:     { type: "light",  ac: 11, dex: null, stealth: false, weight: 10, cost: [10, "gp"] },
  studded:     { type: "light",  ac: 12, dex: null, stealth: false, weight: 13, cost: [45, "gp"] },
  hide:        { type: "medium", ac: 12, dex: 2,    stealth: false, weight: 12, cost: [10, "gp"] },
  chainshirt:  { type: "medium", ac: 13, dex: 2,    stealth: false, weight: 20, cost: [50, "gp"] },
  scalemail:   { type: "medium", ac: 14, dex: 2,    stealth: true,  weight: 45, cost: [50, "gp"] },
  breastplate: { type: "medium", ac: 14, dex: 2,    stealth: false, weight: 20, cost: [400, "gp"] },
  halfplate:   { type: "medium", ac: 15, dex: 2,    stealth: true,  weight: 40, cost: [750, "gp"] },
  ringmail:    { type: "heavy",  ac: 14, dex: 0,    stealth: true,  weight: 40, cost: [30, "gp"] },
  chainmail:   { type: "heavy",  ac: 16, dex: 0, str: 13, stealth: true, weight: 55, cost: [75, "gp"] },
  splint:      { type: "heavy",  ac: 17, dex: 0, str: 15, stealth: true, weight: 60, cost: [200, "gp"] },
  plate:       { type: "heavy",  ac: 18, dex: 0, str: 15, stealth: true, weight: 65, cost: [1500, "gp"] },
  shield:      { type: "shield", ac: 2,  dex: null, stealth: false, weight: 6,  cost: [10, "gp"] }
};

/** How base items are written in prose → base-item id. Longest names first so "light crossbow" beats "crossbow". */
export const BASE_NAMES = Object.entries({
  "hand crossbow": "handcrossbow", "heavy crossbow": "heavycrossbow", "light crossbow": "lightcrossbow",
  "light hammer": "lighthammer", "war pick": "warpick", "half plate": "halfplate", "half-plate": "halfplate",
  "chain mail": "chainmail", "chain shirt": "chainshirt", "scale mail": "scalemail", "ring mail": "ringmail",
  "studded leather": "studded", "plate armor": "plate", "splint armor": "splint", "padded armor": "padded",
  "hide armor": "hide", "leather armor": "leather", "short sword": "shortsword", "long sword": "longsword",
  ...Object.fromEntries(Object.keys(WEAPONS).map(k => [k, k])),
  ...Object.fromEntries(Object.keys(ARMOR).map(k => [k, k]))
}).sort((a, b) => b[0].length - a[0].length);

/** Find a base item id named in a piece of text ("longsword", "half plate", "Flame Tongue Shortsword"). */
export function findBase(text) {
  const t = String(text ?? "").toLowerCase();
  for (const [name, id] of BASE_NAMES) {
    if (new RegExp(`\\b${name.replace(/[-\s]/g, "[-\\s]?")}s?\\b`).test(t)) return id;
  }
  return null;
}
