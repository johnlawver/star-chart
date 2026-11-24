/**
 * Every piece of art the observatory uses, by id (its file's path in `files/`, without the extension). Screens ask for
 * art only by these ids. The Art Gallery shows every entry and flags any whose file is missing.
 *
 * Canvases: the mascot, its moods and outfits all share one 200×200 canvas, so they stack with no offsets in code.
 * The jar's lid, glass and inside share one 200×250 canvas. Everything else is drawn on 100×100.
 */
export interface ArtEntry {
  id: string;
  what: string;
  canvas: [number, number];
}

const mascot: [number, number] = [200, 200];
const jar: [number, number] = [200, 250];
const square: [number, number] = [100, 100];

/** A store item's art, by convention: stickers are `stickers/<id>`, outfits are `outfits/<kind>-<id>`. */
export function storeItemArt(item: { kind: "sticker" | "hat" | "hair"; id: string }): string {
  return item.kind === "sticker" ? `stickers/${item.id}` : `outfits/${item.kind}-${item.id}`;
}

export const manifest: ArtEntry[] = [
  { id: "sky", what: "The night sky behind every observatory screen (a still picture: nothing in it moves)", canvas: [800, 1280] },
  { id: "star", what: "A star: in the jar, flying in and out, on prices, in constellations", canvas: square },
  { id: "mascot/body", what: "The mascot, Comet, without a face", canvas: mascot },
  { id: "mascot/mood-happy", what: "The mascot's happy face", canvas: mascot },
  { id: "mascot/mood-wow", what: "The mascot's amazed face, while new stars arrive", canvas: mascot },
  { id: "outfits/hat-crown", what: "Hat: crown", canvas: mascot },
  { id: "outfits/hat-wizard", what: "Hat: wizard hat", canvas: mascot },
  { id: "outfits/hat-helmet", what: "Hat: space helmet", canvas: mascot },
  { id: "outfits/hair-spiky", what: "Hair: spiky (drawn behind the body)", canvas: mascot },
  { id: "outfits/hair-curly", what: "Hair: curly (drawn behind the body)", canvas: mascot },
  { id: "stickers/rocket", what: "Sticker: rocket", canvas: square },
  { id: "stickers/moon", what: "Sticker: moon", canvas: square },
  { id: "stickers/planet", what: "Sticker: ringed planet", canvas: square },
  { id: "stickers/alien", what: "Sticker: friendly alien", canvas: square },
  { id: "stickers/comet", what: "Sticker: comet", canvas: square },
  { id: "jar/lid", what: "The star jar's lid, drawn over the stars", canvas: jar },
  { id: "jar/glass", what: "The star jar's glass, drawn over the stars", canvas: jar },
  { id: "jar/inside", what: "The shape inside the jar that stars fill (any colour; only its shape counts)", canvas: jar },
  { id: "dock/back", what: "Dock button: back", canvas: square },
  { id: "dock/store", what: "Dock button: store", canvas: square },
  { id: "dock/stickers", what: "Dock button: sticker book", canvas: square },
  { id: "dock/sky", what: "Dock button: my sky", canvas: square },
  { id: "planets/planet-1", what: "A planet that a task or category sits on (used in turn)", canvas: square },
  { id: "planets/planet-2", what: "A planet that a task or category sits on (used in turn)", canvas: square },
  { id: "planets/planet-3", what: "A planet that a task or category sits on (used in turn)", canvas: square },
  { id: "planets/planet-4", what: "A planet that a task or category sits on (used in turn)", canvas: square },
  { id: "planets/planet-5", what: "A planet that a task or category sits on (used in turn)", canvas: square },
  { id: "planets/planet-6", what: "A planet that a task or category sits on (used in turn)", canvas: square },
];

/** Optional art: a jar of one size can have its own lid, glass and inside, such as `jar/glass-50`. */
export const jarSizes = [10, 25, 50, 100, 200, 500] as const;
