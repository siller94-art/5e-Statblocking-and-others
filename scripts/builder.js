/**
 * Builds dnd5e 6 NPC actors from parsed statblocks and writes them to the world or a compendium.
 * Follows the structure of the official dnd5e monsters: features are "monster" feats with activities,
 * recharge and X/Day features use item uses, legendary actions spend resources.legact. Listed spells are
 * copied from your compendiums onto the actor at their own level (cantrips, 1st level…), innate and at-will
 * spells go to their own sections, and weapons and gear named in the statblock land in the inventory.
 */

import { ABILITIES } from "./parser.js";
import { iconFor } from "./icons.js";

export const MODULE_ID = "statblock-5e";

export const KINDS = {
  monster: { label: "Monster", folder: "Monsters", disposition: -1, actorLink: false },
  npc: { label: "NPC", folder: "NPCs", disposition: 0, actorLink: false },
  familiar: { label: "Familiar", folder: "Familiars", disposition: 1, actorLink: true }
};

const ACTIVATION = { trait: "special", action: "action", bonus: "bonus", reaction: "reaction", legendary: "legendary", lair: "lair", mythic: "mythic" };
const TOKEN_SIZE = { tiny: 0.5, sm: 1, med: 1, lg: 2, huge: 3, grg: 4 };

export const escapeHTML = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rid = () => foundry.utils.randomID();
const slugify = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const mod = score => Math.floor((Number(score ?? 10) - 10) / 2);
const signed = n => (n >= 0 ? `+${n}` : String(n));

function profFromCR(cr) {
  if (cr == null || cr < 5) return 2;
  return Math.floor((cr + 7) / 4);
}

/** Printed initiative → bonus over Dex, written as "@prof" / "@prof * 2" when it is proficiency or expertise. */
function initBonus(printed, dexMod, pb) {
  if (printed == null) return "";
  const diff = printed - dexMod;
  if (!diff) return "";
  if (diff === pb) return "@prof";
  if (diff === 2 * pb) return "@prof * 2";
  return signed(diff);
}

function paragraphs(text) {
  return String(text ?? "").split(/\n+/).filter(Boolean).map(p => `<p>${escapeHTML(p)}</p>`).join("");
}

/* -------------------------------------------- */
/*  Damage, targets, activities                 */
/* -------------------------------------------- */

function damagePart(p) {
  const m = String(p.dice).match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (m) return { number: Number(m[1]), denomination: Number(m[2]), bonus: m[3] ? m[3].replace(/^\+/, "") : "", types: [p.type], custom: { enabled: false, formula: "" }, scaling: { number: 1 } };
  return { number: null, denomination: null, bonus: "", types: [p.type], custom: { enabled: true, formula: String(p.dice) }, scaling: { number: 1 } };
}

function baseActivity(type, en, extra = {}) {
  const actType = ACTIVATION[en.section] ?? "action";
  const a = {
    _id: rid(), type, name: "",
    activation: { type: actType, value: actType === "special" ? null : (en.usage?.cost ?? 1), condition: "", override: false },
    consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: true },
    ...extra
  };
  if (en.section === "legendary") {
    a.consumption.targets.push({ type: "attribute", target: "resources.legact.value", value: String(en.usage?.cost ?? 1), scaling: {} });
  } else if (/^legendary resistance/i.test(en.name)) {
    a.activation = { type: "special", value: null, condition: "fails a saving throw", override: false };
    a.consumption.targets.push({ type: "attribute", target: "resources.legres.value", value: "1", scaling: {} });
  } else if (en.usage && !en.usage.cost) {
    a.consumption.targets.push({ type: "itemUses", target: "", value: "1", scaling: {} });
  }
  return a;
}

function rangeFor(atk) {
  if (atk.range && !atk.both) return { value: String(atk.range[0]), long: atk.range[1] != null ? String(atk.range[1]) : "", units: "ft", special: "", override: true };
  if (atk.reach) return { value: String(atk.reach), units: "ft", special: "", override: true };
  return { units: "", special: "", override: false };
}

function targetFor(area) {
  if (!area) return { template: { type: "" }, affects: { count: "", type: "" }, prompt: true, override: false };
  return {
    template: { count: "", contiguous: false, type: area.type, size: String(area.size), width: area.width ? String(area.width) : "", height: "", units: "ft" },
    affects: { count: "", type: "creature", choice: false, special: "" }, prompt: true, override: true
  };
}

