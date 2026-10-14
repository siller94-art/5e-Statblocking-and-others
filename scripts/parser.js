/**
 * Statblock text parser for D&D 5e monsters, NPCs and familiars.
 * Reads 2014 and 2024 layouts copied from PDFs, websites (D&D Beyond), Homebrewery or plain notes.
 * Pure functions with no Foundry calls, so the live preview can run on every keystroke.
 */

export const SIZES = { tiny: "tiny", small: "sm", medium: "med", large: "lg", huge: "huge", gargantuan: "grg" };
export const CREATURE_TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"];
export const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
export const CONDITIONS = ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
export const ABILITIES = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
export const SKILLS = {
  acrobatics: "acr", "animal handling": "ani", arcana: "arc", athletics: "ath", deception: "dec", history: "his",
  insight: "ins", intimidation: "itm", investigation: "inv", medicine: "med", nature: "nat", perception: "prc",
  performance: "prf", persuasion: "per", religion: "rel", "sleight of hand": "slt", stealth: "ste", survival: "sur"
};

const DMG = DAMAGE_TYPES.join("|");
const ABIL_NAMES = Object.values(ABILITIES).join("|");
const SMALL_WORDS = new Set(["of", "the", "and", "to", "a", "an", "in", "on", "for", "with", "from", "or", "at", "by", "into"]);
const PRONOUN_START = /^(it|its|the|this|that|these|those|if|when|while|on|a|an|each|you|your|he|she|they|his|her|their|as|once|after|before|until|then|any|one|every|until)\b/i;

const TYPE_LINE = new RegExp(
  `^(tiny|small|medium|large|huge|gargantuan)(?:\\s+or\\s+(?:tiny|small|medium|large|huge|gargantuan))?\\s+`
  + `(?:swarm\\s+of\\s+(tiny|small|medium|large|huge)\\s+)?(${CREATURE_TYPES.join("|")})s?\\b(.*)$`, "i");

const STAT_LABEL = /^(armor class|armour class|ac|initiative|hit points|hp|speed|saving throws|saves|skills|damage vulnerabilities|damage resistances|damage immunities|condition immunities|vulnerabilities|resistances|immunities|senses|languages|challenge|cr|proficiency bonus|gear|habitat|treasure)\b/i;
const SECTION = /^(traits|actions|bonus actions|reactions|legendary actions|lair actions|mythic actions|regional effects|villain actions)\s*:?$/i;
const ABILITY_LINE = /^(?:(?:str|dex|con|int|wis|cha|mod|save)\b|[\d(+-])/i;

const lc = s => String(s ?? "").trim().toLowerCase();
const cap = s => String(s ?? "").replace(/\b\w/g, c => c.toUpperCase());
const unique = a => [...new Set(a)];
const mod = score => Math.floor((Number(score) - 10) / 2);

/* -------------------------------------------- */
/*  Text cleanup                                */
/* -------------------------------------------- */

export const SPLIT = "\u0000SPLIT";

function titled(name) {
  const words = name.trim().split(/\s+/);
  return words.every((w, i) => /^[A-Z0-9(]/.test(w) || (i > 0 && SMALL_WORDS.has(w.toLowerCase())));
}

/** "Fire Breath (Recharge 5-6). Text…" → { name, paren, text } */
export function entryStart(line, { strict = false } = {}) {
  const m = String(line ?? "").match(/^([A-Z][\w'’\-/]*(?:[ ][\w'’\-/]+){0,7}?)\s*(\([^)]{1,80}\))?\s*\.\s+(\S.*)$/);
  if (!m) return null;
  const name = m[1].trim();
  if (new RegExp(`${STAT_LABEL.source}$`, "i").test(name)) return null;
  if (/^(hit|miss|failure|success|trigger|response|at will|cantrips)$/i.test(name)) return null;
  const ok = titled(name) || (!strict && name.split(/\s+/).length <= 3 && !PRONOUN_START.test(name));
  return ok ? { name, paren: m[2]?.slice(1, -1).trim() ?? "", text: m[3].trim() } : null;
}

