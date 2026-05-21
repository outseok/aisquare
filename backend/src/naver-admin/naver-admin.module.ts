import { Module } from '@nestjs/common';
import { NaverAdminService } from './naver-admin.service';
import { NaverAdminController } from './naver-admin.controller';
import { FabricModule } from '../fabric/fabric.module';

@Module({
  imports: [FabricModule],
  controllers: [NaverAdminController],
  providers: [NaverAdminService],
})
export class NaverAdminModule {}
