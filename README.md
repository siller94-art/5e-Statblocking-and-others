# Statblock 5e

A simple, unified Foundry VTT v14 module for importing D&D 5e content.

## Version 4.1.0

### Easy importer UI
- Large **Drop a file here** upload area.
- **Choose File** button for PDF, TXT, MD, and JSON.
- Large **Paste Clipboard Text** button.
- Manual D&D Beyond copy/paste workflow.
- Live **statblock preview** updates as text is pasted or edited.
- Preview shows detected content type, monster name, AC, HP, speed, CR, ability scores, detected action categories, attack count, and a collapsible source preview.
- Auto-detection can still be overridden with the content type selector.
- Clear and normal Ctrl+V / Cmd+V workflows remain supported.

### Supported input
- Clipboard Text
- Manual D&D Beyond copy/paste
- PDF with selectable text
- TXT
- MD
- JSON

Scanned/image-only PDFs need OCR before importing.

### Supported content categories
- Monster / NPC
- Weapon
- Attack
- Trait
- Action
- Bonus Action
- Reaction
- Legendary Action
- Lair Action
- Species / Race
- Class
- Subclass
- Auto-detect

### Monster / NPC information
The importer attempts to preserve and populate common statblock information when present, including name, size, creature type, alignment, AC, HP and formula, speed, six ability scores, proficiency bonus, challenge rating, passive perception, senses, languages, skills, saving throws, resistances, immunities, condition immunities, spellcasting text, traits, actions, bonus actions, reactions, legendary actions, and lair actions.

The complete original source text is preserved in the imported actor/item description so information that does not map cleanly to a D&D5e field is not lost.

### Weapons and attacks
Weapons and attacks are separate importer choices. Monster attacks are recognized separately from ordinary actions. Attack parsing attempts to capture melee/ranged type, attack bonus, ability, damage dice, damage modifier, damage type, reach, range, and long range. The module attempts to attach a native D&D5e v6 Attack Activity while retaining the weapon if the activity schema is rejected.

### D&D Beyond and website workflow
This module uses manual copy/paste. It does not log in to websites, scrape pages, run bots, bypass access controls, or automatically download protected website content. Copy only material you have permission to use.

## Compatibility
- Foundry VTT **14.359+ / v14**
- D&D5e **6.0.0**
- No build step
- No external runtime dependency

## Installation

### Manifest installation
Paste this manifest into Foundry VTT's **Install Module** window:

`https://raw.githubusercontent.com/siller94-art/5e-Statblocking-and-others/main/module.json`

### Manual ZIP installation
Download the repository ZIP and place the module folder in your Foundry `Data/modules/` directory.

## Project

`https://github.com/siller94-art/5e-Statblocking-and-others`

## License

MIT. See `LICENSE.txt`.
