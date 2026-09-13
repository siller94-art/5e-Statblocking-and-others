/* Statblock 5e v2.1.0 - Foundry VTT v14 / D&D5e v6 */
const MODULE_ID="statblock-5e";
const DND5E_TYPES=new Set(["race","class","subclass"]);

Hooks.once("init",()=>console.log(`${MODULE_ID} | Initializing`));
Hooks.once("ready",()=>{console.log(`${MODULE_ID} | Ready`);ui.notifications.info("Statblock 5e is ready. Use Import Statblock from the Actors directory.");});

Hooks.on("renderActorDirectory",(app,html)=>{
  const root=html instanceof HTMLElement?html:html?.[0]; if(!root)return;
  const header=root.querySelector(".directory-header .action-buttons")||root.querySelector(".directory-header");
  if(!header||header.querySelector("[data-statblock-5e]"))return;
  const b=document.createElement("button"); b.type="button"; b.dataset.statblock5e="true";
  b.innerHTML='<i class="fa-solid fa-file-import"></i> Import Statblock';
  b.title="Import a D&D 5e statblock, species, class, or subclass"; b.onclick=()=>openImporter(); header.appendChild(b);
});

function openImporter(){
  const D=foundry?.applications?.api?.DialogV2;
  if(!D){ui.notifications.error("Statblock 5e requires Foundry VTT v14 or newer.");return;}
  const content=`<div class="statblock-5e-importer"><p><strong>Paste a D&D 5e statblock or choose a PDF/text file.</strong></p><div class="form-group"><label>Content type</label><select name="contentType"><option value="auto">Auto-detect</option><option value="monster">Monster / NPC</option><option value="race">Species / Race</option><option value="class">Class</option><option value="subclass">Subclass</option></select></div><div class="form-group"><label>PDF or text file</label><input id="sb5e-file" type="file" accept=".pdf,.txt,.md,.text,.json,application/pdf,text/plain,application/json"></div><div class="form-group"><label>Source text</label><textarea id="sb5e-text" name="sourceText" rows="20" placeholder="Paste the complete statblock here..."></textarea></div><p class="hint">Text-based PDFs are supported. Scanned/image-only PDFs require OCR. The imported source text is also preserved in the actor biography.</p></div>`;
  new D({
    window:{title:"Statblock 5e Importer",icon:"fa-solid fa-file-import"},position:{width:760},content,
    buttons:[
      {action:"import",label:"Import",icon:"fa-solid fa-file-import",default:true,callback:async(_e,button)=>{
        const form=button.form; const text=String(form.elements.sourceText?.value||"").trim();
        if(!text){ui.notifications.warn("Paste text or choose a readable PDF/text file first.");return false;}
        await importContent(text,form.elements.contentType.value); return true;
      }},
      {action:"cancel",label:"Cancel",icon:"fa-solid fa-xmark"}
    ],
    render:(_e,dialog)=>{
      dialog.element.querySelector("#sb5e-file")?.addEventListener("change",async e=>{
        const f=e.target.files?.[0]; if(!f)return;
        try{dialog.element.querySelector("#sb5e-text").value=await readSourceFile(f);ui.notifications.info(`Loaded ${f.name}. Review the extracted text before importing.`);}
        catch(err){console.error(err);ui.notifications.error(err.message||"Could not read that file.");}
      });
    }
  }).render({force:true});
}

async function readSourceFile(file){return file.name.toLowerCase().endsWith(".pdf")?extractPdfText(file):file.text();}

/* Lightweight PDF text extraction. It handles common Tj/TJ text operators and
   inserts line breaks when the PDF contains positioning operators. */
