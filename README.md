# Statblock 5e

A Foundry VTT module for importing **monster, NPC and familiar statblocks** into the dnd5e system.
Paste a statblock straight from a PDF, D&D Beyond, a website or Homebrewery, check what was read,
and import it as a ready-to-play NPC actor. Reads both **2014** and **2024** statblock layouts.

Requires **Foundry VTT v14** and **dnd5e 6.x**.

## Install
In Foundry's setup screen open **Add-on Modules → Install Module**, paste this into **Manifest URL** and click **Install**:

```
https://raw.githubusercontent.com/siller94-art/5e-Statblocking-and-others/main/module.json
```

Enable **Statblock 5e** in your world. The **Actors** sidebar gets an **Import Statblock** button.

## Using it
1. Choose **Import as**: **Monster**, **NPC** or **Familiar**.
2. Paste one or more statblocks, press **Paste** to read your clipboard, or press **Upload PDF / JSON** (or drop files
   on the left side) to load `.pdf`, `.json`, `.txt` or `.md` files — several at once is fine.
   Several statblocks can go in at once: each new "Medium Humanoid, Neutral" line starts the next creature.
3. With **Auto parse** on, the right side shows each creature as a statblock card: AC, HP, speed, CR, the six
   abilities with saves, every trait and action with what was understood (attack bonus and damage, save DC,
   recharge, uses per day, spells), and ⚠ notes for anything to check.
4. Give each creature a **Portrait** and a **Token** image on its card: click the box or the folder button to pick from
   Foundry's files, the upload button to send a picture from your computer or iPad, or drop an image file on the card.
   The token uses the portrait unless you choose a separate one. Leave both empty for the default silhouette.
5. Pick a **source book** name and where the creatures go (world actors or an unlocked Actor compendium), then **Import**.

Re-importing a creature with **Update existing** checked replaces it in place instead of making a copy. It keeps the
art it already had unless you chose new art on its card.

### Files
- **PDF:** any PDF with selectable text. Load a whole chapter: every statblock in it shows up as its own card.
- **JSON:** any of these —
  - statblock text: `"Goblin Warrior\nSmall Fey…"`, or a list of them
  - objects with the text and optional art: `{ "name": "Goblin Warrior", "text": "…", "img": "path/or/url.webp", "token": "…" }`
    (also read: `statblock`, `content`, `markdown` for the text; `image`, `portrait` for the portrait; `tokenImg` for the token),
    alone, in a list, or wrapped like `{ "monsters": [ … ] }`
  - **Foundry actor exports** (right-click an actor → *Export Data*), one or several: these are imported exactly as
    they are, with the folder, token disposition and art you choose here, without re-parsing.
- **TXT / MD:** plain statblock text, including Homebrewery markdown.

Uploaded pictures (and pictures embedded inside JSON files) are saved in `worlds/<your world>/statblock-5e/`.
Uploading needs Foundry's *Upload New Files* permission; picking existing files needs *Use File Browser*.

### Monsters, NPCs and familiars
| Import as | Folder | Token |
|---|---|---|
| Monster | Monsters | Hostile, not linked |
| NPC | NPCs | Neutral, not linked |
| Familiar | Familiars | Friendly, linked, vision on |

For **familiars** you can also pick the **player who owns it** and change its creature type to **Celestial, Fey or Fiend**,
as *Find Familiar* allows.

## What gets imported
Everything is built the way the official dnd5e monsters are, so it works with the sheet, the chat cards and the combat tracker:

- **Statistics:** size, type and subtype, swarms, alignment, AC (natural armor shown as such), HP and hit dice formula,
  initiative, all speeds and hover, ability scores, saving throw and skill proficiencies (expertise included),
  damage vulnerabilities, resistances and immunities (including "from nonmagical attacks"), condition immunities,
  senses, languages and telepathy, and CR. A printed proficiency bonus that differs from the CR's (homebrew NPCs with
  class levels) is respected: saves, skills and spell DC still show the printed totals.
- **Attacks** roll exactly the printed to-hit and damage, including extra damage ("plus 4 (1d8) acid damage"),
  melee-or-ranged weapons, two-handed versatile damage, and conditional damage ("if the attack roll had Advantage")
  as a separate option.
- **Saving throw effects** (breath weapons, auras, rays) get the printed DC, save, damage, half-on-success and area template.
- **Recharge 5–6**, **X/Day** and **per rest** features track their uses.
- **Legendary actions** (with the number per round and costs), **legendary resistance**, and **lair actions**.
- **Weapons and gear** go in the inventory: weapon attacks (Dagger +2, Dagger of Venom, Light Crossbow…) become equipped
  weapons that still roll the printed numbers, and magic items named in traits (Cloak of Displacement), the Armor Class
  note (ring of protection) or the 2024 Gear line are added as equipped items. Matching compendium items supply icons
  and details; their Active Effects are left off because the printed numbers already include them.
- **Spellcasting** (2014 and 2024, slots and innate/X per day): spells are copied from your compendiums — the dnd5e SRD
  spells included — onto the actor, so they sit under Cantrips, 1st Level, 2nd Level… with the printed slot counts,
  save DC and attack bonus. At-will and X/Day spells go to their own sections with tracked uses. Legendary actions that cast a spell
  ("uses Spellcasting to cast Command") link the spell too. Spells that can't be found are listed after import.
- Traits and actions get matching Foundry icons, and the original statblock text is kept in the biography.

## Macro API
```js
Statblock5e.open();
await Statblock5e.importText(text, { kind: "monster", book: "Marks of Aeyra" });   // kind: "monster" | "npc" | "familiar"
await Statblock5e.importText(text, { kind: "familiar", ownerId: game.users.getName("Sam").id, target: "world.bestiary" });
// With art: give each parsed statblock an img (portrait) and/or token
const [owl] = Statblock5e.parse(text).map(r => r.data);
await Statblock5e.importStatblocks([{ ...owl, img: "worlds/aeyra/art/owl.webp", token: "worlds/aeyra/art/owl-token.webp" }], { kind: "familiar" });
```

## Notes
- Scanned or image-only PDFs have no text to read; copy the text out of your PDF reader instead, or run OCR first.
- Effects that change other things (a condition a hit applies, an aura's ongoing effect) stay as description text.
- This module only reads text you paste or load. It doesn't log in to or download from any website.

## Development
`examples/example-statblocks.txt` holds test statblocks in both editions. After changing anything, run `./build.sh`
and commit `statblock-5e.zip` — that zip is what Foundry downloads. The GitHub check parses the examples and
confirms the zip is up to date.

## License
MIT — see [LICENSE.txt](LICENSE.txt).
