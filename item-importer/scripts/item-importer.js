const ID = "simple-5e-item-importer";
const TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
function parseInput(raw) {
  const text = raw.trim();
  if (!text) throw new Error("Paste item details first.");
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text);
    const data = parsed.item && typeof parsed.item === "object" ? parsed.item : parsed;
    if (!data.name || typeof data.name !== "string") throw new Error("JSON requires an item name.");
    if (data.type && !TYPES.includes(data.type)) throw new Error("Unsupported item type.");
    return {name:data.name.trim(),type:data.type||"loot",img:data.img||"icons/svg/item-bag.svg",system:data.system && typeof data.system==="object" ? data.system : {description:{value:String(data.description||"")}}};
  }
  const lines = text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const name = lines.shift();
  const typeLine = lines.find(x=>/^type\s*:/i.test(x));
  const type = typeLine ? typeLine.split(":").slice(1).join(":").trim().toLowerCase() : "loot";
  if (!TYPES.includes(type)) throw new Error("Type must be: "+TYPES.join(", "));
  const description = lines.filter(x=>!/^type\s*:/i.test(x)).join("\n");
  const safe = foundry.utils.escapeHTML(description).replace(/\n/g,"<br>");
  return {name,type,img:"icons/svg/item-bag.svg",system:{description:{value:"<p>"+safe+"</p>"}}};
}
async function openImporter() {
  const content = `<form><p>Paste an item name and description. Optional: Type: weapon, equipment, consumable, tool, loot, or container. Foundry Item JSON is also accepted.</p><textarea name="itemText" rows="13" style="width:100%" placeholder="Moonlit Sword\nType: weapon\nA magical sword..."></textarea></form>`;
  new foundry.applications.api.DialogV2({
    window:{title:"Simple Item Importer"},
    content,
    buttons:[
      {action:"cancel",label:"Cancel"},
      {action:"create",label:"Create Item",default:true,callback:async(_event,button)=>{
        try {
          const raw=button.form.elements.itemText.value;
          const data=parseInput(raw);
          const item=await Item.create(data);
          if (!item) throw new Error("Foundry did not create the item.");
          ui.notifications.info("Created item: "+item.name+". Drag it from Items onto a character sheet.");
        } catch(error) {ui.notifications.error("Item import failed: "+error.message); return false;}
      }}
    ]
  }).render(true);
}
Hooks.once("ready",()=>{
  if(game.system.id!=="dnd5e") return;
  game.modules.get(ID).api={openImporter,parseInput};
  if(!game.user.isGM) return;
  Hooks.on("renderItemDirectory",(_app,html)=>{
    const root=html instanceof HTMLElement?html:html?.[0];
    if(!root || root.querySelector(".simple-item-importer-button")) return;
    const button=document.createElement("button");
    button.className="simple-item-importer-button";
    button.type="button";
    button.textContent="Import Item";
    button.addEventListener("click",openImporter);
    root.prepend(button);
  });
  ui.notifications.info("Simple Item Importer ready.");
});
