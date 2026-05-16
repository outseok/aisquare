-- wallet_charges 테이블 생성
CREATE TABLE `wallet_charges` (
  `id`           VARCHAR(191) NOT NULL,
  `userId`       VARCHAR(191) NOT NULL,
  `amountKrw`    INT NOT NULL,
  `squareAmount` INT NOT NULL,
  `status`       ENUM('PENDING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `txHash`       VARCHAR(191),
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `wallet_charges_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
