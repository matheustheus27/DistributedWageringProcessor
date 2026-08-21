import { Money, MoneyProps } from "./money";
import { WalletLedgerEntry, LedgerDirection } from "./wallet-ledger-entry";
import { InsufficientBalanceError, CurrencyMismatchError, DomainError } from "@core/errors/domain-error";

export interface OpenWalletProps {
  id?: string;
  playerId: string;
  initialBalance: Money;
}

export interface WalletState {
  id: string;
  playerId: string;
  currency: string;
  balance: MoneyProps;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    public readonly currency: string,
    private _balance: Money,
    private _version: number,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  public static open(props: OpenWalletProps): Wallet {
    if (!props.playerId || props.playerId.trim() === "") {
      throw new DomainError("PlayerId is required to open a wallet");
    }

    if (props.initialBalance.isNegative()) {
      throw new DomainError("Initial balance cannot be negative");
    }

    const id = props.id || crypto.randomUUID();
    const now = new Date();

    return new Wallet(
      id,
      props.playerId,
      props.initialBalance.currency,
      props.initialBalance,
      1,
      now,
      now,
    );
  }

  /** Reconstrução a partir da persistência — não revalida transições. */
  public static rehydrate(state: WalletState): Wallet {
    return new Wallet(
      state.id,
      state.playerId,
      state.currency,
      Money.from(state.balance),
      state.version,
      new Date(state.createdAt),
      new Date(state.updatedAt),
    );
  }

  public get balance(): Money {
    return this._balance;
  }

  public get version(): number {
    return this._version;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public credit(amount: Money, transactionId: string): WalletLedgerEntry {
    this.assertSameCurrency(amount);

    if (amount.isNegative() || amount.isZero()) {
      throw new DomainError("Credit amount must be positive");
    }

    const balanceBefore = this._balance;
    const balanceAfter = balanceBefore.add(amount);

    this._balance = balanceAfter;
    this._version += 1;
    this._updatedAt = new Date();

    return WalletLedgerEntry.create({
      walletId: this.id,
      transactionId,
      direction: LedgerDirection.Credit,
      money: amount,
      balanceBefore,
      balanceAfter,
    });
  }

  public debit(amount: Money, transactionId: string): WalletLedgerEntry {
    this.assertSameCurrency(amount);

    if (amount.isNegative() || amount.isZero()) {
      throw new DomainError("Debit amount must be positive");
    }

    if (this._balance.isLessThan(amount)) {
      throw new InsufficientBalanceError();
    }

    const balanceBefore = this._balance;
    const balanceAfter = balanceBefore.subtract(amount);

    if (balanceAfter.isNegative()) {
      throw new InsufficientBalanceError();
    }

    this._balance = balanceAfter;
    this._version += 1;
    this._updatedAt = new Date();

    return WalletLedgerEntry.create({
      walletId: this.id,
      transactionId,
      direction: LedgerDirection.Debit,
      money: amount,
      balanceBefore,
      balanceAfter,
    });
  }

  private assertSameCurrency(money: Money): void {
    if (this.currency !== money.currency) {
      throw new CurrencyMismatchError(this.currency, money.currency);
    }
  }
}
