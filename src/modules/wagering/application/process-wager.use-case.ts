import { Inject, Injectable } from "@nestjs/common";
import crypto from "crypto";
import { Money, MoneyProps } from "@modules/wallet/domain/money";
import {
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from "@modules/wagering/domain/wager-transaction";
import { IWalletRepository } from "@modules/wallet/application/ports/wallet.repository.port";
import { ILedgerRepository } from "@modules/wallet/application/ports/ledger.repository.port";
import { IWagerTransactionRepository } from "./ports/wager-transaction.repository.port";
import { IInboxRepository } from "@modules/messaging/application/ports/inbox.repository.port";
import { IOutboxRepository } from "@modules/messaging/application/ports/outbox.repository.port";
import { IUnitOfWork } from "@shared/application/unit-of-work.port";
import { InboxMessage } from "@modules/messaging/domain/inbox-message";
import { OutboxMessage } from "@modules/messaging/domain/outbox-message";
import {
  WagerTransactionProcessed,
  WagerTransactionRejected,
  WagerTransactionPendingReference,
  WalletBalanceChanged,
} from "@modules/messaging/domain/integration-events";
import { FailureCode } from "@core/errors/failure-codes";
import {
  DomainError,
  IdempotencyConflictError,
  InsufficientBalanceError,
  CurrencyMismatchError,
} from "@core/errors/domain-error";
import { Result } from "@core/application/result";
import { WalletLedgerEntry } from "@modules/wallet/domain/wallet-ledger-entry";

export interface ProcessWagerCommand {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey?: string;
  playerId: string;
  walletId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: MoneyProps;
  referenceExternalTransactionId?: string;
  messageId?: string;
  consumerName?: string;
}

export interface ProcessWagerResponse {
  transactionId: string;
  status: WagerTransactionStatus;
  balance: MoneyProps;
  idempotentReplay: boolean;
  failureCode?: FailureCode;
}

@Injectable()
export class ProcessWagerUseCase {
  constructor(
    @Inject(IWalletRepository)
    private readonly walletRepo: IWalletRepository,
    @Inject(ILedgerRepository)
    private readonly ledgerRepo: ILedgerRepository,
    @Inject(IWagerTransactionRepository)
    private readonly wagerTxRepo: IWagerTransactionRepository,
    @Inject(IInboxRepository)
    private readonly inboxRepo: IInboxRepository,
    @Inject(IOutboxRepository)
    private readonly outboxRepo: IOutboxRepository,
    @Inject(IUnitOfWork)
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  public async execute(command: ProcessWagerCommand): Promise<Result<ProcessWagerResponse, DomainError>> {
    try {
      const idempotencyKey =
        command.idempotencyKey || `${command.providerId}:${command.externalTransactionId}`;

      const payloadHash = this.computeCanonicalPayloadHash(command);
      const money = Money.from(command.money);

      return await this.unitOfWork.execute(async () => {
        // 1. Inbox deduplication for SQS messages
        if (command.messageId) {
          const consumerName = command.consumerName || "wagering-consumer";
          const existingInbox = await this.inboxRepo.findByMessageId(consumerName, command.messageId);
          if (existingInbox && existingInbox.isProcessed()) {
            const existingTx = await this.wagerTxRepo.findByIdempotencyKey(idempotencyKey);
            if (existingTx) {
              const wallet = await this.walletRepo.findById(existingTx.walletId);
              return Result.ok({
                transactionId: existingTx.id,
                status: existingTx.status,
                balance: wallet ? wallet.balance.toJSON() : money.toJSON(),
                idempotentReplay: true,
                failureCode: existingTx.failureCode,
              });
            }
          }
          const inboxMsg = InboxMessage.receive({
            messageId: command.messageId,
            consumerName,
            payloadHash,
          });
          await this.inboxRepo.save(inboxMsg);
        }

        // 2. Check Idempotency Key
        const existingTx = await this.wagerTxRepo.findByIdempotencyKey(idempotencyKey);
        if (existingTx) {
          if (!existingTx.matchesPayload(payloadHash)) {
            return Result.fail(new IdempotencyConflictError());
          }
          const wallet = await this.walletRepo.findById(existingTx.walletId);
          return Result.ok({
            transactionId: existingTx.id,
            status: existingTx.status,
            balance: wallet ? wallet.balance.toJSON() : existingTx.money.toJSON(),
            idempotentReplay: true,
            failureCode: existingTx.failureCode,
          });
        }

        // 3. Lock Wallet
        const wallet = await this.walletRepo.findById(command.walletId, true);
        if (!wallet) {
          return Result.fail(new DomainError(`Wallet '${command.walletId}' not found`));
        }

        if (wallet.playerId !== command.playerId) {
          return Result.fail(new DomainError(`Wallet '${command.walletId}' does not belong to player '${command.playerId}'`));
        }

        if (wallet.currency !== money.currency) {
          return Result.fail(new CurrencyMismatchError(wallet.currency, money.currency));
        }

        // 4. Create Pending WagerTransaction
        const wagerTx = WagerTransaction.create({
          providerId: command.providerId,
          externalTransactionId: command.externalTransactionId,
          idempotencyKey,
          payloadHash,
          walletId: command.walletId,
          playerId: command.playerId,
          roundId: command.roundId,
          gameId: command.gameId,
          kind: command.kind,
          money,
          referenceExternalTransactionId: command.referenceExternalTransactionId,
        });

        const correlationId = crypto.randomUUID();
        let ledgerEntry: WalletLedgerEntry | undefined = undefined;

        // 5. Execute Business Rules by Kind
        switch (command.kind) {
          case WagerTransactionKind.Bet: {
            if (wallet.balance.isLessThan(money)) {
              wagerTx.reject(FailureCode.INSUFFICIENT_FUNDS);
              await this.wagerTxRepo.save(wagerTx);
              const rejectEvent = WagerTransactionRejected.from(
                wagerTx,
                FailureCode.INSUFFICIENT_FUNDS,
                correlationId,
              );
              await this.outboxRepo.save(OutboxMessage.enqueue(rejectEvent));

              return Result.ok({
                transactionId: wagerTx.id,
                status: wagerTx.status,
                balance: wallet.balance.toJSON(),
                idempotentReplay: false,
                failureCode: FailureCode.INSUFFICIENT_FUNDS,
              });
            }

            ledgerEntry = wallet.debit(money, wagerTx.id);
            wagerTx.markProcessed(undefined);
            break;
          }

          case WagerTransactionKind.Win: {
            ledgerEntry = wallet.credit(money, wagerTx.id);
            wagerTx.markProcessed(undefined);
            break;
          }

          case WagerTransactionKind.Loss: {
            wagerTx.markProcessed(undefined);
            break;
          }

          case WagerTransactionKind.Refund:
          case WagerTransactionKind.Rollback: {
            const refExtId = command.referenceExternalTransactionId!;
            const referenceTx = await this.wagerTxRepo.findByProviderAndExternalId(
              command.providerId,
              refExtId,
            );

            if (!referenceTx || referenceTx.status !== WagerTransactionStatus.Processed) {
              // Reference not yet processed -> PENDING_REFERENCE
              wagerTx.markPendingReference();
              await this.wagerTxRepo.save(wagerTx);
              const pendingEvent = WagerTransactionPendingReference.from(wagerTx, correlationId);
              await this.outboxRepo.save(OutboxMessage.enqueue(pendingEvent));

              return Result.ok({
                transactionId: wagerTx.id,
                status: wagerTx.status,
                balance: wallet.balance.toJSON(),
                idempotentReplay: false,
              });
            }

            // Validate reference belongs to same domain boundaries
            if (
              referenceTx.providerId !== command.providerId ||
              referenceTx.playerId !== command.playerId ||
              referenceTx.walletId !== command.walletId ||
              referenceTx.roundId !== command.roundId
            ) {
              wagerTx.reject(FailureCode.REFERENCE_MISMATCH);
              await this.wagerTxRepo.save(wagerTx);
              const rejectEvent = WagerTransactionRejected.from(
                wagerTx,
                FailureCode.REFERENCE_MISMATCH,
                correlationId,
              );
              await this.outboxRepo.save(OutboxMessage.enqueue(rejectEvent));

              return Result.ok({
                transactionId: wagerTx.id,
                status: wagerTx.status,
                balance: wallet.balance.toJSON(),
                idempotentReplay: false,
                failureCode: FailureCode.REFERENCE_MISMATCH,
              });
            }

            // Validate reference kind restrictions
            if (command.kind === WagerTransactionKind.Refund) {
              if (referenceTx.kind !== WagerTransactionKind.Bet) {
                wagerTx.reject(FailureCode.INVALID_REFERENCE_KIND);
                await this.wagerTxRepo.save(wagerTx);
                return Result.ok({
                  transactionId: wagerTx.id,
                  status: wagerTx.status,
                  balance: wallet.balance.toJSON(),
                  idempotentReplay: false,
                  failureCode: FailureCode.INVALID_REFERENCE_KIND,
                });
              }
            } else if (command.kind === WagerTransactionKind.Rollback) {
              if (
                referenceTx.kind !== WagerTransactionKind.Bet &&
                referenceTx.kind !== WagerTransactionKind.Win &&
                referenceTx.kind !== WagerTransactionKind.Refund
              ) {
                wagerTx.reject(FailureCode.INVALID_REFERENCE_KIND);
                await this.wagerTxRepo.save(wagerTx);
                return Result.ok({
                  transactionId: wagerTx.id,
                  status: wagerTx.status,
                  balance: wallet.balance.toJSON(),
                  idempotentReplay: false,
                  failureCode: FailureCode.INVALID_REFERENCE_KIND,
                });
              }
            }

            // Validate reference value equality
            if (!referenceTx.money.equals(money)) {
              wagerTx.reject(FailureCode.REFERENCE_MISMATCH);
              await this.wagerTxRepo.save(wagerTx);
              return Result.ok({
                transactionId: wagerTx.id,
                status: wagerTx.status,
                balance: wallet.balance.toJSON(),
                idempotentReplay: false,
                failureCode: FailureCode.REFERENCE_MISMATCH,
              });
            }

            // Execute Reversal
            if (command.kind === WagerTransactionKind.Refund || referenceTx.kind === WagerTransactionKind.Bet) {
              ledgerEntry = wallet.credit(referenceTx.money, wagerTx.id);
            } else {
              // Reverting WIN or REFUND -> Debit
              if (wallet.balance.isLessThan(referenceTx.money)) {
                wagerTx.reject(FailureCode.NEGATIVE_BALANCE_REVERSAL);
                await this.wagerTxRepo.save(wagerTx);
                const rejectEvent = WagerTransactionRejected.from(
                  wagerTx,
                  FailureCode.NEGATIVE_BALANCE_REVERSAL,
                  correlationId,
                );
                await this.outboxRepo.save(OutboxMessage.enqueue(rejectEvent));

                return Result.ok({
                  transactionId: wagerTx.id,
                  status: wagerTx.status,
                  balance: wallet.balance.toJSON(),
                  idempotentReplay: false,
                  failureCode: FailureCode.NEGATIVE_BALANCE_REVERSAL,
                });
              }
              ledgerEntry = wallet.debit(referenceTx.money, wagerTx.id);
            }

            wagerTx.markProcessed(referenceTx.id);
            break;
          }
        }

        // 6. Save State and Outbox Events
        await this.wagerTxRepo.save(wagerTx);
        if (ledgerEntry) {
          await this.walletRepo.save(wallet);
          await this.ledgerRepo.save(ledgerEntry);

          const balanceChangedEvent = WalletBalanceChanged.from(
            wallet,
            ledgerEntry,
            correlationId,
            wagerTx.id,
          );
          await this.outboxRepo.save(OutboxMessage.enqueue(balanceChangedEvent));
        }

        const processedEvent = WagerTransactionProcessed.from(wagerTx, correlationId);
        await this.outboxRepo.save(OutboxMessage.enqueue(processedEvent));

        return Result.ok({
          transactionId: wagerTx.id,
          status: wagerTx.status,
          balance: wallet.balance.toJSON(),
          idempotentReplay: false,
        });
      });
    } catch (err: any) {
      if (err instanceof DomainError) {
        return Result.fail(err);
      }
      return Result.fail(new DomainError(err.message || "Failed to process wager transaction"));
    }
  }

  private computeCanonicalPayloadHash(cmd: ProcessWagerCommand): string {
    const canonicalObj = {
      externalTransactionId: cmd.externalTransactionId,
      gameId: cmd.gameId,
      kind: cmd.kind,
      money: {
        amount: cmd.money.amount,
        currency: cmd.money.currency,
      },
      playerId: cmd.playerId,
      providerId: cmd.providerId,
      referenceExternalTransactionId: cmd.referenceExternalTransactionId || null,
      roundId: cmd.roundId,
      walletId: cmd.walletId,
    };

    const jsonString = JSON.stringify(canonicalObj);
    return crypto.createHash("sha256").update(jsonString).digest("hex");
  }
}
