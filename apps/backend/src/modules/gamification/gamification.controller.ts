import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GamificationService } from './gamification.service';
import {
  GamificationAchievementsResponse,
  GamificationLeaderboardResponse,
  GamificationQuestsResponse,
  GamificationStateResponse,
} from './dto/gamification-response.dto';

@ApiTags('gamification')
@ApiBearerAuth()
@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('state')
  @ApiOperation({ summary: 'XP/level/coins/streak plus the four RPG stats' })
  @ApiResponse({ status: 200, type: GamificationStateResponse })
  async getState(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.gamification.getState(user.userId);
  }

  @Get('quests')
  @ApiOperation({ summary: "Today's auto-generated daily quests and the weekly boss fight" })
  @ApiResponse({ status: 200, type: GamificationQuestsResponse })
  async getQuests(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.gamification.getQuests(user.userId);
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Unlocked one-time achievement badges' })
  @ApiResponse({ status: 200, type: GamificationAchievementsResponse })
  async getAchievements(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.gamification.getAchievements(user.userId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: '"Vs. your past self" weekly/monthly bests' })
  @ApiResponse({ status: 200, type: GamificationLeaderboardResponse })
  async getLeaderboard(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.gamification.getLeaderboard(user.userId);
  }
}
