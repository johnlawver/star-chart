// The two QR codes that set up a unit (.scratch/printer-unit/spec.md, "Formats"). The unit prints a Setup Guide, a
// link to the setup page. The phone shows a Handshake, holding the Wi-Fi details, the server and a pairing code. The
// setup page and the fake unit both use this file; the firmware must match it.

export interface Handshake {
  network: string;
  /** Empty for an open network. */
  password: string;
  /** The server the unit should use, such as https://star-chart.johnlawver.com */
  server: string;
  /** A one-time pairing code for the chosen observatory. */
  code: string;
}

export type ReadHandshake = ({ ok: true } & Handshake) | { ok: false; problem: "not-a-handshake" | "unknown-version" };

const version = "SC1";
const special = /[\\;,:"]/g;

/** A value with `\`, `;`, `,`, `:` and `"` escaped by a backslash, as in the standard Wi-Fi QR format. */
function escape(value: string): string {
  return value.replace(special, (character) => `\\${character}`);
}

/** The text for the Handshake QR. */
export function makeHandshake({ network, password, server, code }: Handshake): string {
  return `${version};S:${escape(network)};P:${escape(password)};H:${escape(server)};C:${escape(code)};;`;
}

/** Reads a Handshake QR's text, or says why it isn't one the unit can use. */
export function readHandshake(text: string): ReadHandshake {
  const versionMatch = /^SC(\d+);/.exec(text);
  if (!versionMatch) return { ok: false, problem: "not-a-handshake" };
  if (`SC${versionMatch[1]}` !== version) return { ok: false, problem: "unknown-version" };

  // Split into fields at each ";" that isn't escaped, undoing the escapes.
  const fields: string[] = [];
  let field = "";
  for (let i = versionMatch[0].length; i < text.length; i++) {
    const character = text[i]!;
    if (character === "\\" && i + 1 < text.length) field += text[++i];
    else if (character === ";") {
      fields.push(field);
      field = "";
    } else field += character;
  }
  if (field !== "") fields.push(field);

  const values = new Map<string, string>();
  for (const pair of fields) {
    const colon = pair.indexOf(":");
    if (colon > 0) values.set(pair.slice(0, colon), pair.slice(colon + 1));
  }
  // Fields were unescaped above, so the ":" after the name is the first one; the value may hold more.
  const network = values.get("S");
  const password = values.get("P");
  const server = values.get("H");
  const code = values.get("C");
  if (!network || password === undefined || !server || !code) return { ok: false, problem: "not-a-handshake" };
  return { ok: true, network, password, server, code };
}

/** At most this many network names go in a Setup Guide, and its link stays shorter than this, to keep the QR easy to scan. */
const mostNetworks = 8;
const longestLink = 299;

/** The link in the Setup Guide QR: the setup page, with the unit's name and the networks it found (strongest first). */
export function setupGuideLink(server: string, unit: string, networks: string[]): string {
  const base = `${server.replace(/\/$/, "")}/setup-unit.html#u=${encodeURIComponent(unit)}`;
  let link = base;
  for (const network of networks.slice(0, mostNetworks)) {
    const longer = `${link}&n=${encodeURIComponent(network)}`;
    if (longer.length > longestLink) break;
    link = longer;
  }
  return link;
}

/** What the setup page reads from the part of its link after `#`, which never reaches the server. */
export function readSetupGuide(hash: string): { unit: string | undefined; networks: string[] } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return { unit: params.get("u") ?? undefined, networks: params.getAll("n") };
}
