import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class NaverAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.isNaverAdmin) {
      throw new ForbiddenException('네이버페이 관리자 권한이 필요합니다');
    }
    return true;
  }
}
