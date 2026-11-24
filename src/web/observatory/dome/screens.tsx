// The Dome's screens. They show the observatory's data and call back for every action; main.tsx talks to the server.
import { useState } from "react";
import { Icon } from "../../shared/icons.js";
import { StarHistoryList, type StarHistory } from "../../shared/star-history.js";
import { Art, Confetti, FlyingStars, Mascot, StarJar, jarCapacity } from "../art/components.js";
import { jarSizes } from "../art/manifest.js";
import { categoryColours, taskColours } from "./styles.js";

export interface Child {
  id: string;
  nickname: string;
  displayStyle: "pictures" | "words";
}

/** Something a child can print: a chore, or a quiz topic. */
export interface MenuChoice {
  kind: "chore" | "quiz";
  id: string;
  name: string;
  stars: number;
  icon: string | null;
  done: boolean;
}

/** A category: an optional folder of tasks, which may mix chores and quizzes. */
export interface MenuCategory {
  id: string;
  name: string;
  icon: string | null;
  choices: MenuChoice[];
}

/** What a child sees: their categories, and the tasks not in any category. */
export interface Menu {
  categories: MenuCategory[];
  tasks: MenuChoice[];
}

/** A bigger jar is drawn a little wider, so moving up a size is something a child can see. */
function jarWidth(earned: number) {
  return 190 + (jarSizes as readonly number[]).indexOf(jarCapacity(earned)) * 14;
}

/** Until the store (tickets 07 and 09), every mascot is bare. */
const bare = { hat: null, hair: null };

/** Who are you: every child as a big planet, with their mascot and nickname. */
export function WhoAreYou({ children, onChoose, onGrownUps }: { children: Child[]; onChoose: (child: Child) => void; onGrownUps: () => void }) {
  return (
    <div className="dome-screen">
      <div className="dome-big" style={{ top: 90 }}>
        Who are you?
      </div>
      <div className="dome-planets dome-who">
        {children.length === 0 && <p className="dome-medium">No children yet. A grown-up can add them in the Control Center.</p>}
        {children.map((child, i) => (
          <button key={child.id} className="dome-planet" style={{ background: categoryColours[i % categoryColours.length] }} onClick={() => onChoose(child)}>
            <Mascot wearing={bare} size={170} />
            <span>{child.nickname}</span>
          </button>
        ))}
      </div>
      <button className="dome-corner" onClick={onGrownUps}>
        Grown-ups
      </button>
    </div>
  );
}

/** A planet's face: a big icon for children who see pictures, otherwise the name. */
function Face({ thing, pictures }: { thing: { name: string; icon: string | null }; pictures: boolean }) {
  // Icons are drawn black (for the thermal printer), so they're turned white on a planet.
  return pictures && thing.icon ? (
    <span className="dome-icon">
      <Icon id={thing.icon} size={110} label={thing.name} />
    </span>
  ) : (
    <span>{thing.name}</span>
  );
}

function TaskPlanet({ choice, index, pictures, onPrint }: { choice: MenuChoice; index: number; pictures: boolean; onPrint: (choice: MenuChoice) => void }) {
  return (
    <button
      className="dome-planet"
      style={{ background: taskColours[index % taskColours.length] }}
      disabled={choice.done}
      onClick={() => onPrint(choice)}
      aria-label={`${choice.name}, ${choice.stars} ${choice.stars === 1 ? "star" : "stars"}${choice.done ? ", done for now" : ""}`}
    >
      <Face thing={choice} pictures={pictures} />
      <small>
        {pictures ? "★".repeat(Math.min(choice.stars, 5)) : `${choice.stars} ★`}
        {choice.done ? " ✓" : ""}
      </small>
    </button>
  );
}

/** At most this many stars fly in, however many arrived, so it's over quickly and the old screen keeps up. */
export const mostFlyingStars = 12;

/** How long the new stars take to fly in, so the screen can carry on even if the frame never says they've landed. */
export function arrivalMs(newStars: number) {
  return 900 + (Math.min(newStars, mostFlyingStars) - 1) * 260;
}

/**
 * A child's own screen: the dome with their star jar and mascot, their categories and tasks as planets, and the dock.
 * Tapping the jar shows their star history. While `arriving` new stars fly into the jar, the jar shows the balance
 * before them; any tap skips ahead.
 */
