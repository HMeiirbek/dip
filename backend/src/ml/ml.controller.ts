import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MlService } from './ml.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('ml')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ml')
export class MlController {
  constructor(private readonly ml: MlService) {}

  @ApiOperation({ summary: 'ML Status' })
  @Roles('admin', 'moderator')
  @Get('status')
  async status() {
    return this.ml.status();
  }

  @ApiOperation({ summary: 'ML Metrics' })
  @Roles('admin', 'moderator')
  @Get('metrics')
  async metrics() {
    return this.ml.metrics();
  }

  @ApiOperation({ summary: 'ML Model History' })
  @Roles('admin', 'moderator')
  @Get('history')
  async history() {
    return this.ml.history();
  }

  @ApiOperation({ summary: 'Reload ML Model (Admin)' })
  @Roles('admin')
  @Post('reload')
  async reload(@Body('version') version?: string) {
    return this.ml.reload(version);
  }
}