function attackActivities(en) {
  const atk = en.attack;
  const always = atk.damage.filter(p => !p.condition);
  const conditional = atk.damage.filter(p => p.condition);
  const make = (name, parts, extra = {}) => baseActivity("attack", en, {
    name,
    attack: { ability: "", bonus: String(atk.bonus), flat: true, critical: { threshold: null }, type: { value: atk.type, classification: atk.spell ? "spell" : "weapon" } },
    damage: { includeBase: false, critical: { bonus: "" }, parts: parts.map(damagePart) },
    range: rangeFor(atk),
    ...extra
  });
  const out = [make("", always)];
  if (atk.both && atk.range) {
    out.push(make("Ranged", always, {
      attack: { ...out[0].attack, type: { value: "ranged", classification: out[0].attack.type.classification } },
      range: { value: String(atk.range[0]), long: atk.range[1] != null ? String(atk.range[1]) : "", units: "ft", special: "", override: true }
    }));
  }
  if (atk.versatile) out.push(make("Two-Handed", [atk.versatile, ...always.slice(1)]));
  if (conditional.length) {
    const cond = conditional[0].condition.replace(/^if\s+/i, "");
    out.push(make(`With extra damage (${cond.slice(0, 40)})`, [...always, ...conditional]));
  }
  // Every attack activity after the first shares the item's uses only once.
  return out;
}

function saveActivity(en, s, area) {
  return baseActivity("save", en, {
    save: { ability: [s.ability], dc: { calculation: "", formula: String(s.dc) } },
    damage: { onSave: s.onSave ?? "none", parts: (s.damage ?? []).map(damagePart) },
    target: targetFor(area)
  });
}

/* -------------------------------------------- */
/*  Spells                                      */
/* -------------------------------------------- */

const normName = s => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

/** Map of spell name → uuid, preferring the edition's SRD pack, then the world, then other compendiums. */
export async function buildSpellIndex(rules) {
  const map = new Map();
  const add = (name, uuid) => { const k = normName(name); if (!map.has(k)) map.set(k, uuid); };
  const preferred = rules === "2014" ? ["dnd5e.spells", "dnd5e.spells24"] : ["dnd5e.spells24", "dnd5e.spells"];
  const packs = game.packs.filter(p => p.documentName === "Item")
    .sort((a, b) => {
      const ra = preferred.indexOf(a.collection), rb = preferred.indexOf(b.collection);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    });
  const [first, ...rest] = packs;
  const indexPack = async pack => {
    const index = await pack.getIndex({ fields: ["type"] });
    for (const e of index) if (e.type === "spell") add(e.name, e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`);
  };
  if (first && preferred.includes(first.collection)) await indexPack(first);
  for (const i of game.items.filter(i => i.type === "spell")) add(i.name, i.uuid);
  for (const pack of (first && preferred.includes(first.collection) ? rest : packs)) await indexPack(pack);
  return map;
}

function findSpell(index, name) {
  const n = normName(name);
  return index.get(n)
    ?? index.get(n.replace(/^[a-z]+'s\s+/, ""))          // "Tasha's Hideous Laughter" → "Hideous Laughter"
    ?? index.get(n.replace(/\s*\(.*\)$/, ""))
    ?? null;
}

function castActivity(en, sc, spell, uuid, group) {
  const a = baseActivity("cast", { ...en, usage: null }, {
    spell: {
      uuid, level: spell.level ?? null, ability: sc.ability ?? "",
      properties: sc.noMaterial ? ["vocal", "somatic"] : ["vocal", "somatic", "material"],
      spellbook: true,
      challenge: {
        attack: sc.attack != null ? String(sc.attack) : null,
        save: sc.dc != null ? String(sc.dc) : null,
        override: sc.attack != null || sc.dc != null
      }
    }
  });
  if (en.section === "trait") a.activation = { type: "action", value: 1, condition: "", override: false };
  if (group?.perDay) {
    a.uses = { spent: 0, max: String(group.perDay), recovery: [{ period: "day", type: "recoverAll" }] };
    a.consumption = { targets: [{ type: "activityUses", target: "", value: "1", scaling: {} }], scaling: { allowed: false, max: "" }, spellSlot: false };
  } else if (!group?.slots) {
    a.consumption.spellSlot = false;   // at will
  }
  return a;
}

/* -------------------------------------------- */
/*  Items                                       */
/* -------------------------------------------- */

const ITEM_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container"]);

/** Map of item name → { uuid, type }, preferring the edition's SRD equipment, then the world, then other compendiums. */
export async function buildItemIndex(rules) {
  const map = new Map();
  const add = (name, type, uuid) => { const k = normName(name); if (!map.has(k)) map.set(k, { uuid, type }); };
  const preferred = rules === "2014" ? ["dnd5e.items", "dnd5e.equipment24"] : ["dnd5e.equipment24", "dnd5e.items"];
  const indexPack = async pack => {
    const index = await pack.getIndex({ fields: ["type"] });
    for (const e of index) if (ITEM_TYPES.has(e.type)) add(e.name, e.type, e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`);
  };
  for (const c of preferred) { const pack = game.packs.get(c); if (pack) await indexPack(pack); }
  for (const i of game.items.filter(i => ITEM_TYPES.has(i.type))) add(i.name, i.type, i.uuid);
  for (const pack of game.packs.filter(p => p.documentName === "Item" && !preferred.includes(p.collection))) await indexPack(pack);
  return map;
}

