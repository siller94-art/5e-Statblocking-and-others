/* Statblock 5e v4.0.0
 * Foundry VTT v14 / D&D5e v6
 * Manual importer: Clipboard Text, PDF/TXT/MD/JSON, and D&D Beyond copy/paste.
 */
const MODULE_ID = "statblock-5e";
const VERSION = "4.0.0";
const SIMPLE_TYPES = new Set(["race", "class", "subclass"]);
const SECTION_TYPES = new Set(["trait", "action", "bonus", "reaction", "legendary", "lair"]);

Hooks.once("init", () => console.log(`${MODULE_ID} | Initializing v${VERSION}`));
Hooks.once("ready", () => console.log(`${MODULE_ID} | Ready`));

Hooks.on("renderActorDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const header = root.querySelector(".directory-header .action-buttons") || root.querySelector(".directory-header");
  if (!header || header.querySelector("[data-statblock5e]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.statblock5e = "true";
  button.innerHTML = '<i class="fa-solid fa-file-import"></i> Import 5e Content';
  button.addEventListener("click", openImporter);
  header.appendChild(button);
});

function openImporter() {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return ui.notifications.error("Statblock 5e requires Foundry VTT v14.");

  const content = `
  <div class="statblock-5e-importer" style="min-width:760px">
    <p><strong>Import D&D 5e Content</strong></p>
    <p class="hint">Use manual copy/paste from D&D Beyond or another source, paste from your clipboard, or load a PDF/TXT/MD/JSON file. Nothing is scraped or logged in to.</p>
    <div class="form-group"><label>What are you importing?</label>
      <select name="contentType">
        <option value="auto">Auto-detect</option>
        <option value="monster">Monster / NPC</option>
        <option value="weapon">Weapon</option>
        <option value="attack">Attack</option>
        <option value="trait">Trait</option>
        <option value="action">Action</option>
        <option value="bonus">Bonus Action</option>
        <option value="reaction">Reaction</option>
        <option value="legendary">Legendary Action</option>
        <option value="lair">Lair Action</option>
        <option value="race">Species / Race</option>
        <option value="class">Class</option>
        <option value="subclass">Subclass</option>
      </select>
    </div>
    <div class="form-group" style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" id="sb5e-paste"><i class="fa-solid fa-clipboard"></i> Paste Clipboard Text</button>
      <button type="button" id="sb5e-clear"><i class="fa-solid fa-eraser"></i> Clear</button>
    </div>
    <div class="form-group"><label>File upload</label>
      <input id="sb5e-file" type="file" accept=".pdf,.txt,.md,.text,.json,application/pdf,text/plain,application/json">
      <p class="hint">Supported: selectable-text PDF, TXT, MD, and JSON. Scanned/image-only PDFs need OCR first.</p>
    </div>
    <div class="form-group"><label>Source text</label>
      <textarea id="sb5e-text" name="sourceText" rows="22" placeholder="Paste the complete D&D 5e entry here..."></textarea>
    </div>
    <div id="sb5e-preview" class="hint" style="border-top:1px solid #999;padding-top:8px">Ready to import.</div>
  </div>`;

  new DialogV2({
    window: { title: "Statblock 5e Importer", icon: "fa-solid fa-file-import" },
    position: { width: 900 },
    content,
    buttons: [
      { action: "import", label: "Import", icon: "fa-solid fa-file-import", default: true, callback: async (_event, button) => {
        const form = button.form;
        const text = String(form.elements.sourceText?.value || "").trim();
        if (!text) { ui.notifications.warn("Paste text or load a readable file first."); return false; }
        await importContent(text, form.elements.contentType?.value || "auto");
        return true;
      } },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    render: (_event, dialog) => {
      const root = dialog.element;
      const textBox = root.querySelector("#sb5e-text");
      const preview = root.querySelector("#sb5e-preview");
      const updatePreview = () => {
        const text = textBox?.value || "";
        const selected = root.querySelector("[name=contentType]")?.value || "auto";
        preview.textContent = text.trim() ? `Detected: ${labelForType(selected === "auto" ? detectType(normalize(text)) : selected)} | ${text.length.toLocaleString()} characters` : "Ready to import.";
      };
      root.querySelector("#sb5e-paste")?.addEventListener("click", async () => {
        try {
          textBox.value = await navigator.clipboard.readText();
          updatePreview();
          ui.notifications.info("Clipboard text pasted.");
        } catch (err) {
          console.warn(err);
          textBox.focus();
          ui.notifications.warn("Clipboard permission was blocked. Click the text box and press Ctrl+V / Cmd+V.");
        }
      });
      root.querySelector("#sb5e-clear")?.addEventListener("click", () => { textBox.value = ""; updatePreview(); });
      root.querySelector("#sb5e-file")?.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          textBox.value = await readFile(file);
          updatePreview();
          ui.notifications.info(`Loaded ${file.name}.`);
        } catch (err) { ui.notifications.error(err.message || "Could not read the file."); }
      });
      textBox?.addEventListener("input", updatePreview);
      root.querySelector("[name=contentType]")?.addEventListener("change", updatePreview);
    }
  }).render({ force: true });
}

