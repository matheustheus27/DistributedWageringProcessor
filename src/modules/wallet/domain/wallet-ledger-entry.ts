import { Money } from "./money";
import { DomainError } from "@core/errors/domain-error";

export enum LedgerDirection {
  Debit = "DEBIT",
  Credit = "CREDIT",
}

export interface CreateLedgerEntryProps {
  id?: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt?: Date;
}

export interface LedgerEntryState {
  id: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: { amount: string; currency: string };
  balanceBefore: { amount: string; currency: string };
  balanceAfter: { amount: string; currency: string };
  createdAt: Date;
}

export class WalletLedgerEntry {
  private constructor(
    public readonly id: string,
    public readonly walletId: string,
    public readonly transactionId: string,
    public readonly direction: LedgerDirection,
    public readonly money: Money,
    public readonly balanceBefore: Money,
    public readonly balanceAfter: Money,
    public readonly createdAt: Date,
  ) {
    Object.freeze(this);
  }

  public static create(props: CreateLedgerEntryProps): WalletLedgerEntry {
    const id = props.id || crypto.randomUUID();
    const createdAt = props.createdAt || new Date();

    const entry = new WalletLedgerEntry(
      id,
      props.walletId,
      props.transactionId,
      props.direction,
      props.money,
      props.balanceBefore,
      props.balanceAfter,
      createdAt,
    );

    if (!entry.isBalanced()) {
      throw new DomainError(
        `Ledger entry arithmetic unbalanced: balanceBefore (${props.balanceBefore.amount}) ${props.direction === LedgerDirection.Credit ? "+" : "-"} money (${props.money.amount}) !== balanceAfter (${props.balanceAfter.amount})`,
      );
    }

    return entry;
  }

  public static rehydrate(state: LedgerEntryState): WalletLedgerEntry {
    return new WalletLedgerEntry(
      state.id,
      state.walletId,
      state.transactionId,
      state.direction,
      Money.from(state.money),
      Money.from(state.balanceBefore),
      Money.from(state.balanceAfter),
      new Date(state.createdAt),
    );
  }

  /** balanceBefore ± money === balanceAfter. Verified in factory. */
  public isBalanced(): boolean {
    if (this.direction === LedgerDirection.Credit) {
      const expected = this.balanceBefore.add(this.money);
      return expected.equals(this.balanceAfter);
    } else {
      const expected = this.balanceBefore.subtract(this.money);
      return expected.equals(this.balanceAfter);
    }
  }
}
