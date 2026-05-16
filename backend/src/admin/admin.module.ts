import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [TokenModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
