import { MODULE_ID, importItems } from "./builders.js";
import { parseItems } from "./parser.js";
import { ItemImporterApp } from "./app.js";

let app;
export function openItemImporter() {
  app ??= new ItemImporterApp();
  return app.render({ force: true });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "lastTarget", { scope: "client", config: false, type: String, default: "world" });
  game.settings.register(MODULE_ID, "lastBook", { scope: "client", config: false, type: String, default: "Homebrew" });
});

Hooks.once("ready", () => {
  const api = {
    open: openItemImporter,
    parse: parseItems,
    /** Parse text and import it in one go: await api.importText(text, { target: "world", book: "My Book" }) */
    importText: (text, opts = {}) => importItems(parseItems(text, opts).filter(r => r.kind).map(r => ({ kind: r.kind, ...r.data })), opts),
    importItems
  };
  game.modules.get(MODULE_ID).api = api;
  globalThis.HomebrewItemImporter = api;
});

Hooks.on("renderItemDirectory", (dir, html) => {
  if (!game.user.hasPermission("ITEM_CREATE")) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".hii-open")) return;
  const host = root.querySelector(".header-actions") ?? root.querySelector(".directory-footer") ?? root.querySelector(".directory-header");
  if (!host) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hii-open";
  btn.innerHTML = `<i class="fas fa-file-import"></i> Import Items`;
  btn.addEventListener("click", ev => { ev.preventDefault(); openItemImporter(); });
  host.append(btn);
});
