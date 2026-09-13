/* Statblock 5e v4.1 UI enhancement
 * Adds a simple drop zone and live statblock preview without changing the importer core.
 */
const SB5E_UI = "statblock-5e-ui";
const SB5E_LABELS = {auto:"Auto-detect",monster:"Monster / NPC",weapon:"Weapon",attack:"Attack",trait:"Trait",action:"Action",bonus:"Bonus Action",reaction:"Reaction",legendary:"Legendary Action",lair:"Lair Action",race:"Species / Race",class:"Class",subclass:"Subclass"};

Hooks.once("ready", () => {
  const observer = new MutationObserver(() => enhanceDialogs());
  observer.observe(document.body, {childList:true, subtree:true});
  enhanceDialogs();
});

function enhanceDialogs() {
  document.querySelectorAll(".statblock-5e-importer").forEach(enhanceImporter);
}

function enhanceImporter(root) {
  if (root.dataset.sb5eUiReady) return;
  root.dataset.sb5eUiReady = "true";

  const textarea = root.querySelector("#sb5e-text");
  const file = root.querySelector("#sb5e-file");
  const preview = root.querySelector("#sb5e-preview");
  const typeSelect = root.querySelector("[name=contentType]");
  if (!textarea || !preview) return;

  root.classList.add("sb5e-modern");

  const intro = root.querySelector("p strong")?.closest("p");
  if (intro) intro.classList.add("sb5e-title");

  const oldFileGroup = file?.closest(".form-group");
  const oldTextGroup = textarea.closest(".form-group");
  const oldPaste = root.querySelector("#sb5e-paste");
  const oldClear = root.querySelector("#sb5e-clear");

  const sourceGrid = document.createElement("div");
  sourceGrid.className = "sb5e-source-grid";
  sourceGrid.innerHTML = `
    <div class="sb5e-dropzone" tabindex="0" role="button" aria-label="Upload a PDF, TXT, MD, or JSON file">
      <div class="sb5e-drop-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
      <strong>Drop a file here</strong>
      <span>PDF, TXT, MD, or JSON</span>
      <button type="button" class="sb5e-browse"><i class="fa-solid fa-folder-open"></i> Choose File</button>
    </div>
    <div class="sb5e-clipboard">
      <div class="sb5e-drop-icon"><i class="fa-solid fa-clipboard"></i></div>
      <strong>Paste from clipboard</strong>
      <span>D&D Beyond or any copied statblock</span>
      <button type="button" class="sb5e-paste-new"><i class="fa-solid fa-paste"></i> Paste Clipboard Text</button>
    </div>`;

  if (oldFileGroup) oldFileGroup.replaceWith(sourceGrid);
  else root.prepend(sourceGrid);
  if (oldTextGroup) oldTextGroup.classList.add("sb5e-source-text");
  if (oldPaste) oldPaste.style.display = "none";
  if (oldClear) oldClear.classList.add("sb5e-clear-original");

  const drop = sourceGrid.querySelector(".sb5e-dropzone");
  const browse = sourceGrid.querySelector(".sb5e-browse");
  const paste = sourceGrid.querySelector(".sb5e-paste-new");

  browse.addEventListener("click", () => file?.click());
  drop.addEventListener("click", e => { if (!e.target.closest("button")) file?.click(); });
  drop.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("button")) file?.click(); });
  ["dragenter","dragover"].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add("is-dragging"); }));
  ["dragleave","drop"].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove("is-dragging"); }));
  drop.addEventListener("drop", e => {
    const picked = e.dataTransfer?.files?.[0];
    if (!picked || !file) return;
    try {
      const dt = new DataTransfer(); dt.items.add(picked); file.files = dt.files;
      file.dispatchEvent(new Event("change", {bubbles:true}));
    } catch (_) { ui.notifications.warn("Use Choose File if the browser blocks drag-and-drop."); }
  });
  paste.addEventListener("click", async () => {
    try {
      textarea.value = await navigator.clipboard.readText();
      textarea.dispatchEvent(new Event("input", {bubbles:true}));
      updatePreview();
      ui.notifications.info("Clipboard text pasted.");
    } catch (_) {
      textarea.focus();
      ui.notifications.warn("Clipboard access was blocked. Press Ctrl+V / Cmd+V in the source box.");
    }
  });

  if (typeSelect) typeSelect.addEventListener("change", updatePreview);
  textarea.addEventListener("input", updatePreview);
  file?.addEventListener("change", () => setTimeout(updatePreview, 50));
  updatePreview();

  function updatePreview() {
    const text = textarea.value.trim();
    if (!text) {
      preview.innerHTML = `<div class="sb5e-empty-preview"><i class="fa-solid fa-eye"></i><strong>Preview will appear here</strong><span>Paste or upload a statblock to see what will be imported.</span></div>`;
      return;
    }
    const selected = typeSelect?.value || "auto";
    const type = selected === "auto" ? detect(text) : selected;
    preview.innerHTML = renderPreview(text, type);
  }
}

