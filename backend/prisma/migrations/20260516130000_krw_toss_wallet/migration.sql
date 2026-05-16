-- users: passId, squareWalletAddr, pointWalletAddr 추가
ALTER TABLE `users`
  ADD COLUMN `passId` VARCHAR(191),
  ADD COLUMN `squareWalletAddr` VARCHAR(191),
  ADD COLUMN `pointWalletAddr` VARCHAR(191);

-- products: priceEth (Decimal) → price (Int, KRW)
ALTER TABLE `products` ADD COLUMN `price` INT NOT NULL DEFAULT 0;
UPDATE `products` SET `price` = ROUND(CAST(`priceEth` AS DECIMAL(30,18)) * 3800000);
ALTER TABLE `products` DROP COLUMN `priceEth`;

-- orders: amountEth → paymentAmount (Int), amountRp → usedPoint, txHash 추가
ALTER TABLE `orders` ADD COLUMN `paymentAmount` INT NOT NULL DEFAULT 0;
UPDATE `orders` SET `paymentAmount` = ROUND(CAST(`amountEth` AS DECIMAL(30,18)) * 3800000);
ALTER TABLE `orders` DROP COLUMN `amountEth`;
ALTER TABLE `orders` CHANGE COLUMN `amountRp` `usedPoint` INT;
ALTER TABLE `orders` ADD COLUMN `txHash` VARCHAR(191);

-- PayMethod enum 변경: ETH/RP → TOSS/SQUARE
ALTER TABLE `orders` MODIFY COLUMN `paymentMethod` ENUM('TOSS','SQUARE','ETH','RP') NOT NULL;
UPDATE `orders` SET `paymentMethod` = 'TOSS' WHERE `paymentMethod` = 'ETH';
UPDATE `orders` SET `paymentMethod` = 'SQUARE' WHERE `paymentMethod` = 'RP';
ALTER TABLE `orders` MODIFY COLUMN `paymentMethod` ENUM('TOSS','SQUARE') NOT NULL;
