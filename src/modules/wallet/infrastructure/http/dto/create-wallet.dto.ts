import { IsString, IsNotEmpty, ValidateNested, IsObject } from "class-validator";
import { Type } from "class-transformer";

export class MoneyDto {
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;
}

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  playerId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => MoneyDto)
  initialBalance!: MoneyDto;
}
