import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// The built-in icon library: simple line drawings from Tabler Icons (MIT licence), chosen for children's tasks.
// Each id is the Tabler file name; the label is what a grown-up sees when picking one.
const starterSet: { id: string; label: string }[] = [
  { id: "bed", label: "Make your bed" },
  { id: "dental", label: "Brush teeth" },
  { id: "bath", label: "Bath time" },
  { id: "shirt", label: "Get dressed" },
  { id: "sock", label: "Socks on" },
  { id: "shoe", label: "Shoes on" },
  { id: "hanger", label: "Hang up clothes" },
  { id: "wash-machine", label: "Laundry" },
  { id: "lego", label: "Tidy toys" },
  { id: "trash", label: "Take out the trash" },
  { id: "spray", label: "Clean up" },
  { id: "tools-kitchen-2", label: "Set the table" },
  { id: "bowl", label: "Clear your bowl" },
  { id: "cat", label: "Feed the cat" },
  { id: "dog", label: "Feed the dog" },
  { id: "fish", label: "Feed the fish" },
  { id: "plant", label: "Water the plants" },
  { id: "backpack", label: "Pack your bag" },
  { id: "home", label: "Help at home" },
  { id: "stairs", label: "Tidy the stairs" },
  { id: "door", label: "Shut the door" },
  { id: "apple", label: "Eat a fruit" },
  { id: "carrot", label: "Eat your veggies" },
  { id: "book", label: "Read a book" },
  { id: "books", label: "Reading" },
  { id: "pencil", label: "Writing" },
  { id: "abc", label: "Letters" },
  { id: "alphabet-latin", label: "Spelling" },
  { id: "math", label: "Math" },
  { id: "music", label: "Practise music" },
  { id: "bike", label: "Ride your bike" },
  { id: "ball-football", label: "Play outside" },
  { id: "heart", label: "Be kind" },
  { id: "sun", label: "Morning routine" },
  { id: "moon", label: "Bedtime routine" },
  { id: "star", label: "Star" },
];

// The package maps "@tabler/icons/<path>" onto its icons folder.
const tablerOutlineDir = dirname(createRequire(import.meta.url).resolve("@tabler/icons/outline/bed.svg"));

/**
 * Thermal printers print pure black on white, and thin lines come out faint, so every icon is drawn in solid black
 * with a heavier stroke than Tabler's default.
 */
function forPrinting(svg: string): string {
  return svg
    .replace(/\s+class="[^"]*"/, "")
    .replaceAll('stroke="currentColor"', 'stroke="#000"')
    .replace('stroke-width="2"', 'stroke-width="2.5"')
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

const svgs = new Map(
  starterSet.map(({ id }) => [id, forPrinting(readFileSync(join(tablerOutlineDir, `${id}.svg`), "utf8"))]),
);

export const iconLibrary = {
  list: () => starterSet,
  has: (id: string) => svgs.has(id),
  svg: (id: string) => svgs.get(id),
};
