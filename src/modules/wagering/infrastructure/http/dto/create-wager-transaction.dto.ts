import { IsString, IsNotEmpty, IsEnum, IsOptional, ValidateNested, IsObject } from "class-validator";
import { Type } from "class-transformer";
import { WagerTransactionKind } from "@modules/wagering/domain/wager-transaction";
import { MoneyDto } from "@modules/wallet/infrastructure/http/dto/create-wallet.dto";

export class CreateWagerTransactionDto {
  @IsString()
  @IsNotEmpty()
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  externalTransactionId!: string;

  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsString()
  @IsNotEmpty()
  walletId!: string;

  @IsString()
  @IsNotEmpty()
  roundId!: string;

  @IsString()
  @IsNotEmpty()
  gameId!: string;

  @IsEnum(WagerTransactionKind)
  kind!: WagerTransactionKind;

  @IsObject()
  @ValidateNested()
  @Type(() => MoneyDto)
  money!: MoneyDto;

  @IsString()
  @IsOptional()
  referenceExternalTransactionId?: string;
}
