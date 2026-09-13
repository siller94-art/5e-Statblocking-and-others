/*
 * Statblock 5e v2.0.0
 * Foundry VTT v14 / D&D 5e v6
 * No build step and no external runtime dependencies.
 */

const MODULE_ID = "statblock-5e";
const DND5E_TYPES = new Set(["race", "class", "subclass"]);

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  ui.notifications.info("Statblock 5e is ready. Use Import Statblock from the Actors directory.");
});

Hooks.on("renderActorDirectory", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const header = root.querySelector(".directory-header .action-buttons") || root.querySelector(".directory-header");
  if (!header || header.querySelector(`[data-statblock-5e]`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.statblock5e = "true";
  button.innerHTML = `<i class="fa-solid fa-file-import"></i> Import Statblock`;
  button.title = "Import a D&D 5e statblock, species, class, or subclass";
  button.addEventListener("click", () => openImporter());
  header.appendChild(button);
});

function getDialogV2() {
  return foundry?.applications?.api?.DialogV2 ?? null;
}

async function openImporter() {
  const DialogV2 = getDialogV2();
  if (!DialogV2) {
    ui.notifications.error("Statblock 5e requires Foundry VTT v14 or newer.");
    return;
  }

  const content = `
    <div class="statblock-5e-importer">
      <p><strong>Paste text or choose a PDF/text file.</strong></p>
      <p class="hint">The importer creates an Actor for a monster/NPC, or an Item for a species, class, or subclass.</p>
      <div class="form-group">
        <label for="sb5e-type">Content type</label>
        <select id="sb5e-type" name="contentType">
          <option value="auto">Auto-detect</option>
          <option value="monster">Monster / NPC</option>
          <option value="race">Species / Race</option>
          <option value="class">Class</option>
          <option value="subclass">Subclass</option>
        </select>
      </div>
      <div class="form-group">
        <label for="sb5e-file">PDF or text file</label>
        <input id="sb5e-file" type="file" accept=".pdf,.txt,.md,.text,.json,application/pdf,text/plain,application/json">
      </div>
      <div class="form-group">
        <label for="sb5e-text">Source text</label>
        <textarea id="sb5e-text" name="sourceText" rows="18" placeholder="Paste a D&D 5e statblock here..."></textarea>
      </div>
      <p class="hint">PDF import supports text-based PDFs. Scanned/image-only PDFs require OCR before import.</p>
    </div>`;

  new DialogV2({
    window: { title: "Statblock 5e Importer", icon: "fa-solid fa-file-import" },
    position: { width: 720 },
    content,
    buttons: [
      {
        action: "import",
        label: "Import",
        icon: "fa-solid fa-file-import",
        default: true,
        callback: async (_event, button) => {
          const form = button.form;
          const type = form.elements.contentType.value;
          const text = form.elements.sourceText.value.trim();
          if (!text) {
            ui.notifications.warn("Paste text or choose a readable PDF/text file first.");
            return false;
          }
          await importContent(text, type);
          return true;
        }
      },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    render: (_event, dialog) => {
      const file = dialog.element.querySelector("#sb5e-file");
      const textarea = dialog.element.querySelector("#sb5e-text");
      file?.addEventListener("change", async () => {
        const selected = file.files?.[0];
        if (!selected) return;
        try {
          textarea.value = await readSourceFile(selected);
          ui.notifications.info(`Loaded ${selected.name}. Review the text before importing.`);
        } catch (error) {
          console.error(`${MODULE_ID} | File import failed`, error);
          ui.notifications.error(error.message || "Could not read that file.");
        }
      });
    }
  }).render({ force: true });
}

async function readSourceFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) return await file.text();
  return await extractPdfText(file);
}

/* Lightweight PDF text extraction. It handles the common case of PDFs containing
 * actual text streams and requires no CDN, bundled library, or network access. */
