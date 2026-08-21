import { Inject, Injectable } from "@nestjs/common";
import { Money, MoneyProps } from "@modules/wallet/domain/money";
import { Wallet } from "@modules/wallet/domain/wallet";
import { IWalletRepository } from "./ports/wallet.repository.port";
import { ILedgerRepository } from "./ports/ledger.repository.port";
import { IOutboxRepository } from "@modules/messaging/application/ports/outbox.repository.port";
import { IUnitOfWork } from "@shared/application/unit-of-work.port";
import { WagerTransaction, WagerTransactionKind } from "@modules/wagering/domain/wager-transaction";
import { IWagerTransactionRepository } from "@modules/wagering/application/ports/wager-transaction.repository.port";
import { WalletBalanceChanged } from "@modules/messaging/domain/integration-events";
import { OutboxMessage } from "@modules/messaging/domain/outbox-message";
import { Result } from "@core/application/result";
import { DomainError } from "@core/errors/domain-error";

export interface OpenWalletCommand {
  playerId: string;
  initialBalance: MoneyProps;
}

export interface OpenWalletResponse {
  id: string;
  playerId: string;
  balance: MoneyProps;
  version: number;
}

@Injectable()
export class OpenWalletUseCase {
  constructor(
    @Inject(IWalletRepository)
    private readonly walletRepo: IWalletRepository,
    @Inject(ILedgerRepository)
    private readonly ledgerRepo: ILedgerRepository,
    @Inject(IWagerTransactionRepository)
    private readonly wagerTxRepo: IWagerTransactionRepository,
    @Inject(IOutboxRepository)
    private readonly outboxRepo: IOutboxRepository,
    @Inject(IUnitOfWork)
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  public async execute(command: OpenWalletCommand): Promise<Result<OpenWalletResponse, DomainError>> {
    try {
      const initialMoney = Money.from(command.initialBalance);

      const existing = await this.walletRepo.findByPlayerAndCurrency(
        command.playerId,
        initialMoney.currency,
      );

      if (existing) {
        return Result.fail(
          new DomainError(
            `Wallet already exists for playerId '${command.playerId}' and currency '${initialMoney.currency}'`,
          ),
        );
      }

      const wallet = Wallet.open({
        playerId: command.playerId,
        initialBalance: Money.zero(initialMoney.currency),
      });

      return await this.unitOfWork.execute(async () => {
        await this.walletRepo.save(wallet);

        if (initialMoney.isPositive()) {
          const openingTx = WagerTransaction.create({
            providerId: "internal",
            externalTransactionId: `opening-${wallet.id}`,
            idempotencyKey: `internal:opening-${wallet.id}`,
            payloadHash: "internal-opening",
            walletId: wallet.id,
            playerId: wallet.playerId,
            roundId: "internal-opening",
            gameId: "internal-opening",
            kind: WagerTransactionKind.Opening,
            money: initialMoney,
          });

          const ledgerEntry = wallet.credit(initialMoney, openingTx.id);
          openingTx.markProcessed(undefined);

          await this.walletRepo.save(wallet);
          await this.wagerTxRepo.save(openingTx);
          await this.ledgerRepo.save(ledgerEntry);

          const event = WalletBalanceChanged.from(wallet, ledgerEntry, crypto.randomUUID());
          const outboxMsg = OutboxMessage.enqueue(event);
          await this.outboxRepo.save(outboxMsg);
        }

        return Result.ok<OpenWalletResponse, DomainError>({
          id: wallet.id,
          playerId: wallet.playerId,
          balance: wallet.balance.toJSON(),
          version: wallet.version,
        });
      });
    } catch (err: any) {
      if (err instanceof DomainError) {
        return Result.fail(err);
      }
      return Result.fail(new DomainError(err.message || "Failed to open wallet"));
    }
  }
}
