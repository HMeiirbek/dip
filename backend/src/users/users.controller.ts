import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { AddToBlacklistDto } from './dto/manage-blacklist.dto';
import { ExportAccountQueryDto } from './dto/export-account-query.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { AddContactDto } from './dto/manage-contacts.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as crypto from 'crypto';
import { extname } from 'path';
import { UploadedFile } from '@nestjs/common';
import { mkdirSync } from 'fs';
import type { Request } from 'express';

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

  @ApiOperation({ summary: 'Export My Account Data (JSON)' })
  @UseGuards(JwtAuthGuard)
  @Get('me/export')
  async exportMyAccount(
    @Req() req: { user: { sub: string } },
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: ExportAccountQueryDto,
  ) {
    return this.users.exportMyAccount(req.user.sub, query.includeMessages ?? false);
  }

  @ApiOperation({ summary: 'Delete My Account (Anonymize + Soft Delete)' })
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMe(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: DeleteAccountDto,
  ) {
    return this.users.deleteMe(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Request 6-digit code to confirm account deletion (password alternative)' })
  @UseGuards(JwtAuthGuard)
  @Post('me/delete-account-code')
  async requestDeleteAccountCode(@Req() req: { user: { sub: string } }) {
    return this.users.requestDeleteAccountCode(req.user.sub);
  }

  @ApiOperation({ summary: 'Update Current User' })
  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateProfileDto,
  ) {
    return this.users.updateMe(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Upload Avatar (jpg/png ≤ 5MB)' })
  @UseGuards(JwtAuthGuard)
  @Put('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === 'image/jpeg' || file.mimetype === 'image/png';
        cb(ok ? null : new BadRequestException('Only jpg/png allowed'), ok);
      },
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
          const dest = `${process.cwd()}/uploads/avatars`;
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const ext = extname(file.originalname).toLowerCase() || (file.mimetype === 'image/png' ? '.png' : '.jpg');
          cb(null, `${crypto.randomUUID()}${ext}`);
        },
      }),
    }),
  )
  async uploadAvatar(
    @Req() req: { user: { sub: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.users.updateAvatar(req.user.sub, avatarUrl);
  }

  @ApiOperation({ summary: 'Change Current User Password' })
  @UseGuards(JwtAuthGuard)
  @Put('me/password')
  async changePassword(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(req.user.sub, dto);
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

  @ApiOperation({ summary: 'Get Privacy Settings' })
  @UseGuards(JwtAuthGuard)
  @Get('me/privacy')
  async getMyPrivacy(@Req() req: { user: { sub: string } }) {
    return this.users.getMyPrivacy(req.user.sub);
  }

  @ApiOperation({ summary: 'Update Privacy Settings' })
  @UseGuards(JwtAuthGuard)
  @Put('me/privacy')
  async updateMyPrivacy(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdatePrivacyDto,
  ) {
    return this.users.updateMyPrivacy(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Get My User Blacklist' })
  @UseGuards(JwtAuthGuard)
  @Get('me/blacklist')
  async getMyBlacklist(@Req() req: { user: { sub: string } }) {
    return this.users.getMyBlacklist(req.user.sub);
  }

  @ApiOperation({ summary: 'Add User To Blacklist' })
  @UseGuards(JwtAuthGuard)
  @Post('me/blacklist')
  async addToMyBlacklist(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: AddToBlacklistDto,
  ) {
    return this.users.addToMyBlacklist(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Remove User From Blacklist' })
  @UseGuards(JwtAuthGuard)
  @Delete('me/blacklist/:blockedUserId')
  async removeFromMyBlacklist(
    @Req() req: { user: { sub: string } },
    @Param('blockedUserId') blockedUserId: string,
  ) {
    return this.users.removeFromMyBlacklist(req.user.sub, blockedUserId);
  }

  @ApiOperation({ summary: 'Get My Contacts' })
  @UseGuards(JwtAuthGuard)
  @Get('me/contacts')
  async getMyContacts(@Req() req: { user: { sub: string } }) {
    return this.users.getMyContacts(req.user.sub);
  }

  @ApiOperation({ summary: 'Add Contact' })
  @UseGuards(JwtAuthGuard)
  @Post('me/contacts')
  async addMyContact(
    @Req() req: { user: { sub: string } },
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: AddContactDto,
  ) {
    return this.users.addMyContact(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Remove Contact' })
  @UseGuards(JwtAuthGuard)
  @Delete('me/contacts/:contactUserId')
  async removeMyContact(
    @Req() req: { user: { sub: string } },
    @Param('contactUserId') contactUserId: string,
  ) {
    return this.users.removeMyContact(req.user.sub, contactUserId);
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
