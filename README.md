# Statblock 5e

A Foundry VTT v14 module for importing D&D 5e content from pasted text or text-based PDFs.

## Current support

- Monster / NPC statblocks → creates a D&D5e NPC Actor.
- Species / Race → creates a D&D5e Race Item.
- Class → creates a D&D5e Class Item.
- Subclass → creates a D&D5e Subclass Item.
- Auto-detection or manual content-type selection.
- PDF, TXT, MD, and JSON text loading.
- No build step and no external runtime dependency.

## PDF limitation

The built-in PDF reader extracts text from text-based PDFs. Scanned/image-only PDFs do not contain selectable text and must be OCR'd before importing.

## Installation

### Manifest installation

Use this manifest URL in Foundry VTT's **Install Module** window:

`https://raw.githubusercontent.com/siller94-art/5e-Statblocking-and-others/main/module.json`

### Manual ZIP installation

Extract the `statblock-5e` folder into your Foundry `Data/modules/` directory.

The module targets Foundry VTT 14.359+ and D&D5e 6.0.0.

## License

MIT. See `LICENSE.txt`.
