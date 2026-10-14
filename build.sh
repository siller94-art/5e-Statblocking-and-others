#!/bin/sh
# Rebuild the zip Foundry downloads (module files at the root of the zip). Run after any change, then commit the zip.
cd "$(dirname "$0")" && rm -f statblock-5e.zip && zip -rq statblock-5e.zip module.json README.md LICENSE.txt scripts styles examples && echo "built statblock-5e.zip"
