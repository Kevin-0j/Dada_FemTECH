import { describe, expect, it } from "vitest";
import { EPDS_ITEMS } from "../../src/domain/epds.ts";
import { USSD_KEY, basicAuthHeader, form, playUssd, testApp } from "../support/fixtures.ts";

const distressed = EPDS_ITEMS.map((item, index) =>
  String(item.options.findIndex((o) => o.score === (index === 9 ? 0 : 3)) + 1),
);

describe("POST /ussd (Africa's Talking)", () => {
  it("runs a full screening and puts the referral in the staff queue", async () => {
    const { app, cases } = testApp();
    const screens = await playUssd(app, ["1", "1", ...distressed, "2", "1", "1", "1", "1"]);

    expect(screens[0]).toMatch(/^CON Karibu Dada\./);
    expect(screens.slice(0, -1).every((s) => s.startsWith("CON "))).toBe(true);
    expect(screens.at(-1)).toMatch(/^END Asante\. Counsellor atakupigia leo/);

    expect(cases.listScreenings()).toHaveLength(1);
    const [referral] = cases.listReferrals();
    expect(referral).toMatchObject({ channel: "ussd", tier: "high", ward: "Kangemi" });
    // The phone number is stored encrypted, never in plain text.
    expect(referral?.phoneCiphertext).not.toContain("712345678");

    const staff = await app.request("/staff", { headers: { authorization: basicAuthHeader() } });
    const page = await staff.text();
    expect(staff.status).toBe(200);
    expect(page).toContain("+254712345678");
    expect(page).toContain("tier-high");
  });

  it("ends with a neutral goodbye on 0", async () => {
    const { app } = testApp();
    const screens = await playUssd(app, ["2", "0"]);
    expect(screens.at(-1)).toBe("END Asante. Kwaheri.");
  });

  it("refuses requests without the callback key", async () => {
    const { app } = testApp();
    const response = await app.request("/ussd?key=wrong", {
      method: "POST",
      ...form({ sessionId: "s", serviceCode: "*1#", phoneNumber: "+254712345678", text: "" }),
    });
    expect(response.status).toBe(403);
  });

  it("rejects malformed requests", async () => {
    const { app } = testApp();
    const response = await app.request(`/ussd?key=${USSD_KEY}`, {
      method: "POST",
      ...form({ serviceCode: "*1#" }),
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toMatch(/^END /);
  });

  it("forgets a conversation after the session timeout", async () => {
    const { app, clock } = testApp({ SESSION_TTL_MINUTES: "5" });
    await playUssd(app, ["1"], "timeout-session");
    clock.advanceMinutes(6);
    const screens = await playUssd(app, [], "timeout-session");
    expect(screens[0]).toMatch(/^CON Karibu Dada\./);
  });
});
