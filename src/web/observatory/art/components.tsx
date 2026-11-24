// The observatory's drawings, built from the art files by id. A missing file never breaks a screen: it shows a dashed
// placeholder instead, and the Art Gallery flags it.
import type { CSSProperties } from "react";
import { animationCss } from "./animations.js";
import fontUrl from "./files/fonts/observatory.woff2?url";
import type { ConstellationPattern } from "./constellations.js";
import { artUrl } from "./files.js";
import { jarSizes } from "./manifest.js";

/** The CSS every drawing relies on. Render it once per page. */
export function ArtStyles() {
  return <style>{animationCss + artCss}</style>;
}

const artCss = `
@font-face { font-family: "Observatory"; src: url("${fontUrl}") format("woff2"); font-weight: 300 700; font-display: swap; }
.art-missing { box-sizing: border-box; border: 3px dashed #ff6b6b; border-radius: 12px; }
.art-layers { position: relative; }
.art-layers > img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.art-sky { position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; pointer-events: none; }
.art-burst { position: absolute; left: 50%; top: 45%; width: 0; height: 0; pointer-events: none; z-index: 40; }
.art-burst span { position: absolute; width: 16px; height: 16px; border-radius: 4px; }
.art-flight { position: absolute; left: 0; top: 0; right: 0; bottom: 0; pointer-events: none; z-index: 30; }
.art-flight span { position: absolute; }
`;

/** One piece of art by id, at a given width (height follows its canvas). */
export function Art({ id, width, height = width, style, className }: { id: string; width: number; height?: number; style?: CSSProperties; className?: string }) {
  const url = artUrl(id);
  if (!url) return <span className={`art-missing ${className ?? ""}`} style={{ display: "inline-block", width, height, ...style }} title={`missing art: ${id}`} />;
  return <img src={url} width={width} height={height} alt="" draggable={false} style={style} className={className} />;
}

export interface Wearing {
  hat: string | null;
  hair: string | null;
}

/**
 * The mascot: hair behind the body, then the body, the face for its mood, and a hat on top, all on one canvas.
 * `pictures` holds a family's own pictures for outfits (by item id), which replace the built-in ones.
 */
export function Mascot({
  wearing,
  mood = "happy",
  size = 220,
  pictures = {},
}: {
  wearing: Wearing;
  mood?: "happy" | "wow";
  size?: number;
  pictures?: Record<string, string>;
}) {
  const outfit = (itemId: string | null, kind: "hat" | "hair") => itemId && { id: `outfits/${kind}-${itemId}`, url: pictures[itemId] };
  const layers = [outfit(wearing.hair, "hair"), { id: "mascot/body" }, { id: `mascot/mood-${mood}` }, outfit(wearing.hat, "hat")].filter(
    (layer): layer is { id: string; url?: string } => Boolean(layer),
  );
  return (
    <div
      className="art-layers"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Your mascot, Comet"
      data-hat={wearing.hat ?? undefined}
      data-hair={wearing.hair ?? undefined}
    >
      {layers.map((layer) =>
        layer.url ? <img key={layer.id} src={layer.url} width={size} height={size} alt="" draggable={false} /> : <Art key={layer.id} id={layer.id} width={size} />,
      )}
    </div>
  );
}

/** How big a child's jar is: the first size above every star they've ever earned, so spending never shrinks it. */
export function jarCapacity(earned: number): number {
  return jarSizes.find((size) => earned < size) ?? jarSizes[jarSizes.length - 1]!;
}

/** A jar's own art for its size if there is one (such as `jar/glass-50`), otherwise the shared art. */
export function jarArt(part: "lid" | "glass" | "inside", capacity: number): string {
  return artUrl(`jar/${part}-${capacity}`) ? `jar/${part}-${capacity}` : `jar/${part}`;
}

/**
 * The star jar: stars inside the jar's shape, raised (not resized) to show the balance out of the jar's capacity.
 * Screens choose its width, so they can draw a bigger jar for a bigger capacity.
 */
