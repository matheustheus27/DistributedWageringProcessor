import { Inject, Injectable } from "@nestjs/common";
import { ILedgerRepository } from "./ports/ledger.repository.port";
import { Result } from "@core/application/result";
import { DomainError } from "@core/errors/domain-error";
import { MoneyProps } from "@modules/wallet/domain/money";

export interface LedgerEntryDto {
  id: string;
  walletId: string;
  transactionId: string;
  direction: string;
  money: MoneyProps;
  balanceBefore: MoneyProps;
  balanceAfter: MoneyProps;
  createdAt: Date;
}

export interface GetLedgerResponse {
  entries: LedgerEntryDto[];
  nextCursor?: string;
}

@Injectable()
export class GetLedgerUseCase {
  constructor(
    @Inject(ILedgerRepository)
    private readonly ledgerRepo: ILedgerRepository,
  ) {}

  public async execute(
    walletId: string,
    limit: number = 50,
    cursor?: string,
  ): Promise<Result<GetLedgerResponse, DomainError>> {
    const result = await this.ledgerRepo.findByWalletId(walletId, limit, cursor);

    return Result.ok({
      entries: result.entries.map((entry) => ({
        id: entry.id,
        walletId: entry.walletId,
        transactionId: entry.transactionId,
        direction: entry.direction,
        money: entry.money.toJSON(),
        balanceBefore: entry.balanceBefore.toJSON(),
        balanceAfter: entry.balanceAfter.toJSON(),
        createdAt: entry.createdAt,
      })),
      nextCursor: result.nextCursor,
    });
  }
}
