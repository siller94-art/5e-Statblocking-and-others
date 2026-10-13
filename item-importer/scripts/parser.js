/**
 * Plain-text item parser. Turns weapons, armor, magic items, potions, scrolls, tools, gear,
 * treasure and containers copied from PDFs, websites or Homebrewery into plain entry objects.
 * Pure functions, no Foundry calls, so the preview can run on every keystroke.
 */

import { WEAPONS, ARMOR, findBase } from "./srd-items.js";

const DAMAGE_TYPES = "acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder";
const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const RARITY_RE = /\b(very rare|uncommon|common|rare|legendary|artifact|rarity varies|varies)\b/i;
const RARITY_KEY = { "common": "common", "uncommon": "uncommon", "rare": "rare", "very rare": "veryRare", "legendary": "legendary", "artifact": "artifact" };
const PROPERTY_WORDS = {
  ammunition: "amm", finesse: "fin", heavy: "hvy", light: "lgt", loading: "lod", reach: "rch",
  special: "spc", thrown: "thr", "two-handed": "two", "two handed": "two", versatile: "ver",
  silvered: "sil", adamantine: "ada", firearm: "fir", reload: "rel", returning: "ret"
};
const MASTERIES = ["cleave", "graze", "nick", "push", "sap", "slow", "topple", "vex"];

/** Leading word(s) of an item's type line → category. Longest first. */
const CATEGORIES = [
  ["wondrous item", "wondrous"], ["adventuring gear", "gear"], ["art object", "art"], ["trade good", "trade"],
  ["gaming set", "game"], ["musical instrument", "music"], ["artisan's tools", "art-tool"], ["melee weapon", "weapon"],
  ["simple melee weapon", "weapon"], ["simple ranged weapon", "weapon"], ["martial melee weapon", "weapon"], ["martial ranged weapon", "weapon"],
  ["ranged weapon", "weapon"], ["simple weapon", "weapon"], ["martial weapon", "weapon"],
  ["weapon", "weapon"], ["armor", "armor"], ["armour", "armor"], ["shield", "shield"], ["potion", "potion"],
  ["ring", "ring"], ["rod", "rod"], ["scroll", "scroll"], ["staff", "staff"], ["wand", "wand"],
  ["ammunition", "ammo"], ["poison", "poison"], ["food", "food"], ["drink", "food"], ["trinket", "trinket"],
  ["tool", "tool"], ["kit", "tool"], ["instrument", "music"], ["container", "container"], ["gem", "gem"],
  ["treasure", "treasure"], ["material", "material"], ["gear", "gear"], ["clothing", "clothing"], ["vehicle", "vehicle"]
];

const lc = s => String(s ?? "").trim().toLowerCase();
const cap = s => String(s ?? "").replace(/\b\w/g, c => c.toUpperCase());
const unique = a => [...new Set(a)];

/* -------------------------------------------- */
/*  Text cleanup                                */
/* -------------------------------------------- */

export const SPLIT = "\u0000SPLIT";

export function cleanText(raw) {
  const t = String(raw ?? "")
    .replace(/\r\n?/g, "\n").replace(/ /g, " ")
    .replace(/[‐-–−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, "\"")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li)>/gi, "\n").replace(/<[^>]+>/g, "");
  const lines = [];
  for (let line of t.split("\n")) {
    const s = line.trim();
    if (/^(-{3,}|={3,}|\\page(break)?\b.*)$/i.test(s)) { lines.push(SPLIT); continue; }
    if (/^(\{\{.*|\}\}|:{2,}|_{3,}|\\column\b.*)$/.test(s)) { lines.push(""); continue; }
    line = s.replace(/^#{1,6}\s*/, "").replace(/^[-*•]\s+/, "")
      .replace(/(\*{1,3}|_{1,3})(\S(?:.*?\S)?)\1/g, "$2").replace(/\*+/g, "").trim();
    lines.push(line);
  }
  // Re-join lines a PDF broke mid-sentence.
  const out = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (l && prev && prev !== SPLIT && !isTypeLine(l) && !fieldKey(l)) {
      if (/[a-z]-$/.test(prev) && /^[a-z]/.test(l)) { out[out.length - 1] = prev + l; continue; }
      if (!/[.:!?)"]$/.test(prev) && /^[a-z(0-9]/.test(l) && !fieldKey(prev)) { out[out.length - 1] = `${prev} ${l}`; continue; }
    }
    out.push(l);
  }
  return out;
}

