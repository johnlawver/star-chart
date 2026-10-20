// Opened from the QR code on an unlocked observatory: claims the one-time code, then opens the Control Center.
const status = document.getElementById("status")!;
const code = new URLSearchParams(location.hash.slice(1)).get("code");
history.replaceState(null, "", location.pathname); // don't leave the code in the address bar or history

if (!code) {
  status.textContent = "This link is missing its code. Show a new QR code on the observatory.";
} else {
  const response = await fetch("/api/phone-setup/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (response.ok) location.replace("/");
  else status.textContent = (await response.json()).error ?? "That didn't work. Show a new QR code on the observatory.";
}
