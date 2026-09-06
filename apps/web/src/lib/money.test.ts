import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it("renders cents as US dollars", () => {
    expect(formatCents(4999)).toBe("$49.99");
    expect(formatCents(1200)).toBe("$12.00");
    expect(formatCents(0)).toBe("$0.00");
  });

  it("renders a discount as a negative amount", () => {
    expect(formatCents(-500)).toBe("-$5.00");
  });
});
