import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @ApiOperation({ summary: 'Admin Dashboard' })
  @Roles('admin')
  @Get('dashboard')
  async dashboard() {
    return this.admin.dashboard();
  }

  @ApiOperation({ summary: 'Admin Users' })
  @Roles('admin')
  @Get('users')
  async users() {
    return this.admin.users();
  }

  @ApiOperation({ summary: 'Admin Create User' })
  @Roles('admin')
  @Post('users')
  async createUser(
    @Req() req: { user: { sub: string } },
    @Body() body: any,
  ) {
    return this.admin.createUser(body.username, body.password, body.role, req.user.sub);
  }

  @ApiOperation({ summary: 'Admin User Detail' })
  @Roles('admin')
  @Get('users/:id/detail')
  async userDetail(@Param('id') id: string) {
    return this.admin.userDetail(id);
  }

  @ApiOperation({ summary: 'Update User Role' })
  @Roles('admin')
  @Put('users/:id/role')
  async updateUserRole(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.admin.updateUserRole(id, role, req.user.sub);
  }

  @ApiOperation({ summary: 'Reset User Password (Admin)' })
  @Roles('admin')
  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.admin.resetUserPassword(id, newPassword, req.user.sub);
  }

  @ApiOperation({ summary: 'Revoke All Sessions For User (Admin)' })
  @Roles('admin')
  @Post('users/:id/revoke-sessions')
  async revokeUserSessions(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.admin.revokeUserSessions(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Revoke Specific Session For User (Admin)' })
  @Roles('admin')
  @Post('users/:id/sessions/:sessionId/revoke')
  async revokeUserSession(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.admin.revokeUserSession(id, sessionId, req.user.sub);
  }

  @ApiOperation({ summary: 'Delete User' })
  @Roles('admin')
  @Delete('users/:id')
  async deleteUser(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.admin.deleteUser(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Admin Calls' })
  @Roles('admin')
  @Get('calls')
  async calls() {
    return this.admin.calls();
  }

  @ApiOperation({ summary: 'All Sessions (Admin)' })
  @Roles('admin')
  @Get('sessions')
  async sessions(@Query('limit') limit?: string) {
    return this.admin.sessions(Number(limit || 300));
  }

  @ApiOperation({ summary: 'All Security Activity (Admin)' })
  @Roles('admin')
  @Get('security-activity')
  async securityActivity(@Query('limit') limit?: string) {
    return this.admin.securityActivity(Number(limit || 400));
  }

  @ApiOperation({ summary: 'Traffic Logs / Quality Samples (Admin)' })
  @Roles('admin')
  @Get('traffic-logs')
  async trafficLogs(@Query('limit') limit?: string) {
    return this.admin.trafficLogs(Number(limit || 400));
  }

  @ApiOperation({ summary: 'Moderator Live Overview' })
  @Roles('admin', 'moderator')
  @Get('moderation/overview')
  async moderationOverview() {
    return this.admin.moderationOverview();
  }

  @ApiOperation({ summary: 'Moderator Presence Snapshot' })
  @Roles('admin', 'moderator')
  @Get('moderation/presence')
  async moderationPresence() {
    return this.admin.moderationPresence();
  }

  @ApiOperation({ summary: 'Call Quality History (Admin/Moderator)' })
  @Roles('admin', 'moderator')
  @Get('calls/:id/quality-history')
  async callQualityHistory(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.callQualityHistory(id, Number(limit || 120));
  }

  @ApiOperation({ summary: 'List Call Flags (Admin/Moderator)' })
  @Roles('admin', 'moderator')
  @Get('calls/flags')
  async callFlags(
    @Query('status') status?: 'open' | 'resolved' | 'all',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'status' | 'actorRole',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.admin.callFlags({
      status: status || 'open',
      limit: Number(limit || 100),
      offset: Number(offset || 0),
      q: q || '',
      sortBy: sortBy || 'createdAt',
      sortDir: sortDir || 'desc',
    });
  }

  @ApiOperation({ summary: 'Resolve Call Flag (Admin/Moderator)' })
  @Roles('admin', 'moderator')
  @Post('calls/flags/:flagId/resolve')
  async resolveCallFlag(
    @Req() req: { user: { sub: string } },
    @Param('flagId') flagId: string,
  ) {
    return this.admin.resolveCallFlag(flagId, req.user.sub);
  }

  @ApiOperation({ summary: 'Resolve All Open Flags For Call (Admin/Moderator)' })
  @Roles('admin', 'moderator')
  @Post('calls/:id/flags/resolve-all')
  async resolveAllCallFlags(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.admin.resolveAllCallFlags(id, req.user.sub);
  }

  @ApiOperation({ summary: 'Force End Active Call (Admin/Moderator)' })
  @Roles('admin', 'moderator')
  @Post('calls/:id/force-end')
  async forceEndCall(
    @Req() req: { user: { sub: string; role?: string } },
    @Param('id') id: string,
  ) {
    return this.admin.forceEndCall(id, req.user.sub, req.user.role || 'moderator');
  }

  @ApiOperation({ summary: 'Flag Call For Manual Review (Admin/Moderator)' })
  @Roles('admin', 'moderator')
  @Post('calls/:id/flag')
  async flagCall(
    @Req() req: { user: { sub: string; role?: string } },
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.admin.flagCall(id, req.user.sub, req.user.role || 'moderator', reason);
  }

  @ApiOperation({ summary: 'Admin Reports' })
  @Roles('admin')
  @Get('reports')
  async reports() {
    return this.admin.reports();
  }

  @ApiOperation({ summary: 'Admin Analytics' })
  @Roles('admin')
  @Get('analytics')
  async analytics() {
    return this.admin.analytics();
  }

  @ApiOperation({ summary: 'SLA / Acceptance Summary (Admin/Moderator)' })
  @Roles('admin')
  @Get('sla-summary')
  async slaSummary() {
    return this.admin.slaSummary();
  }

  @ApiOperation({ summary: 'Admin System Logs' })
  @Roles('admin')
  @Get('system-logs')
  async systemLogs() {
    return this.admin.systemLogs();
  }

  @ApiOperation({ summary: 'Admin Blacklist' })
  @Roles('admin')
  @Get('blacklist')
  async blacklist() {
    return this.admin.blacklist();
  }
}
