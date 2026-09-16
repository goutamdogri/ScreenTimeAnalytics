import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import {
  DashboardRangeDto,
  DashboardSessionsDto,
  DashboardSummaryDto,
} from './dto/dashboard-query.dto';
import {
  DashboardCategoriesResponse,
  DashboardSessionsResponse,
  DashboardSummaryResponse,
  DashboardTrendsResponse,
} from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: "Today's screen time summary: totals, intentionality split, category breakdown",
  })
  @ApiResponse({ status: 200, type: DashboardSummaryResponse })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardSummaryDto,
  ): Promise<any> {
    return this.dashboardService.getSummary(
      user.userId,
      query.date ?? todayStr(),
      query.tz ?? 'UTC',
    );
  }

  @Get('trends')
  @ApiOperation({ summary: 'Per-day category minutes for trend charts' })
  @ApiResponse({ status: 200, type: DashboardTrendsResponse })
  async getTrends(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardRangeDto,
  ): Promise<any> {
    return this.dashboardService.getTrends(user.userId, query.range ?? 'week', query.tz ?? 'UTC');
  }

  @Get('categories')
  @ApiOperation({ summary: 'Per-category totals with top apps' })
  @ApiResponse({ status: 200, type: DashboardCategoriesResponse })
  async getCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardRangeDto,
  ): Promise<any> {
    return this.dashboardService.getCategories(
      user.userId,
      query.range ?? 'week',
      query.tz ?? 'UTC',
    );
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Derived focus sessions (time-gapped from raw events)' })
  @ApiResponse({ status: 200, type: DashboardSessionsResponse })
  async getSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardSessionsDto,
  ): Promise<any> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sessions = await this.dashboardService.getSessions(
      user.userId,
      query.from ?? weekAgo.toISOString(),
      query.to ?? now.toISOString(),
    );
    return { sessions };
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