function labelForType(type) {
  return ({auto:"Auto-detect",monster:"Monster / NPC",weapon:"Weapon",attack:"Attack",trait:"Trait",action:"Action",bonus:"Bonus Action",reaction:"Reaction",legendary:"Legendary Action",lair:"Lair Action",race:"Species / Race",class:"Class",subclass:"Subclass"})[type] || type;
}

async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file);
  const text = await file.text();
  if (name.endsWith(".json")) return parseJsonSource(text);
  return text;
}

function parseJsonSource(raw) {
  try {
    const data = JSON.parse(raw);
    if (typeof data === "string") return data;
    return JSON.stringify(data, null, 2);
  } catch (_) { return raw; }
}

async function extractPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const raw = new TextDecoder("latin1").decode(bytes);
  const output = [];
  let cursor = 0;
  while (cursor < raw.length) {
    const streamStart = raw.indexOf("stream", cursor);
    if (streamStart < 0) break;
    let dataStart = streamStart + 6;
    if (raw[dataStart] === "\r") dataStart++;
    if (raw[dataStart] === "\n") dataStart++;
    const streamEnd = raw.indexOf("endstream", dataStart);
    if (streamEnd < 0) break;
    const objectHeader = raw.slice(Math.max(0, raw.lastIndexOf("obj", streamStart - 1)), streamStart);
    let data = bytes.slice(dataStart, streamEnd);
    try {
      if (/\/FlateDecode/.test(objectHeader) && typeof DecompressionStream !== "undefined") {
        data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
      }
    } catch (_) {}
    const streamText = new TextDecoder("latin1").decode(data);
    const extracted = extractPdfOperators(streamText);
    if (extracted) output.push(extracted);
    cursor = streamEnd + 10;
  }
  const result = output.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!result) throw new Error("No selectable text was found. Scanned/image-only PDFs need OCR first.");
  return result;
}

function extractPdfOperators(text) {
  const out = [];
  for (const match of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:(?:\\.|[^\]])*?)\]\s*TJ/g)) {
    const parts = match[0].match(/\((?:\\.|[^\\)])*\)/g) || [];
    const value = parts.map(decodePdfString).join("");
    if (value) out.push(value);
  }
  return out.join("\n");
}

