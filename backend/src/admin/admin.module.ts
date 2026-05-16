import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { FabricModule } from '../fabric/fabric.module';

@Module({
  imports: [FabricModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
