import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PassVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.passVerified) {
      throw new ForbiddenException('PASS 본인인증이 필요합니다');
    }
    return true;
  }
}
