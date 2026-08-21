import { describe, expect, test } from "bun:test";
import { Money } from "../../src/modules/wallet/domain/money";
import {
  CurrencyMismatchError,
  InvalidMoneyValueError,
} from "../../src/core/errors/domain-error";

describe("Money Value Object", () => {
  test("should create valid Money with 2 decimal places", () => {
    const money = Money.from({ amount: "25.50", currency: "BRL" });
    expect(money.amount).toBe("25.50");
    expect(money.currency).toBe("BRL");
  });

  test("should normalize 1 decimal place to 2 decimal places", () => {
    const money = Money.from({ amount: "25.5", currency: "BRL" });
    expect(money.amount).toBe("25.50");
  });

  test("should reject amount with more than 2 decimal places", () => {
    expect(() => Money.from({ amount: "25.505", currency: "BRL" })).toThrow(
      InvalidMoneyValueError,
    );
  });

  test("should reject scientific notation", () => {
    expect(() => Money.from({ amount: "1e2", currency: "BRL" })).toThrow(
      InvalidMoneyValueError,
    );
  });

  test("should reject NaN and Infinity", () => {
    expect(() => Money.from({ amount: "NaN", currency: "BRL" })).toThrow(
      InvalidMoneyValueError,
    );
    expect(() => Money.from({ amount: "Infinity", currency: "BRL" })).toThrow(
      InvalidMoneyValueError,
    );
  });

  test("should perform addition and subtraction correctly", () => {
    const m1 = Money.from({ amount: "100.00", currency: "BRL" });
    const m2 = Money.from({ amount: "25.50", currency: "BRL" });

    const sum = m1.add(m2);
    expect(sum.amount).toBe("125.50");

    const diff = m1.subtract(m2);
    expect(diff.amount).toBe("74.50");
  });

  test("should throw CurrencyMismatchError when operating across different currencies", () => {
    const brl = Money.from({ amount: "100.00", currency: "BRL" });
    const usd = Money.from({ amount: "50.00", currency: "USD" });

    expect(() => brl.add(usd)).toThrow(CurrencyMismatchError);
    expect(() => brl.subtract(usd)).toThrow(CurrencyMismatchError);
    expect(() => brl.isLessThan(usd)).toThrow(CurrencyMismatchError);
  });
});
