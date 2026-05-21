import { Module } from '@nestjs/common';
import { NaverExchangeController, NaverExchangeAdminController } from './naver-exchange.controller';
import { NaverExchangeService } from './naver-exchange.service';
import { FabricModule } from '../fabric/fabric.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [FabricModule, PrismaModule],
  controllers: [NaverExchangeController, NaverExchangeAdminController],
  providers: [NaverExchangeService],
  exports: [NaverExchangeService],
})
export class NaverExchangeModule {}
