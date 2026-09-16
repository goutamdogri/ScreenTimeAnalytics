import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LlmConfig } from '@screen-time/db';
import { LlmProviderType } from '@screen-time/llm-client';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LlmConfigService } from './llm-config.service';
import { LlmProvidersService } from './llm-providers.service';
import { SaveLlmConfigDto, ProviderAvailabilityResponse, LlmConfigResponse } from './dto/llm.dto';

@ApiTags('llm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('llm')
export class LlmController {
  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly llmProvidersService: LlmProvidersService,
  ) {}

  @Get('providers')
  @ApiOperation({
    summary:
      'List available LLM providers (local Ollama auto-detected) with per-user configuration state',
  })
  @ApiResponse({ status: 200, type: ProviderAvailabilityResponse })
  async providers(@CurrentUser() user: AuthenticatedUser): Promise<ProviderAvailabilityResponse> {
    return this.llmProvidersService.getAvailability(user.userId);
  }

  @Get('config')
  @ApiOperation({ summary: 'Read the user’s LLM settings; the API key is never returned' })
  @ApiResponse({ status: 200, type: LlmConfigResponse })
  @ApiResponse({ status: 404, description: 'No LLM configuration yet' })
  async getConfig(@CurrentUser() user: AuthenticatedUser): Promise<LlmConfigResponse> {
    const config = await this.llmConfigService.findByUser(user.userId);
    if (!config) {
      throw new NotFoundException('No LLM configuration for this user');
    }
    return this.toResponse(config);
  }

  @Put('config')
  @ApiOperation({ summary: 'Save LLM provider settings; the API key is stored encrypted at rest' })
  @ApiResponse({ status: 200, type: LlmConfigResponse })
  async putConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveLlmConfigDto,
  ): Promise<LlmConfigResponse> {
    const saved = await this.llmConfigService.save(user.userId, dto);
    return this.toResponse(saved);
  }

  @Delete('config')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear LLM settings and revert to rule-only classification' })
  @ApiResponse({ status: 204 })
  async clearConfig(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.llmConfigService.clear(user.userId);
  }

  private toResponse(
    config: Pick<LlmConfig, 'provider' | 'model' | 'encryptedApiKey' | 'updatedAt'>,
  ): LlmConfigResponse {
    return {
      provider: config.provider as LlmProviderType,
      model: config.model,
      hasApiKey: Boolean(config.encryptedApiKey),
      updatedAt: config.updatedAt.toISOString(),
    };
  }
}
