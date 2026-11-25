import { describe, expect, test } from "vitest";
import { chartWithObservatory } from "./support/observatory.js";
import { signUpOwner } from "./support/sign-up.js";
import { startTestApp, uniqueEmail } from "./support/test-app.js";

// The server is on the public internet, so anything that can be guessed (a password, a code, a link) or that sends
// an email has a limit on how often it can be tried. Limits count per account and per internet address.

const harness = await startTestApp();
const minutes = (n: number) => n * 60_000;
const tooMany = { error: "Too many tries. Wait a few minutes, then try again." };

describe("signing in", () => {
  test("after 10 wrong passwords for one account, even the right one is refused for 15 minutes, from anywhere", async () => {
    const owner = await signUpOwner(harness.newClient());
    for (let i = 0; i < 10; i++) {
      expect((await harness.newClient().post("/api/sign-in", { email: owner.email, password: `guess ${i}` })).status).toBe(401);
    }

    const right = await harness.newClient().post("/api/sign-in", { email: owner.email, password: owner.password });
    harness.clock.advanceBy(minutes(15));
    const later = await harness.newClient().post("/api/sign-in", { email: owner.email, password: owner.password });

    expect(right).toMatchObject({ status: 429, body: tooMany });
    expect(later.status).toBe(200);
  });

  test("one address trying 30 wrong passwords across many accounts is refused, while other addresses aren't", async () => {
    const owner = await signUpOwner(harness.newClient());
    const guesser = harness.newClient();
    for (let i = 0; i < 30; i++) await guesser.post("/api/sign-in", { email: uniqueEmail("nobody"), password: "guess" });

    const fromGuesser = await guesser.post("/api/sign-in", { email: owner.email, password: owner.password });
    const fromElsewhere = await harness.newClient().post("/api/sign-in", { email: owner.email, password: owner.password });

    expect(fromGuesser.status).toBe(429);
    expect(fromElsewhere.status).toBe(200);
  });

  test("signing in correctly, however often, never counts against anyone", async () => {
    const owner = await signUpOwner(harness.newClient());
    const phone = harness.newClient();

    const results = [];
    for (let i = 0; i < 15; i++) results.push((await phone.post("/api/sign-in", { email: owner.email, password: owner.password })).status);

    expect(new Set(results)).toEqual(new Set([200]));
  });
});

describe("guessing codes and links", () => {
  test("20 wrong codes or links from one address (pairing, phone setup, invitations, password resets) stop it for 15 minutes", async () => {
    const chart = await chartWithObservatory(harness);
    const guesser = harness.newClient();
    const guesses = [
      () => guesser.post("/api/parts", { code: "WRONG234", kind: "printer" }),
      () => guesser.post("/api/phone-setup/claim", { code: "not-a-code" }),
      () => guesser.post("/api/invitations/accept", { token: "not-a-token", password: "a good long password" }),
      () => guesser.post("/api/password-reset/complete", { token: "not-a-token", password: "a good long password" }),
    ];
    for (let i = 0; i < 20; i++) expect((await guesses[i % 4]!()).status).toBe(404);
    const code = await chart.pairingCode();

    const realCodeFromGuesser = await guesser.post("/api/parts", { code, kind: "printer" });
    const fromElsewhere = await harness.newClient().post("/api/parts", { code, kind: "printer" });
    harness.clock.advanceBy(minutes(15));
    const guesserLater = await guesser.post("/api/parts", { code: await chart.pairingCode(), kind: "scanner" });

    expect(realCodeFromGuesser).toMatchObject({ status: 429, body: tooMany });
    expect(fromElsewhere.status).toBe(201);
    expect(guesserLater.status).toBe(201);
  });
});

describe("emails anyone can ask for", () => {
  test("an account gets at most 3 password-reset emails an hour; asking more looks the same but sends nothing", async () => {
    const owner = await signUpOwner(harness.newClient());

    const answers = [];
    for (let i = 0; i < 5; i++) answers.push((await harness.newClient().post("/api/password-reset", { email: owner.email })).status);
    await new Promise((resolve) => setTimeout(resolve, 10)); // emails are sent in the background

    expect(answers).toEqual([204, 204, 204, 204, 204]);
    expect(harness.mailer.sentTo(owner.email)).toHaveLength(3);
  });

  test("one address asking for 10 password resets in an hour is refused after that", async () => {
    const asker = harness.newClient();
    for (let i = 0; i < 10; i++) expect((await asker.post("/api/password-reset", { email: uniqueEmail("someone") })).status).toBe(204);

    const eleventh = await asker.post("/api/password-reset", { email: uniqueEmail("someone") });
    harness.clock.advanceBy(minutes(60));
    const anHourLater = await asker.post("/api/password-reset", { email: uniqueEmail("someone") });

    expect(eleventh.status).toBe(429);
    expect(anHourLater.status).toBe(204);
  });

  test("one address can make at most 5 new charts an hour", async () => {
    const signUps = harness.newClient();
    const tryOne = () =>
      signUps.post("/api/sign-up", { email: uniqueEmail("new"), password: "a good long password", chartName: "Ours", timeZone: "Europe/London" });

    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await tryOne()).status);

    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe("behind the host's proxy", () => {
  test("visitors are told apart by the address the proxy passes on, not the proxy's own", async () => {
    const proxied = await startTestApp({ trustProxyHops: 1 });
    const proxy = "172.18.0.2";
    const guesser = proxied.newClient().viaProxy(proxy);
    for (let i = 0; i < 20; i++) await guesser.post("/api/phone-setup/claim", { code: "nope" });

    const guesserAgain = await guesser.post("/api/phone-setup/claim", { code: "nope" });
    const someoneElse = await proxied.newClient().viaProxy(proxy).post("/api/phone-setup/claim", { code: "nope" });

    expect([guesserAgain.status, someoneElse.status]).toEqual([429, 404]);
  });

  test("without trusting a proxy, an address it claims to pass on is ignored (it could be made up)", async () => {
    const guesser = harness.newClient().viaProxy("172.18.0.3");
    for (let i = 0; i < 20; i++) await guesser.post("/api/phone-setup/claim", { code: "nope" });

    const madeUpAddress = await harness.newClient().viaProxy("172.18.0.3").post("/api/phone-setup/claim", { code: "nope" });

    expect(madeUpAddress.status).toBe(429);
  });
});

describe("refusals", () => {
  test("a refusal says when to try again", async () => {
    const guesser = harness.newClient();
    for (let i = 0; i < 20; i++) await guesser.post("/api/phone-setup/claim", { code: "nope" });
    harness.clock.advanceBy(minutes(5));

    const refused = await guesser.post("/api/phone-setup/claim", { code: "nope" });

    expect(refused.status).toBe(429);
    expect(refused.retryAfter).toBe("600");
  });
});