/* -------------------------------------------- */
/*  Line classifiers                            */
/* -------------------------------------------- */

function category(line) {
  const s = lc(line);
  for (const [word, cat] of CATEGORIES) if (s.startsWith(word)) return cat;
  return null;
}

/** "Weapon (longsword), rare (requires attunement)" / "Wondrous Item, Uncommon" / "Potion, common" */
export function isTypeLine(line) {
  const s = String(line ?? "").trim();
  if (!s || s.length > 140 || /[.!?]$/.test(s.replace(/\)$/, ""))) return false;
  const cat = category(s);
  if (!cat) return false;
  // A bare "Weapon" or "Armor" word starting a sentence is prose, not a type line.
  return RARITY_RE.test(s) || /^[^,]+\([^)]*\)\s*$/.test(s) || s.split(/\s+/).length <= 4 || /,/.test(s);
}

const FIELD_KEYS = "cost|price|value|weight|damage|properties|property|armor class|armour class|ac|strength|str|stealth|range|mastery|capacity|charges|rarity|attunement|type|category|quantity";
function fieldKey(line) {
  const m = String(line ?? "").match(new RegExp(`^(${FIELD_KEYS})\\s*:`, "i"));
  return m ? lc(m[1]) : null;
}

/** "Cost: 2500 gp, Weight: 2 lb." → { cost: "2500 gp", weight: "2 lb." } */
function readFields(line) {
  const re = new RegExp(`(?:^|[,;]\\s*)(${FIELD_KEYS})\\s*:\\s*`, "gi");
  const hits = [...line.matchAll(re)];
  const out = {};
  hits.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = hits[i + 1]?.index ?? line.length;
    out[lc(m[1])] = line.slice(start, end).trim().replace(/[,;.]$/, "");
  });
  return out;
}

/* -------------------------------------------- */
/*  Value parsers                               */
/* -------------------------------------------- */

function parseCost(s) {
  const m = String(s ?? "").replace(/,(?=\d{3})/g, "").match(/(\d+(?:\.\d+)?)\s*(pp|gp|ep|sp|cp)\b/i);
  return m ? { value: Number(m[1]), denomination: lc(m[2]) } : null;
}

function parseWeight(s) {
  const t = String(s ?? "").replace(/½/g, ".5").replace(/(\d)\s*1\/2/, "$1.5").replace(/\b1\/2\b/, "0.5").replace(/\b1\/4\b/, "0.25");
  const m = t.match(/(\d*\.?\d+)\s*(lb|lbs|pounds?)\b/i);
  return m ? Number(m[1]) : null;
}

function parseDamageList(s) {
  const re = new RegExp(`(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?|\\d+)\\s*\\[?(${DAMAGE_TYPES})\\]?`, "gi");
  return [...String(s ?? "").matchAll(re)].map(m => ({ dice: m[1].replace(/\s+/g, ""), type: lc(m[2]) }));
}

function parseProperties(s) {
  const text = lc(s);
  const props = unique(Object.entries(PROPERTY_WORDS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(text)).map(([, k]) => k));
  const range = text.match(/(\d+)\s*\/\s*(\d+)/);
  const versatile = text.match(/versatile\s*\((\d+d\d+)\)/);
  return { props, range: range ? [Number(range[1]), Number(range[2])] : null, versatile: versatile?.[1] ?? null };
}

