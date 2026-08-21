import { Inject, Injectable, Logger } from "@nestjs/common";
import { IWalletRepository } from "./ports/wallet.repository.port";
import { ILedgerRepository } from "./ports/ledger.repository.port";
import { Result } from "@core/application/result";
import { DomainError } from "@core/errors/domain-error";
import { MoneyProps } from "@modules/wallet/domain/money";

export interface ReconcileWalletResponse {
  walletId: string;
  storedBalance: MoneyProps;
  calculatedBalance: MoneyProps;
  difference: MoneyProps;
  consistent: boolean;
  checkedEntries: number;
}

@Injectable()
export class ReconcileWalletUseCase {
  private readonly logger = new Logger(ReconcileWalletUseCase.name);

  constructor(
    @Inject(IWalletRepository)
    private readonly walletRepo: IWalletRepository,
    @Inject(ILedgerRepository)
    private readonly ledgerRepo: ILedgerRepository,
  ) {}

  public async execute(walletId: string): Promise<Result<ReconcileWalletResponse, DomainError>> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      return Result.fail(new DomainError(`Wallet '${walletId}' not found`));
    }

    const calculatedBalance = await this.ledgerRepo.calculateBalance(walletId, wallet.currency);
    const checkedEntries = await this.ledgerRepo.countEntries(walletId);

    const storedBalance = wallet.balance;
    const difference = storedBalance.subtract(calculatedBalance);
    const consistent = storedBalance.equals(calculatedBalance);

    if (!consistent) {
      this.logger.error({
        msg: "WALLET BALANCE MISMATCH DETECTED DURING RECONCILIATION",
        walletId,
        storedBalance: storedBalance.toJSON(),
        calculatedBalance: calculatedBalance.toJSON(),
        difference: difference.toJSON(),
        checkedEntries,
      });
    } else {
      this.logger.log({
        msg: "Wallet reconciliation successful",
        walletId,
        consistent: true,
        checkedEntries,
      });
    }

    return Result.ok({
      walletId,
      storedBalance: storedBalance.toJSON(),
      calculatedBalance: calculatedBalance.toJSON(),
      difference: difference.toJSON(),
      consistent,
      checkedEntries,
    });
  }
}
