// The observatory's stage: every observatory screen is designed at 800×1280 (portrait), and the stage scales that
// design to fit whatever window it's in, upright. The picture frame hangs portrait but tells the page it's a 1280×800
// landscape window, so its kiosk address adds `?turn=right` (or `?turn=left`, depending on how it's hung) and the stage
// turns a quarter turn to stay upright. Without it, as on a computer, nothing turns.
// Taps land where they look: the browser maps touches through the turn and the scaling.
import { useEffect, useState, type ReactNode } from "react";

export const stageWidth = 800;
export const stageHeight = 1280;

const css = `
html, body { margin: 0; height: 100%; overflow: hidden; background: #0b1033; }
.observatory-stage { position: fixed; left: 50%; top: 50%; width: ${stageWidth}px; height: ${stageHeight}px; overflow: hidden;
  font-family: "Observatory", "Trebuchet MS", sans-serif; font-size: 24px; color: #fff; }
.observatory-stage-scroll { overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; }
`;

function windowSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** How the 800×1280 design sits in a window: turned or not, and how much it's scaled. */
export function stageFit(window: { width: number; height: number }, turn: "left" | "right" | null) {
  const turned = turn !== null;
  const [across, down] = turned ? [window.height, window.width] : [window.width, window.height];
  const scale = Math.min(across / stageWidth, down / stageHeight);
  const degrees = turned ? (turn === "left" ? -90 : 90) : 0;
  return { turned, scale, transform: `translate(-50%, -50%) rotate(${degrees}deg) scale(${scale})` };
}

/** The 800×1280 stage, fitted to the window. `scroll` lets its contents scroll (for long pages like the Art Gallery). */
export function Stage({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const [size, setSize] = useState(windowSize);
  useEffect(() => {
    const resized = () => setSize(windowSize());
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  }, []);
  const asked = new URLSearchParams(window.location.search).get("turn");
  const turn = asked === "left" || asked === "right" ? asked : null;
  const fit = stageFit(size, turn);
  return (
    <>
      <style>{css}</style>
      <div className={`observatory-stage ${scroll ? "observatory-stage-scroll" : ""}`} data-stage data-turned={fit.turned || undefined} style={{ transform: fit.transform }}>
        {children}
      </div>
    </>
  );
}
