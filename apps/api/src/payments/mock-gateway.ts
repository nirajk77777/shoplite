import { randomUUID } from "node:crypto";

export type ChargeRequest = {
  amountCents: number;
  currency: "USD";
  cardNumber: string;
  expMonth: number;
  expYear: number;
};

export type DeclineCode = "insufficient_funds" | "invalid_number";

export type ChargeResult =
  | { status: "approved"; reference: string }
  | { status: "declined"; declineCode: DeclineCode; message: string };

export type PaymentGateway = {
  charge(request: ChargeRequest): Promise<ChargeResult>;
};

/** The last four digits, for storing on the payment row instead of the card number. */
export function cardLast4(cardNumber: string): string {
  return withoutSpaces(cardNumber).slice(-4);
}

function withoutSpaces(cardNumber: string): string {
  return cardNumber.replace(/\s+/g, "");
}

/**
 * Stands in for a real card processor. Behaviour is decided by the card number
 * alone, the way processors' test modes work: a number ending in 0002 is
 * declined for insufficient funds, anything else well-formed is approved.
 */
export function createMockGateway(): PaymentGateway {
  return {
    async charge(request) {
      const digits = withoutSpaces(request.cardNumber);
      if (!/^\d{13,19}$/.test(digits)) {
        return {
          status: "declined",
          declineCode: "invalid_number",
          message: "Card number is not valid",
        };
      }
      if (digits.endsWith("0002")) {
        return {
          status: "declined",
          declineCode: "insufficient_funds",
          message: "Card declined by issuer: insufficient funds",
        };
      }
      return { status: "approved", reference: `ch_${randomUUID().replace(/-/g, "").slice(0, 24)}` };
    },
  };
}
