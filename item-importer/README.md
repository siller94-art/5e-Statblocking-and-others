# Homebrew Item Importer (D&D 5e)

Paste items straight from a PDF, a website or Homebrewery, press **Parse**, check what was detected,
and import them as ready-to-use dnd5e items. Works with 2014 and 2024 wording.
Requires **Foundry v14** and **dnd5e 6.x**.

## Install
In Foundry's setup screen open **Add-on Modules → Install Module**, paste this into **Manifest URL** and click **Install**:

```
https://raw.githubusercontent.com/siller94-art/5e-Statblocking-and-others/main/item-importer/module.json
```

Enable **Homebrew Item Importer (D&D 5e)** in your world. The **Items** sidebar gets an **Import Items** button.

## Using it
1. Paste one or many items into the left box, or **Open file** for a .txt/.md file.
   Magic items split automatically on their type line ("Ring, uncommon"); separate anything else with a line of `---`.
2. With **Auto parse** on, the right side shows a card per item: ✓ for every field found, ⚠ for anything to check.
3. Fix anything flagged: change the edition, or open **Edit parsed data** and edit it directly.
4. Pick a source book name and where to put the items: **world items**, an unlocked **compendium**,
   or an **actor's inventory** (characters and NPCs you own). Press **Import**.

Re-importing an item with **Update existing** checked updates it in place instead of making a copy.
See `examples/example-items.txt` for sample text.

## What it reads
| Item | Recognised by | Becomes |
|---|---|---|
| Weapons | `Weapon (longsword), rare`, `Martial Melee Weapon`, `Damage:` | Weapon with base weapon stats, attack, +N bonus, extra damage, saves, mastery |
| Armor and shields | `Armor (plate)`, `Armor (shield)`, `Armor Class:` | Armor with AC, Dex cap, Strength requirement, stealth disadvantage, +N bonus |
| Potions, scrolls, poisons, food, ammunition, wands | `Potion, uncommon` etc. | Consumable with healing, damage or save, charges and recovery |
| Rings, rods, wondrous items | `Ring, rare (requires attunement)` | Equipment with charges, saves and limited uses |
| Tools and instruments | `Tool (artisan's tools)` | Tool with an ability check |
| Bags and other containers | `can hold up to 500 pounds` | Container with weight and volume capacity |
| Gems, art, treasure, trade goods, gear | `Gem`, `Cost: 500 gp` | Loot |

Also read anywhere in the text: `Cost:`/`Price:`, `Weight:`, `Properties:` (with thrown/ammunition range and
versatile damage), rarity, attunement (and who it's for), "has 7 charges", "regains 1d6 + 1 expended charges
daily at dawn", "can't be used again until the next dawn", "+1 bonus to attack and damage rolls",
"+2 bonus to AC", "extra 1d6 cold damage", "DC 15 Strength saving throw", "regain 4d4 + 4 Hit Points",
and quantities like `Arrows (20)`. Base weapons and armor fill in their normal stats and use the SRD artwork.

Passive bonuses such as resistances or a ring's +1 to AC and saves stay as description text; add an
Active Effect if you want them automated. Pasting Foundry item JSON also works and imports it as written.

## Macro API
```js
HomebrewItemImporter.open();
await HomebrewItemImporter.importText(text, { book: "Marks of Aeyra", target: "world" }); // or "actor:<id>" or a compendium id
```

## Development
After changing files, run `./build.sh` and commit `homebrew-item-importer.zip` — that zip is what Foundry downloads.
