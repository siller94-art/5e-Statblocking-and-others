const MODULE_ID = "trait-importer";
const VERSION = "1.1.1";

Hooks.once("init", () => console.log(`${MODULE_ID} | Trait Importer ${VERSION} initialized`));

function getActor(actor) {
  return actor || canvas?.tokens?.controlled?.[0]?.actor || null;
}

function categoryLabel(category) {
  return {
    attack: "Attack",
    feature: "Feature / Trait",
    legendary: "Legendary Action"
  }[category] || category;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function parseText(text) {
  const blocks = String(text || "")
    .replace(/\u00a0/g, " ")
    .split(/\n\s*\n/)
    .map(x => x.trim())
    .filter(Boolean);

  return blocks.map(block => {
    const lines = block.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    let name = lines.shift() || "Imported Trait";
    let description = lines.join("<br>");
    const match = name.match(/^(.+?)\.\s+(.+)$/);

    if (match) {
      name = match[1];
      description = [match[2], ...lines].join("<br>");
    }

    return {
      name,
      type: "feat",
      system: { description: { value: description, chat: "" } }
    };
  });
}

function normalizeJson(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.actor?.items)) return data.actor.items;
  if (data.item) return [data.item];
  return [data];
}

function parseInput(text) {
  try {
    return normalizeJson(JSON.parse(text));
  } catch {
    return parseText(text);
  }
}

function unescapePdfString(value) {
  return value
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractPdfOperators(text) {
  const chunks = [];
  const stringRegex = /\((?:\\.|[^\\)])*\)\s*Tj/g;

  for (const match of text.matchAll(stringRegex)) {
    const raw = match[0]
      .replace(/\)\s*Tj$/, "")
      .replace(/^\(/, "");
    chunks.push(unescapePdfString(raw));
  }

  const arrayRegex = /\[((?:\([^)]*\)|<[^>]*>|\s|[-+]?\d+(?:\.\d+)?)+)\]\s*TJ/g;

  for (const match of text.matchAll(arrayRegex)) {
    const values = match[1].match(/\((?:\\.|[^\\)])*\)|<[^>]*>/g) || [];
    chunks.push(values.map(value => {
      if (value.startsWith("<")) {
        const hex = value.slice(1, -1).replace(/\s/g, "");
        try {
          const bytes = new Uint8Array(
            hex.match(/.{1,2}/g)?.map(x => parseInt(x.padEnd(2, "0"), 16)) || []
          );
          return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        } catch {
          return "";
        }
      }
      return unescapePdfString(value.slice(1, -1));
    }).join(""));
  }

  return chunks;
}

async function inflatePdfStream(bytes) {
  try {
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return bytes;
  }
}

async function extractPdfText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const latin = new TextDecoder("latin1").decode(bytes);
  const chunks = [];
  let offset = 0;

  while (true) {
    const start = latin.indexOf("stream", offset);
    if (start < 0) break;

    const dataStart = latin[start + 6] === "\r" && latin[start + 7] === "\n"
      ? start + 8
      : latin[start + 6] === "\n"
        ? start + 7
        : start + 6;

    const end = latin.indexOf("endstream", dataStart);
    if (end < 0) break;

    const dictionaryStart = Math.max(0, latin.lastIndexOf("<<", start));
    const dictionary = latin.slice(dictionaryStart, start);
    const raw = bytes.slice(dataStart, end);
    const decoded = dictionary.includes("/FlateDecode")
      ? await inflatePdfStream(raw)
      : raw;

    chunks.push(new TextDecoder("utf-8", { fatal: false }).decode(decoded));
    offset = end + 9;
  }

  if (!chunks.length) {
    throw new Error("No readable PDF text streams were found.");
  }

  const extracted = chunks.flatMap(extractPdfOperators).join("\n");

  if (!extracted.trim()) {
    throw new Error("The PDF contains no extractable text. Scanned/image-only PDFs require OCR and are not supported yet.");
  }

  return extracted;
}

function prepare(item, category) {
  const data = foundry.utils.deepClone(item || {});
  data.name ||= "Imported Trait";
  data.type = category === "attack" && data.type === "weapon" ? "weapon" : "feat";
  data.system ??= {};
  data.system.description ??= { value: "", chat: "" };
  data.flags ??= {};
  data.flags[MODULE_ID] = { category };
  return data;
}

async function importItems(actor, text, category) {
  actor = getActor(actor);
  if (!actor) throw new Error("Select an Actor or token first.");

  const items = parseInput(text)
    .filter(Boolean)
    .map(x => prepare(x, category));

  if (!items.length) throw new Error("No importable items were found.");
  return actor.createEmbeddedDocuments("Item", items);
}