/** Uses: "has 7 charges", "regains 1d6 + 1 expended charges daily at dawn", "can't be used again until the next dawn". */
function parseUses(text) {
  const t = lc(text);
  const charges = t.match(/(?:has|holds|starts with)\s+(\d+)\s+charges?/);
  const regain = t.match(/regains?\s+(all|\d+d\d+(?:\s*\+\s*\d+)?|\d+)\s+(?:of its\s+)?(?:expended\s+)?charges?(?:\s+(?:daily|each day))?\s+at\s+(dawn|dusk)/)
    ?? t.match(/regains?\s+(all|\d+d\d+(?:\s*\+\s*\d+)?|\d+)\s+(?:expended\s+)?charges?\s+(?:daily|each day)/);
  if (charges) {
    const period = regain?.[2] ?? (regain ? "day" : null);
    const recovery = regain ? [regain[1] === "all"
      ? { period, type: "recoverAll" }
      : { period, type: "formula", formula: regain[1].replace(/\s+/g, "") }] : [];
    return { max: charges[1], recovery, label: `${charges[1]} charges${regain ? `, regains ${regain[1].replace(/\s+/g, "")} at ${period}` : ""}` };
  }
  const daily = t.match(/(?:can't|cannot|can not) (?:be used|use (?:this|it)(?: property)?) again until (?:the next )?(dawn|dusk|you finish a long rest|you finish a short or long rest)/);
  if (daily) {
    const period = /short/.test(daily[1]) ? "sr" : /long/.test(daily[1]) ? "lr" : daily[1];
    return { max: "1", recovery: [{ period, type: "recoverAll" }], label: `1/${period === "lr" ? "long rest" : period === "sr" ? "short rest" : period}` };
  }
  return null;
}

function parseActivation(text) {
  const m = lc(text).match(/as an?\s+(bonus action|magic action|utilize action|reaction|action)/)
    ?? lc(text).match(/\b(bonus action|reaction)\b/);
  if (!m) return null;
  return { "bonus action": "bonus", reaction: "reaction" }[m[1]] ?? "action";
}

/* -------------------------------------------- */
/*  Item parser                                 */
/* -------------------------------------------- */

function parseItem(lines, { rules: rulesOpt = "auto" } = {}) {
  const found = [], warnings = [];
  const body = lines.filter(l => l !== SPLIT);
  let nameIdx = body.findIndex(Boolean);
  let name = (body[nameIdx] ?? "Unnamed item").replace(/^name\s*:\s*/i, "").trim();
  const e = { name, quantity: 1 };

  const qty = name.match(/^(.*?)\s*\((\d+)\)\s*$/) ?? name.match(/^(.*?)\s*,\s*x?(\d+)\s*$/i);
  if (qty && !/\d+d\d+/.test(qty[2])) { e.name = name = qty[1].trim(); e.quantity = Number(qty[2]); }

  // Type line: first classifiable line among the next few.
  let typeLine = null;
  const rest = [];
  const fields = {};
  for (const [i, l] of body.entries()) {
    if (i <= nameIdx || !l) { if (i > nameIdx) rest.push(l); continue; }
    if (!typeLine && i <= nameIdx + 3 && isTypeLine(l) && !fieldKey(l)) { typeLine = l; continue; }
    if (fieldKey(l)) { Object.assign(fields, readFields(l)); continue; }
    rest.push(l);
  }
  if (fields.type && !typeLine) typeLine = fields.type + (fields.rarity ? `, ${fields.rarity}` : "");
  const description = rest.filter(Boolean);
  const text = description.join(" ");

  // ---- Category, rarity, attunement
  let cat = typeLine ? category(typeLine) : (fields.category ? category(fields.category) : null);
  const paren = typeLine?.match(/\(([^)]*)\)/)?.[1] ?? "";
  const rarityText = (typeLine ?? "").replace(/\([^)]*attunement[^)]*\)/i, "") + " " + (fields.rarity ?? "");
  const rarity = rarityText.match(RARITY_RE)?.[1];
  if (rarity && RARITY_KEY[lc(rarity)]) { e.rarity = RARITY_KEY[lc(rarity)]; found.push(cap(rarity)); }
  else if (rarity) warnings.push("Rarity varies: set it on the sheet");
  const attune = `${typeLine ?? ""} ${fields.attunement ?? ""}`.match(/requires attunement(?:\s+by\s+([^)]+))?/i);
  if (attune) { e.attunement = "required"; if (attune[1]) e.attunementBy = attune[1].trim(); found.push("Attunement"); }
  if (typeLine) e.typeLine = typeLine;

  // Category fallbacks from content
  const base = findBase(`${paren} ${name}`);
  if (!cat) {
    if (fields.damage || /\b(melee|ranged) weapon\b/i.test(text) || (base && WEAPONS[base])) cat = "weapon";
    else if (fields["armor class"] || fields["armour class"] || fields.ac || (base && ARMOR[base])) cat = base === "shield" ? "shield" : "armor";
    else if (/\b(potion|elixir|philter|oil of)\b/i.test(name)) cat = "potion";
    else if (/\bscroll\b/i.test(name)) cat = "scroll";
    else if (/\b(bag|backpack|chest|pouch|sack|case|quiver|box|barrel)\b/i.test(name) || /\b(holds?|capacity|can hold)\b/i.test(text)) cat = "container";
    else if (e.rarity) cat = "wondrous";
    else cat = "gear";
    warnings.push(`No type line found: treated as ${cat === "gear" ? "adventuring gear" : cat}`);
  }
  if (cat === "staff") cat = "weapon";

  // ---- Shared physical fields
  const cost = parseCost(fields.cost ?? fields.price ?? fields.value);
  if (cost) { e.price = cost; found.push(`${cost.value} ${cost.denomination}`); }
  const weight = parseWeight(fields.weight);
  if (weight != null) { e.weight = weight; found.push(`${weight} lb`); }
  if (fields.quantity && Number(fields.quantity)) e.quantity = Number(fields.quantity);

  if (e.weight == null) {
    const w = text.match(/\bweighs?\s+(\d+(?:\.\d+)?)\s*(?:pounds|lb)/i);
    if (w) e.weight = Number(w[1]);
  }
  const uses = parseUses(text);
  if (uses) { e.uses = uses; found.push(uses.label); }

  const magicBonus = text.match(/\+(\d)\s+bonus to attack (?:rolls )?and damage rolls/i);
  const acBonus = text.match(/\+(\d)\s+bonus to (?:its |your )?(?:armor class|AC)\b/i);
  const save = text.match(new RegExp(`DC\\s*(\\d+)\\s+(${ABILITIES.join("|")})\\s+saving throw`, "i"));
  const extraDamage = [...text.matchAll(new RegExp(`(?:extra|additional)\\s+(\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)\\s+(${DAMAGE_TYPES})\\s+damage`, "gi"))]
    .map(m => ({ dice: m[1].replace(/\s+/g, ""), type: lc(m[2]) }));

  let kind;
  if (cat === "weapon") {
    kind = "weapon";
    let b = base && WEAPONS[base] ? base : (lc(paren).includes("quarterstaff") || /\bstaff\b/i.test(typeLine ?? name) ? "quarterstaff" : null);
    // A homebrew weapon whose own stats differ from the base it is named after isn't that base weapon.
    const own = parseDamageList(fields.damage)[0];
    if (b && own && !findBase(paren) && (own.dice !== WEAPONS[b].damage[0] || own.type !== WEAPONS[b].damage[1])) b = null;
    const stats = b ? WEAPONS[b] : null;
    if (b) { e.baseItem = b; found.push(`Base ${b}`); }
    else if (/\bany\b/i.test(paren)) warnings.push(`"${paren}" covers several weapons: pick the base weapon on the sheet`);
    const dmg = parseDamageList(fields.damage);
    const pr = parseProperties(fields.properties ?? fields.property ?? "");
    const declared = (typeLine ?? "").match(/\b(simple|martial)\s+(melee|ranged)\b/i);
    e.weaponType = declared ? `${lc(declared[1])}${lc(declared[2]) === "ranged" ? "R" : "M"}`
      : stats?.type ?? (/martial/i.test(typeLine ?? "") ? "martial" : "simple") + (/ranged/i.test(`${typeLine} ${text}`) ? "R" : "M");
    e.damage = dmg[0] ?? (stats ? { dice: stats.damage[0], type: stats.damage[1] } : null);
    e.extraDamage = [...dmg.slice(1), ...extraDamage];
    e.properties = fields.properties || fields.property ? pr.props : [...(stats?.props ?? [])];
    e.range = pr.range ?? (fields.range ? parseProperties(fields.range).range : null) ?? stats?.range ?? null;
    e.versatile = pr.versatile ?? stats?.versatile ?? null;
    const mastery = lc(fields.mastery ?? "") || null;
    e.mastery = MASTERIES.includes(mastery) ? mastery : stats?.mastery ?? null;
    if (!e.price && stats && !e.rarity) e.price = { value: stats.cost[0], denomination: stats.cost[1] };
    if (e.weight == null && stats) e.weight = stats.weight;
    if (magicBonus) { e.magicalBonus = Number(magicBonus[1]); found.push(`+${magicBonus[1]} weapon`); }
    if (e.damage) found.push(`Damage ${e.damage.dice} ${e.damage.type}`);
    else if (!/\bany\b/i.test(paren)) warnings.push("No damage found");
    if (e.extraDamage.length) found.push(`Extra ${e.extraDamage.map(d => `${d.dice} ${d.type}`).join(", ")}`);
    if (e.properties.length) found.push(`Properties ${e.properties.join(", ")}`);
  } else if (cat === "armor" || cat === "shield") {
    kind = "armor";
    const b = cat === "shield" ? "shield" : base && ARMOR[base] ? base : null;
    const stats = b ? ARMOR[b] : null;
    if (b) { e.baseItem = b; found.push(`Base ${b}`); }
    else if (/\bany\b|\bor\b/i.test(paren)) warnings.push(`"${paren}" covers several armors: pick the base armor on the sheet`);
    const acField = fields["armor class"] ?? fields["armour class"] ?? fields.ac;
    const ac = acField?.match(/\+?(\d+)/);
    const dexCap = acField?.match(/max(?:imum)?\.?\s*(?:dex(?:terity)?\s*(?:modifier|bonus)?)?\s*(?:of\s*)?\+?(\d)/i) ?? acField?.match(/\+\s*dex[^)]*max\s*(\d)/i);
    e.armorType = stats?.type ?? (/heavy/i.test(paren) ? "heavy" : /medium/i.test(paren) ? "medium" : /light/i.test(paren) ? "light" : "light");
    e.ac = ac ? Number(ac[1]) : stats?.ac ?? null;
    e.dexCap = dexCap ? Number(dexCap[1]) : acField && !/dex/i.test(acField) ? 0 : stats?.dex ?? null;
    if (e.armorType === "light" && !dexCap) e.dexCap = null;
    const str = (fields.strength ?? fields.str ?? text.match(/requires? strength (\d+)/i)?.[1] ?? "").toString().match(/(\d+)/);
    e.strength = str ? Number(str[1]) : stats?.str ?? null;
    e.stealthDisadvantage = /disadvantage/i.test(fields.stealth ?? "") || /disadvantage on (?:dexterity \()?stealth/i.test(text) || (!fields.stealth && !!stats?.stealth);
    if (e.weight == null && stats) e.weight = stats.weight;
    if (!e.price && stats && !e.rarity) e.price = { value: stats.cost[0], denomination: stats.cost[1] };
    if (acBonus) { e.magicalBonus = Number(acBonus[1]); found.push(`+${acBonus[1]} AC`); }
    if (e.ac != null) found.push(`AC ${e.ac}${e.dexCap != null ? ` (max Dex ${e.dexCap})` : ""}`); else warnings.push("No AC found");
    if (e.strength) found.push(`Str ${e.strength}`);
    if (e.stealthDisadvantage) found.push("Stealth disadvantage");
  } else if (["potion", "scroll", "ammo", "poison", "food", "wand", "trinket"].includes(cat)) {
    kind = "consumable";
    e.consumableType = cat;
    if (cat === "ammo") {
      const sub = lc(`${paren} ${name}`);
      e.subtype = /arrow/.test(sub) ? "arrow" : /bolt/.test(sub) ? "crossbowBolt" : /needle/.test(sub) ? "blowgunNeedle"
        : /firearm|musket|pistol/.test(sub) ? "firearmBullet" : /bullet|sling/.test(sub) ? "slingBullet" : "";
      if (magicBonus) e.magicalBonus = Number(magicBonus[1]);
    }
    if (cat === "poison") e.subtype = ["contact", "ingested", "inhaled", "injury"].find(s => lc(`${paren} ${typeLine}`).includes(s)) ?? "";
    const heal = text.match(/regains?\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+hit points/i);
    if (heal) { e.healing = heal[1].replace(/\s+/g, ""); found.push(`Heals ${e.healing}`); }
    const dmg = [...text.matchAll(new RegExp(`(\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)\\s+(${DAMAGE_TYPES})\\s+damage`, "gi"))].map(m => ({ dice: m[1].replace(/\s+/g, ""), type: lc(m[2]) }));
    if (dmg.length && cat !== "ammo") { e.damageParts = dmg; found.push(`Damage ${dmg.map(d => `${d.dice} ${d.type}`).join(", ")}`); }
    if (cat !== "wand") e.autoDestroy = true;
    found.push(cap(cat === "ammo" ? "ammunition" : cat));
  } else if (["tool", "art-tool", "music", "game"].includes(cat)) {
    kind = "tool";
    const tp = lc(`${paren} ${name}`);
    e.toolType = { "art-tool": "art", music: "music", game: "game" }[cat]
      ?? (/artisan/.test(tp) ? "art" : /instrument|lute|drum|flute|horn|lyre|bagpipes|viol|pan flute|shawm/.test(tp) ? "music" : /gaming|dice set|playing card|dragonchess|three-dragon/.test(tp) ? "game" : "");
    const abil = text.match(new RegExp(`\\b(${ABILITIES.join("|")})\\b`, "i"));
    if (abil) e.ability = lc(abil[1]).slice(0, 3);
    found.push("Tool");
  } else if (cat === "container" || fields.capacity || (["gear", "wondrous"].includes(cat) && /\b(can hold up to|holds up to|can hold \d|capacity of)\b/i.test(text))) {
    kind = "container";
    const capText = `${fields.capacity ?? ""} ${text}`;
    const w = capText.match(/(\d[\d,]*)\s*(?:pounds|lb)/i);
    const v = capText.match(/(\d[\d,.]*)\s*cubic f(?:oo|ee)t/i);
    if (w) e.capacityWeight = Number(w[1].replace(/,/g, ""));
    if (v) e.capacityVolume = Number(v[1].replace(/,/g, ""));
    if (/(?:weighs?|weight is)\s+[\d.]+\s*(?:pounds|lb)[^.]*regardless of (?:its )?contents|contents don't add/i.test(text)) e.weightless = true;
    found.push(`Container${w ? ` ${e.capacityWeight} lb` : ""}${v ? ` ${e.capacityVolume} cu ft` : ""}`);
  } else if (["gem", "art", "treasure", "trade", "material", "gear"].includes(cat) && !e.rarity) {
    kind = "loot";
    e.lootType = cat;
    found.push(cat === "gear" ? "Adventuring gear" : cap(cat));
  } else {
    kind = "equipment";
    e.equipmentType = { ring: "ring", rod: "rod", clothing: "clothing", vehicle: "vehicle", trinket: "trinket" }[cat] ?? "wondrous";
    if (acBonus) { e.magicalBonus = Number(acBonus[1]); warnings.push(`"+${acBonus[1]} bonus to AC" needs an Active Effect on this kind of item`); }
    found.push(cap(e.equipmentType === "wondrous" ? "Wondrous item" : e.equipmentType));
  }

  // ---- Activity-level mechanics shared by all kinds
  if (save && kind !== "loot") {
    e.save = { dc: Number(save[1]), ability: lc(save[2]).slice(0, 3), onSave: /half as much/i.test(text) ? "half" : "none" };
    found.push(`DC ${e.save.dc} ${cap(save[2])} save`);
  }
  const act = parseActivation(text);
  if (act) e.activation = act;
  if (/\b(resistance|immunity) to\b|\bbonus to (?:AC|armor class|saving throws|ability checks)/i.test(text) && kind !== "armor")
    warnings.push("Passive bonuses (resistances, AC or save bonuses) stay as text: add an Active Effect if you want them automated");

  e.description = description.join("\n\n");
  if (!e.description) warnings.push("No description text");

  let rules = rulesOpt !== "auto" ? rulesOpt
    : (fields.mastery || /\b(Magic|Bonus|Utilize) action\b/.test(text) || /Requires Attunement/.test(typeLine ?? "")) ? "2024"
    : /\b[Aa]s an action\b|\bbonus action\b|\bAt Higher Levels\b/.test(text) ? "2014" : "2024";
  if (rules === "2014") e.mastery = null;
  e.rules = rules;
  return { kind, data: e, rules, found: unique(found), warnings };
}

