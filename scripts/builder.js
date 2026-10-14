/**
 * Builds dnd5e 6 NPC actors from parsed statblocks and writes them to the world or a compendium.
 * Follows the structure of the official dnd5e monsters: features are "monster" feats with activities,
 * recharge and X/Day features use item uses, legendary actions spend resources.legact, and spellcasting
 * is a feat whose Cast activities link spells from your compendiums.
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

function spellcastingItem(en, ctx) {
  const sc = en.spellcasting;
  const activities = [];
  const missing = [];
  for (const g of sc.groups) {
    for (const spell of g.spells) {
      const uuid = findSpell(ctx.spells, spell.name);
      if (uuid) activities.push(castActivity(en, sc, spell, uuid, g));
      else missing.push(spell.name);
    }
  }
  if (missing.length) ctx.warnings.push(`${en.name}: not found in your compendiums, left as text: ${missing.join(", ")}`);
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
 */
export function buildActor(d, { kind = "monster", book = "Homebrew", typeOverride = "", spells, ownerId = null }) {
  const warnings = [];
  const source = { book, page: "", custom: "", license: "", rules: d.rules ?? "2024" };
  const cr = d.cr ?? null;
  const pb = d.pb ?? profFromCR(cr);

  // Abilities and saves
  const abilities = {};
  for (const k of Object.keys(ABILITIES)) {
    const score = d.abilities?.[k] ?? 10;
    const a = { value: score, proficient: 0 };
    const total = d.saves?.[k];
    if (total != null) {
      const base = mod(score);
      if (total === base + pb) a.proficient = 1;
      else if (total > base) { a.proficient = 1; a.bonuses = { save: signed(total - base - pb), check: "" }; }
      else if (total !== base) a.bonuses = { save: signed(total - base), check: "" };
    }
    abilities[k] = a;
  }

  // Skills
  const SKILL_ABILITY = { acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha", his: "int", ins: "wis", itm: "cha", inv: "int", med: "wis", nat: "int", prc: "wis", prf: "cha", per: "cha", rel: "int", slt: "dex", ste: "dex", sur: "wis" };
  const skills = {};
  for (const [k, total] of Object.entries(d.skills ?? {})) {
    const base = mod(abilities[SKILL_ABILITY[k]].value);
    const steps = (total - base) / pb;
    let value = 1, bonus = 0;
    if (steps >= 1.75) { value = 2; bonus = total - base - 2 * pb; }
    else if (steps >= 0.75) { value = 1; bonus = total - base - pb; }
    else if (steps >= 0.25) { value = 0.5; bonus = total - base - Math.floor(pb / 2); }
    else { value = 0; bonus = total - base; }
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
      init: { ability: "", bonus: initBonus(d.init, mod(abilities.dex.value), pb) },
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

  // Items
  const ctx = { source, spells, warnings, spellcasting: sc };
  const items = [];
  for (const en of d.entries ?? []) {
    try { items.push(en.spellcasting ? spellcastingItem(en, ctx) : featureItem(en, ctx)); }
    catch (err) { warnings.push(`${en.name}: ${err.message}`); }
  }

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
  const folderName = KINDS[kind]?.folder ?? "Monsters";
  let folderId = null;

  for (const d of statblocks) {
    try {
      const rules = d.rules ?? "2024";
      spellCache[rules] ??= await buildSpellIndex(rules);
      const { actor: data, items, warnings } = buildActor(d, { kind, book, spells: spellCache[rules], ownerId, typeOverride });
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
