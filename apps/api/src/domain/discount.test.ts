import { describe, expect, it } from "vitest";
import { applyDiscount, type DiscountCode } from "./discount";

const sale10: DiscountCode = {
  code: "SALE10",
  kind: "percent",
  value: 10,
  minSubtotalCents: 0,
  active: true,
};

const flat5: DiscountCode = {
  code: "FLAT5",
  kind: "fixed",
  value: 500,
  minSubtotalCents: 2000,
  active: true,
};

describe("applyDiscount", () => {
  it("returns the amount unchanged when there is no discount", () => {
    expect(applyDiscount(4999, null)).toBe(4999);
  });

  it("takes a percentage off, rounded to the nearest cent", () => {
    expect(applyDiscount(4999, sale10)).toBe(4499);
  });

  it("takes a fixed amount off when the minimum spend is met", () => {
    expect(applyDiscount(2500, flat5)).toBe(2000);
  });

  it("leaves the amount alone below the minimum spend", () => {
    expect(applyDiscount(1999, flat5)).toBe(1999);
  });

  it("never goes below zero", () => {
    expect(applyDiscount(2000, { ...flat5, value: 5000 })).toBe(0);
  });

  it("ignores an inactive code", () => {
    expect(applyDiscount(4999, { ...sale10, active: false })).toBe(4999);
  });
});
