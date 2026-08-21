import { WagerTransaction } from "@modules/wagering/domain/wager-transaction";

export interface IWagerTransactionRepository {
  findById(id: string): Promise<WagerTransaction | null>;
  findByProviderAndExternalId(providerId: string, externalTransactionId: string): Promise<WagerTransaction | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null>;
  findPendingReferences(limit: number): Promise<WagerTransaction[]>;
  save(transaction: WagerTransaction): Promise<void>;
}

export const IWagerTransactionRepository = Symbol("IWagerTransactionRepository");
