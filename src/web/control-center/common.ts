// What every Control Center page shares: who's signed in, and where it's open.
import { api } from "../shared/api.js";

export interface Me {
  grownUp: { id: string; email: string; role: "owner" | "admin" | "grown-up" };
  chart: { name: string; timeZone: string; quizPoolTarget: number };
}

/** A guest (a babysitter) with a Guest PIN, who can only handle tickets. */
export interface GuestMe {
  guest: true;
  chart: { name: string; timeZone: string };
}

export interface Child {
  id: string;
  nickname: string;
  displayStyle: "pictures" | "words";
}

/** Opened on an observatory (after a grown-up's PIN) rather than on a phone or computer. */
export const onObservatory = new URLSearchParams(location.search).get("on") === "observatory";
export const observatoryTokenKey = "star-chart.observatory.deviceToken";

/** Signs out and goes back to the children's view of the observatory. */
export async function lockObservatory() {
  await api("POST", "/api/sign-out");
  location.href = "/observatory.html";
}

/** Admins and the owner manage the chart's devices, quizzes and grown-ups; plain grown-ups don't. */
export const manages = (me: Me) => me.grownUp.role !== "grown-up";
