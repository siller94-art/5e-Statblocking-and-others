/**
 * Reads statblocks from dropped or chosen files: PDFs with selectable text, JSON, TXT and MD.
 *
 * JSON can be any of:
 *   - a statblock as a string, or an array of strings
 *   - { "text": "..." } (also "statblock", "content", "markdown", "body"), optionally with
 *     "img" / "image" / "portrait" and "token" / "tokenImg" for the creature's art
 *   - an array or collection of those ({ "statblocks": [...] }, { "monsters": [...] }, ...)
 *   - a Foundry actor export (right-click an actor → Export Data), or an array of them;
 *     these are imported as they are, without re-parsing
 */

export const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
export const isImageFile = f => f?.type?.startsWith("image/") || IMAGE_EXT.test(f?.name ?? "");

/** Just the statblock text of a file (kept for macros and older callers). */
export async function readFile(file) {
  return (await readSource(file)).text;
}

/**
 * @returns {Promise<{ text: string, actors: object[], images: Record<string, { img?: string, token?: string }> }>}
 *   `images` is keyed by lower-case creature name.
 */
export async function readSource(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return { text: await readPdf(file), actors: [], images: {} };
  const text = await file.text();
  if (name.endsWith(".json") || file.type === "application/json") {
    let data;
    try { data = JSON.parse(text); } catch (err) { throw new Error(`${file.name} isn't valid JSON: ${err.message}`); }
    const out = readJson(data);
    if (!out.text && !out.actors.length) {
      throw new Error(`Found no statblocks in ${file.name}. Use statblock text ("text": "..."), a list of statblocks, or a Foundry actor export.`);
    }
    return out;
  }
  return { text, actors: [], images: {} };
}

const TEXT_KEYS = ["text", "statblock", "statBlock", "content", "markdown", "body", "source"];
const IMG_KEYS = ["img", "image", "portrait", "art", "artwork"];
const TOKEN_KEYS = ["token", "tokenImg", "tokenImage", "tokenArt"];

function isFoundryActor(o) {
  return o && typeof o === "object" && typeof o.name === "string" && typeof o.type === "string" && o.system && typeof o.system === "object";
}

const firstString = (o, keys) => { for (const k of keys) if (typeof o?.[k] === "string" && o[k].trim()) return o[k].trim(); return ""; };

function readJson(data) {
  const texts = [];
  const actors = [];
  const images = {};
  const visit = (v, depth = 0) => {
    if (depth > 6 || v == null) return;
    if (typeof v === "string") { if (v.trim()) texts.push(v); return; }
    if (Array.isArray(v)) { v.forEach(x => visit(x, depth + 1)); return; }
    if (typeof v !== "object") return;
    if (isFoundryActor(v)) { actors.push(v); return; }
    const text = firstString(v, TEXT_KEYS);
    if (text) {
      texts.push(text);
      const img = firstString(v, IMG_KEYS);
      const token = firstString(v, TOKEN_KEYS) || (typeof v.prototypeToken?.texture?.src === "string" ? v.prototypeToken.texture.src : "");
      // Name the art after the creature: an explicit "name", else the statblock's first line.
      const key = (typeof v.name === "string" && v.name.trim() ? v.name : text.split("\n").find(l => l.trim()) ?? "").trim().toLowerCase();
      if (key && (img || token)) images[key] = { ...(img ? { img } : {}), ...(token ? { token } : {}) };
      return;
    }
    // A wrapper such as { "monsters": [...] } or a Foundry folder/adventure export.
    for (const x of Object.values(v)) if (x && typeof x === "object") visit(x, depth + 1);
  };
  visit(data);
  return { text: texts.join("\n---\n"), actors, images };
}

async function readPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Use PDF.js when Foundry has it loaded: it keeps reading order and line breaks.
  const pdfjs = globalThis.pdfjsLib;
  if (pdfjs?.getDocument) {
    try {
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const pages = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const content = await (await doc.getPage(p)).getTextContent();
        let line = "", out = [];
        let lastY = null;
        for (const item of content.items) {
          const y = Math.round(item.transform?.[5] ?? 0);
          if (lastY !== null && Math.abs(y - lastY) > 2) { out.push(line); line = ""; }
          line += item.str + (item.hasEOL ? "\n" : "");
          lastY = y;
        }
        out.push(line);
        pages.push(out.join("\n"));
      }
      const text = pages.join("\n").replace(/[ \t]+\n/g, "\n").trim();
      if (text) return text;
    } catch (err) { console.warn("statblock-5e | PDF.js couldn't read the file, trying the basic reader", err); }
  }
  return basicPdfText(bytes);
}

/** Minimal text extraction from PDF content streams, for when PDF.js isn't available. */
async function basicPdfText(bytes) {
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
    const header = raw.slice(Math.max(0, raw.lastIndexOf("obj", streamStart - 1)), streamStart);
    let data = bytes.slice(dataStart, streamEnd);
    try {
      if (/\/FlateDecode/.test(header) && typeof DecompressionStream !== "undefined") {
        data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
      }
    } catch { /* leave compressed */ }
    const text = new TextDecoder("latin1").decode(data);
    const parts = [];
    for (const m of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:(?:\\.|[^\]])*?)\]\s*TJ|T\*|Td|TD/g)) {
      if (/^(T\*|Td|TD)$/.test(m[0])) { parts.push("\n"); continue; }
      const strings = m[0].match(/\((?:\\.|[^\\)])*\)/g) || [];
      parts.push(strings.map(decode).join(""));
    }
    const chunk = parts.join("").replace(/\n{2,}/g, "\n").trim();
    if (chunk) output.push(chunk);
    cursor = streamEnd + 9;
  }
  const result = output.join("\n").trim();
  if (!result) throw new Error("No selectable text found in that PDF. Scanned PDFs need OCR first; copying the text out of your PDF reader works too.");
  return result;
}

function decode(value) {
  return value.slice(1, -1)
    .replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}
