-- AlterTable: users에 nickname 추가
ALTER TABLE `users` ADD COLUMN `nickname` VARCHAR(191) NOT NULL DEFAULT '';

-- 기존 데이터가 있는 경우를 위해 기본값으로 채운 뒤 unique 제약 추가
-- (신규 서비스이므로 데이터 없음)
ALTER TABLE `users` ADD UNIQUE INDEX `users_nickname_key`(`nickname`);
