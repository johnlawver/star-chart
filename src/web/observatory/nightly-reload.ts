import { useEffect, useRef } from "react";
import { isReachable, keepLoading } from "./connection.js";

/** How often the screen checks whether it's time, and quiet enough, to reload. */
const checkEveryMs = 30_000;

/**
 * Reloads the page once a night (3am in the chart's time zone, as the server says), to pick up a new release and clear
 * out a page that's been running all day. It waits while a child is mid-task (`quiet` false), and while the server
 * can't be reached: reloading then would leave the kiosk on a browser error page.
 */
export function useNightlyReload(deviceToken: string, quiet: boolean): void {
  const quietNow = useRef(quiet);
  quietNow.current = quiet;

  useEffect(() => {
    const stop = new AbortController();
    // Measured on the page's own steady clock from the server's answer, so a frame whose date is wrong (or changes
    // when its Wi-Fi comes up) still reloads at the right time.
    let due: number | undefined;
    let reloading = false;
    void keepLoading("/api/observatory/schedule", deviceToken, stop.signal, (schedule, fresh) => {
      if (fresh) due = performance.now() + (Date.parse(schedule.nightlyReload) - Date.parse(schedule.now));
    });

    const check = async () => {
      if (due === undefined || performance.now() < due || !quietNow.current || !isReachable() || reloading) return;
      reloading = true;
      const page = await fetch(location.href, { cache: "no-store" }).catch(() => undefined);
      if (page?.ok) location.reload();
      else reloading = false;
    };
    const every = setInterval(check, checkEveryMs);
    return () => {
      stop.abort();
      clearInterval(every);
    };
  }, [deviceToken]);
}
