import type { ApiClient } from "./test-app.js";
import { uniqueEmail } from "./test-app.js";

/** Signs a client up as the owner of a brand-new chart, ready to make further requests. */
export async function signUpAsOwner(client: ApiClient, chartName = "Our House"): Promise<ApiClient> {
  return (await signUpOwner(client, chartName)).client;
}

/** Like signUpAsOwner, but also returns the owner's email and password, for signing in elsewhere. */
export async function signUpOwner(client: ApiClient, chartName = "Our House", timeZone = "America/Chicago") {
  const email = uniqueEmail("owner");
  const password = "correct horse battery staple";
  const response = await client.post("/api/sign-up", { email, password, chartName, timeZone });
  if (response.status !== 201) throw new Error(`sign-up failed with ${response.status}`);
  return { client, email, password };
}