function decodePdfString(value) {
  return value.slice(1, -1)
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

async function importContent(source, requestedType) {
  try {
    const text = normalize(source);
    if (!text) throw new Error("The source contains no readable text.");
    const type = requestedType === "auto" ? detectType(text) : requestedType;
    if (type === "monster") return importMonster(text);
    if (SIMPLE_TYPES.has(type)) return importSimpleItem(text, type);
    if (type === "weapon") return importStandaloneWeapon(text);
    if (type === "attack") return importStandaloneAttack(text);
    if (SECTION_TYPES.has(type)) return importStandaloneSection(text, type);
    throw new Error(`Unsupported content type: ${type}`);
  } catch (error) {
    console.error(`${MODULE_ID} | Import failed`, error);
    ui.notifications.error(`Import failed: ${error.message || error}`);
  }
}

function normalize(source) {
  return String(source || "")
    .replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n")
    .replace(/[\u200b\u200c\u200d]/g, "")
    .replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function flatten(text) { return text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim(); }
function clean(line) { return line.replace(/\s+/g, " ").trim(); }
function escapeHtml(text) { return String(text).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
function sourceHtml(text) { return `<p><strong>Imported by Statblock 5e</strong></p><pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`; }

function detectType(text) {
  const t = flatten(text);
  if (/(?:armor class|\bAC\b)\s*[:\-]?\s*\d+/i.test(t) && /(?:hit points|\bHP\b)\s*[:\-]?\s*\d+/i.test(t) && /\b(?:STR|DEX|CON|INT|WIS|CHA)\b\s*[:\-]?\s*\d+/i.test(t)) return "monster";
  if (/\blair\s+actions?\b/i.test(t)) return "lair";
  if (/^(?:melee|ranged) weapon attack|(?:melee|ranged) spell attack|\+\d+\s+to\s+hit/i.test(t)) return "attack";
  if (/weapon properties|weapon mastery|damage\s*[:\-]\s*\d+d\d+/i.test(t)) return "weapon";
  if (/subclass features|subclass|archetype|college|domain|circle|oath|patron|tradition/i.test(t)) return "subclass";
  if (/hit die|class features|starting equipment|multiclassing/i.test(t)) return "class";
  if (/ability score increase|species traits|racial traits|creature type/i.test(t)) return "race";
  return "action";
}

function parseMonster(text) {
  const lines = text.split("\n").map(clean).filter(Boolean);
  const flat = flatten(text);
  const abilities = {};
  for (const [key, label] of Object.entries({str:"STR",dex:"DEX",con:"CON",int:"INT",wis:"WIS",cha:"CHA"})) {
    const match = flat.match(new RegExp(`\\b${label}\\b\\s*[:\\-]?\\s*(\\d+)`, "i"));
    if (match) abilities[key] = Number(match[1]);
  }
  const hp = flat.match(/(?:hit points|\bHP\b)\s*[:\-]?\s*(\d+)(?:\s*\(([^)]+)\))?/i);
  const ac = flat.match(/(?:armor class|\bAC\b)\s*[:\-]?\s*(\d+)/i);
  const speed = flat.match(/(?:speed|movement)\s*[:\-]?\s*(\d+)\s*ft/i);
  const cr = flat.match(/(?:challenge|CR)\s*[:\-]?\s*(\d+(?:\/\d+)?(?:\.\d+)?)/i);
  const prof = flat.match(/(?:proficiency bonus|PB)\s*[:\-]?\s*\+?(\d+)/i);
  const passive = flat.match(/passive\s+(?:perception|wisdom)\s*[:\-]?\s*(\d+)/i);
  const alignment = flat.match(/\b(lawful\s+good|neutral\s+good|chaotic\s+good|lawful\s+neutral|true\s+neutral|chaotic\s+neutral|lawful\s+evil|neutral\s+evil|chaotic\s+evil|unaligned)\b/i);
  const size = flat.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i);
  const type = flat.match(/\b(aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead)\b/i);
  const languages = flat.match(/languages?\s*[:\-]?\s*(.*?)(?=\s+(?:challenge|CR|actions?|traits?|senses|proficiency)\b|$)/i);
  const senses = flat.match(/senses?\s*[:\-]?\s*(.*?)(?=\s+(?:languages?|challenge|CR|actions?|traits?)\b|$)/i);
  const resist = findLineAfter(lines, /^(damage resistances?|resistances?)\b/i);
  const immune = findLineAfter(lines, /^(damage immunities?|immunities?)\b/i);
  const conditionImmune = findLineAfter(lines, /^(condition immunities?)\b/i);
  const skills = findLineAfter(lines, /^skills?\b/i);
  const saves = findLineAfter(lines, /^(saving throws?|saves?)\b/i);
  const spellcasting = findSpellcasting(lines);
  return {
    name: findName(lines), abilities, ac: ac ? +ac[1] : null, hp: hp ? +hp[1] : null, formula: hp?.[2] || "",
    speed: speed ? +speed[1] : null, cr: cr?.[1] || "", prof: prof ? +prof[1] : null, passive: passive ? +passive[1] : null,
    alignment: alignment?.[1] || "", size: size?.[1] || "", creatureType: type?.[1] || "",
    languages: languages?.[1] || "", senses: senses?.[1] || "", skills, saves, resistances: resist, immunities: immune,
    conditionImmunities: conditionImmune, spellcasting, entries: parseSections(lines)
  };
}

function findLineAfter(lines, regex) {
  const index = lines.findIndex(line => regex.test(line));
  if (index < 0) return "";
  const line = lines[index].replace(regex, "").replace(/^\s*[:\-]?\s*/, "").trim();
  return line || lines[index + 1] || "";
}
function findSpellcasting(lines) {
  const start = lines.findIndex(l => /spellcasting/i.test(l));
  if (start < 0) return "";
  return lines.slice(start, Math.min(lines.length, start + 15)).join(" ");
}
function findName(lines) {
  for (const line of lines.slice(0, 12)) {
    if (/^(armor class|hit points|speed|str|dex|con|int|wis|cha|challenge|proficiency bonus|languages|senses)\b/i.test(line)) continue;
    if (/^(tiny|small|medium|large|huge|gargantuan)\b.*\b(aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead)\b/i.test(line)) continue;
    return line.replace(/\s*\(.*?\)\s*$/, "").trim() || line;
  }
  return "Imported Monster";
}

function parseSections(lines) {
  const entries = [];
  const headers = /^(traits?|actions?|bonus actions?|reactions?|legendary actions?|lair actions?|features?)$/i;
  let section = "";
  let current = null;
  for (const line of lines) {
    if (headers.test(line)) {
      if (current) entries.push(current);
      current = null;
      section = canonicalSection(line);
      continue;
    }
    if (!section) continue;
    const match = line.match(/^([^.!?]{2,120})\.\s+(.+)/);
    if (match) {
      if (current) entries.push(current);
      current = makeEntry(match[1], match[2], section);
    } else if (current) current.description += ` ${line}`;
  }
  if (current) entries.push(current);
  return entries.slice(0, 100);
}
function canonicalSection(value) {
  const s = value.toLowerCase();
  if (s.startsWith("trait") || s === "features") return "trait";
  if (s.startsWith("bonus")) return "bonus";
  if (s.startsWith("reaction")) return "reaction";
  if (s.startsWith("legendary")) return "legendary";
  if (s.startsWith("lair")) return "lair";
  return "action";
}
function makeEntry(name, description, section) {
  const attack = parseAttack(description);
  return { name: name.trim(), description: description.trim(), section, isAttack: isAttackText(description), ...attack };
}
function isAttackText(text) { return /\b(?:melee|ranged)\s+(?:weapon|spell)?\s*attack\b|\bto hit\b/i.test(text); }

function parseAttack(text) {
  const bonus = text.match(/([+-]\d+)\s*to\s*hit/i)?.[1];
  const damage = text.match(/(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?\s*([a-z]+)?\s*damage/i);
  const reach = text.match(/reach\s+(\d+)\s*ft/i);
  const range = text.match(/range\s+(\d+)\s*(?:\/\s*(\d+)\s*)?ft/i);
  const ranged = /\branged\b/i.test(text);
  const ability = ranged ? "dex" : "str";
  return {
    bonus: bonus == null ? null : +bonus,
    number: damage ? +damage[1] : 1,
    die: damage ? `d${damage[2]}` : "d6",
    modifier: damage?.[4] ? +(damage[3] || "+") + damage[4] : 0,
    damageType: damage?.[5]?.toLowerCase() || "",
    range: range ? +range[1] : (reach ? +reach[1] : (ranged ? 60 : 5)),
    longRange: range?.[2] ? +range[2] : null,
    reach: reach?.[1] ? +reach[1] : null,
    ranged, ability
  };
}

async function importMonster(text) {
  const parsed = parseMonster(text);
  const actor = await Actor.create({ name: parsed.name, type: "npc" });
  const update = {};
  if (parsed.ac != null) update["system.attributes.ac.flat"] = parsed.ac;
  if (parsed.hp != null) { update["system.attributes.hp.value"] = parsed.hp; update["system.attributes.hp.max"] = parsed.hp; }
  if (parsed.formula) update["system.attributes.hp.formula"] = parsed.formula;
  if (parsed.speed != null) update["system.attributes.movement.walk"] = parsed.speed;
  if (parsed.cr) update["system.details.cr"] = parsed.cr;
  if (parsed.prof != null) update["system.attributes.prof"] = parsed.prof;
  if (parsed.passive != null) update["system.attributes.senses.passive"] = parsed.passive;
  if (parsed.alignment) update["system.details.alignment"] = parsed.alignment;
  if (parsed.languages) update["system.traits.languages.custom"] = parsed.languages;
  if (parsed.senses) update["system.attributes.senses.special"] = parsed.senses;
  if (parsed.resistances) update["system.traits.dr.value"] = parsed.resistances;
  if (parsed.immunities) update["system.traits.di.value"] = parsed.immunities;
  if (parsed.conditionImmunities) update["system.traits.ci.value"] = parsed.conditionImmunities;
  for (const [key, value] of Object.entries(parsed.abilities)) update[`system.abilities.${key}.value`] = value;
  update["system.details.biography.value"] = sourceHtml(text);
  await actor.update(update);

  const counts = { trait: 0, action: 0, bonus: 0, reaction: 0, legendary: 0, lair: 0, attack: 0, weapon: 0 };
  for (const entry of parsed.entries) {
    if (entry.section === "lair") { await createSectionItem(actor, entry, "lair"); counts.lair++; continue; }
    if (entry.isAttack) { await createAttackItem(actor, entry); counts.attack++; counts.weapon++; continue; }
    await createSectionItem(actor, entry, entry.section); counts[entry.section]++;
  }
  actor.sheet.render(true);
  ui.notifications.info(`Imported ${actor.name}: ${counts.attack} attack(s), ${counts.weapon} weapon item(s), ${counts.trait} trait(s), ${counts.action} action(s), ${counts.bonus} bonus action(s), ${counts.reaction} reaction(s), ${counts.legendary} legendary action(s), ${counts.lair} lair action(s).`);
  return actor;
}

async function createSectionItem(actor, entry, section) {
  const prefix = section === "lair" ? "Lair Action: " : section === "legendary" ? "Legendary Action: " : section === "bonus" ? "Bonus Action: " : section === "reaction" ? "Reaction: " : section === "trait" ? "Trait: " : "Action: ";
  return Item.create({
    name: `${prefix}${entry.name}`,
    type: "feat",
    system: { description: { value: `<p><strong>${labelForType(section)}</strong></p><p>${escapeHtml(entry.description)}</p>` } }
  }, { parent: actor });
}

async function createAttackItem(actor, entry) {
  const item = await Item.create(makeWeaponData(entry.name, entry.description, entry), { parent: actor });
  await addNativeAttackActivity(item, entry);
  return item;
}

function makeWeaponData(name, description, entry = parseAttack(description)) {
  return {
    name,
    type: "weapon",
    system: {
      description: { value: `<p>${escapeHtml(description)}</p>` },
      actionType: entry.ranged ? "rwak" : "mwak",
      ability: entry.ability,
      attack: { bonus: entry.bonus == null ? "" : String(entry.bonus), flat: true },
      damage: { base: { number: entry.number, denomination: entry.die, bonus: entry.modifier, types: entry.damageType ? [entry.damageType] : [] } },
      range: { value: entry.range, long: entry.longRange, units: "ft" },
      equipped: true,
      proficient: true
    }
  };
}

async function addNativeAttackActivity(item, entry) {
  // D&D5e v6 supports Attack Activities. Keep the weapon if a future schema rejects the activity.
  try {
    const activityId = foundry.utils.randomID();
    await item.update({
      "system.activities": {
        [activityId]: {
          _id: activityId,
          type: "attack",
          name: "Attack",
          activation: { type: "action", value: 1 },
          attack: {
            ability: entry.ability,
            bonus: entry.bonus == null ? "" : String(entry.bonus),
            flat: true,
            type: { value: entry.ranged ? "ranged" : "melee", classification: "weapon" }
          },
          damage: { includeBase: true }
        }
      }
    });
  } catch (error) { console.warn(`${MODULE_ID} | Attack activity could not be attached; weapon retained.`, error); }
}

async function importStandaloneWeapon(text) {
  const named = parseNamedEntry(text);
  const item = await Item.create(makeWeaponData(named.name, text));
  item.sheet.render(true);
  ui.notifications.info(`Created weapon: ${item.name}`);
  return item;
}

async function importStandaloneAttack(text) {
  const named = parseNamedEntry(text);
  const entry = { ...parseAttack(text), name: named.name, description: text };
  const actor = await Actor.create({ name: `${named.name} - Attack`, type: "npc" });
  await createAttackItem(actor, entry);
  actor.sheet.render(true);
  ui.notifications.info(`Created attack: ${named.name}`);
  return actor;
}

async function importStandaloneSection(text, section) {
  const named = parseNamedEntry(text);
  const actor = await Actor.create({ name: `${named.name} - ${labelForType(section)}`, type: "npc" });
  await createSectionItem(actor, { name: named.name, description: text }, section);
  actor.sheet.render(true);
  ui.notifications.info(`Created ${labelForType(section)}: ${named.name}`);
  return actor;
}

async function importSimpleItem(text, type) {
  const named = parseNamedEntry(text);
  const item = await Item.create({ name: named.name, type, system: { description: { value: sourceHtml(text) } } });
  item.sheet.render(true);
  ui.notifications.info(`Created ${labelForType(type)}: ${item.name}`);
  return item;
}

function parseNamedEntry(text) {
  const lines = text.split("\n").map(clean).filter(Boolean);
  return { name: lines[0] || "Imported 5e Content" };
}
