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
  screen.useDeviceToken((await screen.post("/api/observatories")).body.deviceToken);

  return {
    owner: owner.client,
    screen,

    /** Pairs a printer to this observatory and opens its live connection, ready to receive print jobs. */
    async connectPrinter(): Promise<LiveConnection> {
      const { code } = (await screen.post("/api/observatory/pairing-codes")).body;
      const { deviceToken } = (await harness.newClient().post("/api/parts", { code, kind: "printer" })).body;
      const printer = await harness.openLiveConnection();
      printer.send({ type: "hello", deviceToken });
      await printer.nextMessage(); // welcome
      return printer;
    },

    async addChild(nickname: string, displayStyle: "pictures" | "words" = "words"): Promise<string> {
      return (await owner.client.post("/api/children", { nickname, displayStyle })).body.child.id;
    },
  };
}
