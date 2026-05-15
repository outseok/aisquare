import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { FilesModule } from '../files/files.module';
import { IpfsModule } from '../ipfs/ipfs.module';

@Module({
  imports: [FilesModule, IpfsModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