function detect(text) {
  const t = text.replace(/\n+/g, " ").replace(/\s+/g, " ");
  if (/(?:armor class|\bAC\b)\s*[:\-]?\s*\d+/i.test(t) && /(?:hit points|\bHP\b)\s*[:\-]?\s*\d+/i.test(t) && /\b(?:STR|DEX|CON|INT|WIS|CHA)\b\s*[:\-]?\s*\d+/i.test(t)) return "monster";
  if (/\blair\s+actions?\b/i.test(t)) return "lair";
  if (/(?:melee|ranged)\s+(?:weapon|spell)?\s*attack|\+\d+\s+to\s+hit/i.test(t)) return "attack";
  if (/weapon properties|weapon mastery/i.test(t)) return "weapon";
  if (/subclass|archetype|college|domain|circle|oath|patron|tradition/i.test(t)) return "subclass";
  if (/hit die|class features|starting equipment/i.test(t)) return "class";
  if (/species traits|racial traits|creature type/i.test(t)) return "race";
  return "action";
}

function renderPreview(text, type) {
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
  const name = lines[0] || "Imported 5e Content";
  const flat = text.replace(/\n+/g, " ").replace(/\s+/g, " ");
  const get = re => flat.match(re)?.[1] || "—";
  const esc = s => String(s).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  const stats = [
    ["AC", get(/(?:armor class|\bAC\b)\s*[:\-]?\s*(\d+)/i)],
    ["HP", get(/(?:hit points|\bHP\b)\s*[:\-]?\s*(\d+)/i)],
    ["Speed", get(/(?:speed|movement)\s*[:\-]?\s*(\d+)\s*ft/i) === "—" ? "—" : `${get(/(?:speed|movement)\s*[:\-]?\s*(\d+)\s*ft/i)} ft.`],
    ["CR", get(/(?:challenge|CR)\s*[:\-]?\s*(\d+(?:\/\d+)?(?:\.\d+)?)/i)]
  ];
  const abilities = ["STR","DEX","CON","INT","WIS","CHA"].map(a => [a, get(new RegExp(`\\b${a}\\b\\s*[:\\-]?\\s*(\\d+)`, "i"))]);
  const sections = ["Trait","Action","Bonus Action","Reaction","Legendary Action","Lair Action"].filter(s => new RegExp(`\\b${s.replace(" ", "\\s+")}s?\\b`, "i").test(text));
  const attacks = (text.match(/(?:melee|ranged)\s+(?:weapon|spell)?\s*attack/gi) || []).length;
  return `<div class="sb5e-preview-card">
    <div class="sb5e-preview-head"><div><div class="sb5e-preview-name">${esc(name)}</div><div class="sb5e-preview-type">${SB5E_LABELS[type] || type}</div></div><span class="sb5e-status"><i class="fa-solid fa-circle-check"></i> Ready</span></div>
    ${type === "monster" ? `<div class="sb5e-stat-row">${stats.map(([k,v]) => `<div><small>${k}</small><strong>${esc(v)}</strong></div>`).join("")}</div><div class="sb5e-ability-row">${abilities.map(([k,v]) => `<div><small>${k}</small><strong>${esc(v)}</strong></div>`).join("")}</div>` : `<div class="sb5e-simple-info"><i class="fa-solid fa-file-lines"></i><span>${lines.length.toLocaleString()} lines · ${text.length.toLocaleString()} characters</span></div>`}
    <div class="sb5e-detected"><strong>Import summary</strong><span>${attacks ? `${attacks} attack${attacks === 1 ? "" : "s"}` : "Content detected"}</span>${sections.map(s => `<span>${s}</span>`).join("")}</div>
    <details><summary>View source preview</summary><pre>${esc(text.slice(0, 6000))}${text.length > 6000 ? "\n…" : ""}</pre></details>
  </div>`;
}
