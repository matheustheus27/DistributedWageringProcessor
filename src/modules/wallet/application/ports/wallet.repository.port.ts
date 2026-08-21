import { Wallet } from "@modules/wallet/domain/wallet";

export interface IWalletRepository {
  findById(id: string, lock?: boolean): Promise<Wallet | null>;
  findByPlayerAndCurrency(playerId: string, currency: string, lock?: boolean): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
}

export const IWalletRepository = Symbol("IWalletRepository");
