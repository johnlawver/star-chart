// The pages that emailed links open: accepting an invitation, and choosing a new password.
// The link's token is after "#", so it never reaches a server's logs; it's removed from the address bar straight away.
const endpoints: Record<string, string> = {
  "accept-invitation": "/api/invitations/accept",
  "reset-password": "/api/password-reset/complete",
};
const endpoint = endpoints[document.body.dataset.page ?? ""]!;
const token = new URLSearchParams(location.hash.slice(1)).get("token");
history.replaceState(null, "", location.pathname);
const form = document.getElementById("form") as HTMLFormElement;
const status = document.getElementById("status")!;

if (!token) {
  form.hidden = true;
  status.textContent = "This link is missing its code. Ask for a new one.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = new FormData(form).get("password");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (response.ok) location.replace("/");
  else status.textContent = (await response.json().catch(() => ({}))).error ?? "That didn't work. Ask for a new link.";
});
