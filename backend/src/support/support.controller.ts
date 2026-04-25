import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @ApiOperation({ summary: 'Send Feedback To Support' })
  @Post('feedback')
  async feedback(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateSupportRequestDto,
  ) {
    return this.support.createRequest(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Get Info Page (faq/terms/privacy)' })
  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const page = this.support.getInfoPage(slug);
    if (!page) throw new NotFoundException('page not found');
    return page;
  }

  @ApiOperation({ summary: 'List support requests (admin)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('admin/requests')
  async listAdminRequests() {
    return this.support.listAllForAdmin();
  }

  @ApiOperation({ summary: 'Update support request status (admin)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch('admin/requests/:id')
  async updateAdminRequest(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateSupportStatusDto,
  ) {
    return this.support.updateRequestStatus(id, dto.status);
  }
}