const WEAPON_RE = /\b(dagger|club|greatclub|handaxe|javelin|light hammer|mace|quarterstaff|staff|sickle|spear|crossbow|dart|shortbow|sling|battleaxe|flail|glaive|greataxe|greatsword|halberd|lance|longsword|maul|morningstar|pike|rapier|scimitar|shortsword|trident|war pick|warhammer|whip|blowgun|longbow|musket|pistol|sword|axe)s?\b/i;
const MAGIC_ITEM_RE = /^(cloak|ring|amulet|boots|bracers|gloves|gauntlets|belt|helm|circlet|robe|mantle|cape|headband|periapt|necklace|brooch|medallion|wand|rod|orb|ioun stone|bag|stone|talisman|crown|mask|goggles|eyes|slippers|wings|staff|shield|armor|plate|potion|elixir|tome|manual|horn|figurine|lantern|mirror|censer|bowl|brazier|cube|carpet|broom|sphere|scarab|ioun)\b.*\bof\b/i;
const ARMOR = [[/\b(padded|leather|studded)\b/i, "light"], [/\b(hide|chain shirt|scale|breastplate|half plate)\b/i, "medium"], [/\b(ring mail|chain mail|splint|plate)\b/i, "heavy"], [/\bshield\b/i, "shield"]];
const titleCase = s => String(s).trim().replace(/\b([a-z])(\w*)/g, (m, a, b, i) => (i > 0 && SMALL.has(m) ? m : a.toUpperCase() + b));
const SMALL = new Set(["of", "the", "and", "a", "an", "in", "on", "with"]);

/** "Dagger +2" → { hit for "Dagger", bonus 2 }; "Dagger of Venom" → exact hit. */
function findItem(index, name, types) {
  const n = normName(name);
  const bonus = Number(n.match(/(?:^|\s)\+(\d)\b/)?.[1] ?? 0);
  const bases = [n, n.replace(/\s*\(.*\)$/, ""), n.replace(/\s*,?\s*\+\d\b/g, "").replace(/\s*\(.*\)$/, "").trim()];
  for (const b of bases) {
    const hit = index?.get(b);
    if (hit && (!types || types.includes(hit.type))) return { ...hit, bonus, exact: b === n };
  }
  return { uuid: null, type: null, bonus, exact: false };
}

function equipmentType(name) {
  for (const [re, t] of ARMOR) if (re.test(name)) return t;
  if (/^ring\b/i.test(name)) return "ring";
  if (/^(cloak|robe|mantle|cape|boots|gloves|bracers|belt|slippers)\b/i.test(name)) return "clothing";
  return /\bof\b/i.test(name) ? "wondrous" : "trinket";
}

function weaponItem(en, ctx, feat, hit) {
  const ranged = en.attack.type === "ranged";
  const props = hit.bonus ? ["mgc"] : [];
  const data = {
    name: en.name, type: "weapon", img: feat.img,
    system: {
      description: feat.system.description, identifier: feat.system.identifier, source: ctx.source,
      type: { value: ranged ? "simpleR" : "simpleM", baseItem: "" }, properties: props,
      quantity: 1, equipped: true, proficient: 1, magicalBonus: null,
      uses: feat.system.uses, activities: feat.system.activities
    },
    flags: feat.flags
  };
  if (!hit.uuid) return { data };
  const overlay = { name: en.name, system: { description: feat.system.description, quantity: 1, equipped: true, proficient: 1, magicalBonus: null, uses: feat.system.uses, activities: feat.system.activities }, flags: feat.flags };
  return { ref: hit.uuid, overlay, data, addProps: props, replaceActivities: true, kind: "weapon" };
}

