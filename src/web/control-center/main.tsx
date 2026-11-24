// The Control Center, for grown-ups: tickets to check, the kids and their stars, tasks, family and settings, each on its
// own page. On the observatory (after a grown-up's PIN) it locks itself after a short while untouched.
import "./styles.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../shared/api.js";
import { Dialogs } from "../shared/dialog.js";
import { lockObservatory, onObservatory, type GuestMe, type Me } from "./common.js";
import { FamilyPage } from "./pages/family.js";
import { KidsPage } from "./pages/kids.js";
import { SettingsPage } from "./pages/settings.js";
import { TasksPage } from "./pages/tasks.js";
import { TicketsPage } from "./pages/tickets.js";
import { Shell, usePage, type Page } from "./shell.js";
import { SignedOut } from "./signed-out.js";

const idleLockMs = 90_000;
const everyPage: Page[] = ["tickets", "kids", "tasks", "family", "settings"];
const guestPages: Page[] = ["tickets"];

function ControlCenter() {
  const [me, setMe] = useState<Me | GuestMe | null | undefined>(undefined);

  useEffect(() => {
    if (!onObservatory) return;
    let timer = setTimeout(lockObservatory, idleLockMs);
    const touched = () => {
      clearTimeout(timer);
      timer = setTimeout(lockObservatory, idleLockMs);
    };
    for (const event of ["pointerdown", "keydown"]) window.addEventListener(event, touched);
    return () => {
      clearTimeout(timer);
      for (const event of ["pointerdown", "keydown"]) window.removeEventListener(event, touched);
    };
  }, []);

  const refresh = async () => {
    const result = await api("GET", "/api/me");
    setMe(result.ok ? result.data : null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (me === undefined) return <p className="cc-loading">Loading…</p>;
  if (me === null) {
    if (onObservatory) {
      location.href = "/observatory.html";
      return null;
    }
    return <SignedOut onSignedIn={refresh} />;
  }
  return <SignedIn me={me} onSignedOut={refresh} />;
}

function SignedIn({ me, onSignedOut }: { me: Me | GuestMe; onSignedOut: () => void }) {
  const guest = "guest" in me;
  const allowed = guest ? guestPages : everyPage;
  const page = usePage(allowed);
  const account = onObservatory ? (
    <button onClick={lockObservatory}>Lock</button>
  ) : (
    <button onClick={async () => (await api("POST", "/api/sign-out"), onSignedOut())}>Sign out</button>
  );
  const who = guest ? "Guest: tickets only" : me.grownUp.email;

  return (
    <Shell chartName={me.chart.name} who={who} allowed={allowed} page={page} account={account}>
      {page === "tickets" && <TicketsPage />}
      {!guest && page === "kids" && <KidsPage />}
      {!guest && page === "tasks" && <TasksPage me={me} />}
      {!guest && page === "family" && <FamilyPage me={me} />}
      {!guest && page === "settings" && <SettingsPage me={me} account={account} />}
    </Shell>
  );
}

// Lets the Control Center be installed on a phone's home screen.
if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ControlCenter />
    <Dialogs />
  </StrictMode>,
);
