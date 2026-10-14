/**
 * Foundry core icons for imported features, matched by name. Every path here is one the
 * official dnd5e monsters use, so it ships with Foundry.
 */

const BY_NAME = [
  [/\bbite\b/i, "icons/creatures/abilities/mouth-teeth-rows-red.webp"],
  [/\bclaws?\b/i, "icons/creatures/claws/claw-talons-yellow-red.webp"],
  [/\btalons?\b/i, "icons/commodities/claws/claw-bird-pink.webp"],
  [/\btail\b/i, "icons/creatures/abilities/tail-swipe-green.webp"],
  [/\btentacles?\b/i, "icons/creatures/tentacles/tentacles-octopus-black-pink.webp"],
  [/\bslam\b|\bfist\b|\bunarmed\b/i, "icons/skills/melee/unarmed-punch-fist-yellow-red.webp"],
  [/\bgore\b|\bhorns?\b|\btusks?\b/i, "icons/skills/wounds/bone-broken-tooth-fang-red.webp"],
  [/\bsting(?:er)?\b/i, "icons/creatures/abilities/stinger-poison-green.webp"],
  [/\bhooves\b|\bstomp\b|\btrample\b/i, "icons/commodities/bones/hooves-cloven-brown.webp"],
  [/\bbeak\b|\bpeck\b/i, "icons/commodities/bones/beak-hooked-red.webp"],
  [/\brend\b/i, "icons/skills/melee/shield-damaged-broken-orange.webp"],
  [/\bmultiattack\b/i, "icons/skills/melee/strike-weapons-orange.webp"],
  [/\bfire breath\b/i, "icons/creatures/abilities/dragon-fire-breath-orange.webp"],
  [/\b(?:cold|frost|ice) breath\b/i, "icons/creatures/abilities/dragon-ice-breath-blue.webp"],
  [/\blightning breath\b/i, "icons/magic/lightning/bolt-strike-blue.webp"],
  [/\bacid breath\b/i, "icons/magic/acid/projectile-stream-bubbles.webp"],
  [/\bpoison breath\b/i, "icons/magic/light/beam-rays-green-large.webp"],
  [/\bbreath\b/i, "icons/creatures/reptiles/lizard-mouth-glowing-red.webp"],
  [/\bfrightful presence\b/i, "icons/creatures/reptiles/dragon-horned-blue.webp"],
  [/\blegendary resistance\b/i, "icons/equipment/shield/heater-steel-crystal-red.webp"],
  [/\bspellcasting\b/i, "icons/magic/symbols/circled-gem-pink.webp"],
  [/\bpack tactics\b/i, "icons/creatures/abilities/wolf-heads-swirl-purple.webp"],
  [/\bkeen (?:senses|sight|hearing)\b/i, "icons/creatures/eyes/human-single-blue.webp"],
  [/\bkeen smell\b/i, "icons/creatures/mammals/wolf-howl-moon-forest-blue.webp"],
  [/\bamphibious\b|\bwater breathing\b|\bhold breath\b/i, "icons/creatures/amphibians/bullfrog-glass-teal.webp"],
  [/\bmagic resistance\b/i, "icons/magic/light/orbs-hand-gray.webp"],
  [/\bweb\b/i, "icons/creatures/webs/web-spider-casting-caught-purple.webp"],
  [/\bspider climb\b/i, "icons/creatures/invertebrates/spider-pink-purple.webp"],
  [/\bparry\b/i, "icons/skills/melee/swords-parry-block-blue.webp"],
  [/\bcharge\b/i, "icons/creatures/mammals/bull-horns-eyes-glowin-orange.webp"],
  [/\bpounce\b|\bleap\b/i, "icons/skills/movement/arrow-upward-yellow.webp"],
  [/\bswallow\b/i, "icons/creatures/abilities/mouth-teeth-rows-needles-purple.webp"],
  [/\bconstrict\b|\bgrapple\b|\bentangle\b/i, "icons/magic/nature/root-vine-entangled-hands.webp"],
  [/\bengulf\b/i, "icons/creatures/slimes/slime-face-skull-green.webp"],
  [/\bincorporeal\b/i, "icons/creatures/magical/spirit-undead-ghost-purple.webp"],
  [/\bsunlight\b/i, "icons/magic/light/beam-rays-yellow.webp"],
  [/\bregeneration\b/i, "icons/skills/wounds/anatomy-organ-heart-red.webp"],
  [/\bflyby\b|\bwing\b/i, "icons/creatures/abilities/wings-birdlike-blue.webp"],
  [/\becholocation\b/i, "icons/magic/sonic/projectile-sound-rings-wave.webp"],
  [/\bteleport\b|\bmisty step\b|\bblink\b/i, "icons/magic/symbols/ring-circle-smoke-blue.webp"],
  [/\bshapechange\b|\bshape-?shift/i, "icons/magic/unholy/hand-fire-skeleton-pink.webp"],
  [/\blife drain\b|\bdrain\b/i, "icons/skills/wounds/injury-pain-body-orange.webp"],
  [/\bdaggers?\b/i, "icons/weapons/daggers/dagger-straight-blue.webp"],
  [/\bgreatswords?\b/i, "icons/weapons/swords/greatsword-crossguard-steel.webp"],
  [/\blongswords?\b/i, "icons/weapons/swords/greatsword-guard.webp"],
  [/\bshortswords?\b/i, "icons/weapons/swords/sword-guard-worn-purple.webp"],
  [/\bscimitars?\b/i, "icons/weapons/swords/scimitar-worn-blue.webp"],
  [/\brapiers?\b/i, "icons/weapons/swords/sword-guard-bronze.webp"],
  [/\bgreataxes?\b/i, "icons/weapons/axes/axe-double.webp"],
  [/\b(?:hand|battle)?axes?\b/i, "icons/weapons/axes/axe-broad-black.webp"],
  [/\bjavelins?\b/i, "icons/weapons/polearms/javelin-flared.webp"],
  [/\bspears?\b|\bpikes?\b|\bharpoons?\b/i, "icons/weapons/polearms/spear-flared-green.webp"],
  [/\btridents?\b/i, "icons/weapons/polearms/trident-silver-blue.webp"],
  [/\bmaces?\b/i, "icons/weapons/maces/mace-flanged-steel.webp"],
  [/\bmorningstars?\b/i, "icons/weapons/maces/mace-round-spiked-black.webp"],
  [/\bflails?\b/i, "icons/weapons/maces/flail-ball-grey.webp"],
  [/\bwarhammers?\b|\bmauls?\b|\bhammers?\b/i, "icons/weapons/hammers/hammer-drilling-spiked.webp"],
  [/\bclubs?\b|\bgreatclubs?\b/i, "icons/weapons/clubs/club-simple-barbed.webp"],
  [/\b(?:quarter)?staff\b/i, "icons/weapons/staves/staff-simple.webp"],
  [/\bwhips?\b/i, "icons/weapons/misc/whip-red-yellow.webp"],
  [/\bheavy crossbow\b/i, "icons/weapons/crossbows/crossbow-loaded-black.webp"],
  [/\bcrossbows?\b/i, "icons/weapons/crossbows/crossbow-simple-brown.webp"],
  [/\blongbows?\b/i, "icons/weapons/bows/longbow-recurve-leather-brown.webp"],
  [/\b(?:short)?bows?\b/i, "icons/weapons/bows/shortbow-leather.webp"],
  [/\bslings?\b/i, "icons/weapons/slings/slingshot-wood.webp"],
  [/\bnets?\b/i, "icons/tools/fishing/net-simple-brown.webp"]
];

/** Fallbacks by what the feature is, using dnd5e's own activity icons. */
const BY_KIND = {
  attack: "systems/dnd5e/icons/svg/activity/attack.svg",
  save: "systems/dnd5e/icons/svg/activity/save.svg",
  heal: "systems/dnd5e/icons/svg/activity/heal.svg",
  cast: "systems/dnd5e/icons/svg/activity/cast.svg",
  feature: "systems/dnd5e/icons/svg/monster.svg"
};

export function iconFor(name, kind = "feature") {
  for (const [re, path] of BY_NAME) if (re.test(name)) return path;
  return BY_KIND[kind] ?? BY_KIND.feature;
}
