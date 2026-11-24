// The Control Center's frame: the chart's name, the pages, and who's signed in. A sidebar on wide screens (and on the
// observatory), a tab bar along the bottom on phones. Each page has its own address (/kids, /tasks…), so Back and
// Forward work and a page can be bookmarked. The server serves the Control Center at each of them (src/server/app.ts).
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { api } from "../shared/api.js";
import { onObservatory } from "./common.js";

export type Page = "tickets" | "kids" | "tasks" | "family" | "settings";

const pages: { id: Page; label: string; icon: ReactNode }[] = [
  {
    id: "tickets",
    label: "Tickets",
    icon: <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM9 11l2 2 4-4" />,
  },
  {
    id: "kids",
    label: "Kids",
    icon: <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />,
  },
  { id: "tasks", label: "Tasks", icon: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /> },
  {
    id: "family",
    label: "Family",
    icon: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M21 20a5 5 0 0 0-4-4.9" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
      </>
    ),
  },
];

function pageFromPath(allowed: Page[]): Page {
  const asked = location.pathname.replace(/^\//, "").replace(/\/$/, "") as Page;
  return allowed.includes(asked) ? asked : allowed[0]!;
}

/** The page in the address, kept in step with Back and Forward. */
export function usePage(allowed: Page[]): Page {
  const [page, setPage] = useState(() => pageFromPath(allowed));
  useEffect(() => {
    const changed = () => setPage(pageFromPath(allowed));
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, [allowed.join()]);
  return page;
}

/** Goes to another page without reloading, adding it to the history. Keeps `?on=observatory` and the like. */
function go(event: MouseEvent<HTMLAnchorElement>, page: Page) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  if (location.pathname === `/${page}`) return;
  history.pushState(null, "", `/${page}${location.search}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

/** Shows how many things are waiting on the app's home-screen badge (where the browser supports it). */
function showOnAppBadge(count: number) {
  if (onObservatory || !("setAppBadge" in navigator)) return;
  const update = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  update.catch(() => {
    // Badges are a nice extra; ignore browsers that refuse.
  });
}

/** How many tickets and lost-ticket requests are waiting for a grown-up, checked every 10 seconds. */
function useWaitingCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const check = async () => {
      const [handedIn, lost] = await Promise.all([api("GET", "/api/tickets?state=handed-in"), api("GET", "/api/reprint-requests")]);
      const total = (handedIn.ok ? handedIn.data.tickets.length : 0) + (lost.ok ? lost.data.reprintRequests.length : 0);
      setCount(total);
      showOnAppBadge(total);
    };
    void check();
    const every = setInterval(check, 10_000);
    return () => clearInterval(every);
  }, []);
  return count;
}

export function Shell({
  chartName,
  who,
  allowed,
  page,
  account,
  children,
}: {
  chartName: string;
  who: string;
  allowed: Page[];
  page: Page;
  account: ReactNode;
  children: ReactNode;
}) {
  const waiting = useWaitingCount();
  const visible = pages.filter((candidate) => allowed.includes(candidate.id));
  const title = visible.find((candidate) => candidate.id === page)?.label;
  return (
    <div className={`cc ${visible.length > 1 ? "cc-with-nav" : ""}`}>
      <header className="cc-top">
        <span className="cc-brand">
          <span aria-hidden>★</span> {chartName}
        </span>
        <span className="cc-who">{who}</span>
        {account}
      </header>
      {visible.length > 1 && (
        <nav className="cc-nav" aria-label="Pages">
          {visible.map((candidate) => (
            <a key={candidate.id} href={`/${candidate.id}${location.search}`} onClick={(event) => go(event, candidate.id)} aria-current={candidate.id === page ? "page" : undefined}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {candidate.icon}
              </svg>
              <span>{candidate.label}</span>
              {candidate.id === "tickets" && waiting > 0 && (
                <span className="cc-badge" aria-label={`${waiting} waiting`}>
                  {waiting}
                </span>
              )}
            </a>
          ))}
        </nav>
      )}
      <main className="cc-main">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
