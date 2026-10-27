import { describe, expect, it } from "vitest";
import type { PublicStats } from "../../src/application/stats-service.ts";
import { EPDS_ITEMS } from "../../src/domain/epds.ts";
import { BASE_URL, basicAuthHeader, playUssd, testApp } from "../support/fixtures.ts";

const distressed = EPDS_ITEMS.map((item, index) =>
  String(item.options.findIndex((o) => o.score === (index === 9 ? 0 : 3)) + 1),
);
const calm = EPDS_ITEMS.map((item) => String(item.options.findIndex((o) => o.score === 0) + 1));

describe("staff queue", () => {
  it("asks for a password", async () => {
    const { app } = testApp();
    expect((await app.request("/staff")).status).toBe(401);
    const wrong = await app.request("/staff", {
      headers: { authorization: basicAuthHeader("counsellor", "wrong-password-123") },
    });
    expect(wrong.status).toBe(401);
  });

  it("shows an empty state, then marks a referral as contacted", async () => {
    const { app, cases, clock } = testApp();
    const empty = await app.request("/staff", { headers: { authorization: basicAuthHeader() } });
    expect(await empty.text()).toContain("No open referrals");

    await playUssd(app, ["3", "1", ...distressed, "2", "1", "1", "1", "2"]);
    const [referral] = cases.listOpenReferrals();
    if (referral === undefined) throw new Error("expected a referral");

    clock.advanceMinutes(90);
    const response = await app.request(`/staff/referrals/${referral.id}/contacted`, {
      method: "POST",
      headers: {
        authorization: basicAuthHeader(),
        origin: "http://localhost",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    expect(response.status).toBe(303);
    expect(cases.listOpenReferrals()).toHaveLength(0);
    expect(cases.listReferrals()[0]?.contactedAt?.toISOString()).toBe("2026-11-01T09:30:00.000Z");
  });

  it("blocks cross-site form posts", async () => {
    const { app } = testApp();
    const response = await app.request(
      "/staff/referrals/00000000-0000-4000-8000-000000000000/contacted",
      {
        method: "POST",
        headers: {
          authorization: basicAuthHeader(),
          origin: "https://evil.example",
          "content-type": "application/x-www-form-urlencoded",
        },
      },
    );
    expect(response.status).toBe(403);
  });

  it("deletes contacted referrals after the retention period", async () => {
    const { app, cases, clock, referrals } = testApp({ RETENTION_DAYS: "30" });
    await playUssd(app, ["3", "1", ...distressed, "2", "1", "1", "1", "2"]);
    const [referral] = cases.listOpenReferrals();
    if (referral === undefined) throw new Error("expected a referral");
    referrals.markContacted(referral.id);

    clock.advanceMinutes(29 * 24 * 60);
    expect(referrals.purgeExpired()).toBe(0);
    clock.advanceMinutes(2 * 24 * 60);
    expect(referrals.purgeExpired()).toBe(1);
    expect(cases.listReferrals()).toHaveLength(0);
  });
});

describe("public stats", () => {
  it("publishes anonymised totals as JSON and as an accessible page", async () => {
    const { app } = testApp({ STATS_SUPPRESSION: "1" });
    await playUssd(app, ["3", "1", ...calm, "2", "1", "2"], "a");
    await playUssd(app, ["3", "1", ...distressed, "2", "1", "1", "1", "1"], "b");

    const json = (await (await app.request("/stats.json")).json()) as PublicStats;
    expect(json).toMatchObject({
      screenings: { total: 2, byTier: { low: 1, high: 1 }, byChannel: { ussd: 2 } },
      referrals: { total: 1, open: 1, byWard: { Kangemi: 1 } },
    });

    const page = await (await app.request("/stats")).text();
    expect(page).toContain('<html lang="en">');
    expect(page).toContain('href="#main"');
    expect(page).toContain("Screenings completed");
  });

  it("hides small counts so nobody can be identified", async () => {
    const { app } = testApp({ STATS_SUPPRESSION: "5" });
    await playUssd(app, ["3", "1", ...distressed, "2", "1", "1", "1", "1"]);
    const json = (await (await app.request("/stats.json")).json()) as PublicStats;
    expect(json.screenings.byTier.high).toBeNull();
    expect(json.referrals.byWard.Kangemi).toBeNull();
    expect(json.referrals.medianHoursToContact).toBeNull();
  });

  it("reports the median time to contact", async () => {
    const { app, cases, clock, referrals } = testApp({ STATS_SUPPRESSION: "1" });
    await playUssd(app, ["3", "1", ...distressed, "2", "1", "1", "1", "1"], "x");
    await playUssd(app, ["3", "1", ...distressed, "2", "1", "1", "1", "1"], "y");
    clock.advanceMinutes(60);
    const [first, second] = cases.listOpenReferrals();
    if (first === undefined || second === undefined) throw new Error("expected referrals");
    referrals.markContacted(first.id);
    clock.advanceMinutes(120);
    referrals.markContacted(second.id);
    const json = (await (await app.request("/stats.json")).json()) as PublicStats;
    expect(json.referrals.medianHoursToContact).toBe(2);
  });

  it("labels every page as demo data in demo mode", async () => {
    const live = testApp();
    expect(await (await live.app.request("/stats")).text()).not.toContain("Demo data.");
    const { app } = testApp({ DEMO_MODE: "true" });
    expect(await (await app.request("/stats")).text()).toContain("Demo data.");
    const staff = await app.request("/staff", { headers: { authorization: basicAuthHeader() } });
    expect(await staff.text()).toContain("Demo data.");
  });

  it("serves a health check and redirects the home page", async () => {
    const { app } = testApp();
    expect(await (await app.request("/health")).json()).toEqual({ status: "ok" });
    const home = await app.request("/");
    expect(home.headers.get("location")).toBe("/stats");
    expect(BASE_URL).toMatch(/^https:/);
  });
});
