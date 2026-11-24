// The Art Gallery: every piece of observatory art and every animation, in every state, for reviewing art as it's
// replaced. Development builds only (left out when STAR_CHART_RELEASE=true). Open it on the real screen to judge
// size and smoothness there.
import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { animations, type Animation } from "../observatory/art/animations.js";
import { Art, ArtStyles, Confetti, Constellation, FlyingStars, Mascot, StarJar, TwinklingSky, jarArt } from "../observatory/art/components.js";
import { constellations, skyFor, starsInTheSky } from "../observatory/art/constellations.js";
import { artUrl } from "../observatory/art/files.js";
import { jarSizes, manifest } from "../observatory/art/manifest.js";

const css = `
body { margin: 0; background: linear-gradient(#0b1033, #1c1f5c 45%, #2e2a6b); background-attachment: fixed; color: #fff;
  font-family: "Trebuchet MS", "Arial Rounded MT Bold", sans-serif; }
main { padding: 16px; max-width: 1200px; margin: 0 auto; }
h1 { font-size: 34px; margin: 8px 0 4px; }
h2 { font-size: 26px; margin: 32px 0 8px; border-bottom: 3px solid #8b6bd9; padding-bottom: 6px; }
.lede { opacity: 0.8; margin: 0 0 8px; }
.grid { display: flex; flex-wrap: wrap; margin: 0 -8px; }
.tile { margin: 8px; padding: 12px; border-radius: 18px; background: rgba(255,255,255,0.07); display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 260px; }
.tile code { font-size: 14px; color: #ffe680; margin-top: 8px; word-break: break-all; }
.tile small { font-size: 13px; opacity: 0.75; margin-top: 4px; }
.tile.missing { background: rgba(255,80,80,0.25); outline: 3px solid #ff6b6b; }
.missing-note { color: #ff9b9b; font-weight: bold; }
.stage { position: relative; width: 240px; height: 240px; overflow: hidden; border-radius: 14px; background: rgba(0,0,0,0.35); }
button { font: inherit; font-size: 16px; padding: 8px 14px; border-radius: 12px; border: none; background: #8b6bd9; color: #fff; margin-top: 8px; }
.summary { padding: 10px 14px; border-radius: 12px; display: inline-block; margin-top: 8px; }
`;

function Tile({ artId, missing, children, label, note }: { artId?: string; missing?: boolean; children: ReactNode; label: string; note?: string }) {
  return (
    <div className={`tile ${missing ? "missing" : ""}`} data-art-id={artId} data-missing={missing ? "" : undefined}>
      {children}
      <code>{label}</code>
      {note && <small>{note}</small>}
      {missing && <small className="missing-note">File missing</small>}
    </div>
  );
}

function Images() {
  return (
    <div className="grid">
      {manifest.map((entry) => (
        <Tile key={entry.id} artId={entry.id} missing={!artUrl(entry.id)} label={entry.id} note={`${entry.what} · ${entry.canvas.join("×")}`}>
          <Art id={entry.id} width={entry.canvas[0] > 100 ? 160 : 100} height={entry.canvas[0] > 100 ? (160 * entry.canvas[1]) / entry.canvas[0] : 100} />
        </Tile>
      ))}
    </div>
  );
}

function Mascots() {
  const hats = ["crown", "wizard", "helmet"];
  const hairs = ["spiky", "curly"];
  const looks: { label: string; hat: string | null; hair: string | null; mood: "happy" | "wow" }[] = [
    { label: "bare, happy", hat: null, hair: null, mood: "happy" },
    { label: "bare, wow", hat: null, hair: null, mood: "wow" },
    ...hats.map((hat) => ({ label: `hat: ${hat}`, hat, hair: null, mood: "happy" as const })),
    ...hairs.map((hair) => ({ label: `hair: ${hair}`, hat: null, hair, mood: "happy" as const })),
    ...hats.flatMap((hat) => hairs.map((hair) => ({ label: `${hat} + ${hair}`, hat, hair, mood: "happy" as const }))),
  ];
  return (
    <div className="grid">
      {looks.map((look) => (
        <Tile key={look.label} label={look.label}>
          <Mascot wearing={{ hat: look.hat, hair: look.hair }} mood={look.mood} size={180} />
        </Tile>
      ))}
    </div>
  );
}

