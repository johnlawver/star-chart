// The Dome's screens. They show the observatory's data and call back for every action; main.tsx talks to the server.
import { useState } from "react";
import { Icon } from "../../shared/icons.js";
import { StarHistoryList, type StarHistory } from "../../shared/star-history.js";
import { Art, Confetti, Constellation, FlyingStars, Mascot, StarJar, jarCapacity, type Wearing } from "../art/components.js";
import { skyFor } from "../art/constellations.js";
import { artUrl } from "../art/files.js";
import { jarSizes, storeItemArt } from "../art/manifest.js";
import { categoryColours, taskColours } from "./styles.js";

export interface Child {
  id: string;
  nickname: string;
  displayStyle: "pictures" | "words";
  /** What their mascot is wearing (from the who-are-you list). */
  wearing?: Wearing;
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

/** Something in the chart's store. */
export interface StoreItem {
  id: string;
  kind: "sticker" | "hat" | "hair";
  name: string;
  price: number;
  /** An uploaded picture's address, or null for a built-in item (whose picture ships with the app). */
  art: string | null;
}

/** A store item's picture: its uploaded one, or the built-in art for its id. */
function ItemPicture({ item, width }: { item: Pick<StoreItem, "id" | "kind" | "art">; width: number }) {
  return item.art ? <img src={item.art} width={width} height={width} alt="" draggable={false} style={{ objectFit: "contain" }} /> : <Art id={storeItemArt(item)} width={width} />;
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

/** A mascot wearing nothing in particular. */
const bare: Wearing = { hat: null, hair: null };

/** A family's own outfit pictures (by item id), from the store, so the mascot wears those instead of the built-in ones. */
export function outfitPictures(store: StoreItem[] | undefined): Record<string, string> {
  return Object.fromEntries((store ?? []).flatMap((item) => (item.kind !== "sticker" && item.art ? [[item.id, item.art]] : [])));
}

/** Who are you: every child as a big planet, with their mascot and nickname. */
export function WhoAreYou({
  children,
  pictures,
  onChoose,
  onGrownUps,
}: {
  children: Child[];
  pictures: Record<string, string>;
  onChoose: (child: Child) => void;
  onGrownUps: () => void;
}) {
  return (
    <div className="dome-screen">
      <div className="dome-big" style={{ top: 90 }}>
        Who are you?
      </div>
      <div className="dome-planets dome-who">
        {children.length === 0 && <p className="dome-medium">No children yet. A grown-up can add them in the Control Center.</p>}
        {children.map((child, i) => (
          <button key={child.id} className="dome-planet" style={{ background: categoryColours[i % categoryColours.length] }} onClick={() => onChoose(child)}>
            <Mascot wearing={child.wearing ?? bare} pictures={pictures} size={170} />
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
  store,
  owned,
  wearing,
  onArrived,
  onPrint,
  onBuy,
  onWear,
  onShowHistory,
  onLeave,
}: {
  child: Child;
  balance: number | undefined;
  earned: number | undefined;
  arriving: number;
  menu: Menu | undefined;
  history: StarHistory | undefined;
  store: StoreItem[] | undefined;
  owned: string[];
  wearing: Wearing;
  onArrived: () => void;
  onPrint: (choice: MenuChoice) => void;
  /** Buys an item; resolves true if it was bought. */
  onBuy: (item: StoreItem) => Promise<boolean>;
  /** Puts an owned outfit on, or takes it off if it's being worn. */
  onWear: (item: StoreItem) => void;
  onShowHistory: (show: boolean) => void;
  onLeave: () => void;
}) {
  const [category, setCategory] = useState<MenuCategory | undefined>();
  const [panel, setPanel] = useState<"planets" | "store" | "stickers" | "sky">("planets");
  const [spending, setSpending] = useState(0);
  const pictures = child.displayStyle === "pictures";

  const buy = async (item: StoreItem) => {
    if (await onBuy(item)) setSpending(Math.min(item.price, 6));
  };

  // A category with just one task for this child prints it straight away; otherwise the child picks one.
  const open = (chosen: MenuCategory) => {
    const only = chosen.choices[0];
    if (chosen.choices.length === 1 && only && !only.done) onPrint(only);
    else setCategory(chosen);
  };

  const show = (next: typeof panel) => {
    if (history) onShowHistory(false);
    setPanel(next);
  };

  const back = () => {
    if (panel !== "planets") setPanel("planets");
    else if (history) onShowHistory(false);
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
          <Mascot wearing={wearing} pictures={outfitPictures(store)} mood={arriving ? "wow" : "happy"} size={230} />
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
      ) : panel === "sky" && earned !== undefined ? (
        <MySky earned={earned} pictures={pictures} />
      ) : panel === "stickers" ? (
        <StickerBook owned={owned} store={store} pictures={pictures} onShop={() => setPanel("store")} />
      ) : panel === "store" ? (
        <Shop store={store} owned={owned} wearing={wearing} balance={balance ?? 0} pictures={pictures} onBuy={buy} onWear={onWear} />
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

      {spending > 0 && <FlyingStars count={spending} from={[205, 360]} to={[400, 820]} direction="out" onDone={() => setSpending(0)} />}

      <div className="dome-dock" style={arriving ? { visibility: "hidden" } : undefined}>
        <button className="dome-door" onClick={back} aria-label="Back">
          <span className="dome-door-arrow" aria-hidden>
            ⬅
          </span>
          {!pictures && "Back"}
        </button>
        <button className="dome-door" onClick={() => show("store")} aria-label="Store" aria-pressed={panel === "store"}>
          <Art id="dock/store" width={64} />
          {!pictures && "Store"}
        </button>
        <button className="dome-door" onClick={() => show("stickers")} aria-label="Sticker Book" aria-pressed={panel === "stickers"}>
          <Art id="dock/stickers" width={64} />
          {!pictures && "Stickers"}
        </button>
        <button className="dome-door" onClick={() => show("sky")} aria-label="My sky" aria-pressed={panel === "sky"}>
          <Art id="dock/sky" width={64} />
          {!pictures && "My sky"}
        </button>
      </div>
    </div>
  );
}

/**
 * The store, under the dome so the jar stays in sight: every item at its real size with its price. Items the child
 * can't afford yet are faded, and ones they own say so. Neither can be tapped.
 */
function Shop({
  store,
  owned,
  wearing,
  balance,
  pictures,
  onBuy,
  onWear,
}: {
  store: StoreItem[] | undefined;
  owned: string[];
  wearing: Wearing;
  balance: number;
  pictures: boolean;
  onBuy: (item: StoreItem) => void;
  onWear: (item: StoreItem) => void;
}) {
  const outfits = outfitPictures(store);
  return (
    <div className="dome-planets dome-shop">
      {store === undefined && <p className="dome-medium">Loading…</p>}
      {store?.map((item) => {
        const mine = owned.includes(item.id);
        const outfit = item.kind !== "sticker";
        const worn = outfit && wearing[item.kind as "hat" | "hair"] === item.id;
        // An owned outfit can be put on and taken off; an owned sticker is simply yours.
        const label = !mine
          ? `Buy ${item.name} for ${item.price} ${item.price === 1 ? "star" : "stars"}`
          : outfit
            ? `${worn ? "Take off" : "Wear"} ${item.name}`
            : `${item.name}, yours`;
        return (
          <button
            key={item.id}
            className={`dome-shelf-item ${mine ? "dome-owned" : ""} ${worn ? "dome-worn" : ""}`}
            disabled={mine ? !outfit : item.price > balance}
            onClick={() => (mine ? onWear(item) : onBuy(item))}
            aria-label={label}
            aria-pressed={outfit && mine ? worn : undefined}
          >
            {outfit ? (
              <Mascot wearing={{ hat: item.kind === "hat" ? item.id : null, hair: item.kind === "hair" ? item.id : null }} pictures={outfits} size={110} />
            ) : (
              <ItemPicture item={item} width={110} />
            )}
            {!pictures && <span className="dome-shelf-name">{item.name}</span>}
            <span className="dome-price">
              {mine && outfit ? (
                pictures ? (
                  worn ? "✓" : ""
                ) : worn ? (
                  "Wearing"
                ) : (
                  "Wear"
                )
              ) : mine ? (
                "✓"
              ) : (
                <>
                  {item.price} <Art id="star" width={30} />
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Every sticker the child has bought, or a friendly empty page pointing to the store. */
function StickerBook({ owned, store, pictures, onShop }: { owned: string[]; store: StoreItem[] | undefined; pictures: boolean; onShop: () => void }) {
  // Stickers are what the store sells as stickers, or (for one no longer in the store) what has sticker art.
  const isSticker = (id: string) => store?.find((item) => item.id === id)?.kind === "sticker" || Boolean(artUrl(`stickers/${id}`));
  const stickers = owned.filter(isSticker);
  const name = (id: string) => store?.find((item) => item.id === id)?.name ?? id;
  return (
    <div className="dome-panel dome-book">
      {stickers.length === 0 ? (
        <div className="dome-book-empty">
          <div className="dome-medium">{pictures ? "" : "No stickers yet!"}</div>
          <button className="dome-door" onClick={onShop} aria-label="Go to the store">
            <Art id="dock/store" width={64} />
            {!pictures && "Store"}
          </button>
        </div>
      ) : (
        stickers.map((id, i) => (
          // Tilted on the outside, popping in on the inside: the animation would otherwise replace the tilt.
          <span key={id} className="dome-book-sticker" style={{ transform: `rotate(${((i * 23) % 30) - 15}deg)` }} role="img" aria-label={name(id)}>
            <span className="anim-pop" style={{ display: "inline-block", animationDelay: `${i * 60}ms` }}>
              <ItemPicture item={store?.find((item) => item.id === id) ?? { id, kind: "sticker", art: null }} width={150} />
            </span>
          </span>
        ))
      )}
    </div>
  );
}

/**
 * My sky: every star the child has ever earned lights real constellations, one star at a time, in order. Built from
 * lifetime stars, so spending never empties one. Finished ones sparkle once as the sky opens. Past the last
 * constellation the sky starts again in gold.
 */
function MySky({ earned, pictures }: { earned: number; pictures: boolean }) {
  const { round, constellations } = skyFor(earned);
  const golden = round > 0;
  return (
    <div className="dome-panel dome-sky">
      {golden && !pictures && <div className="dome-medium dome-sky-round">Golden sky, round {round + 1}!</div>}
      {constellations.map((pattern, i) => {
        const done = pattern.filled === pattern.stars.length;
        return (
          <div key={pattern.name} className="dome-sky-tile">
            <div className={done ? "anim-sparkle" : undefined} style={done ? { animationDelay: `${i * 80}ms` } : undefined}>
              <Constellation pattern={pattern} filled={pattern.filled} size={170} golden={golden} />
            </div>
            {!pictures && (
              <div className="dome-sky-label">
                {pattern.name}
                <br />
                {done ? "✓" : `${pattern.filled} / ${pattern.stars.length}`}
              </div>
            )}
          </div>
        );
      })}
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