async function importFile(actor, file, category) {
  if (!file) throw new Error("No file was selected.");

  const name = String(file.name || "").toLowerCase();
  if (!name.endsWith(".json") && !name.endsWith(".pdf")) {
    throw new Error("Unsupported file type. Please use a .json or .pdf file.");
  }

  const text = name.endsWith(".pdf")
    ? await extractPdfText(file)
    : await file.text();

  if (!text.trim()) throw new Error("The selected file is empty.");
  return importItems(actor, text, category);
}

function updateDropStatus(root, message, state = "") {
  const status = root?.querySelector?.(".trait-importer-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function wireDropZone(root, actor) {
  if (!(root instanceof HTMLElement)) {
    console.error(`${MODULE_ID} | Could not find the dialog HTML element.`);
    return;
  }

  const zone = root.querySelector(".trait-drop-zone");
  const fileInput = root.querySelector("input[name=file]");
  const categoryInput = root.querySelector("select[name=category]");

  if (!zone || !fileInput || !categoryInput) {
    console.error(`${MODULE_ID} | Drag/drop controls were not found in the dialog.`);
    return;
  }

  const processFile = async file => {
    try {
      updateDropStatus(root, `Reading ${file.name}…`, "working");
      const created = await importFile(actor, file, categoryInput.value);
      const label = categoryLabel(categoryInput.value);
      updateDropStatus(root, `Imported ${created.length} ${label} item(s).`, "success");
      ui.notifications.info(`Imported ${created.length} ${label} item(s) into ${actor.name}.`);
      fileInput.value = "";
    } catch (error) {
      console.error(`${MODULE_ID} | File import failed`, error);
      updateDropStatus(root, error?.message || "File import failed.", "error");
      ui.notifications.error(error?.message || "File import failed.");
    }
  };

  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });
  zone.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", event => {
    event.preventDefault();
    zone.classList.remove("dragover");
    const file = event.dataTransfer?.files?.[0];
    if (file) processFile(file);
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) processFile(file);
  });
}

async function openImporter(actor) {
  actor = getActor(actor);
  if (!actor) {
    ui.notifications.warn("Select an Actor or token first.");
    return;
  }

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("Trait Importer requires Foundry VTT v14 or newer.");
    return;
  }

  const content = `
  <div class="trait-importer" style="min-width:760px">
    <p><strong>Actor:</strong> ${escapeHtml(actor.name)} (${escapeHtml(actor.type)})</p>

    <div class="form-group">
      <label>Import Type</label>
      <select name="category">
        <option value="attack">Attacks</option>
        <option value="feature">Features / Traits</option>
        <option value="legendary">Legendary Actions</option>
      </select>
    </div>

    <div class="trait-drop-zone" tabindex="0" role="button">
      <i class="fa-solid fa-cloud-arrow-up"></i>
      <strong>Drag & Drop JSON or PDF Here</strong>
      <span>or click to choose a file</span>
      <small>Supported: .json and .pdf</small>
      <input type="file" name="file" accept=".json,.pdf,application/json,application/pdf" hidden>
    </div>

    <div class="trait-importer-status" aria-live="polite">
      Drop a file to import it directly.
    </div>

    <div class="form-group">
      <label>Or paste Foundry Item JSON / stat-block text</label>
      <textarea name="source" rows="14" style="width:100%" placeholder="JSON object/array or simple text blocks."></textarea>
    </div>
  </div>`;

  const dialog = new DialogV2({
    window: {
      title: "Trait Importer",
      icon: "fa-solid fa-file-import"
    },
    position: { width: 900 },
    content,
    buttons: [
      {
        action: "import",
        label: "Import Text",
        icon: "fa-solid fa-file-import",
        default: true,
        callback: async (_event, button) => {
          const form = button.form;
          const text = String(form?.elements?.source?.value || "").trim();
          if (!text) {
            ui.notifications.warn("Paste content first, or drag in a JSON/PDF file.");
            return false;
          }

          const category = form.elements.category.value;
          const created = await importItems(actor, text, category);
          ui.notifications.info(`Imported ${created.length} ${categoryLabel(category)} item(s) into ${actor.name}.`);
          return true;
        }
      },
      {
        action: "cancel",
        label: "Close",
        icon: "fa-solid fa-xmark"
      }
    ]
  });

  await dialog.render(true);
  wireDropZone(dialog.element, actor);
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
  buttons.unshift({
    label: "Trait Importer",
    class: "trait-importer-button",
    icon: "fa-solid fa-file-import",
    onclick: () => openImporter(app.actor)
  });
});

globalThis.TraitImporter = {
  open: actor => openImporter(actor),
  import: (actor, text, category = "feature") => importItems(actor, text, category),
  importFile: (actor, file, category = "feature") => importFile(actor, file, category)
};