# Statblock 5e

A simple, unified Foundry VTT v14 module for importing D&D 5e content without a build step.

## Version 4.0.0

### Simple import workflow
1. Open the **Actor Directory**.
2. Click **Import 5e Content**.
3. Choose **Auto-detect** or select exactly what you are importing.
4. Either click **Paste Clipboard Text**, use normal **Ctrl+V / Cmd+V**, or upload a file.
5. Click **Import**.

### Supported input
- **Clipboard Text** — copies text already on your clipboard into the importer.
- **Manual D&D Beyond copy/paste** — copy the entry yourself from D&D Beyond, then paste it into the module.
- **PDF** — extracts common selectable PDF text streams.
- **TXT** — plain text files.
- **MD** — Markdown files.
- **JSON** — JSON files are read and formatted as source text.

Scanned/image-only PDFs do not contain selectable text and need OCR before importing.

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
The importer attempts to preserve and populate common statblock information when it is present, including:
- Name
- Size and creature type
- Alignment
- Armor Class
- Hit Points and HP formula
- Speed
- Six ability scores
- Proficiency bonus
- Challenge Rating
- Passive Perception
- Senses
- Languages
- Skills
- Saving throws
- Damage resistances
- Damage immunities
- Condition immunities
- Spellcasting text
- Traits
- Actions
- Bonus Actions
- Reactions
- Legendary Actions
- Lair Actions

The complete original source text is also preserved in the imported actor/item description so information that does not map cleanly to a D&D5e field is not lost.

### Weapons and attacks
Weapons and attacks are separate importer choices.

- **Weapon** creates a D&D5e weapon item.
- **Attack** creates an NPC actor containing the attack weapon/activity.
- Monster attacks are recognized separately from normal actions.
- Attack parsing attempts to capture melee/ranged type, attack bonus, ability, damage dice, damage modifier, damage type, reach, range, and long range.
- The module attempts to attach a native D&D5e v6 Attack Activity. If the system rejects an activity schema, the weapon item is retained instead of aborting the import.

### Action categories
Monster entries are separated into their own categories:
- Traits
- Actions
- Bonus Actions
- Reactions
- Legendary Actions
- Lair Actions

Lair actions are specifically created as **Lair Action:** items rather than being mixed into ordinary actions.

### D&D Beyond and website workflow
This module uses a manual copy/paste workflow. It does not:
- log in to D&D Beyond or another website;
- scrape web pages;
- run bots against websites;
- bypass access controls;
- automatically download protected website content.

Copy only material you have permission to use.

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
