-- Migration: Update Amount Columns Precision and Add Indexes
-- Description: 
--   1. Update all amount columns to use precision 15, scale 3 (supports KWD with 3 decimal places)
--   2. Add indexes for better query performance
-- Date: 2025-11-22

-- ============================================
-- 1. Update Payment Entity Amount Column
-- ============================================
ALTER TABLE `payments` 
  MODIFY COLUMN `amount` DECIMAL(15, 3) NOT NULL;

-- ============================================
-- 2. Update Donation Entity Amount Column
-- ============================================
ALTER TABLE `donations` 
  MODIFY COLUMN `amount` DECIMAL(15, 3) NOT NULL;

-- ============================================
-- 3. Update Project Entity Amount Columns
-- ============================================
ALTER TABLE `projects` 
  MODIFY COLUMN `targetAmount` DECIMAL(15, 3) NOT NULL,
  MODIFY COLUMN `currentAmount` DECIMAL(15, 3) NOT NULL DEFAULT 0,
  MODIFY COLUMN `donationGoal` DECIMAL(15, 3) NULL;

-- ============================================
-- 4. Update Campaign Entity Amount Columns
-- ============================================
ALTER TABLE `campaigns` 
  MODIFY COLUMN `targetAmount` DECIMAL(15, 3) NOT NULL,
  MODIFY COLUMN `currentAmount` DECIMAL(15, 3) NOT NULL DEFAULT 0,
  MODIFY COLUMN `donationGoal` DECIMAL(15, 3) NULL;

-- ============================================
-- 5. Add Indexes for Better Query Performance
-- ============================================

-- Payment table indexes
CREATE INDEX IF NOT EXISTS `idx_payments_status` ON `payments` (`status`);
CREATE INDEX IF NOT EXISTS `idx_payments_paymentMethod` ON `payments` (`paymentMethod`);
CREATE INDEX IF NOT EXISTS `idx_payments_currency` ON `payments` (`currency`);
CREATE INDEX IF NOT EXISTS `idx_payments_createdAt` ON `payments` (`createdAt`);

-- Donation table indexes
CREATE INDEX IF NOT EXISTS `idx_donations_paymentId` ON `donations` (`paymentId`);
CREATE INDEX IF NOT EXISTS `idx_donations_projectId` ON `donations` (`projectId`);
CREATE INDEX IF NOT EXISTS `idx_donations_campaignId` ON `donations` (`campaignId`);
CREATE INDEX IF NOT EXISTS `idx_donations_donorId` ON `donations` (`donorId`);
CREATE INDEX IF NOT EXISTS `idx_donations_status` ON `donations` (`status`);
CREATE INDEX IF NOT EXISTS `idx_donations_createdAt` ON `donations` (`createdAt`);

-- ============================================
-- Migration Complete
-- ============================================

