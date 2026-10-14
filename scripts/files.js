/**
 * Reads statblock text from dropped or chosen files: TXT, MD, JSON and PDFs with selectable text.
 */

export async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file);
  const text = await file.text();
  if (name.endsWith(".json")) {
    try {
      const data = JSON.parse(text);
      if (typeof data === "string") return data;
      if (typeof data?.text === "string") return data.text;
      if (Array.isArray(data) && data.every(x => typeof x === "string")) return data.join("\n---\n");
    } catch { /* not JSON after all */ }
  }
  return text;
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
