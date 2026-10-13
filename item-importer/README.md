# Simple 5e Item Importer (prototype)

Standalone Foundry VTT v14 D&D5e module. Copy this directory to Foundry's Data/modules/simple-5e-item-importer (the folder name must match module.json id). Enable it in a D&D5e world. Open the Items directory and choose Import Item. Paste item text or a JSON object with name, type, and system fields. Create the item in the world Items directory, then drag it onto an actor sheet.

This first prototype intentionally does not parse mechanical statistics from prose or import PDFs. JSON system data is passed through to Foundry validation. No live Foundry runtime testing has been performed yet. Keep the original statblock importer untouched until acceptance testing.
