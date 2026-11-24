import { useEffect, useRef } from "react";

/** Calls `onIdle` once nobody has touched the screen for `ms`, while `active`. Any tap or key press starts it again. */
export function useIdle(active: boolean, ms: number, onIdle: () => void) {
  const latest = useRef(onIdle);
  latest.current = onIdle;

  useEffect(() => {
    if (!active) return;
    let timer = setTimeout(() => latest.current(), ms);
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), ms);
    };
    window.addEventListener("pointerdown", restart, true);
    window.addEventListener("keydown", restart, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", restart, true);
      window.removeEventListener("keydown", restart, true);
    };
  }, [active, ms]);
}
