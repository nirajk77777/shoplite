import { describe, expect, it } from "vitest";
import { createMockGateway } from "./mock-gateway";

const gateway = createMockGateway();
const charge = { amountCents: 4499, currency: "USD" as const, expMonth: 12, expYear: 2030 };

describe("mock payment gateway", () => {
  it("approves an ordinary test card and returns a reference", async () => {
    const result = await gateway.charge({ ...charge, cardNumber: "4242424242424242" });

    expect(result.status).toBe("approved");
    expect(result.status === "approved" && result.reference).toMatch(/^ch_/);
  });

  it("declines any card ending in 0002 and says why", async () => {
    const result = await gateway.charge({ ...charge, cardNumber: "4000000000000002" });

    expect(result).toEqual({
      status: "declined",
      declineCode: "insufficient_funds",
      message: "Card declined by issuer: insufficient funds",
    });
  });

  it("ignores spaces in the card number when deciding", async () => {
    const result = await gateway.charge({ ...charge, cardNumber: "4000 0000 0000 0002" });

    expect(result.status).toBe("declined");
  });

  it("declines a card number that is not 13 to 19 digits", async () => {
    const result = await gateway.charge({ ...charge, cardNumber: "1234" });

    expect(result).toMatchObject({ status: "declined", declineCode: "invalid_number" });
  });
});
