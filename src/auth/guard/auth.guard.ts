import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException("No token provided, please login")
        }

        const secret = this.config.get('ACCESS_TOKEN_SECRET')

        try {
            const payload = this.jwtService.verify(token!, { secret })

            request['user'] = payload;
        }

        catch (error) {

            switch (error.name) {

                case "TokenExpiredError":
                    throw new UnauthorizedException("Token expired, please login again");

                case "JsonWebTokenError":
                    throw new UnauthorizedException("Invalid token, please login again");

                case "NotBeforeError":
                    throw new UnauthorizedException("Token not active yet, please login again");
                    
                default:
                    throw error;
            }
        }

        return true
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}