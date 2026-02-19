import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
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
  @Roles('admin', 'moderator')
  @Get('dashboard')
  async dashboard() {
    return this.admin.dashboard();
  }

  @ApiOperation({ summary: 'Admin Users' })
  @Roles('admin', 'moderator')
  @Get('users')
  async users() {
    return this.admin.users();
  }

  @ApiOperation({ summary: 'Update User Role' })
  @Roles('admin')
  @Put('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.admin.updateUserRole(id, role);
  }

  @ApiOperation({ summary: 'Delete User' })
  @Roles('admin')
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.admin.deleteUser(id);
  }

  @ApiOperation({ summary: 'Admin Calls' })
  @Roles('admin', 'moderator')
  @Get('calls')
  async calls() {
    return this.admin.calls();
  }

  @ApiOperation({ summary: 'Admin Reports' })
  @Roles('admin', 'moderator')
  @Get('reports')
  async reports() {
    return this.admin.reports();
  }

  @ApiOperation({ summary: 'Admin Analytics' })
  @Roles('admin', 'moderator')
  @Get('analytics')
  async analytics() {
    return this.admin.analytics();
  }

  @ApiOperation({ summary: 'Admin System Logs' })
  @Roles('admin')
  @Get('system-logs')
  async systemLogs() {
    return this.admin.systemLogs();
  }

  @ApiOperation({ summary: 'Admin Blacklist' })
  @Roles('admin', 'moderator')
  @Get('blacklist')
  async blacklist() {
    return this.admin.blacklist();
  }
}