export function StarJar({ balance, earned, width = 220 }: { balance: number; earned: number; width?: number }) {
  const capacity = jarCapacity(earned);
  const fullness = Math.max(0, Math.min(1, balance / capacity));
  const drawn = Math.min(balance, 40);
  const scale = width / 200;
  // Stars sit in the filled part only (on the jar's 200-wide canvas, the fill starts at 55 and the jar ends near 235).
  const rise = (1 - fullness) * 185;
  const depth = Math.max(10, 165 - rise);
  const inside = artUrl(jarArt("inside", capacity));
  const mask: CSSProperties = inside
    ? { WebkitMaskImage: `url("${inside}")`, WebkitMaskSize: "100% 100%", maskImage: `url("${inside}")`, maskSize: "100% 100%" }
    : {};
  return (
    <div className="art-layers" style={{ width, height: width * 1.25 }} role="img" aria-label={`${balance} stars`}>
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "hidden", ...mask }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            transform: `translateY(${rise * scale}px)`,
            transition: "transform 900ms cubic-bezier(.3,1.4,.6,1)",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 55 * scale, width: "100%", height: 200 * scale, background: "rgba(255,216,77,0.35)" }} />
          {Array.from({ length: drawn }, (_, i) => (
            <Art
              key={i}
              id="star"
              width={26 * scale}
              style={{
                position: "absolute",
                // An even scatter that looks random but never clumps or lines up (the "R2" sequence).
                left: (32 + ((i * 0.7548776662) % 1) * 128) * scale,
                top: (60 + ((i * 0.5698402910) % 1) * depth) * scale,
                transform: `rotate(${(i * 47) % 360}deg)`,
              }}
            />
          ))}
        </div>
      </div>
      <Art id={jarArt("lid", capacity)} width={width} height={width * 1.25} />
      <Art id={jarArt("glass", capacity)} width={width} height={width * 1.25} />
    </div>
  );
}

/**
 * One constellation, with its first `filled` stars lit. The golden look is for the sky's later rounds. It doesn't
 * animate itself: a screen can sparkle a finished one once (each star sparkling would be dozens of animations at once).
 */
export function Constellation({ pattern, filled, size = 260, golden = false }: { pattern: ConstellationPattern; filled: number; size?: number; golden?: boolean }) {
  const lit = golden ? "#ffb319" : "#ffe680";
  const star = artUrl("star");
  return (
    <svg width={size} height={size} viewBox="-5 -5 110 110" role="img" aria-label={`${pattern.name}: ${filled} of ${pattern.stars.length}`}>
      {pattern.lines.map(([a, b], i) => {
        const [x1, y1] = pattern.stars[a]!;
        const [x2, y2] = pattern.stars[b]!;
        const on = a < filled && b < filled;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? lit : "rgba(255,255,255,0.18)"} strokeWidth={on ? 1.6 : 0.8} strokeDasharray={on ? undefined : "2 2"} />
        );
      })}
      {pattern.stars.map(([x, y], i) =>
        i < filled && star ? (
          <image key={i} href={star} x={x - 6} y={y - 6} width={12} height={12} />
        ) : (
          <circle key={i} cx={x} cy={y} r="2.2" fill={i < filled ? lit : "none"} stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        ),
      )}
    </svg>
  );
}

/** A burst of confetti from the middle of its container. Few pieces: each one is an animation the frame has to draw. */
export function Confetti({ pieces = 12 }: { pieces?: number }) {
  return (
    <div className="art-burst" aria-hidden>
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2;
        const distance = 220 + (i % 5) * 60;
        return (
          <span
            key={i}
            className="anim-confetti"
            style={
              {
                "--dx": `${Math.cos(angle) * distance}px`,
                "--dy": `${Math.sin(angle) * distance}px`,
                animationDelay: `${(i % 4) * 40}ms`,
                background: ["#ffd84d", "#ff6b9d", "#7ad7ff", "#9be08f", "#c9a7ff"][i % 5],
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** The night sky, filling its container. A still picture: on the frame, moving stars would keep its processor busy. */
export function NightSky() {
  const url = artUrl("sky");
  return <div className="art-sky" aria-hidden style={url ? { backgroundImage: `url("${url}")`, backgroundSize: "cover" } : { background: "#1c1f5c" }} />;
}

/**
 * Stars flying one after another from one point to another within their container: into the jar (`fly-in`) or out of
 * it (`fly-out`). `onDone` runs when the last one lands.
 */
export function FlyingStars({
  count,
  from,
  to,
  direction = "in",
  onDone,
}: {
  count: number;
  from: [number, number];
  to: [number, number];
  direction?: "in" | "out";
  onDone?: () => void;
}) {
  return (
    <div className="art-flight" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={direction === "in" ? "anim-fly-in" : "anim-fly-out"}
          style={{ left: from[0], top: from[1], "--fx": `${to[0] - from[0]}px`, "--fy": `${to[1] - from[1]}px`, animationDelay: `${i * 260}ms` } as CSSProperties}
          onAnimationEnd={i === count - 1 ? onDone : undefined}
        >
          <Art id="star" width={44} />
        </span>
      ))}
    </div>
  );
}
