// SQLite doesn't support Prisma enums, so we redeclare them as TS-only
// string enums. Imports that read `from '@prisma/client'` should be
// rewritten to read from this file instead.

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export enum FileType {
  PDF = 'PDF',
  JPG = 'JPG',
  PNG = 'PNG',
  MP4 = 'MP4',
  TXT = 'TXT',
  ZIP = 'ZIP',
}

export enum ProductStatus {
  ON_SALE = 'ON_SALE',
  SOLD = 'SOLD',
  HIDDEN = 'HIDDEN',
}

export enum PayMethod {
  TOSS = 'TOSS',
  SQUARE = 'SQUARE',
}

export enum OrderStatus {
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  DELIVERED = 'DELIVERED',
  CONFIRMED = 'CONFIRMED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum PointLogType {
  CHARGE = 'CHARGE',
  SPEND = 'SPEND',
  EARN = 'EARN',
  REFUND = 'REFUND',
  BONUS = 'BONUS',
}

export enum TokenLogType {
  GAIN = 'GAIN',
  LOSS = 'LOSS',
  PENALTY = 'PENALTY',
  RESET = 'RESET',
}

export enum ChargeStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum VerificationType {
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
}

export enum VerifyStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
