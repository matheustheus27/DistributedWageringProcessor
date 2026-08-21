import { Inject, Injectable } from "@nestjs/common";
import { IWagerTransactionRepository } from "./ports/wager-transaction.repository.port";
import { Result } from "@core/application/result";
import { DomainError } from "@core/errors/domain-error";
import { MoneyProps } from "@modules/wallet/domain/money";

export interface WagerTransactionResponseDto {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: string;
  money: MoneyProps;
  status: string;
  referenceExternalTransactionId?: string;
  referenceTransactionId?: string;
  failureCode?: string;
  createdAt: Date;
  processedAt?: Date;
}

@Injectable()
export class GetWagerTransactionUseCase {
  constructor(
    @Inject(IWagerTransactionRepository)
    private readonly wagerRepo: IWagerTransactionRepository,
  ) {}

  public async getById(transactionId: string): Promise<Result<WagerTransactionResponseDto, DomainError>> {
    const tx = await this.wagerRepo.findById(transactionId);
    if (!tx) {
      return Result.fail(new DomainError(`Transaction '${transactionId}' not found`));
    }
    return Result.ok(this.toDto(tx));
  }

  public async getByProviderAndExternalId(
    providerId: string,
    externalTransactionId: string,
  ): Promise<Result<WagerTransactionResponseDto, DomainError>> {
    const tx = await this.wagerRepo.findByProviderAndExternalId(providerId, externalTransactionId);
    if (!tx) {
      return Result.fail(
        new DomainError(`Transaction '${externalTransactionId}' for provider '${providerId}' not found`),
      );
    }
    return Result.ok(this.toDto(tx));
  }

  private toDto(tx: any): WagerTransactionResponseDto {
    return {
      id: tx.id,
      providerId: tx.providerId,
      externalTransactionId: tx.externalTransactionId,
      idempotencyKey: tx.idempotencyKey,
      walletId: tx.walletId,
      playerId: tx.playerId,
      roundId: tx.roundId,
      gameId: tx.gameId,
      kind: tx.kind,
      money: tx.money.toJSON(),
      status: tx.status,
      referenceExternalTransactionId: tx.referenceExternalTransactionId,
      referenceTransactionId: tx.referenceTransactionId,
      failureCode: tx.failureCode,
      createdAt: tx.createdAt,
      processedAt: tx.processedAt,
    };
  }
}