function structural(l) {
  return SECTION.test(l) || TYPE_LINE.test(l) || STAT_LABEL.test(l) || /^(str|dex|con|int|wis|cha|mod|save)\b/i.test(l);
}

export function cleanText(raw) {
  const t = String(raw ?? "")
    .replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[​-‍﻿]/g, "")
    .replace(/[−‒–—](?=\s*\d)/g, "-").replace(/(\d)\s*[‒–—]\s*(\d)/g, "$1-$2")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, "\"")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li|tr)>/gi, "\n").replace(/<\/t[dh]>/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  const lines = [];
  for (let line of t.split("\n")) {
    let s = line.trim().replace(/^>\s*/, "").trim();
    if (/^(-{3,}|\\page(break)?\b.*)$/i.test(s)) { lines.push(SPLIT); continue; }
    if (/^(\{\{.*|\}\}|:{1,}|_{3,}|\\column\b.*|\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?)$/.test(s)) { lines.push(""); continue; }
    if (/^\|.*\|$/.test(s)) s = s.split("|").map(x => x.trim()).filter(Boolean).join(" ");
    s = s.replace(/^#{1,6}\s*/, "").replace(/^[-*•]\s+/, "").replace(/\s*::\s*/g, " ")
      .replace(/(\*{1,3}|_{1,3})(\S(?:.*?\S)?)\1/g, "$2").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
    lines.push(s);
  }

  // Re-join lines that a PDF or website broke mid-sentence.
  const out = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (l && prev && prev !== SPLIT && l !== SPLIT) {
      if (/[a-z]-$/.test(prev) && /^[a-z]/.test(l)) { out[out.length - 1] = prev + l; continue; }
      if (!/[.:!?)\]"]$/.test(prev) && !structural(prev) && !structural(l) && !entryStart(l, { strict: true })) {
        out[out.length - 1] = `${prev} ${l}`;
        continue;
      }
    }
    out.push(l);
  }
  return out;
}

/* -------------------------------------------- */
/*  Small value parsers                         */
/* -------------------------------------------- */

const firstNum = s => { const m = String(s ?? "").match(/[+-]?\d+/); return m ? Number(m[0]) : null; };

