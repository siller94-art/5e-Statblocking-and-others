import { importItems, escapeHTML, MODULE_ID } from "./builders.js";
import { parseItems } from "./parser.js";

const { ApplicationV2 } = foundry.applications.api;

const KIND = {
  weapon: ["Weapon", "fa-sword"], armor: ["Armor", "fa-shield-halved"], consumable: ["Consumable", "fa-flask"],
  equipment: ["Equipment", "fa-ring"], tool: ["Tool", "fa-screwdriver-wrench"], container: ["Container", "fa-sack"],
  loot: ["Loot", "fa-gem"]
};

const PLACEHOLDER = `Paste items here — straight from a PDF, website or Homebrewery. Several items can go in at once.

Flame Tongue
Weapon (any sword), rare (requires attunement)
While holding this magic weapon, you can use a bonus action to ...

Mundane gear works too:
Harpoon
Martial Melee Weapon
Cost: 12 gp, Weight: 4 lb.
Damage: 1d8 piercing
Properties: Thrown (range 20/60)

Separate items without a rarity line with a line of ---`;

export class ItemImporterApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "homebrew-item-importer-app",
    classes: ["hii-app"],
    window: { title: "Import Items", icon: "fas fa-file-import", resizable: true },
    position: { width: 980, height: 720 },
    actions: {
      parse: function () { this.parse(); },
      openFile: function () { this.element.querySelector("input[name=file]").click(); },
      import: function () { this.runImport(); },
      clear: function () { this.clear(); }
    }
  };

  results = [];
  #timer = null;

  #destinations() {
    const last = game.settings.get(MODULE_ID, "lastTarget");
    const sel = v => (v === last ? "selected" : "");
    const packs = game.packs.filter(p => p.documentName === "Item" && !p.locked);
    const actors = game.actors.filter(a => a.isOwner && ["character", "npc"].includes(a.type))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "character" ? -1 : 1));
    return `<option value="world">World items</option>`
      + (packs.length ? `<optgroup label="Compendiums">${packs.map(p => `<option value="${p.collection}" ${sel(p.collection)}>${escapeHTML(p.title)}</option>`).join("")}</optgroup>` : "")
      + (actors.length ? `<optgroup label="Actor inventory">${actors.map(a => `<option value="actor:${a.id}" ${sel(`actor:${a.id}`)}>${escapeHTML(a.name)}</option>`).join("")}</optgroup>` : "");
  }

  async _renderHTML() {
    const div = document.createElement("div");
    div.className = "hii-body";
    div.innerHTML = `
      <section class="hii-pane hii-source">
        <div class="hii-toolbar">
          <select name="rules" title="Rules edition">
            <option value="auto">Edition: auto</option><option value="2024">2024 (5.5e)</option><option value="2014">2014 (5e)</option>
          </select>
          <label class="hii-check"><input type="checkbox" name="auto" checked> Auto parse</label>
        </div>
        <textarea name="source" spellcheck="false" placeholder="${escapeHTML(PLACEHOLDER)}"></textarea>
        <div class="hii-toolbar">
          <span class="hii-spacer"></span>
          <button type="button" data-action="clear"><i class="fas fa-eraser"></i> Clear</button>
          <button type="button" data-action="openFile"><i class="fas fa-folder-open"></i> Open file</button>
          <button type="button" data-action="parse"><i class="fas fa-magnifying-glass"></i> Parse</button>
          <input type="file" name="file" accept=".txt,.md,.json,.markdown,text/plain,application/json" hidden>
        </div>
      </section>
      <section class="hii-pane hii-result">
        <div class="hii-preview"><p class="hii-empty">Paste items on the left. Each item shows what was found before anything is created.</p></div>
        <details class="hii-json"><summary>Edit parsed data</summary><textarea name="json" spellcheck="false"></textarea>
          <p class="hint">Changes here are used on import. Parsing again replaces them.</p></details>
        <div class="hii-footer">
          <label>Source book <input type="text" name="book" value="${escapeHTML(game.settings.get(MODULE_ID, "lastBook"))}"></label>
          <label>Import into <select name="target">${this.#destinations()}</select></label>
          <label class="hii-check" title="Overwrite items this module imported before (same type, name and edition)"><input type="checkbox" name="update" checked> Update existing</label>
          <button type="button" data-action="import" class="hii-import" disabled><i class="fas fa-file-import"></i> Import</button>
        </div>
      </section>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onRender() {
    const el = this.element;
    const src = el.querySelector("textarea[name=source]");
    const schedule = () => {
      if (!el.querySelector("input[name=auto]").checked) return;
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.parse(), 350);
    };
    src.addEventListener("input", schedule);
    el.querySelector("select[name=rules]").addEventListener("change", schedule);
    el.querySelector("input[name=file]").addEventListener("change", async ev => {
      const f = ev.target.files[0];
      if (!f) return;
      src.value = await f.text();
      ev.target.value = "";
      this.parse();
    });
  }

  #q(n) { return this.element.querySelector(`[name=${n}]`); }

  clear() {
    this.#q("source").value = "";
    this.results = [];
    this.#show([]);
  }

  parse() {
    const text = this.#q("source").value.trim();
    if (!text) return this.#show([]);
    if (/^[[{]/.test(text)) {
      try {
        const data = JSON.parse(text);
        const list = Array.isArray(data) ? data : data.items ?? [data];
        this.results = [];
        return this.#show(list, `<p class="hii-empty">Foundry item JSON detected: ${list.length} item(s) will be imported as written.</p>`);
      } catch (err) {
        return this.#show([], `<p class="hii-warn">Looks like JSON but couldn't be read: ${escapeHTML(err.message)}</p>`);
      }
    }
    this.results = parseItems(text, { rules: this.#q("rules").value });
    this.#show(this.results.filter(r => r.kind).map(r => ({ kind: r.kind, ...r.data })));
  }

  #show(entries, message) {
    const preview = this.element.querySelector(".hii-preview");
    const btn = this.element.querySelector(".hii-import");
    this.#q("json").value = entries.length ? JSON.stringify(entries, null, 2) : "";
    btn.disabled = !entries.length;
    btn.innerHTML = `<i class="fas fa-file-import"></i> Import${entries.length ? ` ${entries.length}` : ""}`;
    if (message) { preview.innerHTML = message; return; }
    if (!this.results.length) {
      preview.innerHTML = `<p class="hii-empty">Paste items on the left. Each item shows what was found before anything is created.</p>`;
      return;
    }
    preview.innerHTML = this.results.map(r => {
      const [label, icon] = KIND[r.kind] ?? ["Not recognised", "fa-circle-question"];
      const q = r.data?.quantity > 1 ? ` <span class="hii-qty">×${r.data.quantity}</span>` : "";
      return `
      <article class="hii-card ${r.kind ? (r.warnings.length ? "hii-warned" : "") : "hii-bad"}">
        <header>
          <i class="fas ${icon}"></i>
          <strong>${escapeHTML(r.data?.name ?? "Unknown")}${q}</strong>
          <span class="hii-badge">${label}</span>
          ${r.rules ? `<span class="hii-badge hii-rules">${r.rules}</span>` : ""}
        </header>
        ${r.found.length ? `<ul class="hii-found">${r.found.map(x => `<li><i class="fas fa-check"></i>${escapeHTML(x)}</li>`).join("")}</ul>` : ""}
        ${r.warnings.length ? `<ul class="hii-warnings">${r.warnings.map(x => `<li><i class="fas fa-triangle-exclamation"></i>${escapeHTML(x)}</li>`).join("")}</ul>` : ""}
      </article>`;
    }).join("");
  }

  async runImport() {
    let entries;
    try { entries = JSON.parse(this.#q("json").value || "[]"); } catch (err) {
      return ui.notifications.error(`The parsed data isn't valid JSON: ${err.message}`);
    }
    entries = [].concat(entries);
    if (!entries.length) return ui.notifications.warn("Nothing to import.");
    const target = this.#q("target").value;
    const book = this.#q("book").value.trim() || "Homebrew";
    await game.settings.set(MODULE_ID, "lastTarget", target);
    await game.settings.set(MODULE_ID, "lastBook", book);

    const btn = this.element.querySelector(".hii-import");
    btn.disabled = true;
    let report;
    try {
      report = await importItems(entries, { target, book, update: this.#q("update").checked });
    } catch (err) {
      console.error(err);
      return ui.notifications.error(`Import failed: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
    const msg = `Created ${report.created}, updated ${report.updated}, skipped ${report.skipped}.`;
    if (report.errors.length) {
      ui.notifications.warn(`${msg} ${report.errors.length} error(s): see the list in the window.`);
      this.element.querySelector(".hii-preview").insertAdjacentHTML("afterbegin",
        `<article class="hii-card hii-bad"><header><strong>Import finished with errors</strong></header><ul class="hii-warnings">${report.errors.map(e => `<li>${escapeHTML(e)}</li>`).join("")}</ul></article>`);
    } else {
      ui.notifications.info(`Items imported. ${msg}`);
    }
  }
}
