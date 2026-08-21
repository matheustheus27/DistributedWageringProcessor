import { WalletLedgerEntry } from "@modules/wallet/domain/wallet-ledger-entry";
import { Money } from "@modules/wallet/domain/money";

export interface LedgerPaginationResult {
  entries: WalletLedgerEntry[];
  nextCursor?: string;
}

export interface ILedgerRepository {
  save(entry: WalletLedgerEntry): Promise<void>;
  findByWalletId(walletId: string, limit?: number, cursor?: string): Promise<LedgerPaginationResult>;
  calculateBalance(walletId: string, currency: string): Promise<Money>;
  countEntries(walletId: string): Promise<number>;
}

export const ILedgerRepository = Symbol("ILedgerRepository");
