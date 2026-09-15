# Statblock 5e

A simple, unified Foundry VTT v14 module for importing D&D 5e content, plus an installable phone-friendly DM companion.

## Version 4.3.0

### Easy importer UI
- Compact dark upload controls inspired by the straightforward workflow of the established 5e Statblock Importer.
- **Drop a file here** / **Choose File** for PDF, TXT, MD, and JSON.
- **Paste Clipboard Text** for copied statblocks.
- Manual D&D Beyond copy/paste workflow.
- Live **statblock preview** updates as text is pasted or edited.
- Preview shows detected content type, monster name, AC, HP, speed, CR, ability scores, detected action categories, attack count, and a collapsible source preview.
- Clear and normal Ctrl+V / Cmd+V workflows remain supported.
- A dark **Create** button is available in the importer dialog and triggers the existing import action.

### DM phone app
The repository now includes a lightweight Progressive Web App at `app/`. It is designed for DMs using a phone at the table and can be added to the home screen from a supported browser.

- Paste a statblock and use **Correct Formatting** to normalize spacing, headings, and common field labels.
- Preview the cleaned statblock in a phone-friendly 5e-style card.
- Save corrected statblocks to a local **DM Library**.
- Search the library, reopen entries, copy them, or delete them.
- Library data is stored locally on the device; no account or server database is required.
- Offline caching is included after the app has been opened once online.
- This is a web/PWA companion, not a native App Store or Play Store binary.

### Automatic Foundry icon matching
Imported Items are automatically assigned matching **Foundry VTT core icons** when the item does not already have a custom image. The icon matcher uses Foundry's bundled icon paths and does not download outside artwork.

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

### Phone DM app
Open the `/app/` directory from a web host that serves the repository, then use your phone browser's **Add to Home Screen / Install App** option. A GitHub Pages deployment is suitable once Pages is enabled for the repository.

### Manual ZIP installation
Download the repository ZIP and place the module folder in your Foundry `Data/modules/` directory.

## Project

`https://github.com/siller94-art/5e-Statblocking-and-others`

## License

MIT. See `LICENSE.txt`.
