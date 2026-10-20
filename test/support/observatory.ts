import type { LiveConnection } from "./live-connection.js";
import { signUpOwner } from "./sign-up.js";
import type { ApiClient } from "./test-app.js";

interface Harness {
  newClient: () => ApiClient;
  openLiveConnection: () => Promise<LiveConnection>;
}

/** A chart with an owner (signed in on their own client) and a paired observatory screen. */
export async function chartWithObservatory(harness: Harness, chartName = "Our House") {
  const owner = await signUpOwner(harness.newClient(), chartName);
  const screen = harness.newClient();
  await screen.post("/api/sign-in", { email: owner.email, password: owner.password });
  const screenToken: string = (await screen.post("/api/observatories")).body.deviceToken;
  screen.useDeviceToken(screenToken);

  /** Opens a device's live connection with the given credential and waits for the welcome. */
  async function connect(deviceToken: string): Promise<LiveConnection> {
    const connection = await harness.openLiveConnection();
    connection.send({ type: "hello", deviceToken });
    await connection.nextMessage(); // welcome
    return connection;
  }

  async function connectPart(kind: "printer" | "scanner"): Promise<LiveConnection> {
    const { code } = (await screen.post("/api/observatory/pairing-codes")).body;
    const { deviceToken } = (await harness.newClient().post("/api/parts", { code, kind })).body;
    return connect(deviceToken);
  }

  return {
    owner: owner.client,
    screen,

    /** Pairs a printer to this observatory and opens its live connection, ready to receive print jobs. */
    connectPrinter: () => connectPart("printer"),
    /** Pairs a scanner to this observatory and opens its live connection, ready to send scanned codes. */
    connectScanner: () => connectPart("scanner"),
    /** Opens the observatory screen's own live connection, on which it hears what happened at a scan. */
    connectScreen: () => connect(screenToken),

    async addChild(nickname: string, displayStyle: "pictures" | "words" = "words"): Promise<string> {
      return (await owner.client.post("/api/children", { nickname, displayStyle })).body.child.id;
    },

    /** Adds a chore (in a new chore category) assigned to the given children. */
    async addChore(name: string, stars: number, childIds: string[]) {
      const { category } = (await owner.client.post("/api/categories", { name: "Chores", kind: "chore" })).body;
      const { chore } = (
        await owner.client.post("/api/chores", { categoryId: category.id, name, stars, childIds })
      ).body;
      return { categoryId: category.id as string, choreId: chore.id as string };
    },

    /** A child prints a chore at the observatory; returns the ticket and the code the printer printed. */
    async print(
      childId: string,
      chore: { categoryId: string; choreId: string },
      printer: LiveConnection,
    ): Promise<{ ticketId: string; code: string }> {
      const printed = await screen.post(`/api/observatory/children/${childId}/tickets`, {
        categoryId: chore.categoryId,
        choiceId: chore.choreId,
      });
      const job = (await printer.nextMessage()).ticket;
      return { ticketId: printed.body.ticket.id, code: job.code };
    },
  };
}
