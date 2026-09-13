# Statblock 5e

A single-file Foundry VTT v14 module for importing D&D 5e content from copied text, clipboard text, or text-based PDFs.

## Version 3.0.0

### Importer
- Auto-detect or manually select Monster / NPC, Species / Race, Class, Subclass, or Weapon / Attack.
- **Paste Clipboard Text** button for text copied from D&D Beyond and other websites.
- Normal Ctrl+V / Cmd+V also works when browser clipboard permission is unavailable.
- Loads TXT, MD, JSON, and text-based PDF files.
- Preserves the original imported source in the created actor/item description.

### Monsters and NPCs
- Creates a D&D5e NPC Actor.
- Parses AC, HP, HP formula, speed, challenge rating, proficiency bonus, passive perception, size, creature type, alignment, languages, and six ability scores when present.
- Parses Actions, Bonus Actions, Reactions, and Legendary Actions.
- Creates weapon Items for recognizable attacks and feat Items for other actions.

### Weapons and attacks
- Recognizes common 5e phrases such as **Melee Weapon Attack** and **Ranged Weapon Attack**.
- Parses attack bonus, damage dice, damage modifier, damage type, ability, reach/range, and long range.
- Creates a D&D5e weapon Item and attempts to attach a native D&D5e Attack activity. If an activity schema changes or is rejected, the weapon Item is retained instead of aborting the import.

### Species, classes, and subclasses
- Creates native D&D5e Race, Class, and Subclass Items.
- Preserves the complete imported text so it can be edited after import.

## Compatibility
- Foundry VTT **14.359+ / v14**.
- D&D5e **6.0.0**.
- No build step and no external runtime dependency.

## PDF limitation
The built-in reader extracts common selectable PDF text streams. Scanned/image-only PDFs do not contain selectable text and require OCR first.

## Website copying
The clipboard feature is manual copy/paste only. The module does not log in to websites, scrape pages, bypass access controls, or automatically download protected content. Use content only when you have the right to use it.

## Installation

### Manifest installation
Use this manifest URL in Foundry VTT's **Install Module** window:

`https://raw.githubusercontent.com/siller94-art/5e-Statblocking-and-others/main/module.json`

### Manual ZIP installation
Download the repository ZIP and place the `statblock-5e` module folder in your Foundry `Data/modules/` directory.

## Project

`https://github.com/siller94-art/5e-Statblocking-and-others`

## License

MIT. See `LICENSE.txt`.