async function extractPdfText(file){
  const bytes=new Uint8Array(await file.arrayBuffer()),raw=new TextDecoder("latin1").decode(bytes),chunks=[]; let cursor=0;
  while(cursor<raw.length){
    const s=raw.indexOf("stream",cursor); if(s<0)break; let a=s+6;
    if(raw[a]==="\r")a++; if(raw[a]==="\n")a++;
    const e=raw.indexOf("endstream",a); if(e<0)break;
    const h=raw.slice(Math.max(raw.lastIndexOf("obj",s-1),s-1500),s),sb=bytes.slice(a,e); let decoded=sb;
    try{
      if(/\/FlateDecode/.test(h)&&typeof DecompressionStream!=="undefined"){
        const ds=new DecompressionStream("deflate");
        decoded=new Uint8Array(await new Response(new Blob([sb]).stream().pipeThrough(ds)).arrayBuffer());
      }
    }catch(err){console.warn(`${MODULE_ID} | PDF decompression failed`,err);}
    const t=new TextDecoder("latin1").decode(decoded); if(t)chunks.push(extractPdfOperators(t)); cursor=e+9;
  }
  const result=chunks.join("\n").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  if(!result)throw new Error("No selectable text was found in this PDF. If it is scanned, run OCR first."); return result;
}

function extractPdfOperators(stream){
  const out=[];
  const re=/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:(?:\\.|[^\]])*?)\]\s*TJ/g;
  for(const m of stream.matchAll(re)){
    const s=m[0],parts=s.match(/\((?:\\.|[^\\)])*\)/g)||[];
    const text=parts.map(decodePdfString).join("");
    if(text)out.push(text);
  }
  return out.join("\n");
}
function decodePdfString(v){
  return v.slice(1,-1).replace(/\\([\\()])/g,"$1").replace(/\\n/g,"\n").replace(/\\r/g,"\n").replace(/\\t/g,"\t").replace(/\\([0-7]{1,3})/g,(_m,o)=>String.fromCharCode(parseInt(o,8)));
}

async function importContent(text,type){
  text=normalize(text); type=type==="auto"?detectType(text):type;
  try{
    if(type==="monster")await createMonster(text);
    else if(DND5E_TYPES.has(type))await createDndItem(text,type);
    else throw new Error(`Unsupported content type: ${type}`);
  }catch(err){console.error(`${MODULE_ID} | Import failed`,err);ui.notifications.error(`Import failed: ${err.message}`);}
}

function detectType(text){
  const t=flatten(text);
  if(/(?:armor\s*class|\bAC\b)\s*\d+/i.test(t)&&/(?:hit\s*points|\bHP\b)\s+\d+/i.test(t)&&/(?:STR|DEX|CON|INT|WIS|CHA)\s*\d+/i.test(t))return"monster";
  if(/subclass|subclass features|archetype|college|domain|circle|oath|patron|tradition|school/i.test(t))return"subclass";
  if(/hit die|class features|starting equipment|multiclassing/i.test(t))return"class";
  if(/ability score increase|species traits|racial traits|creature type/i.test(t))return"race";
  return"monster";
}

async function createMonster(text){
  const p=parseMonster(text);
  const actor=await Actor.create({name:p.name||"Imported Monster",type:"npc",system:{}});
  const u={};
  if(p.ac!=null)u["system.attributes.ac.flat"]=p.ac;
  if(p.hp!=null){u["system.attributes.hp.value"]=p.hp;u["system.attributes.hp.max"]=p.hp;}
  if(p.hpFormula)u["system.attributes.hp.formula"]=p.hpFormula;
  if(p.speed!=null)u["system.attributes.movement.walk"]=p.speed;
  for(const[a,v]of Object.entries(p.abilities))u[`system.abilities.${a}.value`]=v;
  if(p.cr)u["system.details.cr"]=p.cr;
  if(p.alignment)u["system.details.alignment"]=p.alignment;
  if(p.size)u["system.traits.size"]=p.size;
  if(p.creatureType)u["system.details.type.value"]=p.creatureType;
  if(p.proficiency!=null)u["system.attributes.prof"]=p.proficiency;
  if(p.passive!=null)u["system.attributes.senses.passive"]=p.passive;
  if(p.languages)u["system.traits.languages.value"]=p.languages.split(/[,;]/).map(s=>s.trim()).filter(Boolean);
  u["system.details.biography.value"]=`<p><strong>Imported by Statblock 5e</strong></p><pre>${escapeHtml(text)}</pre>`;
  await actor.update(u);

  // Create simple action items so common attacks/actions are usable from the NPC sheet.
  if(p.actions.length){
    for(const action of p.actions){
      try{await Item.create({name:action.name,type:"feat",system:{description:{value:`<p>${escapeHtml(action.description)}</p>`}}},{parent:actor});}
      catch(e){console.warn(`${MODULE_ID} | Could not create action item`,action.name,e);}
    }
  }
  actor.sheet.render(true); ui.notifications.info(`Imported monster: ${actor.name}`);
}

