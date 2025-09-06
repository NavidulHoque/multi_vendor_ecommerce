import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon from "argon2";
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { ForgetPasswordDto, RefreshAccessTokenDto, RegistrationDto, VerifyOtpDto, ResetPasswordDto, LogoutDto, LoginDto } from './dto';
import { EmailService } from 'src/email/email.service';
import { SmsService } from 'src/sms/sms.service';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Injectable()
export class AuthService {

  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRES: string;
  private readonly REFRESH_TOKEN_EXPIRES: string;
  private readonly ACCESS_TOKEN_SECRET: string;
  private readonly REFRESH_TOKEN_SECRET: string;
  private readonly OTP_Expires: number;

  private readonly sessionSelect = {
    id: true,
    deviceName: true,
    user: {
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      }
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly sms: SmsService
  ) {
    this.ACCESS_TOKEN_EXPIRES = this.config.get<string>('ACCESS_TOKEN_EXPIRES')!;
    this.REFRESH_TOKEN_EXPIRES = this.config.get<string>('REFRESH_TOKEN_EXPIRES')!;
    this.ACCESS_TOKEN_SECRET = this.config.get<string>('ACCESS_TOKEN_SECRET')!;
    this.REFRESH_TOKEN_SECRET = this.config.get<string>('REFRESH_TOKEN_SECRET')!;
    this.OTP_Expires = Number(this.config.get<string>('OTP_EXPIRES'))
  }

  async register(dto: RegistrationDto) {
    const { password } = dto

    try {
      const hashedPassword = await argon.hash(password);
      dto.password = hashedPassword;
      await this.prisma.user.create({ data: dto });
      return { message: 'User created successfully' }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target?.[0];
        if (target === 'email') {
          throw new ConflictException("Email already exists");
        }
      }
      throw error;
    }
  }

  async login(dto: LoginDto & { role: string }, res: Response) {
    const { email, password: plainPassword, deviceName, role } = dto;

    const user = await this.fetchUserByEmail(email, "Specific Email is not registered yet, please register first");

    if (user.role !== role) {
      throw new UnauthorizedException(`${role} login only`);
    }

    const { password: hashedPassword, id: userId } = user as any;
    const isMatched = await argon.verify(hashedPassword, plainPassword);

    if (!isMatched) {
      throw new UnauthorizedException("Password invalid");
    }

    const { id: sessionId } = await this.prisma.session.create({
      data: {
        userId,
        deviceName: deviceName || null,
        refreshToken: "abc",
        expiresAt: new Date()
      },
      select: { id: true }
    });

    const payload = { id: userId, role, email };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({ ...payload, sessionId });

    const hashedRefreshToken = await argon.hash(refreshToken);
    const refreshTokenExpires = this.generateParsedExpiry(this.REFRESH_TOKEN_EXPIRES);

    const [_, session] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastActiveAt: new Date() }
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: {
          refreshToken: hashedRefreshToken,
          expiresAt: new Date(Date.now() + refreshTokenExpires * 24 * 60 * 60 * 1000)
        },
        select: this.sessionSelect
      })
    ]);

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: refreshTokenExpires * 24 * 60 * 60 * 1000
    });

    return {
      message: 'Logged in successfully',
      session,
      accessToken
    };
  }

  async refreshAccessToken(dto: RefreshAccessTokenDto, req: any, res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found, please login again");
    }

    let payload: { sessionId: string, id: string, role: string, email: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: this.REFRESH_TOKEN_SECRET });
    } catch (error) {
      const decoded: any = this.jwtService.decode(refreshToken);
      const sessionId = decoded?.sessionId;
      if (sessionId) await this.deleteSession(sessionId);

      throw new UnauthorizedException("Invalid or expired refresh token, please login again");
    }

    const { sessionId } = payload;
    const session = await this.findSessionById(sessionId, {
      refreshToken: true,
      expiresAt: true,
      user: { select: { id: true, role: true, email: true } }
    });

    const isMatched = await argon.verify(session.refreshToken, refreshToken);
    if (!isMatched || new Date() > session.expiresAt) {
      await this.deleteSession(sessionId);
      throw new UnauthorizedException("Session expired or token invalid, please login again");
    }

    const accessToken = this.generateAccessToken(session.user);
    const newRefreshToken = this.generateRefreshToken({
      id: session.user.id,
      role: session.user.role,
      email: session.user.email,
      sessionId
    });

    const hashedNewRefreshToken = await argon.hash(newRefreshToken);

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshToken: hashedNewRefreshToken,
        expiresAt: new Date(Date.now() + Number(this.generateParsedExpiry(this.REFRESH_TOKEN_EXPIRES)) * 24 * 60 * 60 * 1000)
      },
      select: this.sessionSelect
    });

    // Update cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: Number(this.generateParsedExpiry(this.REFRESH_TOKEN_EXPIRES)) * 24 * 60 * 60 * 1000
    });

    return {
      message: 'Token refreshed successfully',
      accessToken,
      session: updatedSession
    };
  }

  async logout(dto: LogoutDto, res: Response) {
    const { sessionId } = dto;
    const session = await this.findSessionById(sessionId, { user: { select: { id: true } } });

    await this.prisma.$transaction([
      this.prisma.session.delete({ where: { id: sessionId } }),
      this.prisma.user.update({
        where: { id: session.user.id },
        data: { isOnline: false, lastActiveAt: new Date() }
      })
    ]);

    // Clear cookie
    res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'strict' });

    return { message: 'Logged out successfully' };
  }

  private async findSessionById(sessionId: string, select: any): Promise<any> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, select });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async deleteSession(sessionId: string) {
    await this.prisma.session.delete({ where: { id: sessionId } });
  }

  private generateParsedExpiry(expiresIn: string) {
    return Number(expiresIn.replace(/\D/g, ''))
  }

  private generateAccessToken(payload: { id: string, role: string, email: string }) {
    return this.jwtService.sign(payload, { secret: this.ACCESS_TOKEN_SECRET, expiresIn: this.ACCESS_TOKEN_EXPIRES });
  }

  private generateRefreshToken(payload: { id: string, role: string, email: string, sessionId: string }) {
    return this.jwtService.sign(payload, { secret: this.REFRESH_TOKEN_SECRET, expiresIn: this.REFRESH_TOKEN_EXPIRES });
  }

  private async fetchUserByEmail(email: string, errorMessage: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        password: true,
        otp: true,
        otpExpires: true,
        isOtpVerified: true
      }
    });

    if (!user) throw new BadRequestException(errorMessage);
    return user;
  }
}
