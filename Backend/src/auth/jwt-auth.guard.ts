import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

type SessionPayload = {
  sub: string;
  email: string;
  role?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      params?: Record<string, string | undefined>;
      user?: SessionPayload;
    }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Login required.');
    }

    try {
      const payload = this.jwt.verify<SessionPayload>(authorization.slice('Bearer '.length));
      request.user = payload;

      if (request.params?.userId && request.params.userId !== payload.sub) {
        throw new ForbiddenException('You can only access your own account.');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Session is invalid or expired.');
    }
  }
}