function parseCR(s) {
  const m = String(s ?? "").match(/(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return m[1] ? Number(m[1]) / Number(m[2]) : Number(m[3]);
}

function parseSpeed(s) {
  const t = lc(s);
  const speed = {};
  const walk = t.match(/^(\d+)/) ?? t.match(/walk\s+(\d+)/);
  if (walk) speed.walk = Number(walk[1]);
  for (const m of t.matchAll(/(burrow|climb|fly|swim)\s+(\d+)/g)) speed[m[1]] = Number(m[2]);
  if (/hover/.test(t)) speed.hover = true;
  if (speed.walk == null && !Object.keys(speed).length) speed.walk = 30;
  speed.walk ??= 0;
  return speed;
}

function parseSenses(s) {
  const t = String(s ?? "");
  const ranges = {};
  for (const m of t.matchAll(/(blindsight|darkvision|tremorsense|truesight)\s+(\d+)/gi)) ranges[lc(m[1])] = Number(m[2]);
  const passive = t.match(/passive perception\s*:?\s*(\d+)/i);
  const special = t.replace(/(blindsight|darkvision|tremorsense|truesight)\s+\d+\s*(ft\.?|feet)?/gi, "")
    .replace(/[;,]?\s*passive perception\s*:?\s*\d+/i, "").replace(/^[\s,;]+|[\s,;]+$/g, "");
  return { ranges, passive: passive ? Number(passive[1]) : null, special: /[a-z]/i.test(special) ? special : "" };
}

/** "Dex +5, Con +9" / "Perception +13, Stealth +6" → { key: total } */
function parseBonusList(s, keyFor) {
  const out = {};
  for (const m of String(s ?? "").matchAll(/([A-Za-z][A-Za-z ]*?)\s*([+-]\d+)/g)) {
    const key = keyFor(lc(m[1]));
    if (key) out[key] = Number(m[2]);
  }
  return out;
}
const abilityKey = w => Object.keys(ABILITIES).find(k => w.startsWith(k)) ?? null;
const skillKey = w => SKILLS[w] ?? null;

/** Damage/condition trait line: "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks; Charmed" */
function parseTraitLine(s) {
  const t = String(s ?? "");
  const damage = DAMAGE_TYPES.filter(d => new RegExp(`\\b${d}\\b`, "i").test(t));
  const conditions = CONDITIONS.filter(c => new RegExp(`\\b${c}\\b`, "i").test(t));
  const bypasses = [];
  if (/nonmagical|non-magical|aren't magical|not magical/i.test(t)) {
    bypasses.push("mgc");
    if (/silver/i.test(t)) bypasses.push("sil");
    if (/adamantine/i.test(t)) bypasses.push("ada");
  }
  let rest = t;
  for (const w of [...DAMAGE_TYPES, ...CONDITIONS]) rest = rest.replace(new RegExp(`\\b${w}\\b`, "ig"), "");
  rest = rest.replace(/\b(from|nonmagical|non-magical|attacks?|that aren't|aren't|silvered|adamantine|magical|weapons?|and|or|damage)\b/gi, "")
    .replace(/[;,.\s]+/g, " ").trim();
  return { damage, conditions, bypasses, custom: rest.length > 2 ? t.trim() : "" };
}

/** "(Recharge 5-6)", "(3/Day)", "(Costs 2 Actions)", "(Recharges after a Short or Long Rest)" */
function parseUsage(paren) {
  const p = lc(paren);
  if (!p) return null;
  const recharge = p.match(/recharge\s*(\d)/);
  if (recharge) return { recharge: Number(recharge[1]) };
  const rest = p.match(/recharges? after a (short or long|long|short) rest/);
  if (rest) return { max: 1, per: rest[1] === "long" ? "lr" : "sr" };
  const day = p.match(/(\d+)\s*\/\s*day/);
  if (day) return { max: Number(day[1]), per: "day" };
  const cost = p.match(/costs?\s+(\d+)\s+actions?/);
  if (cost) return { cost: Number(cost[1]) };
  return null;
}

/* -------------------------------------------- */
/*  Abilities                                   */
/* -------------------------------------------- */

function parseAbilities(text) {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const scores = {}, saves = {};
  // 2014 header row: "STR DEX CON INT WIS CHA 18 (+4) 14 (+2) …"
  const header = t.match(/\bstr\b\s*\bdex\b\s*\bcon\b\s*\bint\b\s*\bwis\b\s*\bcha\b([\s\S]*)/i);
  if (header) {
    const nums = [...header[1].matchAll(/(\d{1,2})\s*\(\s*[+-]?\d+\s*\)/g)].map(m => Number(m[1]));
    if (nums.length >= 6) Object.keys(ABILITIES).forEach((k, i) => { scores[k] = nums[i]; });
  }
  // Per-ability: "Str 18 +4 +4" (2024 table), "STR 18 (+4)", "STR: 18"
  for (const k of Object.keys(ABILITIES)) {
    const m = t.match(new RegExp(`\\b(?:${k}|${ABILITIES[k]})\\b\\s*:?\\s*(\\d{1,2})\\b\\s*(?:\\(\\s*([+-]\\d+)\\s*\\))?(?:\\s*([+-]\\d+)\\s+([+-]\\d+))?`, "i"));
    if (!m) continue;
    scores[k] ??= Number(m[1]);
    if (m[3] != null && m[4] != null) saves[k] = Number(m[4]);
  }
  return { scores, saves };
}

/* -------------------------------------------- */
/*  Entry mechanics                             */
/* -------------------------------------------- */

function damageParts(text) {
  const parts = [], alternates = [];
  const re = new RegExp(`(\\d+)\\s*\\(\\s*(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)\\s*\\)\\s*(${DMG})\\s+damage|\\b(\\d+)\\s+(${DMG})\\s+damage`, "gi");
  for (const m of String(text ?? "").matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 5), m.index);
    const part = m[2] ? { dice: m[2].replace(/\s+/g, ""), average: Number(m[1]), type: lc(m[3]) } : { dice: m[4], average: Number(m[4]), type: lc(m[5]) };
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 80);
    if (/\bor\s*$/i.test(before)) alternates.push({ ...part, twoHanded: /two hands/i.test(after) });
    else if (/^\s*(?:,\s*)?(if|when|against|while|on a)\b/i.test(after)) parts.push({ ...part, condition: after.replace(/^[\s,]+/, "").split(/[.;]/)[0].trim() });
    else parts.push(part);
  }
  return { parts, alternates };
}

