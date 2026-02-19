import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlacklistService } from './blacklist.service';

@ApiTags('blacklist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('blacklist')
export class BlacklistController {
  constructor(private readonly blacklist: BlacklistService) {}

  @ApiOperation({ summary: 'Get Blacklist' })
  @Get()
  async list() {
    return this.blacklist.list();
  }

  @ApiOperation({ summary: 'Add Blacklist Entry' })
  @Post()
  async create(
    @Body('phoneNumber') phoneNumber: string,
    @Body('reason') reason?: string,
  ) {
    return this.blacklist.create(phoneNumber, reason);
  }

  @ApiOperation({ summary: 'Delete Blacklist Entry' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.blacklist.remove(id);
  }
}
