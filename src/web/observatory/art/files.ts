/**
 * Every art file in `files/`, found at build time. Art is looked up by id: its path without the extension, such as
 * `stickers/rocket`. Replacing a file with one of the same name replaces the art. If one id has several files, the
 * first of SVG, WebP, PNG, JPEG wins. Draw art at the size it's shown (the frame's screen is 1×, not retina).
 */
const found = import.meta.glob<string>("./files/**/*.{svg,webp,png,jpg,jpeg}", { eager: true, query: "?url", import: "default" });

const preference = ["svg", "webp", "png", "jpg", "jpeg"];
const rank = (path: string) => preference.indexOf(path.slice(path.lastIndexOf(".") + 1));

const byId = new Map<string, { url: string; path: string }>();
for (const [path, url] of Object.entries(found)) {
  const id = path.replace(/^\.\/files\//, "").replace(/\.[a-z]+$/, "");
  const current = byId.get(id);
  if (!current || rank(path) < rank(current.path)) byId.set(id, { url, path });
}

/** The URL of a piece of art, or undefined if its file is missing. */
export function artUrl(id: string): string | undefined {
  return byId.get(id)?.url;
}