async function extractPdfText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);
  const chunks = [];
  let cursor = 0;

  while (cursor < raw.length) {
    const streamStart = raw.indexOf("stream", cursor);
    if (streamStart < 0) break;
    let dataStart = streamStart + 6;
    if (raw[dataStart] === "\r") dataStart++;
    if (raw[dataStart] === "\n") dataStart++;
    const end = raw.indexOf("endstream", dataStart);
    if (end < 0) break;

    const headerStart = Math.max(raw.lastIndexOf("obj", streamStart - 1), streamStart - 1200);
    const header = raw.slice(headerStart, streamStart);
    const streamBytes = bytes.slice(dataStart, end);
    let text = "";

    try {
      let decodedBytes = streamBytes;
      if (/\/FlateDecode/.test(header) && typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate");
        decodedBytes = new Uint8Array(await new Response(new Blob([streamBytes]).stream().pipeThrough(ds)).arrayBuffer());
      }
      text = new TextDecoder("latin1").decode(decodedBytes);
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not decompress a PDF stream`, error);
    }

    if (text) chunks.push(extractPdfOperators(text));
    cursor = end + 9;
  }

  const result = chunks.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!result) throw new Error("No selectable text was found in this PDF. If it is scanned, run OCR first.");
  return result;
}

function extractPdfOperators(stream) {
  const out = [];
  const token = /\((?:\\.|[^\\)])*\)\s*Tj|\[(?:.|\n)*?\]\s*TJ/g;
  for (const match of stream.matchAll(token)) {
    const s = match[0];
    if (s.includes("TJ")) {
      const parts = s.match(/\((?:\\.|[^\\)])*\)/g) || [];
      out.push(parts.map(decodePdfString).join(""));
    } else {
      out.push(decodePdfString(s.slice(0, s.lastIndexOf(")") + 1)));
    }
  }
  return out.join(" ");
}

function decodePdfString(value) {
  const body = value.startsWith("(") ? value.slice(1, -1) : value;
  return body
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

async function importContent(text, requestedType) {
  const type = requestedType === "auto" ? detectType(text) : requestedType;
  try {
    if (type === "monster") await createMonster(text);
    else if (DND5E_TYPES.has(type)) await createDndItem(text, type);
    else throw new Error(`Unsupported content type: ${type}`);
  } catch (error) {
    console.error(`${MODULE_ID} | Import failed`, error);
    ui.notifications.error(`Import failed: ${error.message}`);
  }
}

function detectType(text) {
  const t = normalize(text);
  if (/(^|\n)\s*(armor class|ac)\s*\d+/i.test(t) && /(hit points|hp)\s+\d+/i.test(t) && /strength\s+\d+/.test(t)) return "monster";
  if (/subclass|subclass features|archetype|college|domain|circle|oath|patron|tradition|school/i.test(t)) return "subclass";
  if (/hit die|class features|starting equipment|multiclassing/i.test(t)) return "class";
  if (/ability score increase|species traits|racial traits|creature type|size\s+(tiny|small|medium|large|huge|gargantuan)/i.test(t)) return "race";
  return "monster";
}

async function createMonster(text) {
  const p = parseMonster(text);
  const data = {
    name: p.name || "Imported Monster",
    type: "npc",
    system: {}
  };
  const actor = await Actor.create(data);
  const updates = {};

  if (p.ac != null) updates["system.attributes.ac.flat"] = p.ac;
  if (p.hp != null) {
    updates["system.attributes.hp.value"] = p.hp;
    updates["system.attributes.hp.max"] = p.hp;
  }
  if (p.hpFormula) updates["system.attributes.hp.formula"] = p.hpFormula;
  if (p.speed != null) updates["system.attributes.movement.walk"] = p.speed;
  for (const [ability, value] of Object.entries(p.abilities)) {
    updates[`system.abilities.${ability}.value`] = value;
  }
  if (p.cr) updates["system.details.cr"] = p.cr;
  if (p.alignment) updates["system.details.alignment"] = p.alignment;
  if (p.size) updates["system.traits.size"] = p.size;
  if (p.typeLine) updates["system.details.type.value"] = p.typeLine;
  updates["system.details.biography.value"] = `<p><strong>Imported by Statblock 5e</strong></p><pre>${escapeHtml(text)}</pre>`;

  try { await actor.update(updates); } catch (e) { console.warn(`${MODULE_ID} | Some monster fields could not be applied`, e); }
  await createMonsterFeatures(actor, p);
  actor.sheet.render(true);
  ui.notifications.info(`Imported monster: ${actor.name}`);
}

function parseMonster(text) {
  const lines = normalize(text).split("\n").map(s => s.trim()).filter(Boolean);
  const name = lines[0] || "Imported Monster";
  const flat = lines.join(" ");
  const abilities = {};
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const label = ability.toUpperCase();
    const m = flat.match(new RegExp(`\\b${label}\\s+(\\d+)\\b`, "i"));
    if (m) abilities[ability] = Number(m[1]);
  }
  const ac = numberAfter(flat, /(?:armor class|ac)\s+(\d+)/i);
  const hpMatch = flat.match(/(?:hit points|hp)\s+(\d+)(?:\s*\(([^)]+)\))?/i);
  const speedMatch = flat.match(/speed\s+(\d+)\s*ft\.?/i);
  const cr = flat.match(/challenge\s+(\d+(?:\/\d+)?(?:\.\d+)?)/i)?.[1];
  const alignment = lines.find(x => /\b(?:lawful|neutral|chaotic|good|evil|unaligned)\b/i.test(x) && x.length < 100) || "";
  const typeLine = lines.find(x => /\b(?:aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead)\b/i.test(x)) || "";
  return { name, abilities, ac, hp: hpMatch ? Number(hpMatch[1]) : null, hpFormula: hpMatch?.[2] || "", speed: speedMatch ? Number(speedMatch[1]) : null, cr, alignment, typeLine, size: detectSize(typeLine) };
}

function detectSize(line) {
  const m = line.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i);
  return m?.[1]?.toLowerCase()?.[0] || null;
}

function numberAfter(text, regex) {
  const m = text.match(regex);
  return m ? Number(m[1]) : null;
}

async function createMonsterFeatures(actor, parsed) {
  const features = parsed.featureBlocks || [];
  if (!features.length) return;
  await actor.createEmbeddedDocuments("Item", features.map(f => ({
    name: f.name,
    type: "feat",
    system: { description: { value: `<p>${escapeHtml(f.text)}</p>` } }
  })));
}

async function createDndItem(text, type) {
  const p = parseItem(text);
  const system = {};
  const description = `<p><strong>Imported by Statblock 5e</strong></p><pre>${escapeHtml(text)}</pre>`;
  if (type === "class") {
    system.description = { value: description };
    system.levels = p.levels || 1;
    system.hitDie = p.hitDie || "d8";
  } else if (type === "subclass") {
    system.description = { value: description };
    if (p.parentClass) system.classIdentifier = slugify(p.parentClass);
  } else {
    system.description = { value: description };
  }
  const item = await Item.create({ name: p.name || `Imported ${type}`, type, system });
  item.sheet.render(true);
  ui.notifications.info(`Imported ${type}: ${item.name}`);
}

function parseItem(text) {
  const lines = normalize(text).split("\n").map(s => s.trim()).filter(Boolean);
  const flat = lines.join(" ");
  return {
    name: lines[0] || "Imported Content",
    hitDie: flat.match(/hit die\s*[:\-]?\s*(d\d+)/i)?.[1],
    levels: Number(flat.match(/(?:levels?|level)\s*[:\-]?\s*(\d+)/i)?.[1]) || undefined,
    parentClass: flat.match(/(?:class|parent class)\s*[:\-]?\s*([A-Za-z][A-Za-z ]{2,40})/i)?.[1]?.trim()
  };
}

function normalize(text) {
  return String(text).replace(/\r\n?/g, "\n").replace(/[\u00a0\u200b]/g, " ").replace(/[ \t]+/g, " ");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
