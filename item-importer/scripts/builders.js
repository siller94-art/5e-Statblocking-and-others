/**
 * Turns parsed item entries into dnd5e 6.x Item data (with activities) and writes them
 * to world items, a compendium, or an actor's inventory.
 */

export const MODULE_ID = "homebrew-item-importer";

const ICONS = {
  weapon: "icons/weapons/swords/sword-guard-steel-green.webp",
  armor: "icons/equipment/chest/breastplate-banded-steel.webp",
  shield: "icons/equipment/shield/heater-steel-worn.webp",
  potion: "icons/consumables/potions/potion-bottle-corked-red.webp",
  scroll: "icons/sundries/scrolls/scroll-rolled-white.webp",
  wand: "icons/weapons/wands/wand-gem-red.webp",
  ammo: "icons/weapons/ammunition/arrows-war-red.webp",
  poison: "icons/consumables/potions/bottle-round-corked-green.webp",
  food: "icons/consumables/food/bread-loaf-round-white.webp",
  trinket: "icons/sundries/misc/pin-brass.webp",
  ring: "icons/equipment/finger/ring-band-gold.webp",
  rod: "icons/weapons/staves/staff-simple.webp",
  wondrous: "icons/commodities/treasure/token-gold-gem-purple.webp",
  tool: "icons/tools/hand/hammer-and-nail.webp",
  container: "icons/containers/bags/pack-leather-tan.webp",
  gem: "icons/commodities/gems/gem-faceted-round-white.webp",
  loot: "icons/containers/chest/chest-wooden-tied-white.webp"
};

export const escapeHTML = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rid = () => foundry.utils.randomID();
const slugify = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function toHTML(e) {
  const paras = String(e.description ?? "").split(/\n\s*\n/).filter(Boolean).map(p =>
    `<p>${escapeHTML(p.trim()).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")}</p>`);
  if (e.typeLine) paras.unshift(`<p><em>${escapeHTML(e.typeLine)}</em></p>`);
  return paras.join("");
}

function dice(str, types) {
  const m = String(str ?? "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (m) return { number: Number(m[1]), denomination: Number(m[2]), bonus: m[3] ? m[3].replace(/^\+/, "") : "", types: [].concat(types ?? []), custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } };
  return { number: null, denomination: null, bonus: "", types: [].concat(types ?? []), custom: { enabled: true, formula: String(str ?? "") }, scaling: { mode: "", number: null, formula: "" } };
}

function activity(type, extra = {}, e = {}) {
  const a = {
    _id: rid(), type,
    activation: { type: e.activation ?? "action", value: 1, condition: "", override: false },
    consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: true },
    ...extra
  };
  return a;
}

/** Item uses + which activities spend them. */
function usesData(e) {
  if (!e.uses) return {};
  return { uses: { max: String(e.uses.max), spent: 0, recovery: e.uses.recovery ?? [] } };
}
const spendUse = { targets: [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }], scaling: { allowed: false, max: "" }, spellSlot: true };

function saveActivity(e, parts = []) {
  return activity("save", {
    save: { ability: [e.save.ability], dc: { calculation: "", formula: String(e.save.dc) } },
    damage: { onSave: e.save.onSave ?? "none", parts }
  }, e);
}

function common(e, ctx) {
  return {
    description: { value: toHTML(e), chat: "" },
    identifier: slugify(e.name),
    source: { book: ctx.book, page: "", custom: "", license: "", rules: e.rules ?? "2024" },
    quantity: e.quantity ?? 1,
    weight: { value: e.weight ?? 0, units: "lb" },
    price: { value: e.price?.value ?? 0, denomination: e.price?.denomination ?? "gp" },
    rarities: e.rarity ? [e.rarity] : [],
    attunement: e.attunement ?? "",
    identified: true
  };
}

function magicProps(e, props = []) {
  return [...new Set([...props, ...(e.rarity || e.magicalBonus ? ["mgc"] : [])])];
}

/* -------------------------------------------- */