/* -------------------------------------------- */
/*  Entry point                                 */
/* -------------------------------------------- */

/** Split a block holding several items: each type line that names a rarity starts a new item (name = line above). */
function splitItems(block) {
  const heads = block.map((l, i) => (i > 0 && isTypeLine(l) && RARITY_RE.test(l) ? i : -1)).filter(i => i >= 0);
  if (heads.length < 2) return [block];
  const starts = heads.map(h => { let i = h - 1; while (i > 0 && !block[i]) i--; return i; });
  if (starts[0] > 0 && block.slice(0, starts[0]).some(Boolean)) starts[0] = 0;
  return starts.map((s, i) => block.slice(s, starts[i + 1] ?? block.length));
}

/**
 * Parse pasted item text.
 * @param {string} raw
 * @param {{ rules?: "auto"|"2014"|"2024" }} [opts]
 */
export function parseItems(raw, opts = {}) {
  const lines = cleanText(raw);
  const blocks = [];
  let cur = [];
  for (const l of lines) {
    if (l === SPLIT) { if (cur.some(Boolean)) blocks.push(cur); cur = []; } else cur.push(l);
  }
  if (cur.some(Boolean)) blocks.push(cur);

  const results = [];
  for (const block of blocks) {
    for (const part of splitItems(block)) {
      try { results.push(parseItem(part, opts)); }
      catch (err) { results.push({ kind: null, data: { name: part.find(Boolean) }, rules: null, found: [], warnings: [`Parse error: ${err.message}`] }); }
    }
  }
  return results;
}
