import type { ApiClient } from "./test-app.js";
import { uniqueEmail } from "./test-app.js";

/** Signs a client up as the owner of a brand-new chart, ready to make further requests. */
export async function signUpAsOwner(client: ApiClient, chartName = "Our House"): Promise<ApiClient> {
  const response = await client.post("/api/sign-up", {
    email: uniqueEmail("owner"),
    password: "correct horse battery staple",
    chartName,
    timeZone: "America/Chicago",
  });
  if (response.status !== 201) throw new Error(`sign-up failed with ${response.status}`);
  return client;
}
