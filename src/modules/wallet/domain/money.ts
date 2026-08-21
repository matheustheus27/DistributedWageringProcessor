import Decimal from "decimal.js";
import {
  CurrencyMismatchError,
  InvalidMoneyValueError,
} from "@core/errors/domain-error";

export interface MoneyProps {
  amount: string;   // decimal string, ex.: "25.00"
  currency: string; // ISO-4217, ex.: "BRL"
}

export class Money {
  private constructor(
    private readonly value: Decimal,
    public readonly currency: string,
  ) {
    Object.freeze(this);
  }

  public static from(props: MoneyProps): Money {
    if (!props || typeof props.amount !== "string" || typeof props.currency !== "string") {
      throw new InvalidMoneyValueError("Money props must include string amount and string currency");
    }

    const trimmedAmount = props.amount.trim();
    const trimmedCurrency = props.currency.trim().toUpperCase();

    if (!trimmedCurrency || trimmedCurrency.length !== 3) {
      throw new InvalidMoneyValueError(`Invalid ISO currency code: '${props.currency}'`);
    }

    if (!trimmedAmount) {
      throw new InvalidMoneyValueError("Amount string cannot be empty");
    }

    // Reject scientific notation (e.g. "1e2", "1E-3")
    if (/[eE]/.test(trimmedAmount)) {
      throw new InvalidMoneyValueError("Scientific notation is not allowed for Money values");
    }

    // Decimal regex checking max 2 decimal places and numeric format
    const decimalRegex = /^-?\d+(\.\d{1,2})?$/;
    if (!decimalRegex.test(trimmedAmount)) {
      throw new InvalidMoneyValueError(
        `Amount '${trimmedAmount}' is not a valid decimal string with at most 2 decimal places`,
      );
    }

    let dec: Decimal;
    try {
      dec = new Decimal(trimmedAmount);
    } catch {
      throw new InvalidMoneyValueError(`Failed to parse amount '${trimmedAmount}'`);
    }

    if (dec.isNaN() || !dec.isFinite()) {
      throw new InvalidMoneyValueError(`Amount '${trimmedAmount}' is NaN or Infinity`);
    }

    return new Money(dec, trimmedCurrency);
  }

  public static zero(currency: string): Money {
    return Money.from({ amount: "0.00", currency });
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.value.plus(other.value);
    return new Money(result, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.value.minus(other.value);
    return new Money(result, this.currency);
  }

  public negate(): Money {
    return new Money(this.value.negated(), this.currency);
  }

  public isZero(): boolean {
    return this.value.isZero();
  }

  public isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  public isNegative(): boolean {
    return this.value.isNegative();
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThan(other.value);
  }

  public equals(other: Money): boolean {
    if (!other || this.currency !== other.currency) {
      return false;
    }
    return this.value.equals(other.value);
  }

  public toJSON(): MoneyProps {
    return {
      amount: this.value.toFixed(2),
      currency: this.currency,
    };
  }

  public toString(): string {
    return `${this.value.toFixed(2)} ${this.currency}`;
  }

  public get amount(): string {
    return this.value.toFixed(2);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
