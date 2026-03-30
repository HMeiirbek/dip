import { Body, Controller, Delete, Get, Header, Param, Put, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @ApiOperation({ summary: 'Get Current User' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { sub: string } }) {
    return this.users.findById(req.user.sub);
  }

  @ApiOperation({ summary: 'Update Current User' })
  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(
    @Req() req: { user: { sub: string } },
    @Body('username') username?: string,
  ) {
    return this.users.updateMe(req.user.sub, { username });
  }

  @ApiOperation({ summary: 'List Users' })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list() {
    return this.users.findAll();
  }

  @ApiOperation({ summary: 'List My Sessions' })
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Get('me/sessions')
  async getMySessions(@Req() req: { user: { sub: string } }) {
    return this.users.getSessions(req.user.sub);
  }

  @ApiOperation({ summary: 'Terminate My Session' })
  @UseGuards(JwtAuthGuard)
  @Delete('me/sessions/:id')
  async deleteMySession(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.users.terminateSession(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Get My Security Activity' })
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Get('me/security-activity')
  async getMySecurityActivity(@Req() req: { user: { sub: string } }) {
    return this.users.getSecurityActivity(req.user.sub);
  }

  @ApiOperation({ summary: 'Get User By ID' })
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @ApiOperation({ summary: 'Delete User (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async deleteById(@Param('id') id: string) {
    return this.users.deleteById(id);
  }
}