function buildWeapon(e, ctx) {
  const ranged = /R$/.test(e.weaponType ?? "");
  const thrown = (e.properties ?? []).includes("thr");
  const acts = {};
  const atk = activity("attack", {
    attack: { type: { value: ranged ? "ranged" : "melee", classification: "weapon" }, ability: "", bonus: "", flat: false, critical: { threshold: null } },
    damage: { includeBase: true, critical: { bonus: "" }, parts: (e.extraDamage ?? []).map(d => dice(d.dice, d.type)) }
  }, e);
  if (e.uses) atk.consumption = spendUse;
  acts[atk._id] = atk;
  if (e.save) { const s = saveActivity(e); acts[s._id] = s; }

  return {
    name: e.name, type: "weapon", img: ICONS.weapon,
    system: {
      ...common(e, ctx), ...usesData(e),
      type: { value: e.weaponType ?? "simpleM", baseItem: e.baseItem ?? "" },
      damage: {
        base: e.damage ? dice(e.damage.dice, e.damage.type) : dice("", []),
        versatile: e.versatile ? dice(e.versatile, e.damage?.type) : dice("", [])
      },
      properties: magicProps(e, e.properties),
      magicalBonus: e.magicalBonus ? String(e.magicalBonus) : "",
      mastery: e.mastery ?? "",
      range: {
        value: e.range?.[0] ?? null, long: e.range?.[1] ?? null,
        reach: !ranged && !thrown ? ((e.properties ?? []).includes("rch") ? 10 : null) : null, units: "ft"
      },
      activities: acts
    }
  };
}

function buildArmor(e, ctx) {
  const props = magicProps(e, e.stealthDisadvantage ? ["stealthDisadvantage"] : []);
  return {
    name: e.name, type: "equipment", img: e.armorType === "shield" ? ICONS.shield : ICONS.armor,
    system: {
      ...common(e, ctx), ...usesData(e),
      type: { value: e.armorType ?? "light", baseItem: e.baseItem ?? "" },
      armor: { value: e.ac ?? 10, magicalBonus: e.magicalBonus ? String(e.magicalBonus) : "", dex: e.dexCap ?? null },
      strength: e.strength ?? null,
      properties: props,
      activities: activitiesForEffects(e)
    }
  };
}

function activitiesForEffects(e) {
  const acts = {};
  if (e.save) {
    const s = saveActivity(e, (e.damageParts ?? []).map(d => dice(d.dice, d.type)));
    if (e.uses) s.consumption = spendUse;
    acts[s._id] = s;
  } else if (e.damageParts?.length) {
    const d = activity("damage", { damage: { parts: e.damageParts.map(p => dice(p.dice, p.type)) } }, e);
    if (e.uses) d.consumption = spendUse;
    acts[d._id] = d;
  } else if (e.uses) {
    const u = activity("utility", { consumption: spendUse }, e);
    acts[u._id] = u;
  }
  return acts;
}

function buildConsumable(e, ctx) {
  const acts = {};
  if (e.healing) {
    const h = activity("heal", { healing: dice(e.healing, "healing") }, e);
    h.consumption = spendUse;
    acts[h._id] = h;
  } else if (e.consumableType !== "ammo" || e.save || e.damageParts?.length) {
    Object.assign(acts, activitiesForEffects({ ...e, uses: e.uses ?? { max: "1" } }));
  }
  return {
    name: e.name, type: "consumable", img: ICONS[e.consumableType] ?? ICONS.potion,
    system: {
      ...common(e, ctx),
      type: { value: e.consumableType, subtype: e.subtype ?? "" },
      uses: { max: String(e.uses?.max ?? (e.consumableType === "ammo" ? "" : "1")), spent: 0, recovery: e.uses?.recovery ?? [], autoDestroy: !!e.autoDestroy },
      magicalBonus: e.magicalBonus ? String(e.magicalBonus) : "",
      properties: magicProps(e),
      activities: acts
    }
  };
}

function buildEquipment(e, ctx) {
  return {
    name: e.name, type: "equipment", img: ICONS[e.equipmentType] ?? ICONS.wondrous,
    system: {
      ...common(e, ctx), ...usesData(e),
      type: { value: e.equipmentType ?? "wondrous", baseItem: "" },
      armor: { value: null, magicalBonus: "", dex: null },
      properties: magicProps(e),
      activities: activitiesForEffects(e)
    }
  };
}

function buildTool(e, ctx) {
  const check = activity("check", { check: { associated: [], ability: e.ability ?? "", dc: { calculation: "", formula: "" } } }, e);
  return {
    name: e.name, type: "tool", img: ICONS.tool,
    system: {
      ...common(e, ctx),
      type: { value: e.toolType ?? "", baseItem: "" },
      ability: e.ability ?? "", properties: magicProps(e),
      activities: { [check._id]: check }
    }
  };
}

function buildContainer(e, ctx) {
  const { quantity, ...rest } = common(e, ctx);
  return {
    name: e.name, type: "container", img: ICONS.container,
    system: {
      ...rest,
      capacity: {
        count: null,
        volume: { value: e.capacityVolume ?? null, units: "cubicFoot" },
        weight: { value: e.capacityWeight ?? null, units: "lb" }
      },
      properties: magicProps(e, e.weightless ? ["weightlessContents"] : [])
    }
  };
}

