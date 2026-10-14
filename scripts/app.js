import { importStatblocks, escapeHTML, MODULE_ID, KINDS } from "./builder.js";
import { parseStatblocks } from "./parser.js";
import { readFile } from "./files.js";

const { ApplicationV2 } = foundry.applications.api;

const SECTION_LABEL = { trait: "Traits", action: "Actions", bonus: "Bonus Actions", reaction: "Reactions", legendary: "Legendary Actions", lair: "Lair Actions", mythic: "Mythic Actions" };
const SIZE_LABEL = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };
const ABBR = ["str", "dex", "con", "int", "wis", "cha"];
const mod = s => Math.floor((Number(s ?? 10) - 10) / 2);
const signed = n => (n >= 0 ? `+${n}` : `${n}`);
const crLabel = cr => (cr == null ? "?" : cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));

const PLACEHOLDER = `Paste one or more statblocks here, straight from a PDF, D&D Beyond, a website or Homebrewery. 2014 and 2024 layouts both work.

Goblin Warrior
Small Fey (Goblinoid), Chaotic Neutral
AC 15   Initiative +2 (12)
HP 10 (3d6)
Speed 30 ft.
...

Several statblocks can go in at once; each new size/type line starts the next creature.`;

export class StatblockImporterApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "statblock-5e-importer",
    classes: ["sb5e-app"],
    window: { title: "Import Statblocks", icon: "fas fa-dragon", resizable: true },
    position: { width: 1040, height: 760 },
    actions: {
      parse: function () { this.parse(); },
      openFile: function () { this.element.querySelector("input[name=file]").click(); },
      paste: function () { this.pasteClipboard(); },
      import: function () { this.runImport(); },
      clear: function () { this.clear(); }
    }
  };

  results = [];
  #timer = null;

  async _renderHTML() {
    const last = game.settings.get(MODULE_ID, "lastTarget");
    const lastKind = game.settings.get(MODULE_ID, "lastKind");
    const packs = game.packs.filter(p => p.documentName === "Actor" && !p.locked);
    const players = game.users.filter(u => !u.isGM);
    const div = document.createElement("div");
    div.className = "sb5e-body";
    div.innerHTML = `
      <section class="sb5e-pane sb5e-source">
        <div class="sb5e-toolbar">
          <label>Import as <select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === lastKind ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
          <label>Edition <select name="rules"><option value="auto">Auto</option><option value="2024">2024</option><option value="2014">2014</option></select></label>
          <label class="sb5e-check"><input type="checkbox" name="auto" checked> Auto parse</label>
        </div>
        <div class="sb5e-toolbar sb5e-familiar" ${lastKind === "familiar" ? "" : "hidden"}>
          <label>Owner <select name="owner"><option value="">No player</option>${players.map(u => `<option value="${u.id}">${escapeHTML(u.name)}</option>`).join("")}</select></label>
          <label>Creature type <select name="typeOverride">
            <option value="">As written</option><option value="celestial">Celestial</option><option value="fey">Fey</option><option value="fiend">Fiend</option>
          </select></label>
        </div>
        <textarea name="source" spellcheck="false" placeholder="${escapeHTML(PLACEHOLDER)}"></textarea>
        <div class="sb5e-toolbar">
          <span class="sb5e-spacer"></span>
          <button type="button" data-action="clear"><i class="fas fa-eraser"></i> Clear</button>
          <button type="button" data-action="paste"><i class="fas fa-clipboard"></i> Paste</button>
          <button type="button" data-action="openFile"><i class="fas fa-folder-open"></i> Open file</button>
          <button type="button" data-action="parse"><i class="fas fa-magnifying-glass"></i> Parse</button>
          <input type="file" name="file" accept=".txt,.md,.markdown,.pdf,.json,text/plain,application/pdf,application/json" hidden>
        </div>
      </section>
      <section class="sb5e-pane sb5e-result">
        <div class="sb5e-preview"><p class="sb5e-empty">Paste a statblock on the left. You'll see what was read before anything is created.</p></div>
        <div class="sb5e-footer">
          <label>Source book <input type="text" name="book" value="${escapeHTML(game.settings.get(MODULE_ID, "lastBook"))}"></label>
          <label>Import into <select name="target">
            <option value="world">World actors</option>
            ${packs.length ? `<optgroup label="Compendiums">${packs.map(p => `<option value="${p.collection}" ${p.collection === last ? "selected" : ""}>${escapeHTML(p.title)}</option>`).join("")}</optgroup>` : ""}
          </select></label>
          <label class="sb5e-check" title="Replace creatures this module imported before (same name, edition and kind)"><input type="checkbox" name="update" checked> Update existing</label>
          <button type="button" data-action="import" class="sb5e-import" disabled><i class="fas fa-file-import"></i> Import</button>
        </div>
      </section>`;
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  _onRender() {
    const el = this.element;
    const src = this.#q("source");
    const schedule = () => {
      if (!this.#q("auto").checked) return;
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.parse(), 300);
    };
    src.addEventListener("input", schedule);
    this.#q("rules").addEventListener("change", schedule);
    this.#q("kind").addEventListener("change", ev => {
      el.querySelector(".sb5e-familiar").hidden = ev.target.value !== "familiar";
      game.settings.set(MODULE_ID, "lastKind", ev.target.value);
    });
    this.#q("file").addEventListener("change", async ev => {
      const f = ev.target.files[0];
      ev.target.value = "";
      if (f) await this.#loadFile(f);
    });
    // Drop a file anywhere on the paste box.
    src.addEventListener("dragover", ev => ev.preventDefault());
    src.addEventListener("drop", async ev => {
      const f = ev.dataTransfer?.files?.[0];
      if (!f) return;
      ev.preventDefault();
      await this.#loadFile(f);
    });
  }

  #q(n) { return this.element.querySelector(`[name=${n}]`); }

  async #loadFile(file) {
    try {
      this.#q("source").value = await readFile(file);
      this.parse();
      ui.notifications.info(`Loaded ${file.name}.`);
    } catch (err) {
      ui.notifications.error(err.message || `Couldn't read ${file.name}.`);
    }
  }

  async pasteClipboard() {
    try {
      this.#q("source").value = await navigator.clipboard.readText();
      this.parse();
    } catch {
      this.#q("source").focus();
      ui.notifications.warn("Your browser blocked clipboard access. Click the box and press Ctrl+V / Cmd+V.");
    }
  }

  clear() {
    this.#q("source").value = "";
    this.results = [];
    this.#show();
  }

  parse() {
    const text = this.#q("source").value.trim();
    this.results = text ? parseStatblocks(text, { rules: this.#q("rules").value }) : [];
    this.#show();
  }

  #show() {
    const preview = this.element.querySelector(".sb5e-preview");
    const btn = this.element.querySelector(".sb5e-import");
    const ok = this.results.filter(r => !r.error);
    btn.disabled = !ok.length;
    btn.innerHTML = `<i class="fas fa-file-import"></i> Import${ok.length ? ` ${ok.length}` : ""}`;
    if (!this.results.length) {
      preview.innerHTML = `<p class="sb5e-empty">Paste a statblock on the left. You'll see what was read before anything is created.</p>`;
      return;
    }
    preview.innerHTML = this.results.map(r => this.#card(r)).join("");
  }

  #card(r) {
    const d = r.data;
    if (r.error) return `<article class="sb5e-card sb5e-bad"><h3>${escapeHTML(d.name)}</h3><ul class="sb5e-warnings">${r.warnings.map(w => `<li>${escapeHTML(w)}</li>`).join("")}</ul></article>`;
    const sub = [SIZE_LABEL[d.size] ?? "", d.swarm ? `Swarm of ${SIZE_LABEL[d.swarm]}` : "", d.type ? d.type[0].toUpperCase() + d.type.slice(1) : "", d.subtype ? `(${d.subtype})` : ""].filter(Boolean).join(" ");
    const speed = Object.entries(d.speed ?? {}).filter(([k, v]) => k !== "hover" && v).map(([k, v]) => (k === "walk" ? `${v} ft.` : `${k} ${v} ft.`)).join(", ");
    const abilities = ABBR.map(k => {
      const v = d.abilities?.[k];
      const save = d.saves?.[k];
      return `<div class="sb5e-ab ${v == null ? "sb5e-missing" : ""}"><b>${k.toUpperCase()}</b><span>${v ?? "?"}</span><small>${v == null ? "" : signed(mod(v))}${save != null ? ` · save ${signed(save)}` : ""}</small></div>`;
    }).join("");
    const groups = {};
    for (const en of d.entries ?? []) (groups[en.section] ??= []).push(en);
    const sections = Object.entries(groups).map(([sec, list]) => `
      <div class="sb5e-section"><h4>${SECTION_LABEL[sec] ?? sec}</h4><ul>${list.map(en => `<li><strong>${escapeHTML(en.name)}</strong>${this.#tags(en)}</li>`).join("")}</ul></div>`).join("");
    return `
      <article class="sb5e-card ${r.warnings.length ? "sb5e-warned" : ""}">
        <header>
          <h3>${escapeHTML(d.name)}</h3>
          <span class="sb5e-badge">${r.rules}</span>
        </header>
        <p class="sb5e-sub">${escapeHTML(sub)}${d.alignment ? `, ${escapeHTML(d.alignment)}` : ""}</p>
        <div class="sb5e-stats">
          <span><b>AC</b> ${d.ac ?? "?"}${d.acNote ? ` <small>(${escapeHTML(d.acNote)})</small>` : ""}</span>
          <span><b>HP</b> ${d.hp ?? "?"}${d.hpFormula ? ` <small>(${escapeHTML(d.hpFormula)})</small>` : ""}</span>
          <span><b>Speed</b> ${escapeHTML(speed || "?")}${d.speed?.hover ? " (hover)" : ""}</span>
          <span><b>CR</b> ${crLabel(d.cr)}</span>
        </div>
        <div class="sb5e-abilities">${abilities}</div>
        ${r.found.length ? `<ul class="sb5e-found">${r.found.map(f => `<li><i class="fas fa-check"></i>${escapeHTML(f)}</li>`).join("")}</ul>` : ""}
        ${sections}
        ${r.warnings.length ? `<ul class="sb5e-warnings">${r.warnings.map(w => `<li><i class="fas fa-triangle-exclamation"></i>${escapeHTML(w)}</li>`).join("")}</ul>` : ""}
      </article>`;
  }

  #tags(en) {
    const t = [];
    if (en.usage?.recharge) t.push(`Recharge ${en.usage.recharge}${en.usage.recharge < 6 ? "–6" : ""}`);
    if (en.usage?.max) t.push(`${en.usage.max}/${en.usage.per === "day" ? "Day" : en.usage.per === "lr" ? "Long Rest" : "Short Rest"}`);
    if (en.usage?.cost > 1) t.push(`Costs ${en.usage.cost}`);
    if (en.attack) t.push(`${en.attack.both ? "Melee/Ranged" : en.attack.type === "ranged" ? "Ranged" : "Melee"} ${signed(en.attack.bonus)}${en.attack.damage.length ? ` · ${en.attack.damage.filter(p => !p.condition).map(p => `${p.dice} ${p.type}`).join(" + ")}` : ""}`);
    if (en.save) t.push(`DC ${en.save.dc} ${en.save.ability.toUpperCase()}${en.save.damage?.length ? ` · ${en.save.damage.map(p => `${p.dice} ${p.type}`).join(" + ")}` : ""}${en.area ? ` · ${en.area.size} ft ${en.area.type}` : ""}`);
    if (en.heal) t.push(`Heals ${en.heal}`);
    if (en.castSpell) t.push(`Casts ${en.castSpell.name}`);
    if (en.spellcasting) {
      const sc = en.spellcasting;
      const n = sc.groups.reduce((a, g) => a + g.spells.length, 0);
      t.push(`${n} spells${sc.dc ? ` · DC ${sc.dc}` : ""}${sc.attack != null ? ` · ${signed(sc.attack)} to hit` : ""}`);
    }
    return t.length ? ` <span class="sb5e-tags">${t.map(x => `<em>${escapeHTML(x)}</em>`).join("")}</span>` : "";
  }

  async runImport() {
    const statblocks = this.results.filter(r => !r.error).map(r => r.data);
    if (!statblocks.length) return ui.notifications.warn("Nothing to import.");
    const opts = {
      target: this.#q("target").value,
      kind: this.#q("kind").value,
      book: this.#q("book").value.trim() || "Homebrew",
      update: this.#q("update").checked,
      ownerId: this.#q("owner")?.value || null,
      typeOverride: this.#q("typeOverride")?.value || ""
    };
    await game.settings.set(MODULE_ID, "lastTarget", opts.target);
    await game.settings.set(MODULE_ID, "lastBook", opts.book);

    const btn = this.element.querySelector(".sb5e-import");
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Importing…`;
    let report;
    try {
      report = await importStatblocks(statblocks, opts);
    } catch (err) {
      console.error(err);
      ui.notifications.error(`Import failed: ${err.message}`);
      return this.#show();
    }
    this.#show();
    const msg = `Created ${report.created}, updated ${report.updated}, skipped ${report.skipped}.`;
    const notes = [...report.errors.map(e => ["bad", e]), ...report.warnings.map(w => ["warn", w])];
    if (notes.length) {
      this.element.querySelector(".sb5e-preview").insertAdjacentHTML("afterbegin", `
        <article class="sb5e-card ${report.errors.length ? "sb5e-bad" : "sb5e-warned"}">
          <header><h3>${report.errors.length ? "Import finished with errors" : "Imported, with notes"}</h3></header>
          <p class="sb5e-sub">${msg}</p>
          <ul class="sb5e-warnings">${notes.map(([, n]) => `<li><i class="fas fa-triangle-exclamation"></i>${escapeHTML(n)}</li>`).join("")}</ul>
        </article>`);
    }
    if (report.errors.length) ui.notifications.warn(`${msg} ${report.errors.length} error(s): see the importer window.`);
    else ui.notifications.info(`Statblocks imported. ${msg}`);
  }
}