function gearItem(name, ctx, { text = "", activities = {}, uses = null, section = "gear" } = {}) {
  const hit = findItem(ctx.items, name, ["equipment", "consumable", "loot", "container", "tool", "weapon"]);
  const nice = /[A-Z]/.test(name) ? name : titleCase(name);
  const data = {
    name: nice, type: "equipment", img: "icons/svg/item-bag.svg",
    system: {
      description: { value: text ? paragraphs(text) : "", chat: "" }, identifier: slugify(nice), source: ctx.source,
      type: { value: equipmentType(nice), baseItem: "" }, quantity: 1, equipped: true,
      ...(uses ? { uses } : {}), activities
    },
    flags: { [MODULE_ID]: { section } }
  };
  if (!hit.uuid) return { data };
  const overlay = { name: nice, system: { quantity: 1, equipped: true }, flags: data.flags };
  if (text) overlay.system.description = data.system.description;
  if (Object.keys(activities).length) overlay.system.activities = activities;
  if (uses) overlay.system.uses = uses;
  return { ref: hit.uuid, overlay, data, replaceActivities: !!Object.keys(activities).length, kind: "gear" };
}

function usesFor(en) {
  const u = en.usage;
  if (!u || u.cost) return { spent: 0, max: "", recovery: [] };
  if (/^legendary resistance/i.test(en.name)) return { spent: 0, max: "", recovery: [] };
  if (u.recharge) return { spent: 0, max: "1", recovery: [{ period: "recharge", formula: String(u.recharge), type: "recoverAll" }] };
  return { spent: 0, max: String(u.max ?? 1), recovery: [{ period: u.per ?? "day", type: "recoverAll" }] };
}

function featureItem(en, ctx) {
  const activities = [];
  let kind = "feature";
  const rider = a => { a.consumption.targets = []; return a; };   // follow-up rolls don't spend the action again
  if (en.attack) {
    activities.push(...attackActivities(en));
    kind = "attack";
    if (en.save) activities.push(rider(saveActivity(en, en.save, en.area)));
  } else if (en.save) {
    activities.push(saveActivity(en, en.save, en.area));
    kind = "save";
  } else if (en.castSpell) {
    const uuid = findSpell(ctx.spells, en.castSpell.name);
    const sc = ctx.spellcasting ?? {};
    if (uuid) { activities.push(castActivity(en, sc, en.castSpell, uuid, null)); kind = "cast"; }
    else ctx.warnings.push(`${en.name}: spell "${en.castSpell.name}" not found in your compendiums`);
  } else if (en.heal) {
    activities.push(baseActivity("heal", en, { healing: damagePart({ dice: en.heal, type: "healing" }) }));
    kind = "heal";
  } else if (en.damage?.length) {
    activities.push(baseActivity("damage", en, { damage: { parts: en.damage.map(damagePart) }, target: targetFor(en.area) }));
  }
  if (en.heal && kind !== "heal") activities.push(rider(baseActivity("heal", en, { healing: damagePart({ dice: en.heal, type: "healing" }) })));
  if (!activities.length && (en.section !== "trait" || en.usage)) activities.push(baseActivity("utility", en));

  const usage = en.usage?.recharge ? ` (Recharge ${en.usage.recharge}${en.usage.recharge < 6 ? "-6" : ""})`
    : en.usage?.max && !/^legendary resistance/i.test(en.name) ? ` (${en.usage.max}/${en.usage.per === "day" ? "Day" : en.usage.per === "lr" ? "Long Rest" : "Short Rest"})`
    : en.usage?.cost > 1 ? ` (Costs ${en.usage.cost} Actions)` : "";
  return {
    name: en.name, type: "feat", img: iconFor(en.name, kind),
    system: {
      description: { value: paragraphs(en.text), chat: "" },
      identifier: slugify(en.name),
      source: ctx.source,
      type: { value: "monster", subtype: "" },
      uses: usesFor(en),
      activities: Object.fromEntries(activities.map(a => [a._id, a]))
    },
    flags: { [MODULE_ID]: { section: en.section, usageLabel: usage.trim() } }
  };
}

/**
 * Spells go straight onto the actor (not through Cast activities, which dnd5e files under "Additional Spells").
 * Slot spells and cantrips use the "spell" method so the sheet shows them under their level; at-will and
 * X/Day spells use the "atwill" and "innate" methods. The printed DC and attack come from actor bonuses.
 */
function spellRefs(en, ctx) {
  const sc = en.spellcasting;
  const missing = [];
  const seen = new Set();
  for (const g of sc.groups) {
    for (const spell of g.spells) {
      const uuid = findSpell(ctx.spells, spell.name);
      if (!uuid) { missing.push(spell.name); continue; }
      if (seen.has(uuid)) continue;
      seen.add(uuid);
      const slotted = g.slots || g.cantrips || (!sc.innate && sc.casterLevel && !g.perDay && !g.level);
      const method = slotted ? "spell" : g.perDay ? "innate" : "atwill";
      const overlay = { system: { method, prepared: slotted ? 1 : 0 }, flags: { [MODULE_ID]: { spellcasting: en.name } } };
      if (g.perDay) overlay.system.uses = { spent: 0, max: String(g.perDay), recovery: [{ period: "day", type: "recoverAll" }] };
      ctx.refs.push({ ref: uuid, overlay, consumeUses: !!g.perDay, kind: "spell" });
    }
  }
  if (missing.length) ctx.warnings.push(`${en.name}: not found in your compendiums, left as text: ${missing.join(", ")}`);
}

