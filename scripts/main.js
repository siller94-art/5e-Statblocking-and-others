import { MODULE_ID, importStatblocks } from "./builder.js";
import { parseStatblocks } from "./parser.js";
import { StatblockImporterApp } from "./app.js";

let app;
export function openImporter() {
  app ??= new StatblockImporterApp();
  return app.render({ force: true });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "lastTarget", { scope: "client", config: false, type: String, default: "world" });
  game.settings.register(MODULE_ID, "lastBook", { scope: "client", config: false, type: String, default: "Homebrew" });
  game.settings.register(MODULE_ID, "lastKind", { scope: "client", config: false, type: String, default: "monster" });
});

Hooks.once("ready", () => {
  const api = {
    open: openImporter,
    parse: parseStatblocks,
    /** await Statblock5e.importText(text, { kind: "monster" | "npc" | "familiar", target: "world", book: "My Book" }) */
    importText: (text, opts = {}) => importStatblocks(parseStatblocks(text, opts).filter(r => !r.error).map(r => r.data), opts),
    importStatblocks
  };
  game.modules.get(MODULE_ID).api = api;
  globalThis.Statblock5e = api;
});

Hooks.on("renderActorDirectory", (dir, html) => {
  if (!game.user.hasPermission("ACTOR_CREATE")) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".sb5e-open")) return;
  const host = root.querySelector(".header-actions") ?? root.querySelector(".directory-footer") ?? root.querySelector(".directory-header");
  if (!host) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sb5e-open";
  btn.innerHTML = `<i class="fas fa-dragon"></i> Import Statblock`;
  btn.addEventListener("click", ev => { ev.preventDefault(); openImporter(); });
  host.append(btn);
});