function parseArea(text) {
  const t = String(text ?? "");
  const m = t.match(/(\d+)-foot(?:[- ](?:radius|long))?[- ]?(cone|cube|line|sphere|cylinder|emanation|radius|square|wall)\b/i)
    ?? t.match(/(\d+)\s*(?:ft\.?|feet)\s+(cone|cube|line|sphere|cylinder|emanation)\b/i);
  if (!m) return null;
  const type = { emanation: "radius" }[lc(m[2])] ?? lc(m[2]);
  const width = t.match(/(\d+)\s*(?:feet|ft\.?)\s+wide/i)?.[1] ?? t.match(/(\d+)-foot-wide/i)?.[1] ?? (type === "line" ? "5" : "");
  return { type, size: m[1], width: type === "line" ? width : "" };
}

function parseMechanics(text) {
  const out = {};
  const t = String(text ?? "");
  const atk = t.match(/\b(melee or ranged|melee|ranged)\s+(weapon\s+|spell\s+)?attack(?:\s+roll)?\s*:\s*([+-]\d+)/i);
  if (atk) {
    const reach = t.match(/reach\s+(\d+)\s*(?:ft|feet)/i);
    const range = t.match(/range\s+(\d+)(?:\s*\/\s*(\d+))?\s*(?:ft|feet)/i);
    const hitStart = t.search(/\bhit\s*:/i);
    const hitEnd = hitStart >= 0 ? t.slice(hitStart).search(/\b(miss|hit or miss|failure|success)\s*:/i) : -1;
    const hitText = hitStart >= 0 ? t.slice(hitStart, hitEnd > 0 ? hitStart + hitEnd : undefined) : "";
    const dmg = damageParts(hitText);
    out.attack = {
      type: /ranged/i.test(atk[1]) && !/melee/i.test(atk[1]) ? "ranged" : "melee",
      both: /melee or ranged/i.test(atk[1]),
      spell: /spell/i.test(atk[2] ?? "") || /spell attack/i.test(t),
      bonus: Number(atk[3]),
      reach: reach ? Number(reach[1]) : null,
      range: range ? [Number(range[1]), range[2] ? Number(range[2]) : null] : null,
      damage: dmg.parts,
      versatile: dmg.alternates.find(a => a.twoHanded) ?? null
    };
  }
  const save = t.match(new RegExp(`DC\\s*(\\d+)\\s+(${ABIL_NAMES})\\s+saving throw`, "i"))
    ?? (() => { const m = t.match(new RegExp(`(${ABIL_NAMES})\\s+saving throw\\s*:\\s*DC\\s*(\\d+)`, "i")); return m ? [m[0], m[2], m[1]] : null; })();
  if (save) {
    const idx = t.indexOf(save[0]);
    const scope = out.attack ? t.slice(idx) : t;
    const after = out.attack ? damageParts(scope.replace(/\bhit\s*:[\s\S]*/i, "")).parts : damageParts(scope).parts;
    out.save = {
      dc: Number(save[1]), ability: lc(save[2]).slice(0, 3),
      onSave: /half as much damage|success\s*:\s*half/i.test(t) ? "half" : "none",
      damage: out.attack ? after.filter(p => !out.attack.damage.some(d => d.dice === p.dice && d.type === p.type)) : after
    };
  }
  const area = parseArea(t);
  if (area && (out.save || !out.attack)) out.area = area;
  const heal = t.match(/regains?\s+(\d+)\s*\(\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*\)\s+hit points/i);
  if (heal) out.heal = heal[2].replace(/\s+/g, "");
  if (!out.attack && !out.save) {
    const dmg = damageParts(t).parts;
    if (dmg.length) out.damage = dmg;
  }
  return out;
}

