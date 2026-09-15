const KEY="sb5e-dm-library";
const $=s=>document.querySelector(s);
let formatted="";
let deferredInstall=null;

const headings={"bonus action":"Bonus Actions","bonus actions":"Bonus Actions","actions":"Actions","action":"Actions","reactions":"Reactions","reaction":"Reactions","legendary actions":"Legendary Actions","legendary action":"Legendary Actions","lair actions":"Lair Actions","lair action":"Lair Actions","traits":"Traits","trait":"Traits","features":"Features","feature":"Features","spellcasting":"Spellcasting"};

function cleanLine(line){
  return line.replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim();
}
function formatStatblock(text){
  const raw=text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  if(!raw.length)return "";
  const out=[];
  let current=null;
  for(let line of raw){
    const key=line.toLowerCase().replace(/[:.]+$/g,"");
    if(headings[key]){
      current=headings[key];
      if(out.length && out[out.length-1]!=="")out.push("");
      out.push(current);
      continue;
    }
    line=line.replace(/^Armor Class\s*[:\-]\s*/i,"Armor Class ")
      .replace(/^Hit Points\s*[:\-]\s*/i,"Hit Points ")
      .replace(/^Speed\s*[:\-]\s*/i,"Speed ")
      .replace(/^Challenge\s*[:\-]\s*/i,"Challenge ")
      .replace(/^Proficiency Bonus\s*[:\-]\s*/i,"Proficiency Bonus ");
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g,"\n\n").trim();
}
function parse(text){
  const flat=text.replace(/\n+/g," ").replace(/\s+/g," ");
  const pick=(re)=>flat.match(re)?.[1]||"";
  const lines=text.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const name=lines[0]||"Untitled Statblock";
  const stats={
    "Armor Class":pick(/(?:Armor Class|AC)\s*[:\-]?\s*(\d+)/i),
    "Hit Points":pick(/(?:Hit Points|HP)\s*[:\-]?\s*(\d+(?:\s*\([^)]*\))?)/i),
    Speed:pick(/Speed\s*[:\-]?\s*([^.;]+)/i),
    STR:pick(/\bSTR\b\s*[:\-]?\s*(\d+)/i),DEX:pick(/\bDEX\b\s*[:\-]?\s*(\d+)/i),CON:pick(/\bCON\b\s*[:\-]?\s*(\d+)/i),INT:pick(/\bINT\b\s*[:\-]?\s*(\d+)/i),WIS:pick(/\bWIS\b\s*[:\-]?\s*(\d+)/i),CHA:pick(/\bCHA\b\s*[:\-]?\s*(\d+)/i),
    Challenge:pick(/(?:Challenge|CR)\s*[:\-]?\s*(\d+(?:\/\d+)?(?:\s*\([^)]*\))?)/i)
  };
  return {name,stats};
}
function esc(s){return String(s).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
function render(text){
  const p=parse(text),s=p.stats;
  const ability=["STR","DEX","CON","INT","WIS","CHA"].map(k=>`<div><b>${k}</b><strong>${esc(s[k]||"—")}</strong></div>`).join("");
  const body=esc(text).split(/\n\n/).map(block=>{const lines=block.split("\n");if(!lines[0])return"";const title=/^(Traits|Features|Actions|Bonus Actions|Reactions|Legendary Actions|Lair Actions|Spellcasting)$/i.test(lines[0]);if(title)return `<div class="section"><h3>${esc(lines[0])}</h3>${lines.slice(1).map(x=>`<p>${x.replace(/^([^.!?]{2,80})\./,m=>`<b>${m}</b>`)}</p>`).join("")}</div>`;return""}).join("");
  return `<article class="statblock"><h2>${esc(p.name)}</h2><div class="subtitle">Corrected 5e formatting</div><hr class="rule"><p><b>Armor Class</b> ${esc(s["Armor Class"]||"—")} &nbsp; <b>Hit Points</b> ${esc(s["Hit Points"]||"—")}</p><p><b>Speed</b> ${esc(s.Speed||"—")}</p><div class="stats">${ability}</div><p><b>Challenge</b> ${esc(s.Challenge||"—")}</p>${body||`<div class="section"><h3>Source</h3><p>${esc(text).replace(/\n/g,"<br>")}</p></div>`}</article>`;
}
function getLibrary(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function setLibrary(items){localStorage.setItem(KEY,JSON.stringify(items))}
function renderLibrary(filter=""){
  const q=filter.toLowerCase();const items=getLibrary().filter(x=>x.name.toLowerCase().includes(q)||x.text.toLowerCase().includes(q));
  $("#library").innerHTML=items.length?items.map((x,i)=>`<article class="library-card"><h3>${esc(x.name)}</h3><p>${new Date(x.updated).toLocaleDateString()} · ${x.text.length.toLocaleString()} characters</p><div class="button-row"><button data-open="${i}">Open</button><button data-copy="${i}">Copy</button><button data-delete="${i}">Delete</button></div></article>`).join(""):"<div class='empty'>No saved statblocks yet.</div>";
  $("#library").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const visible=items[+b.dataset.open];$("#source").value=visible.text;formatted=visible.text;$("#preview").innerHTML=render(formatted);$("#save").disabled=false;show("import-view")});
  $("#library").querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(items[+b.dataset.copy].text));
  $("#library").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{const all=getLibrary();const target=items[+b.dataset.delete];setLibrary(all.filter(x=>x.id!==target.id));renderLibrary($("#library-search").value)});
}
function show(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id));if(id==="library-view")renderLibrary($("#library-search").value)}

$("#format").onclick=()=>{formatted=formatStatblock($("#source").value);$("#preview").innerHTML=formatted?render(formatted):"<div class='empty'>Paste a statblock first.</div>";$("#save").disabled=!formatted;$("#copy").disabled=!formatted};
$("#clear").onclick=()=>{$("#source").value="";formatted="";$("#preview").innerHTML="<div class='empty'>Your corrected statblock will appear here.</div>";$("#save").disabled=true;$("#copy").disabled=true};
$("#copy").onclick=()=>navigator.clipboard?.writeText(formatted);
$("#save").onclick=()=>{const p=parse(formatted);const all=getLibrary();all.unshift({id:crypto.randomUUID(),name:p.name,text:formatted,updated:Date.now()});setLibrary(all);show("library-view")};
$("#library-search").oninput=e=>renderLibrary(e.target.value);
document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>show(n.dataset.view));

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("#install").hidden=false});
$("#install").onclick=async()=>{if(deferredInstall){deferredInstall.prompt();deferredInstall=null}};
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
renderLibrary();
