import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RiskService } from './risk.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('risk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @ApiOperation({ summary: 'Get Risk Analysis' })
  @Get('analysis')
  async analysis(@Req() req: { user: { sub: string } }) {
    return this.riskService.analysis(req.user.sub);
  }

  @ApiOperation({ summary: 'Get Risk Monitor Stream Snapshot' })
  @Get('monitor')
  async monitor() {
    return this.riskService.monitor();
  }

  @ApiOperation({ summary: 'Get Risk Stats' })
  @Roles('admin', 'moderator')
  @Get('stats')
  async stats() {
    return this.riskService.stats();
  }
}
