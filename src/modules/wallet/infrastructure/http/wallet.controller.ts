import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { CreateWalletDto } from "./dto/create-wallet.dto";
import { OpenWalletUseCase } from "@modules/wallet/application/open-wallet.use-case";
import { GetWalletUseCase } from "@modules/wallet/application/get-wallet.use-case";
import { GetLedgerUseCase } from "@modules/wallet/application/get-ledger.use-case";
import { ReconcileWalletUseCase } from "@modules/wallet/application/reconcile-wallet.use-case";
import { ProviderAuthGuard } from "@shared/infrastructure/guards/provider-auth.guard";

@Controller("wallets")
@UseGuards(ProviderAuthGuard)
export class WalletController {
  constructor(
    private readonly openWalletUseCase: OpenWalletUseCase,
    private readonly getWalletUseCase: GetWalletUseCase,
    private readonly getLedgerUseCase: GetLedgerUseCase,
    private readonly reconcileWalletUseCase: ReconcileWalletUseCase,
  ) {}

  @Post()
  public async createWallet(
    @Body() dto: CreateWalletDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.openWalletUseCase.execute({
      playerId: dto.playerId,
      initialBalance: dto.initialBalance,
    });

    if (!result.isSuccess) {
      res.status(HttpStatus.CONFLICT).json({ error: result.error.message });
      return;
    }

    res.status(HttpStatus.CREATED).json(result.value);
  }

  @Get(":walletId")
  public async getWallet(
    @Param("walletId") walletId: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.getWalletUseCase.execute(walletId);
    if (!result.isSuccess) {
      res.status(HttpStatus.NOT_FOUND).json({ error: result.error.message });
      return;
    }
    res.status(HttpStatus.OK).json(result.value);
  }

  @Get(":walletId/ledger")
  public async getLedger(
    @Param("walletId") walletId: string,
    @Query("limit") limitStr: string,
    @Query("cursor") cursor: string,
    @Res() res: Response,
  ): Promise<void> {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const result = await this.getLedgerUseCase.execute(walletId, limit, cursor);

    if (!result.isSuccess) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: result.error.message });
      return;
    }

    res.status(HttpStatus.OK).json(result.value);
  }

  @Post(":walletId/reconciliation")
  public async reconcile(
    @Param("walletId") walletId: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.reconcileWalletUseCase.execute(walletId);

    if (!result.isSuccess) {
      res.status(HttpStatus.NOT_FOUND).json({ error: result.error.message });
      return;
    }

    res.status(HttpStatus.OK).json(result.value);
  }
}
