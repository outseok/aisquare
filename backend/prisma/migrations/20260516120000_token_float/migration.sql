-- trustToken: Int → Double, 기본값 30 → 15, 최대 200 → 100
ALTER TABLE `users` MODIFY COLUMN `trustToken` DOUBLE NOT NULL DEFAULT 15;

-- token_logs: amount/balance Int → Double (소수점 지원)
ALTER TABLE `token_logs` MODIFY COLUMN `amount` DOUBLE NOT NULL;
ALTER TABLE `token_logs` MODIFY COLUMN `balance` DOUBLE NOT NULL;
