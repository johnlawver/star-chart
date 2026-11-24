import type { Plugin } from "vite";

// The picture frame's WebView ignores 4- and 8-digit hex colours (#rgba, #rrggbbaa), so anything drawn with one
// silently loses its colour. Vite's cssTarget rewrites them in stylesheets, but not in colours written in code, such as
// inline styles. This check fails the build if any built CSS or JS still contains one.

const longHex = /#(?:[0-9a-f]{8}|[0-9a-f]{4})(?![0-9a-z_-])/gi;

/**
 * Colours that look unsafe but never reach the browser's CSS: the `qrcode` library's defaults, which it converts to
 * RGBA itself (it's used by the Control Center, not the observatory).
 */
export const knownSafe = ["#000000ff", "#ffffffff"];

/** Every 4- or 8-digit hex colour in some built code, apart from the known-safe ones. */
export function findFrameUnsafeColours(code: string): string[] {
  return (code.match(longHex) ?? []).filter((colour) => !knownSafe.includes(colour.toLowerCase()));
}

/** A Vite plugin that fails the build when a built CSS or JS file has a colour the frame can't read. */
export function frameSafeColours(): Plugin {
  return {
    name: "frame-safe-colours",
    apply: "build",
    generateBundle(_options, bundle) {
      const problems: string[] = [];
      for (const file of Object.values(bundle)) {
        if (!/\.(css|js)$/.test(file.fileName)) continue;
        const code = file.type === "chunk" ? file.code : String(file.source);
        const found = findFrameUnsafeColours(code);
        if (found.length) problems.push(`${file.fileName}: ${[...new Set(found)].join(", ")}`);
      }
      if (problems.length) {
        this.error(`Colours the picture frame can't read (use 3/6-digit hex or rgba()):\n  ${problems.join("\n  ")}`);
      }
    },
  };
}
