/**
 * Every art file in `files/`, found at build time. Art is looked up by id: its path without the extension, such as
 * `stickers/rocket`. Replacing a file with one of the same name replaces the art; an SVG wins over a PNG.
 */
const found = import.meta.glob<string>("./files/**/*.{svg,png}", { eager: true, query: "?url", import: "default" });

const byId = new Map<string, string>();
for (const [path, url] of Object.entries(found)) {
  const id = path.replace(/^\.\/files\//, "").replace(/\.(svg|png)$/, "");
  if (path.endsWith(".svg") || !byId.has(id)) byId.set(id, url);
}

/** The URL of a piece of art, or undefined if its file is missing. */
export function artUrl(id: string): string | undefined {
  return byId.get(id);
}
