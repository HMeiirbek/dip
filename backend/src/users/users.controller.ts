import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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

  @ApiOperation({ summary: 'List Users' })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list() {
    return this.users.findAll();
  }

  @ApiOperation({ summary: 'Get User By ID' })
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