function Jars() {
  // A jar is never quite full: the star that would fill it moves the child up to the next size.
  return (
    <div className="grid">
      {jarSizes.flatMap((capacity, index) => {
        const smallest = index === 0 ? 0 : jarSizes[index - 1]!;
        const ownArt = jarArt("glass", capacity) !== "jar/glass";
        return [
          { label: "just spent", balance: 0, earned: smallest },
          { label: "half", balance: Math.floor(capacity / 2), earned: Math.max(smallest, Math.floor(capacity / 2)) },
          { label: "nearly full", balance: capacity - 1, earned: capacity - 1 },
        ].map((state) => (
          <Tile key={`${capacity}-${state.label}`} label={`${capacity}-star jar, ${state.balance} stars`} note={`${state.label} · ${ownArt ? "its own art" : "shared jar art"}`}>
            <StarJar balance={state.balance} earned={state.earned} width={140} />
          </Tile>
        ));
      })}
    </div>
  );
}

function Sky() {
  const golden = skyFor(starsInTheSky + 9);
  return (
    <>
      <p className="lede">
        {constellations.length} constellations, {starsInTheSky} stars in all. Each is shown empty, part-filled and full; then the sky's golden second round.
      </p>
      <div className="grid">
        {constellations.flatMap((pattern) =>
          [0, Math.ceil(pattern.stars.length / 2), pattern.stars.length].map((filled) => (
            <Tile key={`${pattern.name}-${filled}`} label={`${pattern.name}: ${filled}/${pattern.stars.length}`}>
              <span data-constellation={filled === 0 ? pattern.name : undefined}>
                <Constellation pattern={pattern} filled={filled} size={150} />
              </span>
            </Tile>
          )),
        )}
        {golden.constellations.slice(0, 3).map((pattern) => (
          <Tile key={`golden-${pattern.name}`} label={`round ${golden.round + 1}: ${pattern.name}`}>
            <Constellation pattern={pattern} filled={pattern.filled} size={150} golden />
          </Tile>
        ))}
      </div>
    </>
  );
}

function AnimationTile({ name, animation }: { name: string; animation: Animation }) {
  const [run, setRun] = useState(0);
  const demo: Record<string, ReactNode> = {
    confetti: <Confetti />,
    "fly-in": <FlyingStars count={3} from={[30, 180]} to={[180, 40]} />,
    "fly-out": <FlyingStars count={3} from={[180, 40]} to={[30, 200]} direction="out" />,
    twinkle: <TwinklingSky count={30} />,
    bounce: (
      <div className="anim-bounce" style={{ position: "absolute", left: 30, top: 30 }}>
        <Mascot wearing={{ hat: null, hair: null }} size={180} />
      </div>
    ),
    "ticket-slide": (
      <div className="anim-ticket-slide" style={{ position: "absolute", left: 60, top: 0, width: 120, height: 200, background: "#fff", borderRadius: 4 }} />
    ),
  };
  return (
    <Tile label={name} note={`${animation.what} · ${animation.durationMs}ms${animation.repeat === "infinite" ? ", repeating" : ""}`}>
      <div className="stage" key={run}>
        {demo[name] ?? (
          <div className={`anim-${name}`} style={{ position: "absolute", left: 70, top: 70 }}>
            <Art id="stickers/rocket" width={100} />
          </div>
        )}
      </div>
      <button onClick={() => setRun(run + 1)}>Replay</button>
    </Tile>
  );
}

function Gallery() {
  const missing = manifest.filter((entry) => !artUrl(entry.id));
  return (
    <main>
      <ArtStyles />
      <style>{css}</style>
      <h1>Art Gallery</h1>
      <p className="lede">
        Every piece of observatory art lives in <code>src/web/observatory/art/files/</code>. To replace one, save a new SVG or PNG over the file with the same name.
      </p>
      <div className="summary" style={{ background: missing.length ? "rgba(255,80,80,0.35)" : "rgba(80,200,120,0.25)" }}>
        {missing.length ? `${missing.length} missing: ${missing.map((entry) => entry.id).join(", ")}` : `All ${manifest.length} files present`}
      </div>
      <h2>Images</h2>
      <Images />
      <h2>Mascot</h2>
      <Mascots />
      <h2>Star jar</h2>
      <Jars />
      <h2>My sky</h2>
      <Sky />
      <h2>Animations</h2>
      <div className="grid">
        {Object.entries(animations).map(([name, animation]) => (
          <AnimationTile key={name} name={name} animation={animation} />
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Gallery />);
