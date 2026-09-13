# Trait Importer

Foundry VTT module for D&D 5e that imports **Attacks**, **Features / Traits**, and **Legendary Actions** separately into Player Characters, NPCs, and Monsters.

## Install

Enable the module in Foundry VTT after installing the repository module. Manifest:

`https://raw.githubusercontent.com/siller94-art/5e-Statblocking-and-others/main/trait-importer/module.json`

## Use

Open an Actor and choose **Trait Importer**. Select the category, then paste native Foundry Item JSON or simple stat-block text.

### Categories

- Attacks
- Features / Traits
- Legendary Actions

The module creates normal D&D 5e Item documents on the Actor and stores the import category in `flags.trait-importer.category`.

### Macro API

```js
TraitImporter.open()
```

```js
await TraitImporter.import(game.actors.get("ACTOR_ID"), `[{"name":"Parry","type":"feat","system":{"description":{"value":"The creature adds 2 to its AC against one melee attack that would hit it."}}}]`, "feature")
```
