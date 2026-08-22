import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Res,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CreateWagerTransactionDto } from "./dto/create-wager-transaction.dto";
import { ProcessWagerUseCase } from "@modules/wagering/application/process-wager.use-case";
import { GetWagerTransactionUseCase } from "@modules/wagering/application/get-wager-transaction.use-case";
import { ProviderAuthGuard } from "@shared/infrastructure/guards/provider-auth.guard";
import { IdempotencyConflictError } from "@core/errors/domain-error";

@Controller()
@UseGuards(ProviderAuthGuard)
export class WageringController {
  constructor(
    private readonly processWagerUseCase: ProcessWagerUseCase,
    private readonly getWagerTransactionUseCase: GetWagerTransactionUseCase,
  ) {}

  @Post("wagering/transactions")
  public async processTransaction(
    @Headers("idempotency-key") idempotencyKeyHeader: string,
    @Body() dto: CreateWagerTransactionDto,
    @Res() res: Response,
  ): Promise<void> {
    const idempotencyKey =
      idempotencyKeyHeader || `${dto.providerId}:${dto.externalTransactionId}`;

    const result = await this.processWagerUseCase.execute({
      providerId: dto.providerId,
      externalTransactionId: dto.externalTransactionId,
      idempotencyKey,
      playerId: dto.playerId,
      walletId: dto.walletId,
      roundId: dto.roundId,
      gameId: dto.gameId,
      kind: dto.kind,
      money: dto.money,
      referenceExternalTransactionId: dto.referenceExternalTransactionId,
    });

    if (!result.isSuccess) {
      if (result.error instanceof IdempotencyConflictError) {
        res.status(HttpStatus.CONFLICT).json({ error: result.error.message });
        return;
      }
      res.status(HttpStatus.BAD_REQUEST).json({ error: result.error.message });
      return;
    }

    res.status(HttpStatus.OK).json(result.value);
  }

  @Get("wagering/transactions/:transactionId")
  public async getById(
    @Param("transactionId") transactionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.getWagerTransactionUseCase.getById(transactionId);
    if (!result.isSuccess) {
      res.status(HttpStatus.NOT_FOUND).json({ error: result.error.message });
      return;
    }
    res.status(HttpStatus.OK).json(result.value);
  }

  @Get("providers/:providerId/wagering/transactions/:externalTransactionId")
  public async getByExternalId(
    @Param("providerId") providerId: string,
    @Param("externalTransactionId") externalTransactionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.getWagerTransactionUseCase.getByProviderAndExternalId(
      providerId,
      externalTransactionId,
    );

    if (!result.isSuccess) {
      res.status(HttpStatus.NOT_FOUND).json({ error: result.error.message });
      return;
    }

    res.status(HttpStatus.OK).json(result.value);
  }
}