function parseMonster(text){
  const lines=text.split("\n").map(s=>cleanLine(s)).filter(Boolean),flat=flatten(text),abilities={};
  // Prefer a line containing all six ability scores, but also support one score per line.
  const abilityPatterns={str:/\b(?:STR|Strength)\s*[:\-]?\s*(\d+)\b/i,dex:/\b(?:DEX|Dexterity)\s*[:\-]?\s*(\d+)\b/i,con:/\b(?:CON|Constitution)\s*[:\-]?\s*(\d+)\b/i,int:/\b(?:INT|Intelligence)\s*[:\-]?\s*(\d+)\b/i,wis:/\b(?:WIS|Wisdom)\s*[:\-]?\s*(\d+)\b/i,cha:/\b(?:CHA|Charisma)\s*[:\-]?\s*(\d+)\b/i};
  for(const[a,r]of Object.entries(abilityPatterns)){const m=flat.match(r);if(m)abilities[a]=Number(m[1]);}

  const hm=flat.match(/(?:hit\s*points|\bHP\b)\s*[:\-]?\s*(\d+)(?:\s*\(([^)]+)\))?/i);
  const speed=flat.match(/(?:speed|movement)\s*[:\-]?\s*([\d,]+)\s*ft\.?/i);
  const cm=flat.match(/(?:challenge|CR)\s*[:\-]?\s*(\d+(?:\/\d+)?(?:\.\d+)?)/i);
  const ac=flat.match(/(?:armor\s*class|\bAC\b)\s*[:\-]?\s*(\d+)/i);
  const prof=flat.match(/(?:proficiency\s*bonus|PB)\s*[:\-]?\s*\+?(\d+)/i);
  const passive=flat.match(/passive\s*(?:perception|wisdom)\s*[:\-]?\s*(\d+)/i);
  const sizeMatch=flat.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b\s+(?:aberration|beast|celestial|construct|dragon|elemental|fey|fiend|giant|humanoid|monstrosity|ooze|plant|undead|or)\b/i);
  const typeMatch=flat.match(/\b(?:Tiny|Small|Medium|Large|Huge|Gargantuan)\b\s+([A-Za-z][A-Za-z -]{2,30})\s*\([^)]*\)/i);
  const alignment=extractAlignment(flat);
  const languages=extractAfterLabel(flat,/languages?\s*[:\-]?\s*/i,["challenge","actions","reactions","legendary"]);
  const actions=parseActions(lines);
  const name=findMonsterName(lines);
  return {
    name,abilities,ac:ac?Number(ac[1]):null,hp:hm?Number(hm[1]):null,hpFormula:hm?.[2]||"",speed:speed?Number(speed[1].replace(/,/g,"")):null,
    cr:cm?.[1],proficiency:prof?Number(prof[1]):null,passive:passive?Number(passive[1]):null,
    size:normalizeSize(sizeMatch?.[1]),creatureType:normalizeCreatureType(typeMatch?.[1]),alignment,languages,actions
  };
}