function spellcastingItem(en, ctx) {
  spellRefs(en, ctx);
  const activities = [];
  return {
    name: en.name, type: "feat", img: iconFor("spellcasting", "cast"),
    system: {
      description: { value: paragraphs(en.text), chat: "" },
      identifier: slugify(en.name),
      source: ctx.source,
      type: { value: "monster", subtype: "" },
      uses: { spent: 0, max: "", recovery: [] },
      activities: Object.fromEntries(activities.map(a => [a._id, a]))
    },
    flags: { [MODULE_ID]: { section: en.section } }
  };
}

/* -------------------------------------------- */
/*  Actor                                       */
/* -------------------------------------------- */

function languageData(raw, telepathy) {
  const out = { value: [], custom: "", communication: {} };
  if (telepathy) out.communication.telepathy = { value: telepathy, units: "ft" };
  if (!raw) return out;
  const labels = {};
  const walk = (obj, prefix = "") => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const label = typeof v === "string" ? v : v?.label;
      if (label) labels[game.i18n.localize(label).toLowerCase()] = k;
      if (v?.children) walk(v.children, prefix);
    }
  };
  walk(CONFIG.DND5E.languages);
  const leftovers = [];
  for (const part of raw.split(/,|;/).map(s => s.trim()).filter(Boolean)) {
    if (/^telepathy\b/i.test(part)) continue;
    const key = labels[part.toLowerCase()];
    if (key) out.value.push(key); else leftovers.push(part);
  }
  out.custom = leftovers.join("; ");
  return out;
}

function traitData(t, kind) {
  if (!t) return { value: [], custom: "", ...(kind === "ci" ? {} : { bypasses: [] }) };
  if (kind === "ci") return { value: t.conditions, custom: "" };
  return { value: t.damage, bypasses: t.bypasses, custom: t.custom && !t.damage.length ? t.custom : "" };
}

function biography(d) {
  const lore = d.lore?.length ? paragraphs(d.lore.join("\n")) : "";
  const extra = [];
  if (d.gear?.length) extra.push(`<p><strong>Gear:</strong> ${escapeHTML(d.gear.join(", "))}</p>`);
  if (d.acNote) extra.push(`<p><strong>Armor Class:</strong> ${d.ac} (${escapeHTML(d.acNote)})</p>`);
  if (d.legendaryIntro) extra.push(`<p><strong>Legendary Actions:</strong> ${escapeHTML(d.legendaryIntro)}</p>`);
  if (d.lairIntro) extra.push(`<p><strong>Lair Actions:</strong> ${escapeHTML(d.lairIntro)}</p>`);
  const source = `<h3>Original statblock</h3><p>${escapeHTML(d.source).replace(/\n/g, "<br>")}</p>`;
  return lore + extra.join("") + source;
}

/**
 * Build the actor and its items.
 * @param {object} d             Parsed statblock data.
 * @param {object} opts
 * @param {"monster"|"npc"|"familiar"} opts.kind
 * @param {string} [opts.book]
 * @param {string} [opts.typeOverride]  Creature type to use instead of the statblock's (familiars).
 * @param {Map} opts.spells       Spell index from buildSpellIndex().
 * @param {Map} [opts.items]      Item index from buildItemIndex().
 * @returns {{ actor: object, items: { data?: object, ref?: string, overlay?: object }[], warnings: string[] }}
 *   Items with a `ref` are copied from that compendium entry with `overlay` on top (see resolveItems).
 */
