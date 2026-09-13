/* Statblock 5e v4.2.0
 * Automatic Foundry VTT core icon matching for imported Items and NPCs.
 * Uses Foundry's bundled icons; no external artwork is downloaded.
 */
const SB5E_ICON_DEFAULTS = {
  weapon: "icons/weapons/swords/sword-guard-worn-purple.webp",
  attack: "icons/weapons/swords/sword-guard.webp",
  trait: "icons/skills/trades/academics-study-reading-book.webp",
  action: "icons/skills/melee/strike-sword-steel-blue.webp",
  bonus: "icons/skills/melee/strike-sword-steel-blue.webp",
  reaction: "icons/skills/melee/defensive-shield-block.webp",
  legendary: "icons/magic/control/debuff-energy-hold-levitate-blue.webp",
  lair: "icons/environment/wilderness/altar-ancient.webp",
  race: "icons/creatures/humanoids/human-warrior.webp",
  class: "icons/skills/trades/academics-study-reading-book.webp",
  subclass: "icons/skills/trades/academics-study-reading-book.webp",
  spell: "icons/magic/symbols/runes-star-blue.webp",
  consumable: "icons/consumables/potions/potion-bottle-corked-blue.webp",
  armor: "icons/equipment/chest/plate-armor.webp",
  shield: "icons/equipment/shield/heater-steel.webp",
  tool: "icons/tools/smithing/anvil.webp",
  equipment: "icons/equipment/neck/cloak-hooded-leather-brown.webp"
};

const SB5E_WEAPON_ICONS = [
  [/(?:^|\\b)shortsword(?:\\b|$)/i, "icons/weapons/swords/sword-guard-worn-purple.webp"],
  [/(?:^|\\b)longsword(?:\\b|$)/i, "icons/weapons/swords/greatsword-guard.webp"],
  [/(?:^|\\b)greatsword(?:\\b|$)/i, "icons/weapons/swords/greatsword-crossguard-steel.webp"],
  [/(?:^|\\b)rapier(?:\\b|$)/i, "icons/weapons/swords/sword-guard-bronze.webp"],
  [/(?:^|\\b)scimitar(?:\\b|$)/i, "icons/weapons/swords/scimitar-worn-blue.webp"],
  [/(?:^|\\b)dagger(?:s)?(?:\\b|$)/i, "icons/weapons/daggers/dagger-steel.webp"],
  [/(?:^|\\b)handaxe(?:\\b|$)/i, "icons/weapons/axes/handaxe.webp"],
  [/(?:^|\\b)battleaxe(?:\\b|$)/i, "icons/weapons/axes/axe-battle.webp"],
  [/(?:^|\\b)greataxe(?:\\b|$)/i, "icons/weapons/axes/axe-battle.webp"],
  [/(?:^|\\b)war pick(?:\\b|$)/i, "icons/weapons/axes/pickaxe-iron-green.webp"],
  [/(?:^|\\b)mace(?:\\b|$)/i, "icons/weapons/maces/mace-cube-spiked-steel.webp"],
  [/(?:^|\\b)morningstar(?:\\b|$)/i, "icons/weapons/maces/mace-cube-spiked-steel.webp"],
  [/(?:^|\\b)maul(?:\\b|$)/i, "icons/weapons/hammers/hammer-double-steel-embossed.webp"],
  [/(?:^|\\b)hammer(?:s)?(?:\\b|$)/i, "icons/weapons/hammers/hammer-double-steel-embossed.webp"],
  [/(?:^|\\b)club(?:\\b|$)/i, "icons/weapons/clubs/club-spiked-brown.webp"],
  [/(?:^|\\b)quarterstaff(?:\\b|$)/i, "icons/weapons/staves/staff-simple.webp"],
  [/(?:^|\\b)staff(?:\\b|$)/i, "icons/weapons/staves/staff-simple.webp"],
  [/(?:^|\\b)spear(?:s)?(?:\\b|$)/i, "icons/weapons/polearms/spear-simple-engraved.webp"],
  [/(?:^|\\b)pike(?:\\b|$)/i, "icons/weapons/polearms/spear-hooked-spike.webp"],
  [/(?:^|\\b)halberd(?:\\b|$)/i, "icons/weapons/polearms/halberd-engraved-black.webp"],
  [/(?:^|\\b)javelin(?:s)?(?:\\b|$)/i, "icons/weapons/polearms/javelin.webp"],
  [/(?:^|\\b)trident(?:\\b|$)/i, "icons/weapons/polearms/trident.webp"],
  [/(?:^|\\b)shortbow(?:\\b|$)/i, "icons/weapons/bows/shortbow.webp"],
  [/(?:^|\\b)longbow(?:\\b|$)/i, "icons/weapons/bows/longbow.webp"],
  [/(?:^|\\b)crossbow(?:\\b|$)/i, "icons/weapons/crossbows/crossbow.webp"],
  [/(?:^|\\b)hand crossbow(?:\\b|$)/i, "icons/weapons/crossbows/crossbow-hand.webp"],
  [/(?:^|\\b)whip(?:\\b|$)/i, "icons/sundries/survival/leather-strap-brown.webp"],
  [/(?:^|\\b)flail(?:\\b|$)/i, "icons/weapons/maces/flail-steel.webp"],
  [/(?:^|\\b)glaive(?:\\b|$)/i, "icons/weapons/polearms/glaive-hooked.webp"],
  [/(?:^|\\b)scythe(?:\\b|$)/i, "icons/weapons/polearms/scythe-hooked.webp"],
  [/(?:^|\\b)blowgun(?:\\b|$)/i, "icons/weapons/ammunition/arrow-head-poison.webp"],
  [/(?:^|\\b)sling(?:\\b|$)/i, "icons/weapons/ammunition/sling-bullets.webp"],
  [/(?:^|\\b)dart(?:s)?(?:\\b|$)/i, "icons/weapons/ammunition/arrow-broadhead.webp"],
  [/(?:^|\\b)net(?:\\b|$)/i, "icons/tools/fishing/net.webp"]
];

