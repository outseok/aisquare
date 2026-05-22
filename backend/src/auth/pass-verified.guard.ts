import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PassVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Dev escape hatch: SKIP_PASS_VERIFICATION=1 lets unverified users
    // exercise the payment flow during local testing.
    if (process.env.SKIP_PASS_VERIFICATION === '1') return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.phoneVerified) {
      throw new ForbiddenException('핸드폰 인증이 필요합니다');
    }
    return true;
  }
}
