import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SlackService } from '../slack/slack.service';
import { CreateReportDto } from './dto/create-report.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private slack: SlackService,
    private filesService: FilesService,
  ) {}

  async create(
    reporterId: string,
    orderId: string,
    dto: CreateReportDto,
    imageFiles: Express.Multer.File[],
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다');
    if (order.buyerId !== reporterId) throw new ForbiddenException('구매자만 신고할 수 있습니다');
    if (!['PENDING_CONFIRMATION', 'SETTLEMENT_HOLD'].includes(order.status)) {
      throw new BadRequestException('신고할 수 없는 상태의 주문입니다');
    }

    const existingReport = await this.prisma.report.findFirst({ where: { orderId } });
    if (existingReport) throw new BadRequestException('이미 신고된 주문입니다');

    const imageKeys = await Promise.all(
      imageFiles.map((f) => this.filesService.uploadFile(f)),
    );

    const [report] = await this.prisma.$transaction([
      this.prisma.report.create({
        data: { orderId, reporterId, reason: dto.reason, imageKeys },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'SETTLEMENT_HOLD' },
      }),
    ]);

    const reporter = await this.prisma.user.findUnique({ where: { id: reporterId } });
    await this.slack.sendReportAlert({
      reportId: report.id,
      orderId,
      productTitle: order.product.title,
      reporterName: reporter?.name || reporterId,
      reason: dto.reason,
    });

    return report;
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { select: { username: true, name: true } },
        order: { include: { product: true } },
      },
    });
    if (!report) throw new NotFoundException();
    return report;
  }
}