export function buildActor(d, { kind = "monster", book = "Homebrew", typeOverride = "", spells, items: itemIndex = null, ownerId = null }) {
  const warnings = [];
  const source = { book, page: "", custom: "", license: "", rules: d.rules ?? "2024" };
  const cr = d.cr ?? null;
  // dnd5e works out an NPC's proficiency from its CR; the statblock may print a different one (homebrew, class levels).
  // Read proficiency levels with the printed bonus, then add bonuses so the sheet shows the printed totals.
  const sheetPb = profFromCR(cr);
  const pb = d.pb ?? sheetPb;

  // Abilities and saves
  const abilities = {};
  for (const k of Object.keys(ABILITIES)) {
    const score = d.abilities?.[k] ?? 10;
    const a = { value: score, proficient: 0 };
    const total = d.saves?.[k];
    if (total != null) {
      const base = mod(score);
      const prof = total - base >= Math.ceil(pb * 0.75) ? 1 : 0;
      a.proficient = prof;
      const extra = total - base - prof * sheetPb;
      if (extra) a.bonuses = { save: signed(extra), check: "" };
    }
    abilities[k] = a;
  }

  // Skills
  const SKILL_ABILITY = { acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha", his: "int", ins: "wis", itm: "cha", inv: "int", med: "wis", nat: "int", prc: "wis", prf: "cha", per: "cha", rel: "int", slt: "dex", ste: "dex", sur: "wis" };
  const skills = {};
  for (const [k, total] of Object.entries(d.skills ?? {})) {
    const base = mod(abilities[SKILL_ABILITY[k]].value);
    const steps = (total - base) / pb;
    const value = steps >= 1.75 ? 2 : steps >= 0.75 ? 1 : steps >= 0.25 ? 0.5 : 0;
    const bonus = total - base - (value === 0.5 ? Math.floor(sheetPb / 2) : value * sheetPb);
    skills[k] = { value, ability: SKILL_ABILITY[k], bonuses: { check: bonus ? signed(bonus) : "", passive: "" } };
  }

  // Movement (dnd5e 6 stores speeds under movement.speeds)
  const speeds = {};
  for (const t of ["walk", "burrow", "climb", "fly", "swim"]) speeds[t] = d.speed?.[t] != null ? String(d.speed[t]) : "";
  const movement = { speeds, hover: !!d.speed?.hover, units: "ft" };

  const ac = d.natural ? { calcs: ["natural"], flat: d.ac ?? 10 } : { override: d.ac ?? null, flat: d.ac ?? null };
  const sc = d.spellcasting?.[0];
  const slotCaster = d.spellcasting?.find(s => s.casterLevel);

  const system = {
    abilities,
    skills,
    attributes: {
      ac,
      hp: { value: d.hp ?? 1, max: d.hp ?? 1, formula: d.hpFormula ?? "" },
      init: { ability: "", bonus: initBonus(d.init, mod(abilities.dex.value), sheetPb) },
      movement,
      senses: { ranges: { darkvision: null, blindsight: null, tremorsense: null, truesight: null, ...(d.senses?.ranges ?? {}) }, units: "ft", special: d.senses?.special ?? "" },
      spellcasting: sc?.ability ?? "",
      spell: { level: slotCaster?.casterLevel ?? 0 }
    },
    details: {
      type: { value: typeOverride || d.type || "humanoid", subtype: d.subtype ?? "", swarm: d.swarm ?? "", custom: "" },
      alignment: d.alignment ?? "",
      cr,
      biography: { value: biography(d), public: "" }
    },
    traits: {
      size: d.size ?? "med",
      di: traitData(d.di, "di"), dr: traitData(d.dr, "dr"), dv: traitData(d.dv, "dv"), ci: traitData(d.ci, "ci"),
      languages: languageData(d.languages, d.telepathy)
    },
    resources: {
      legact: { max: d.legendary?.max ?? 0, spent: 0 },
      legres: { max: d.legres ?? 0, spent: 0 },
      lair: { value: !!d.lair, initiative: d.lair ? 20 : null, inside: false }
    },
    source
  };

  // Printed spell save DC and spell attack, on top of what dnd5e works out from CR and the casting ability.
  if (sc) {
    const castMod = sc.ability ? mod(abilities[sc.ability]?.value) : 0;
    const dcExtra = sc.dc != null ? sc.dc - (8 + sheetPb + castMod) : 0;
    const atkExtra = sc.attack != null ? sc.attack - (sheetPb + castMod) : sc.dc != null ? dcExtra : 0;
    system.bonuses = {
      spell: { dc: dcExtra ? signed(dcExtra) : "" },
      msak: { attack: atkExtra ? signed(atkExtra) : "", damage: "" },
      rsak: { attack: atkExtra ? signed(atkExtra) : "", damage: "" }
    };
  }
  // Explicit slot counts ("1st level (4 slots)") win over the caster-level table.
  const slots = {};
  for (const s of d.spellcasting ?? []) for (const g of s.groups) if (g.slots && g.level) slots[`spell${g.level}`] = { value: g.slots, override: g.slots };
  if (Object.keys(slots).length) system.spells = slots;

  // Items: features, then spells and gear copied from compendiums (resolved in importStatblocks)
  const ctx = { source, spells, items: itemIndex, warnings, spellcasting: sc, refs: [] };
  const items = [];
  const gearNames = new Set();
  const addGear = g => { const k = normName(g.overlay?.name ?? g.data.name); if (gearNames.has(k)) return; gearNames.add(k); items.push(g); };
  for (const en of d.entries ?? []) {
    try {
      if (en.spellcasting) { items.push({ data: spellcastingItem(en, ctx) }); continue; }
      const feat = featureItem(en, ctx);
      if (en.attack && !en.attack.spell) {
        const hit = findItem(itemIndex, en.name, ["weapon"]);
        if (hit.uuid || WEAPON_RE.test(en.name)) { addGear(weaponItem(en, ctx, feat, hit)); continue; }
      }
      if (en.section === "trait" && (MAGIC_ITEM_RE.test(en.name) || (findItem(itemIndex, en.name, ["equipment", "consumable"]).exact && /\s/.test(en.name)))) {
        addGear(gearItem(en.name, ctx, { text: en.text, activities: feat.system.activities, uses: feat.system.uses?.max ? feat.system.uses : null, section: en.section }));
        continue;
      }
      items.push({ data: feat });
    }
    catch (err) { warnings.push(`${en.name}: ${err.message}`); }
  }
  // Gear named outside the actions: the Armor Class note ("ring of protection") and the 2024 Gear line.
  const acGear = String(d.acNote ?? "").split(/,|;|\band\b/i).map(s => s.trim())
    .filter(s => s && /[a-z]/i.test(s) && !/natural|unarmored|mage armor|barkskin|^armor$|dex|\bwith\b|\bspell\b|^\d+$/i.test(s));
  for (const g of [...acGear, ...(d.gear ?? [])]) {
    const name = g.replace(/\s*\(\d+\)$/, "").trim();
    const qty = Number(g.match(/\((\d+)\)$/)?.[1] ?? 1);
    if ([...gearNames].some(k => k === normName(name) || k.replace(/\s*\+\d\b/, "") === normName(name))) continue;
    const item = gearItem(name, ctx);
    if (qty > 1) { (item.overlay ?? item.data).system ??= {}; (item.overlay ?? item.data).system.quantity = qty; if (item.overlay) item.data.system.quantity = qty; }
    addGear(item);
  }
  items.push(...ctx.refs);

  const k = KINDS[kind] ?? KINDS.monster;
  const size = TOKEN_SIZE[system.traits.size] ?? 1;
  const vision = Math.max(0, ...Object.values(d.senses?.ranges ?? {}).filter(Number.isFinite));
  const actor = {
    name: d.name,
    type: "npc",
    img: "icons/svg/mystery-man.svg",
    system,
    prototypeToken: {
      name: d.name,
      width: size, height: size,
      disposition: k.disposition,
      actorLink: k.actorLink,
      displayName: kind === "monster" ? 20 : 30,
      bar1: { attribute: "attributes.hp" },
      sight: { enabled: kind === "familiar", range: vision || 0, visionMode: "basic" }
    },
    flags: { [MODULE_ID]: { kind, key: `${slugify(d.name)}:${source.rules}` } }
  };
  if (kind === "familiar" && ownerId) actor.ownership = { default: 0, [ownerId]: 3 };
  return { actor, items, warnings };
}

/* -------------------------------------------- */
/*  Writing                                     */
/* -------------------------------------------- */

/** Turn built item entries into item data, copying spells and gear from their compendium entries. */
export async function resolveItems(entries, warnings = []) {
  const out = [];
  for (const en of entries) {
    if (!en.ref) { out.push(en.data); continue; }
    let doc = null;
    try { doc = await fromUuid(en.ref); } catch (err) { /* fall through */ }
    if (!doc) { if (en.data) out.push(en.data); else warnings.push(`Couldn't load ${en.ref}`); continue; }
    const base = doc.toObject();
    for (const k of ["_id", "folder", "sort", "ownership"]) delete base[k];
    // Magic item effects (Ring of Protection's +1 AC and saves…) are already in the printed numbers.
    if (en.kind !== "spell") base.effects = [];
    const merged = foundry.utils.mergeObject(base, en.overlay ?? {}, { inplace: false });
    if (en.replaceActivities) merged.system.activities = en.overlay.system.activities;
    if (en.addProps?.length) merged.system.properties = [...new Set([...(merged.system.properties ?? []), ...en.addProps])];
    if (en.consumeUses) {
      for (const a of Object.values(merged.system.activities ?? {})) {
        a.consumption ??= { targets: [], scaling: { allowed: false, max: "" } };
        a.consumption.targets = [...(a.consumption.targets ?? []).filter(t => t.type !== "itemUses"), { type: "itemUses", target: "", value: "1", scaling: {} }];
        a.consumption.spellSlot = false;
      }
    }
    merged._stats = { compendiumSource: doc.uuid };
    out.push(merged);
  }
  return out;
}

async function ensureFolder(name, pack) {
  const folders = pack ? pack.folders.contents : game.folders.filter(f => f.type === "Actor");
  const hit = folders.find(f => f.name === name && !f.folder);
  if (hit) return hit.id;
  return (await Folder.create({ name, type: "Actor" }, pack ? { pack: pack.collection } : {})).id;
}

/**
 * Import parsed statblocks.
 * @param {object[]} statblocks   Parsed data objects (parseStatblocks(...)[n].data).
 * @param {object} opts
 * @param {string} [opts.target="world"]  "world" or an Actor compendium collection id.
 * @param {"monster"|"npc"|"familiar"} [opts.kind="monster"]
 * @param {boolean} [opts.update=true]   Replace actors this module imported before (same name and edition).
 * @param {string} [opts.book="Homebrew"]
 * @param {string} [opts.ownerId]       Familiars: the player who should own it.
 * @param {string} [opts.typeOverride]  Familiars: celestial, fey or fiend instead of beast.
 * @param {boolean} [opts.openSheet=true]
 */
export async function importStatblocks(statblocks, opts = {}) {
  const { target = "world", kind = "monster", update = true, book = "Homebrew", ownerId = null, typeOverride = "", openSheet = true } = opts;
  if (game.system.id !== "dnd5e") throw new Error("Statblock 5e needs the dnd5e system.");
  let pack = null;
  if (target !== "world") {
    pack = game.packs.get(target);
    if (!pack) throw new Error(`Compendium "${target}" not found.`);
    if (pack.locked) throw new Error(`Compendium "${pack.title}" is locked. Unlock it first.`);
    if (pack.documentName !== "Actor") throw new Error(`"${pack.title}" isn't an Actor compendium.`);
  }

  const report = { created: 0, updated: 0, skipped: 0, errors: [], warnings: [], actors: [] };
  const spellCache = {};
  const itemCache = {};
  const folderName = KINDS[kind]?.folder ?? "Monsters";
  let folderId = null;

  for (const d of statblocks) {
    try {
      const rules = d.rules ?? "2024";
      spellCache[rules] ??= await buildSpellIndex(rules);
      itemCache[rules] ??= await buildItemIndex(rules);
      const { actor: data, items: built, warnings } = buildActor(d, { kind, book, spells: spellCache[rules], items: itemCache[rules], ownerId, typeOverride });
      const items = await resolveItems(built, warnings);
      report.warnings.push(...warnings.map(w => `${d.name}: ${w}`));

      const key = data.flags[MODULE_ID].key;
      const pool = pack ? await pack.getDocuments() : game.actors.contents;
      const prior = pool.find(a => a.getFlag(MODULE_ID, "key") === key && a.getFlag(MODULE_ID, "kind") === kind);
      if (prior && !update) { report.skipped++; continue; }

      if (!pack) folderId ??= await ensureFolder(folderName, null);
      // Build in the world first so Cast activities can copy their spells onto the actor, then move to a compendium if asked.
      let actor;
      if (prior && !pack) {
        await prior.deleteEmbeddedDocuments("Item", prior.items.map(i => i.id));
        const keepImg = prior.img && !prior.img.startsWith("icons/svg/") ? { img: prior.img, "prototypeToken.texture.src": prior.prototypeToken.texture.src } : {};
        await prior.update({ ...data, ...keepImg, folder: prior.folder?.id ?? folderId }, { recursive: false, diff: false });
        actor = prior;
        report.updated++;
      } else {
        actor = await Actor.implementation.create({ ...data, folder: pack ? null : folderId });
      }
      if (items.length) await actor.createEmbeddedDocuments("Item", items);
      // Cast activities copy their spells onto the actor right after creation; wait for that before moving on.
      const casts = items.reduce((n, i) => n + Object.values(i.system.activities ?? {}).filter(a => a.type === "cast").length, 0);
      for (let t = 0; casts && t < 50 && actor.items.filter(i => i.getFlag("dnd5e", "cachedFor")).length < casts; t++) {
        await new Promise(r => setTimeout(r, 100));
      }

      if (pack) {
        const temp = actor;
        try {
          const packFolder = await ensureFolder(folderName, pack);
          if (prior) await prior.delete();
          actor = await pack.importDocument(temp);
          await actor.update({ folder: packFolder });
        } finally {
          await temp.delete();   // never leave the temporary world copy behind
        }
        if (prior) report.updated++; else report.created++;
      } else if (!prior) report.created++;

      report.actors.push(actor);
    } catch (err) {
      console.error(`${MODULE_ID} | ${d?.name}`, err);
      report.errors.push(`${d?.name ?? "(unnamed)"}: ${err.message}`);
    }
  }
  if (openSheet && report.actors.length === 1) report.actors[0].sheet.render(true);
  return report;
}
