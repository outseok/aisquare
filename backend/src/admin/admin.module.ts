import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TokenModule } from '../token/token.module';
import { FabricModule } from '../fabric/fabric.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TokenModule, FabricModule, FilesModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
