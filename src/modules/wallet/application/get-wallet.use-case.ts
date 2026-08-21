import { Inject, Injectable } from "@nestjs/common";
import { IWalletRepository } from "./ports/wallet.repository.port";
import { Result } from "@core/application/result";
import { DomainError } from "@core/errors/domain-error";
import { MoneyProps } from "@modules/wallet/domain/money";

export interface GetWalletResponse {
  id: string;
  playerId: string;
  currency: string;
  balance: MoneyProps;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GetWalletUseCase {
  constructor(
    @Inject(IWalletRepository)
    private readonly walletRepo: IWalletRepository,
  ) {}

  public async execute(walletId: string): Promise<Result<GetWalletResponse, DomainError>> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      return Result.fail(new DomainError(`Wallet '${walletId}' not found`));
    }

    return Result.ok({
      id: wallet.id,
      playerId: wallet.playerId,
      currency: wallet.currency,
      balance: wallet.balance.toJSON(),
      version: wallet.version,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });
  }
}
