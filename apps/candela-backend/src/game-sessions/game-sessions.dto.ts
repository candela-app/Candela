import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGameSessionDto {
  @IsString()
  @MaxLength(80)
  clientEventId: string;

  @IsString()
  @MaxLength(64)
  gameId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  levelId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  deviceTier?: string | null;

  @IsString()
  recordedAt: string;

  @IsInt()
  @Min(0)
  durationSec: number;

  @IsInt()
  @Min(0)
  correct: number;

  @IsInt()
  @Min(0)
  wrongTaps: number;

  @IsInt()
  @Min(0)
  misses: number;

  @IsInt()
  @Min(0)
  timeouts: number;

  @IsNumber()
  accuracy: number;

  @IsNumber()
  avgReactionSec: number;

  @IsNumber()
  medianReactionSec: number;

  @IsNumber()
  efficiencyIndex: number;

  @IsArray()
  @ArrayMaxSize(5000)
  @IsNumber({}, { each: true })
  reactionMs: number[];

  @IsInt()
  @Min(0)
  stimuliCount: number;

  @IsString()
  @MaxLength(160)
  gameName: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  bgColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  stimulusColor?: string;

  @IsOptional()
  @IsInt()
  contrastPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  metricsVersion?: number;
}

export class GameSessionQueryDto {
  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsString()
  levelId?: string;

  @IsOptional()
  @IsString()
  deviceTier?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  agg?: 'pooled' | 'best';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxDates?: number;
}
