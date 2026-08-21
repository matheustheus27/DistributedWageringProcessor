import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { IWagerTransactionRepository } from "@modules/wagering/application/ports/wager-transaction.repository.port";
import { ProcessWagerUseCase } from "@modules/wagering/application/process-wager.use-case";
import { FailureCode } from "@core/errors/failure-codes";
import { WagerTransactionStatus } from "@modules/wagering/domain/wager-transaction";

@Injectable()
export class PendingReferenceWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PendingReferenceWorker.name);
  private timer?: NodeJS.Timeout;
  private isProcessing = false;
  private readonly MAX_PENDING_AGE_MS = 5 * 60 * 1000; // 5 minutes TTL

  constructor(
    @Inject(IWagerTransactionRepository)
    private readonly wagerTxRepo: IWagerTransactionRepository,
    private readonly processWagerUseCase: ProcessWagerUseCase,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.processPendingReferences(), 5000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  public async processPendingReferences(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingTxs = await this.wagerTxRepo.findPendingReferences(20);
      const now = Date.now();

      for (const tx of pendingTxs) {
        const ageMs = now - tx.createdAt.getTime();

        if (ageMs > this.MAX_PENDING_AGE_MS) {
          tx.reject(FailureCode.REFERENCE_NOT_FOUND);
          await this.wagerTxRepo.save(tx);
          this.logger.warn({
            msg: "Pending reference transaction timed out and was rejected",
            transactionId: tx.id,
            externalTransactionId: tx.externalTransactionId,
            referenceExternalTransactionId: tx.referenceExternalTransactionId,
          });
          continue;
        }

        // Retry resolution via ProcessWagerUseCase
        const result = await this.processWagerUseCase.execute({
          providerId: tx.providerId,
          externalTransactionId: tx.externalTransactionId,
          idempotencyKey: tx.idempotencyKey,
          playerId: tx.playerId,
          walletId: tx.walletId,
          roundId: tx.roundId,
          gameId: tx.gameId,
          kind: tx.kind,
          money: tx.money.toJSON(),
          referenceExternalTransactionId: tx.referenceExternalTransactionId,
        });

        if (result.isSuccess && result.value.status !== WagerTransactionStatus.PendingReference) {
          this.logger.log({
            msg: "Pending reference transaction resolved successfully",
            transactionId: tx.id,
            newStatus: result.value.status,
          });
        }
      }
    } catch (err: any) {
      this.logger.error({ msg: "Error processing pending reference transactions", error: err.message });
    } finally {
      this.isProcessing = false;
    }
  }
}