function buildLoot(e, ctx) {
  return {
    name: e.name, type: "loot", img: ICONS[e.lootType] ?? ICONS.loot,
    system: { ...common(e, ctx), type: { value: e.lootType ?? "gear", subtype: "" }, properties: magicProps(e) }
  };
}

const BUILDERS = { weapon: buildWeapon, armor: buildArmor, consumable: buildConsumable, equipment: buildEquipment, tool: buildTool, container: buildContainer, loot: buildLoot };

export function buildItem(entry, ctx) {
  if (entry.system && entry.type) return foundry.utils.deepClone(entry); // raw Foundry item JSON
  const build = BUILDERS[entry.kind];
  if (!build) throw new Error(`Unknown item kind "${entry.kind}"`);
  return build(entry, ctx);
}

/** Use the matching SRD item's artwork for base weapons and armor when the compendium is installed. */
async function baseImage(entry) {
  const ids = { ...(CONFIG.DND5E.weaponIds ?? {}), ...(CONFIG.DND5E.armorIds ?? {}), ...(CONFIG.DND5E.shieldIds ?? {}) };
  const uuid = entry.baseItem && ids[entry.baseItem];
  if (!uuid) return null;
  try { return (await fromUuid(uuid))?.img ?? null; } catch { return null; }
}

/* -------------------------------------------- */
/*  Writing                                     */
/* -------------------------------------------- */

/**
 * @param {object[]} entries   Parsed entries ({kind, ...}) or raw Foundry item data.
 * @param {object} opts
 * @param {string} [opts.target="world"]  "world", a compendium collection id, or "actor:<id>".
 * @param {boolean} [opts.update=true]   Update items this module imported before (same name, type, edition).
 * @param {string} [opts.book="Homebrew"]
 */
export async function importItems(entries, { target = "world", update = true, book = "Homebrew" } = {}) {
  if (game.system.id !== "dnd5e") throw new Error("This module needs the dnd5e system.");
  let pack = null, actor = null;
  if (target.startsWith("actor:")) {
    actor = game.actors.get(target.slice(6));
    if (!actor) throw new Error("That actor no longer exists.");
    if (!actor.isOwner) throw new Error(`You don't own ${actor.name}.`);
  } else if (target !== "world") {
    pack = game.packs.get(target);
    if (!pack) throw new Error(`Compendium "${target}" not found.`);
    if (pack.locked) throw new Error(`Compendium "${pack.title}" is locked. Unlock it first.`);
    if (pack.documentName !== "Item") throw new Error(`"${pack.title}" isn't an Item compendium.`);
  }

  const existingDocs = actor ? actor.items.contents : pack ? await pack.getDocuments() : game.items.contents;
  const existing = new Map(existingDocs.filter(d => d.getFlag(MODULE_ID, "key")).map(d => [d.getFlag(MODULE_ID, "key"), d]));
  const report = { created: 0, updated: 0, skipped: 0, errors: [], documents: [] };
  const ctx = { book };
  let folderId = null;

  for (const entry of entries) {
    try {
      const data = buildItem(entry, ctx);
      if (!entry.system) {
        const img = await baseImage(entry);
        if (img) data.img = img;
      }
      const key = `${data.type}:${slugify(data.name)}:${data.system?.source?.rules ?? ""}`;
      foundry.utils.setProperty(data, `flags.${MODULE_ID}.key`, key);
      const prior = existing.get(key);
      if (prior) {
        if (!update) { report.skipped++; continue; }
        data.folder = prior.folder?.id ?? null;
        if (!entry.system && prior.img && !prior.img.startsWith("icons/")) data.img = prior.img; // keep custom art
        await prior.update(data, { recursive: false, diff: false });
        report.updated++; report.documents.push(prior);
        continue;
      }
      if (!actor) data.folder = folderId ??= await ensureFolder(pack, `Homebrew Items – ${book}`);
      const doc = await Item.implementation.create(data, actor ? { parent: actor } : pack ? { pack: pack.collection } : {});
      existing.set(key, doc);
      report.created++; report.documents.push(doc);
    } catch (err) {
      console.error(`${MODULE_ID} | ${entry?.name ?? entry?.data?.name}`, err);
      report.errors.push(`${entry?.name ?? "(unnamed)"}: ${err.message}`);
    }
  }
  return report;
}

async function ensureFolder(pack, name) {
  const folders = pack ? pack.folders.contents : game.folders.filter(f => f.type === "Item");
  const hit = folders.find(f => f.name === name && !f.folder);
  if (hit) return hit.id;
  const f = await Folder.create({ name, type: "Item", color: "#7a4b1f" }, pack ? { pack: pack.collection } : {});
  return f.id;
}
