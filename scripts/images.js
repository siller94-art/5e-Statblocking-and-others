/**
 * Portrait and token art for creatures being imported: pick from Foundry's file browser,
 * or upload a picture from your computer into the world's folder.
 */

const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
const SOURCE = () => (globalThis.ForgeVTT?.usingTheForge ? "forgevtt" : "data");
export const uploadDir = () => `worlds/${game.world.id}/statblock-5e`;

export const canUpload = () => game.user.can("FILES_UPLOAD");
export const canBrowse = () => game.user.can("FILES_BROWSE");

/** Open Foundry's file browser for images. Resolves to the chosen path, or null if it was closed. */
export function pickImage(current = "") {
  return new Promise(resolve => {
    let done = false;
    const picker = new (FP())({
      type: "image",
      current: current || uploadDir(),
      callback: path => { done = true; resolve(path); }
    });
    // Resolve null when the browser closes without a choice.
    const close = picker.close.bind(picker);
    picker.close = async (...args) => { const r = await close(...args); if (!done) resolve(null); return r; };
    picker.render(true);
  });
}

async function ensureDir(source, dir) {
  const FilePicker = FP();
  let path = "";
  for (const part of dir.split("/")) {
    path = path ? `${path}/${part}` : part;
    try { await FilePicker.browse(source, path); }
    catch { try { await FilePicker.createDirectory(source, path); } catch { /* made by someone else, or not allowed */ } }
  }
}

const slug = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "creature";

/**
 * Upload an image file into worlds/<world>/statblock-5e and return its path.
 * @param {File|Blob} file
 * @param {string} creature   Used for the file name.
 * @param {"img"|"token"} slot
 */
export async function uploadImage(file, creature, slot = "img") {
  if (!canUpload()) throw new Error("You don't have permission to upload files. Ask the GM, or pick an image that's already in Foundry.");
  const source = SOURCE();
  const dir = uploadDir();
  await ensureDir(source, dir);
  const ext = (file.name?.match(/\.([a-z0-9]+)$/i)?.[1] ?? file.type?.split("/")[1] ?? "webp").replace("jpeg", "jpg").replace("svg+xml", "svg").toLowerCase();
  // A unique name each time, so browsers don't keep showing an older picture.
  const name = `${slug(creature)}${slot === "token" ? "-token" : ""}-${Date.now().toString(36)}.${ext}`;
  const named = new File([file], name, { type: file.type || `image/${ext}` });
  const res = await FP().upload(source, dir, named, {}, { notify: false });
  const path = res?.path ?? (typeof res === "string" ? res : null);
  if (!path) throw new Error(`Couldn't upload ${file.name ?? "the image"}.`);
  return path;
}

/** Turn a data: URL (from a JSON file) into an uploaded file path. */
export async function uploadDataUrl(url, creature, slot) {
  const blob = await (await fetch(url)).blob();
  return uploadImage(blob, creature, slot);
}
