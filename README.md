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
2. Paste one or more statblocks, press **Paste** to read your clipboard, or drop / open a `.txt`, `.md` or `.pdf` file.
   Several statblocks can go in at once: each new "Medium Humanoid, Neutral" line starts the next creature.
3. With **Auto parse** on, the right side shows each creature as a statblock card: AC, HP, speed, CR, the six
   abilities with saves, every trait and action with what was understood (attack bonus and damage, save DC,
   recharge, uses per day, spells), and ⚠ notes for anything to check.
4. Pick a **source book** name and where the creatures go (world actors or an unlocked Actor compendium), then **Import**.

Re-importing a creature with **Update existing** checked replaces it in place (keeping its artwork) instead of making a copy.

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
  senses, languages and telepathy, and CR.
- **Attacks** roll exactly the printed to-hit and damage, including extra damage ("plus 4 (1d8) acid damage"),
  melee-or-ranged weapons, two-handed versatile damage, and conditional damage ("if the attack roll had Advantage")
  as a separate option.
- **Saving throw effects** (breath weapons, auras, rays) get the printed DC, save, damage, half-on-success and area template.
- **Recharge 5–6**, **X/Day** and **per rest** features track their uses.
- **Legendary actions** (with the number per round and costs), **legendary resistance**, and **lair actions**.
- **Spellcasting** (2014 and 2024, slots and innate/X per day): spells are linked from your compendiums — the dnd5e SRD
  spells included — with the printed save DC, attack bonus and casting ability. Legendary actions that cast a spell
  ("uses Spellcasting to cast Command") link the spell too. Spells that can't be found are listed after import.
- Traits and actions get matching Foundry icons, and the original statblock text is kept in the biography.

## Macro API
```js
Statblock5e.open();
await Statblock5e.importText(text, { kind: "monster", book: "Marks of Aeyra" });   // kind: "monster" | "npc" | "familiar"
await Statblock5e.importText(text, { kind: "familiar", ownerId: game.users.getName("Sam").id, target: "world.bestiary" });
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
