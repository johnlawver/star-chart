// In-page dialogs, instead of the browser's confirm() and prompt(), which the picture frame's kiosk silently ignores.
// Render <Dialogs /> once on a page, then `await confirmFirst(...)` or `await askForText(...)` anywhere on it.
import { useEffect, useRef, useState, type FormEvent } from "react";

interface Confirm {
  kind: "confirm";
  message: string;
  action: string;
  danger: boolean;
  resolve: (confirmed: boolean) => void;
}

interface AskForText {
  kind: "text";
  message: string;
  action: string;
  defaultValue: string;
  optional: boolean;
  resolve: (text: string | null) => void;
}

type Request = Confirm | AskForText;

let showRequest: ((request: Request) => void) | undefined;

function open(request: Request) {
  if (!showRequest) throw new Error("render <Dialogs /> on the page before asking anything");
  showRequest(request);
}

/**
 * Asks "are you sure?" before something that can't be undone. Resolves true if the grown-up chose `action` (the
 * button's words, such as "Remove Nova"), false if they cancelled.
 */
export function confirmFirst(message: string, { action, danger = true }: { action: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => open({ kind: "confirm", message, action, danger, resolve }));
}

/** Asks for a line of text. Resolves with what was typed (trimmed), or null if they cancelled. */
export function askForText(
  message: string,
  { action, defaultValue = "", optional = false }: { action: string; defaultValue?: string; optional?: boolean },
): Promise<string | null> {
  return new Promise((resolve) => open({ kind: "text", message, action, defaultValue, optional, resolve }));
}

const css = `
.dialog-backdrop { position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 1000; background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center; padding: 16px; }
.dialog { background: #fff; color: #1d1d29; border-radius: 16px; padding: 20px; width: 100%; max-width: 440px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.35); font-size: 18px; }
.dialog p { margin: 0 0 16px; line-height: 1.4; }
.dialog input { width: 100%; box-sizing: border-box; font: inherit; padding: 10px 12px; border: 2px solid #9a98b0; border-radius: 10px; margin-bottom: 16px; }
.dialog-buttons { display: flex; justify-content: flex-end; flex-wrap: wrap; }
.dialog-buttons button { font: inherit; min-height: 48px; padding: 0 18px; margin: 4px 0 0 8px; border-radius: 10px; border: 2px solid #6b6880; background: #fff; color: #1d1d29; }
.dialog-buttons .dialog-go { background: #4b3fb5; border-color: #4b3fb5; color: #fff; }
.dialog-buttons .dialog-danger { background: #c62f3b; border-color: #c62f3b; color: #fff; }
`;

/** Where the dialogs appear. Render it once per page. */
export function Dialogs() {
  const [request, setRequest] = useState<Request | undefined>();
  const [text, setText] = useState("");
  const firstControl = useRef<HTMLInputElement & HTMLButtonElement>(null);

  useEffect(() => {
    showRequest = (next) => {
      // Only one question at a time: a new one cancels any still open.
      setRequest((current) => {
        if (current) finish(current, false);
        return next;
      });
      setText(next.kind === "text" ? next.defaultValue : "");
    };
    return () => {
      showRequest = undefined;
    };
  }, []);

  useEffect(() => {
    firstControl.current?.focus();
    if (request?.kind === "text") firstControl.current?.select();
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!request) return null;

  function finish(answered: Request, confirmed: boolean) {
    if (answered.kind === "confirm") answered.resolve(confirmed);
    else answered.resolve(confirmed ? text.trim() : null);
  }

  function close(confirmed: boolean) {
    if (request) finish(request, confirmed);
    setRequest(undefined);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (request.kind === "text" && !request.optional && !text.trim()) return;
    close(true);
  };

  return (
    <div className="dialog-backdrop" onClick={(event) => event.target === event.currentTarget && close(false)}>
      <style>{css}</style>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-message" onSubmit={submit}>
        <p id="dialog-message">{request.message}</p>
        {request.kind === "text" && (
          <input
            ref={firstControl}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-labelledby="dialog-message"
            required={!request.optional}
            maxLength={200}
          />
        )}
        <div className="dialog-buttons">
          <button type="button" onClick={() => close(false)} ref={request.kind === "confirm" ? firstControl : undefined}>
            Cancel
          </button>
          <button type="submit" className={request.kind === "confirm" && request.danger ? "dialog-danger" : "dialog-go"}>
            {request.action}
          </button>
        </div>
      </form>
    </div>
  );
}
