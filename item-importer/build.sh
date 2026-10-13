#!/bin/sh
# Rebuild the zip Foundry downloads. Run from this folder after changing anything, then commit the zip.
cd "$(dirname "$0")" && rm -f homebrew-item-importer.zip && zip -rq homebrew-item-importer.zip module.json README.md scripts styles examples && echo "built homebrew-item-importer.zip"
