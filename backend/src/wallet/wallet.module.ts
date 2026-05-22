import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { FabricModule } from '../fabric/fabric.module';

@Module({
  imports: [FabricModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