function sb5eCoreIcon(name, type, document) {
  const n = String(name || "").trim();
  const t = String(type || "").toLowerCase();

  if (t === "weapon" || t === "spell" || t === "equipment" || t === "consumable" || t === "tool" || t === "feat") {
    const weaponMatch = SB5E_WEAPON_ICONS.find(([re]) => re.test(n));
    if (weaponMatch) return weaponMatch[1];
  }

  if (/^shield$/i.test(n) || /shield/i.test(n) && t === "equipment") return SB5E_ICON_DEFAULTS.shield;
  if (/(?:plate|chain mail|chainmail|scale mail|breastplate|half plate|leather armor|hide armor|padded armor|studded leather|splint)/i.test(n)) return SB5E_ICON_DEFAULTS.armor;
  if (/(?:potion|elixir|draught)/i.test(n)) return SB5E_ICON_DEFAULTS.consumable;
  if (t === "spell") return SB5E_ICON_DEFAULTS.spell;
  if (t === "feat") {
    if (/lair action/i.test(n)) return SB5E_ICON_DEFAULTS.lair;
    if (/legendary action/i.test(n)) return SB5E_ICON_DEFAULTS.legendary;
    if (/reaction/i.test(n)) return SB5E_ICON_DEFAULTS.reaction;
    if (/bonus action/i.test(n)) return SB5E_ICON_DEFAULTS.bonus;
    if (/trait/i.test(n)) return SB5E_ICON_DEFAULTS.trait;
    return SB5E_ICON_DEFAULTS.action;
  }
  if (t === "race") return SB5E_ICON_DEFAULTS.race;
  if (t === "class" || t === "subclass") return SB5E_ICON_DEFAULTS[t];
  if (t === "tool") return SB5E_ICON_DEFAULTS.tool;
  return null;
}

function sb5eIsDefaultImage(document) {
  const img = String(document?.img || "");
  return !img || img === "icons/svg/item-bag.svg" || img === "icons/svg/mystery-man.svg" || img === "icons/svg/book.svg" || img === "icons/svg/d20-black.svg";
}

Hooks.on("createItem", async item => {
  try {
    if (!item || !sb5eIsDefaultImage(item)) return;
    const icon = sb5eCoreIcon(item.name, item.type, item);
    if (!icon) return;
    await item.update({img: icon}, {render: false});
  } catch (error) {
    console.warn("Statblock 5e | Could not assign automatic item icon", error);
  }
});

Hooks.on("createActor", async actor => {
  try {
    if (!actor || !sb5eIsDefaultImage(actor)) return;
    if (actor.type !== "npc") return;
    await actor.update({img: "icons/creatures/undead/zombie-rotting.webp"}, {render: false});
  } catch (error) {
    console.warn("Statblock 5e | Could not assign automatic NPC icon", error);
  }
});