/* -------------------------------------------- */
/*  Spellcasting                                */
/* -------------------------------------------- */

const GROUP_RE = /(cantrips\s*\(at will\)|at will|(\d+)\s*\/\s*day(?:\s+each)?|(\d+)(?:st|nd|rd|th)[- ]level\s*\((\d+)\s+slots?\)|(\d+)(?:st|nd|rd|th)[- ]level\s*\(at will\))\s*:\s*/gi;

export function parseSpellcasting(name, text) {
  const t = String(text ?? "");
  const ability = (t.match(/spellcasting ability is (\w+)/i) ?? t.match(/using (\w+) as (?:the|its|their|his|her) spellcasting ability/i) ?? t.match(/(\w+) is (?:its|the|their|his|her) spellcasting ability/i))?.[1];
  const dc = t.match(/spell save DC\s*(\d+)/i);
  const atk = t.match(/([+-]\d+)\s*to hit with spell attacks/i);
  const level = t.match(/is an?\s+(\d+)(?:st|nd|rd|th)-level spellcaster/i);
  const groups = [];
  const marks = [...t.matchAll(GROUP_RE)];
  marks.forEach((m, i) => {
    const body = t.slice(m.index + m[0].length, marks[i + 1]?.index ?? t.length);
    const spells = body.split(/,|;/).map(raw => {
      const upcast = raw.match(/level\s+(\d)\s+version|(\d)(?:st|nd|rd|th)[- ]level version/i);
      const name = raw.replace(/\([^)]*\)/g, "").replace(/\*/g, "").replace(/\b(?:only|each)\b\s*$/i, "")
        .replace(/[.\s]+$/g, "").replace(/^\s*(?:and|or)\s+/i, "").trim();
      return { name, level: upcast ? Number(upcast[1] ?? upcast[2]) : null };
    }).filter(s => s.name && s.name.length < 40 && /^[a-z]/i.test(s.name) && !/\b(the|following|spells?|prepared|innately)\b.*\b(can|has|cast)\b/i.test(s.name));
    const g = { spells };
    if (m[2]) { g.perDay = Number(m[2]); }
    else if (m[4]) { g.level = Number(m[3]); g.slots = Number(m[4]); }
    else if (m[5]) { g.level = Number(m[5]); g.atWill = true; }
    else g.atWill = true;
    if (/^cantrips/i.test(m[1])) g.cantrips = true;
    if (spells.length) groups.push(g);
  });
  return {
    name,
    ability: ability ? (abilityKey(lc(ability)) ?? "") : "",
    dc: dc ? Number(dc[1]) : null,
    attack: atk ? Number(atk[1]) : null,
    casterLevel: level ? Number(level[1]) : null,
    innate: /innate/i.test(name) || /innately|requiring no material components/i.test(t),
    noMaterial: /requiring no material components|no material components/i.test(t),
    groups,
    intro: marks.length ? t.slice(0, marks[0].index).trim() : t.trim()
  };
}

/* -------------------------------------------- */
/*  Statblock                                   */
/* -------------------------------------------- */

const SECTION_KEY = { traits: "trait", actions: "action", "bonus actions": "bonus", reactions: "reaction", "legendary actions": "legendary", "lair actions": "lair", "mythic actions": "mythic", "regional effects": "regional", "villain actions": "villain" };