function findMonsterName(lines){
  for(const line of lines.slice(0,8)){
    if(/^(armor class|hit points|speed|str|dex|con|int|wis|cha|challenge|proficiency bonus|languages|senses)\b/i.test(line))continue;
    if(/^(tiny|small|medium|large|huge|gargantuan)\b.*\b(construct|humanoid|beast|dragon|undead|fiend|fey|monstrosity|aberration|celestial|elemental|giant|ooze|plant)\b/i.test(line))continue;
    return line.replace(/\s{2,}/g," ").trim();
  }
  return "Imported Monster";
}

function parseActions(lines){
  const idx=lines.findIndex(l=>/^actions?$/i.test(l)); if(idx<0)return [];
  const stop=/^(reactions?|legendary actions?|lair actions?|bonus actions?|spellcasting|description|equipment)$/i;
  const actions=[]; let current=null;
  for(const line of lines.slice(idx+1)){
    if(stop.test(line))break;
    // Standard statblocks use: Attack Name. Melee Weapon Attack: ...
    const m=line.match(/^([^.!?]{2,80})\.\s+(.+)/);
    if(m&&/attack|spell|damage|save|hit|recharge|cantrip/i.test(m[2])){
      if(current)actions.push(current); current={name:m[1].trim(),description:m[2].trim()};
    }else if(current)current.description+=` ${line}`;
  }
  if(current)actions.push(current);
  return actions.slice(0,30);
}

function extractAlignment(t){
  const m=t.match(/\b(lawful\s+good|neutral\s+good|chaotic\s+good|lawful\s+neutral|true\s+neutral|chaotic\s+neutral|lawful\s+evil|neutral\s+evil|chaotic\s+evil|unaligned)\b/i); return m?.[1]||"";
}
function extractAfterLabel(t,label,stops){
  const m=t.match(label); if(!m)return ""; let s=t.slice(m.index+m[0].length); const stop=new RegExp(`\\b(?:${stops.join("|")})\\b\\s*[:\\-]?`,"i"); const x=s.search(stop); if(x>=0)s=s.slice(0,x); return s.trim().replace(/\s{2,}/g," ");
}
function normalizeSize(v){return ({tiny:"tiny",small:"sm",medium:"med",large:"lg",huge:"huge",gargantuan:"grg"})[String(v||"").toLowerCase()]||null;}
function normalizeCreatureType(v){return String(v||"").trim().split(" ")[0].toLowerCase()||null;}

async function createDndItem(text,type){
  const p=parseItem(text),description=`<p><strong>Imported by Statblock 5e</strong></p><pre>${escapeHtml(text)}</pre>`,system={description:{value:description}};
  if(type==="class"){system.levels=p.levels||1;system.hitDie=p.hitDie||"d8";}
  if(type==="subclass"&&p.parentClass)system.classIdentifier=slugify(p.parentClass);
  const item=await Item.create({name:p.name||`Imported ${type}`,type,system}); item.sheet.render(true); ui.notifications.info(`Imported ${type}: ${item.name}`);
}
function parseItem(text){
  const l=text.split("\n").map(cleanLine).filter(Boolean),f=flatten(text);
  return{name:l[0]||"Imported Content",hitDie:f.match(/hit die\s*[:\-]?\s*(d\d+)/i)?.[1],levels:Number(f.match(/(?:levels?|level)\s*[:\-]?\s*(\d+)/i)?.[1])||undefined,parentClass:f.match(/(?:class|parent class)\s*[:\-]?\s*([A-Za-z][A-Za-z ]{2,40})/i)?.[1]?.trim()};
}

function cleanLine(s){return String(s).replace(/\u00a0/g," ").replace(/[\u200b\ufeff]/g," ").replace(/[ \t]+/g," ").trim();}
function normalize(t){return String(t).replace(/\r\n?/g,"\n").replace(/\u00a0/g," ").replace(/[\u200b\ufeff]/g," ").split("\n").map(cleanLine).filter(Boolean).join("\n");}
function flatten(t){return normalize(t).replace(/\n+/g," ").replace(/\s{2,}/g," ").trim();}
function slugify(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function escapeHtml(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
