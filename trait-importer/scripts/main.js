const MODULE_ID = "trait-importer";

Hooks.once("init", () => console.log(`${MODULE_ID} | Trait Importer initialized`));

function getActor(actor) {
  return actor || canvas?.tokens?.controlled?.[0]?.actor || null;
}

function categoryLabel(category) {
  return {attack:"Attack", feature:"Feature / Trait", legendary:"Legendary Action"}[category] || category;
}

function parseText(text) {
  const blocks = String(text || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    let name = lines.shift() || "Imported Trait";
    let description = lines.join("<br>");
    const match = name.match(/^(.+?)\.\s+(.+)$/);
    if (match) { name = match[1]; description = [match[2], ...lines].join("<br>"); }
    return {name, type: "feat", system: {description: {value: description, chat: ""}}};
  });
}

function parseInput(text) {
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  } catch { return parseText(text); }
}

function prepare(item, category) {
  const data = foundry.utils.deepClone(item);
  data.name ||= "Imported Trait";
  data.type = category === "attack" && data.type === "weapon" ? "weapon" : "feat";
  data.system ??= {};
  data.system.description ??= {value: "", chat: ""};
  data.flags ??= {};
  data.flags[MODULE_ID] = {category};
  return data;
}

async function importItems(actor, text, category) {
  actor = getActor(actor);
  if (!actor) throw new Error("Select an Actor or a token first.");
  const items = parseInput(text).map(x => prepare(x, category));
  return actor.createEmbeddedDocuments("Item", items);
}

async function openImporter(actor) {
  actor = getActor(actor);
  if (!actor) return ui.notifications.warn("Select an Actor or token first.");
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return ui.notifications.error("Trait Importer requires Foundry VTT v14.");

  const content = `
  <div class="trait-importer" style="min-width:760px">
    <p><strong>Actor:</strong> ${foundry.utils.escapeHTML(actor.name)} (${foundry.utils.escapeHTML(actor.type)})</p>
    <div class="form-group"><label>Import Type</label>
      <select name="category">
        <option value="attack">Attacks</option>
        <option value="feature">Features / Traits</option>
        <option value="legendary">Legendary Actions</option>
      </select>
    </div>
    <div class="form-group"><label>Paste Foundry Item JSON or stat-block text</label>
      <textarea name="source" rows="20" style="width:100%" placeholder='JSON object/array or simple text blocks. Example:\n\nLongsword. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) slashing damage.\n\nParry. The creature adds 2 to its AC against one melee attack that would hit it.'></textarea>
    </div>
  </div>`;

  new DialogV2({
    window: {title: "Trait Importer", icon: "fa-solid fa-file-import"},
    position: {width: 900},
    content,
    buttons: [
      {action:"import", label:"Import", icon:"fa-solid fa-file-import", default:true, callback: async (_e, button) => {
        const form = button.form;
        const text = String(form.elements.source.value || "").trim();
        if (!text) { ui.notifications.warn("Paste content first."); return false; }
        const category = form.elements.category.value;
        const created = await importItems(actor, text, category);
        ui.notifications.info(`Imported ${created.length} ${categoryLabel(category)} item(s) into ${actor.name}.`);
        return true;
      }},
      {action:"cancel", label:"Cancel", icon:"fa-solid fa-xmark"}
    ]
  }).render(true);
}

Hooks.on("getActorDirectoryEntryContext", (_html, options) => {
  options.push({
    name: "Trait Importer",
    icon: '<i class="fa-solid fa-file-import"></i>',
    condition: () => game.user.isGM,
    callback: li => openImporter(game.actors.get(li.dataset.entryId || li.dataset.documentId))
  });
});

Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
  if (!game.user.isGM || !app.actor) return;
  buttons.unshift({label:"Trait Importer", class:"trait-importer-button", icon:"fa-solid fa-file-import", onclick:() => openImporter(app.actor)});
});

globalThis.TraitImporter = {
  open: actor => openImporter(actor),
  import: (actor, text, category = "feature") => importItems(actor, text, category)
};