function parseStatblock(lines, { rules: rulesOpt = "auto" } = {}) {
  const found = [], warnings = [];
  const e = { abilities: {}, saves: {}, skills: {}, entries: [], spellcasting: [], lore: [], gear: [] };
  const L = lines.filter(l => l !== SPLIT);

  // ---- Name and type line
  const typeIdx = L.findIndex(l => TYPE_LINE.test(l));
  let i = 0;
  if (typeIdx >= 0) {
    let nameIdx = typeIdx - 1;
    while (nameIdx >= 0 && !L[nameIdx]) nameIdx--;
    e.name = (L[nameIdx] ?? "Unnamed Creature").replace(/^name\s*:\s*/i, "").trim();
    e.lore.push(...L.slice(0, Math.max(0, nameIdx)).filter(Boolean));
    const m = L[typeIdx].match(TYPE_LINE);
    e.size = SIZES[lc(m[1])];
    if (m[2]) e.swarm = SIZES[lc(m[2])];
    e.type = lc(m[3]);
    const rest = m[4] ?? "";
    const sub = rest.match(/^\s*\(([^)]*)\)/);
    if (sub) e.subtype = sub[1].trim();
    const align = rest.replace(/^\s*\([^)]*\)/, "").replace(/^\s*,\s*/, "").trim();
    if (align) e.alignment = cap(align.replace(/[.;]$/, ""));
    found.push(`${cap(m[1])} ${cap(e.type)}${e.swarm ? " swarm" : ""}`);
    i = typeIdx + 1;
  } else {
    const first = L.findIndex(Boolean);
    e.name = (L[first] ?? "Unnamed Creature").replace(/^name\s*:\s*/i, "").trim();
    i = first + 1;
    warnings.push("No size/type line (e.g. \"Medium Humanoid, Neutral\"): set size and type on the sheet");
  }

  // ---- Stat lines
  const abilityText = [];
  let rules2024 = 0, rules2014 = 0;
  for (; i < L.length; i++) {
    const l = L[i];
    if (!l) continue;
    if (SECTION.test(l)) break;
    const label = l.match(STAT_LABEL)?.[1]?.toLowerCase();
    if (!label) {
      if (ABILITY_LINE.test(l) && !entryStart(l)) { abilityText.push(l); continue; }
      if (e.hp == null && e.ac == null) { e.lore.push(l); continue; }
      break;
    }
    const val = l.slice(label.length).replace(/^\s*:?\s*/, "");
    if (["armor class", "armour class", "ac"].includes(label)) {
      const m = val.match(/^(\d+)\s*(?:\(([^)]*)\))?/);
      if (m) { e.ac = Number(m[1]); e.acNote = m[2] ?? ""; e.natural = /natural/i.test(m[2] ?? ""); found.push(`AC ${e.ac}`); }
      if (label === "ac") rules2024++; else rules2014++;
      const init = l.match(/initiative\s*:?\s*([+-]\d+)/i);
      if (init) { e.init = Number(init[1]); rules2024++; }
    } else if (label === "initiative") { e.init = firstNum(val); rules2024++; }
    else if (label === "hit points" || label === "hp") {
      const m = val.match(/^(\d+)\s*(?:\(([^)]*)\))?/);
      if (m) { e.hp = Number(m[1]); e.hpFormula = (m[2] ?? "").replace(/\s+/g, ""); found.push(`HP ${e.hp}${e.hpFormula ? ` (${e.hpFormula})` : ""}`); }
    } else if (label === "speed") { e.speed = parseSpeed(val); found.push(`Speed ${e.speed.walk} ft${Object.keys(e.speed).length > 1 ? "+" : ""}`); }
    else if (label === "saving throws" || label === "saves") { e.saves = { ...e.saves, ...parseBonusList(val, abilityKey) }; found.push("Saves"); }
    else if (label === "skills") { e.skills = parseBonusList(val, skillKey); found.push("Skills"); }
    else if (/vulnerabilities/.test(label)) { e.dv = parseTraitLine(val); found.push("Vulnerabilities"); }
    else if (/resistances/.test(label)) { e.dr = parseTraitLine(val); found.push("Resistances"); }
    else if (label === "condition immunities") { e.ci = parseTraitLine(val); found.push("Condition immunities"); }
    else if (/immunities/.test(label)) {
      const t = parseTraitLine(val);
      e.di = { ...t, conditions: [] };
      if (t.conditions.length) e.ci = { damage: [], conditions: unique([...(e.ci?.conditions ?? []), ...t.conditions]), bypasses: [], custom: "" };
      found.push("Immunities");
    } else if (label === "senses") { e.senses = parseSenses(val); if (Object.keys(e.senses.ranges).length) found.push("Senses"); }
    else if (label === "languages") {
      e.languages = /^(—|-|none)$/i.test(val.trim()) ? "" : val.trim();
      const tele = val.match(/telepathy\s+(\d+)/i);
      if (tele) e.telepathy = Number(tele[1]);
      if (e.languages) found.push("Languages");
    } else if (label === "challenge" || label === "cr") {
      e.cr = parseCR(val);
      const xp = val.match(/(?:xp\s*)?([\d,]+)\s*xp|xp\s*([\d,]+)/i);
      if (xp) e.xp = Number((xp[1] ?? xp[2]).replace(/,/g, ""));
      const pb = val.match(/pb\s*\+?(\d+)/i);
      if (pb) e.pb = Number(pb[1]);
      if (label === "cr") rules2024++; else rules2014++;
      if (e.cr != null) found.push(`CR ${val.match(/\d+\s*\/\s*\d+|\d+(?:\.\d+)?/)?.[0].replace(/\s+/g, "")}`);
    } else if (label === "proficiency bonus") { e.pb = firstNum(val); }
    else if (label === "gear") { e.gear = val.split(/,\s*/).map(s => s.trim()).filter(Boolean); rules2024++; }
    else if (label === "habitat" || label === "treasure") { e.lore.push(`${cap(label)}: ${val}`); }
  }

  const ab = parseAbilities(abilityText.join(" ") || L.join(" "));
  e.abilities = ab.scores;
  if (Object.keys(ab.saves).length) { rules2024++; for (const [k, v] of Object.entries(ab.saves)) if (v !== mod(ab.scores[k])) e.saves[k] = v; }
  if (Object.keys(ab.scores).length === 6) found.push("Abilities");
  else warnings.push(`Only ${Object.keys(ab.scores).length} of 6 ability scores found`);
  if (e.ac == null) warnings.push("No Armor Class found");
  if (e.hp == null) warnings.push("No Hit Points found");
  if (e.cr == null) warnings.push("No Challenge Rating found");
  e.speed ??= { walk: 30 };

  // ---- Traits, actions and the rest
  let section = "trait";
  let cur = null;
  const intro = { legendary: [], lair: [], mythic: [] };
  for (; i < L.length; i++) {
    const l = L[i];
    if (!l) continue;
    const sec = l.match(SECTION);
    if (sec) { section = SECTION_KEY[lc(sec[1])]; cur = null; if (section === "trait") {} continue; }
    if (["legendary", "lair", "mythic"].includes(section)) {
      const uses = l.match(/legendary action uses\s*:\s*(\d+)(?:\s*\((\d+)\s+in lair\))?/i) ?? l.match(/can take (\d+) legendary actions/i);
      if (uses) { e.legendary = { max: Number(uses[1]), lair: uses[2] ? Number(uses[2]) : null }; intro.legendary.push(l); cur = null; continue; }
      if (section === "legendary" && !cur && !entryStart(l)) { intro.legendary.push(l); continue; }
      if (section === "lair" && !entryStart(l) && !cur) { intro.lair.push(l); continue; }
    }
    if (["regional", "villain"].includes(section)) { e.lore.push(l); continue; }
    const st = entryStart(l);
    if (st) {
      cur = { section, name: st.name, paren: st.paren, text: st.text };
      e.entries.push(cur);
      continue;
    }
    if (cur) cur.text += `\n${l}`;
    else if (intro[section]) intro[section].push(l);
    else e.lore.push(l);
  }
  if (intro.legendary.length) e.legendaryIntro = intro.legendary.join("\n");
  if (intro.lair.length || e.entries.some(x => x.section === "lair") || e.legendary?.lair || /\bin lair\b/i.test(L.join(" "))) {
    e.lair = true; e.lairIntro = intro.lair.join("\n");
  }

  // ---- Per-entry mechanics
  for (const en of e.entries) {
    const usage = parseUsage(en.paren);
    if (usage) en.usage = usage;
    else if (en.paren) en.name = `${en.name} (${en.paren})`;
    if (/spellcasting/i.test(en.name)) {
      const sc = parseSpellcasting(en.name, en.text);
      en.spellcasting = sc;
      e.spellcasting.push(sc);
      const n = sc.groups.reduce((a, g) => a + g.spells.length, 0);
      found.push(`${en.name}: ${n} spell${n === 1 ? "" : "s"}`);
      if (!n) warnings.push(`${en.name}: no spell list found`);
      continue;
    }
    Object.assign(en, parseMechanics(en.text));
    const cast = en.text.match(/uses?\s+(?:its\s+)?Spellcasting to cast\s+([A-Za-z][\w' ]*?)\s*(?:\((?:level\s+(\d)\s+version|(\d)(?:st|nd|rd|th)[- ]level version)\))?\s*[.,]/i);
    if (cast) en.castSpell = { name: cast[1].trim(), level: cast[2] || cast[3] ? Number(cast[2] ?? cast[3]) : null };
    if (/^legendary resistance/i.test(en.name) && usage?.max) e.legres = usage.max;
  }
  if (e.legres) found.push(`Legendary resistance ${e.legres}`);
  if (e.legendary) found.push(`Legendary actions ${e.legendary.max}`);
  else if (e.entries.some(x => x.section === "legendary")) { e.legendary = { max: 3 }; warnings.push("Legendary action count not found: set to 3"); }
  if (e.lair) found.push("Lair");

  const counts = {};
  for (const en of e.entries) counts[en.section] = (counts[en.section] ?? 0) + 1;
  e.counts = counts;
  if (!e.entries.length) warnings.push("No traits or actions found");
  const attacks = e.entries.filter(x => x.attack);
  for (const a of attacks) if (!a.attack.damage.length && !/grapple|net|restrain/i.test(a.text)) warnings.push(`${a.name}: attack found but no damage`);

  if (/\bAttack Roll:|Saving Throw:\s*DC|Legendary Action Uses/.test(L.join("\n"))) rules2024 += 2;
  if (/Weapon Attack:|to hit,|saving throw, taking/.test(L.join("\n"))) rules2014 += 2;
  e.rules = rulesOpt !== "auto" ? rulesOpt : rules2024 > rules2014 ? "2024" : rules2014 > rules2024 ? "2014" : "2024";

  e.lore = e.lore.filter(Boolean);
  e.source = L.filter(Boolean).join("\n");
  return { data: e, rules: e.rules, found: unique(found), warnings: unique(warnings) };
}

/* -------------------------------------------- */
/*  Entry point                                 */
/* -------------------------------------------- */

/** Split a block that holds several statblocks: each size/type line starts a new one (the line above it is the name). */
function splitStatblocks(block) {
  const heads = block.map((l, i) => (TYPE_LINE.test(l) ? i : -1)).filter(i => i >= 0);
  if (heads.length < 2) return [block];
  const starts = heads.map(h => { let i = h - 1; while (i > 0 && !block[i]) i--; return Math.max(0, i); });
  starts[0] = 0;
  return starts.map((s, k) => block.slice(s, starts[k + 1] ?? block.length));
}

/**
 * Parse pasted statblock text.
 * @param {string} raw
 * @param {{ rules?: "auto"|"2014"|"2024" }} [opts]
 * @returns {{ data: object, rules: string, found: string[], warnings: string[] }[]}
 */
export function parseStatblocks(raw, opts = {}) {
  const lines = cleanText(raw);
  const blocks = [];
  let cur = [];
  for (const l of lines) {
    if (l === SPLIT) { if (cur.some(Boolean)) blocks.push(cur); cur = []; } else cur.push(l);
  }
  if (cur.some(Boolean)) blocks.push(cur);
  const out = [];
  for (const block of blocks) {
    for (const part of splitStatblocks(block)) {
      try { out.push(parseStatblock(part, opts)); }
      catch (err) { out.push({ data: { name: part.find(Boolean) ?? "Unknown" }, rules: null, found: [], warnings: [`Parse error: ${err.message}`], error: true }); }
    }
  }
  return out;
}