export function ChildScreen({
  child,
  balance,
  earned,
  arriving,
  menu,
  history,
  onArrived,
  onPrint,
  onShowHistory,
  onLeave,
}: {
  child: Child;
  balance: number | undefined;
  earned: number | undefined;
  arriving: number;
  menu: Menu | undefined;
  history: StarHistory | undefined;
  onArrived: () => void;
  onPrint: (choice: MenuChoice) => void;
  onShowHistory: (show: boolean) => void;
  onLeave: () => void;
}) {
  const [category, setCategory] = useState<MenuCategory | undefined>();
  const pictures = child.displayStyle === "pictures";

  // A category with just one task for this child prints it straight away; otherwise the child picks one.
  const open = (chosen: MenuCategory) => {
    const only = chosen.choices[0];
    if (chosen.choices.length === 1 && only && !only.done) onPrint(only);
    else setCategory(chosen);
  };

  const back = () => {
    if (history) onShowHistory(false);
    else if (category) setCategory(undefined);
    else onLeave();
  };

  return (
    <div className="dome-screen">
      <div className="dome-dome">
        {!pictures && <div className="dome-title">Hi {child.nickname}!</div>}
        {balance !== undefined && earned !== undefined && (
          <button className="dome-jar" onClick={() => onShowHistory(true)} aria-label={`My stars: ${balance - arriving}`}>
            <StarJar balance={balance - arriving} earned={earned} width={jarWidth(earned)} />
            {!pictures && <div className="dome-count">{balance - arriving} ★</div>}
          </button>
        )}
        <div className="dome-mascot anim-hop">
          <Mascot wearing={bare} mood={arriving ? "wow" : "happy"} size={230} />
        </div>
      </div>

      {arriving > 0 ? (
        <div className="dome-overlay" style={{ background: "none" }} onClick={onArrived}>
          <FlyingStars count={Math.min(arriving, mostFlyingStars)} from={[378, -40]} to={[205, 360]} onDone={onArrived} />
          {!pictures && (
            <div className="dome-big anim-pop" style={{ top: 700 }} role="status">
              You earned {arriving} {arriving === 1 ? "star" : "stars"}!
            </div>
          )}
        </div>
      ) : history ? (
        <div className="dome-panel" style={{ top: 620, bottom: 190 }}>
          <StarHistoryList history={history} />
        </div>
      ) : (
        <div className="dome-planets">
          {menu === undefined && <p className="dome-medium">Loading…</p>}
          {menu && menu.categories.length === 0 && menu.tasks.length === 0 && <p className="dome-medium">Nothing to do right now.</p>}
          {menu &&
            !category &&
            menu.categories.map((c, i) => (
              <button key={c.id} className="dome-planet" style={{ background: categoryColours[i % categoryColours.length] }} onClick={() => open(c)} aria-label={c.name}>
                <Face thing={c} pictures={pictures} />
              </button>
            ))}
          {menu &&
            (category ? category.choices : menu.tasks).map((choice, i) => (
              <TaskPlanet key={`${choice.kind}-${choice.id}`} choice={choice} index={i} pictures={pictures} onPrint={onPrint} />
            ))}
        </div>
      )}

      <div className="dome-dock" style={arriving ? { visibility: "hidden" } : undefined}>
        <button className="dome-door" onClick={back} aria-label="Back">
          <span className="dome-door-arrow" aria-hidden>
            ⬅
          </span>
          {!pictures && "Back"}
        </button>
      </div>
    </div>
  );
}

/** A ticket sliding out of the top with confetti, while the printer prints it. */
export function Printing({ child, choice }: { child: Child; choice: MenuChoice }) {
  const pictures = child.displayStyle === "pictures";
  return (
    <div className="dome-screen">
      <Confetti />
      <div className="dome-ticket anim-ticket-slide">
        <div style={{ fontSize: 36, fontWeight: 700 }}>{child.nickname}</div>
        <div className="dome-ticket-art">{pictures && choice.icon ? <Icon id={choice.icon} size={180} label={choice.name} /> : choice.name}</div>
        <div>{"★".repeat(Math.min(choice.stars, 10))}</div>
      </div>
      <div className="dome-big anim-pop" style={{ top: 800 }}>
        Here's your ticket!
      </div>
    </div>
  );
}

/**
 * When a ticket couldn't print: what happened, from the server, with the mascot looking surprised. If the child
 * already has one of that kind out, they can say they lost it, to ask a grown-up for a new copy.
 */
export function CouldNotPrint({ message, lost, onLost, onStillHaveIt }: { message: string; lost: boolean; onLost: () => void; onStillHaveIt: () => void }) {
  return (
    <div className="dome-screen">
      <div className="anim-pop" style={{ position: "absolute", left: 285, top: 200 }}>
        <Mascot wearing={bare} mood="wow" size={230} />
      </div>
      <div className="dome-big" style={{ top: 500, fontSize: 48 }} role="status">
        {message}
      </div>
      {lost && (
        <div className="dome-choice">
          <button className="dome-door" onClick={onLost}>
            I lost it
          </button>
          <button className="dome-door" onClick={onStillHaveIt}>
            I still have it
          </button>
        </div>
      )}
    </div>
  );
}

export type ScanOutcome = { result: "handed-in" | "waiting-for-grown-up" | "already-done" | "not-recognised"; childNickname?: string; title?: string };

/** What happened when a ticket was scanned here: a big celebration, or a friendly message. Tap to close. */
export function Scanned({ outcome, onClose }: { outcome: ScanOutcome; onClose: () => void }) {
  const said = {
    "handed-in": [`Great job${outcome.childNickname ? `, ${outcome.childNickname}` : ""}!`, "A grown-up will check it."],
    "waiting-for-grown-up": ["Already handed in!", "It's waiting for a grown-up."],
    "already-done": ["Already done!", outcome.title ? `"${outcome.title}" got its stars.` : "It got its stars."],
    "not-recognised": ["Hmm, I don't know that ticket.", "Ask a grown-up."],
  }[outcome.result] ?? ["Hmm, I don't know that ticket.", "Ask a grown-up."];
  const happy = outcome.result === "handed-in" || outcome.result === "already-done";
  return (
    <div className="dome-overlay" onClick={onClose} role="status">
      {outcome.result === "handed-in" && <Confetti />}
      <div className={`dome-overlay-mascot ${happy ? "anim-hop" : "anim-pop"}`}>
        <Mascot wearing={bare} mood={happy ? "happy" : "wow"} size={220} />
      </div>
      {outcome.result === "already-done" && (
        <div className="anim-sparkle" style={{ position: "absolute", left: 560, top: 230 }}>
          <Art id="star" width={110} />
        </div>
      )}
      <div className="dome-big anim-pop" style={{ top: 560 }}>
        {said[0]}
        <div className="dome-medium" style={{ marginTop: 16 }}>
          {said[1]}
        </div>
      </div>
    </div>
  );
}
