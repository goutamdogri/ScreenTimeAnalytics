import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LLM_PROVIDER_IDS, LlmProviderType } from '@screen-time/llm-client';

/**
 * Per-user LLM provider settings (design doc §3.3). The API key is sent once
 * over HTTPS and stored encrypted; `GET /llm/config` never returns it.
 */
export class SaveLlmConfigDto {
  @ApiProperty({ enum: LLM_PROVIDER_IDS, example: 'openai' })
  @IsIn(LLM_PROVIDER_IDS)
  provider!: LlmProviderType;

  @ApiProperty({ example: 'gpt-4o-mini', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model!: string;

  @ApiPropertyOptional({
    description: 'Provider API key. Omitted on update to keep the existing stored key.',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey?: string;
}

export class LocalProviderAvailabilityDto {
  @ApiProperty({ example: true })
  available!: boolean;

  @ApiProperty({
    type: [String],
    example: ['llama3.1:8b'],
    description: 'Models pulled on the local Ollama instance',
  })
  models!: string[];
}

export class CloudProviderItemDto {
  @ApiProperty({ enum: LLM_PROVIDER_IDS })
  id!: LlmProviderType;

  @ApiProperty({ example: 'OpenAI' })
  label!: string;

  @ApiProperty({ description: 'Whether this provider has a stored key for the current user' })
  configured!: boolean;

  @ApiProperty({ type: [String], example: ['gpt-4o-mini', 'gpt-4o'] })
  models!: string[];
}

export class CloudProvidersDto {
  @ApiProperty({ type: [CloudProviderItemDto] })
  items!: CloudProviderItemDto[];
}

export class ProviderAvailabilityResponse {
  @ApiProperty({ type: LocalProviderAvailabilityDto })
  local!: LocalProviderAvailabilityDto;

  @ApiProperty({ type: CloudProvidersDto })
  cloud!: CloudProvidersDto;
}

export class LlmConfigResponse {
  @ApiProperty({ enum: LLM_PROVIDER_IDS })
  provider!: LlmProviderType;

  @ApiProperty({ example: 'gpt-4o-mini' })
  model!: string;

  @ApiProperty({ description: 'True when an API key is stored (never returned)' })
  hasApiKey!: boolean;

  @ApiProperty()
  updatedAt!: string;
}
