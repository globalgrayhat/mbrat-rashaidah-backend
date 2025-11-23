# دليل تطبيق Migration لتحديث أعمدة المبالغ

## التغييرات المطبقة

### 1. توحيد Precision/Scale لجميع المبالغ
- تم تحديث جميع أعمدة المبالغ لاستخدام `DECIMAL(15, 3)`
- هذا يدعم KWD والعملات الأخرى التي تستخدم حتى 3 أرقام عشرية
- الكيانات المحدثة:
  - `payments.amount`
  - `donations.amount`
  - `projects.targetAmount`, `projects.currentAmount`, `projects.donationGoal`
  - `campaigns.targetAmount`, `campaigns.currentAmount`, `campaigns.donationGoal`

### 2. إضافة Indexes لتحسين الأداء
تمت إضافة indexes على الأعمدة التالية:
- **payments**: `status`, `paymentMethod`, `currency`, `createdAt`
- **donations**: `paymentId`, `projectId`, `campaignId`, `donorId`, `status`, `createdAt`

### 3. تحسين عمليات الحفظ
- استخدام bulk operations بدلاً من save متعدد
- تحسين أداء عمليات الحفظ في `DonationsService`

## كيفية تطبيق Migration

### الطريقة 1: استخدام MySQL Workbench أو phpMyAdmin
1. افتح MySQL Workbench أو phpMyAdmin
2. اختر قاعدة البيانات الخاصة بك
3. افتح ملف `src/migrations/001-update-amount-columns-precision.sql`
4. انسخ المحتوى والصقه في SQL Editor
5. نفذ الاستعلام

### الطريقة 2: استخدام سطر الأوامر
```bash
mysql -u your_username -p your_database_name < src/migrations/001-update-amount-columns-precision.sql
```

### الطريقة 3: استخدام TypeORM CLI (إذا كان مُكوّنًا)
```bash
npm run typeorm migration:run
```

## ملاحظات مهمة

⚠️ **تحذير**: قبل تطبيق Migration:
1. **احفظ نسخة احتياطية** من قاعدة البيانات
2. تأكد من عدم وجود عمليات كتابة نشطة
3. اختبر Migration على بيئة التطوير أولاً

## التحقق من التطبيق

بعد تطبيق Migration، يمكنك التحقق من التغييرات:

```sql
-- التحقق من precision/scale للأعمدة
SHOW COLUMNS FROM payments WHERE Field = 'amount';
SHOW COLUMNS FROM donations WHERE Field = 'amount';
SHOW COLUMNS FROM projects WHERE Field IN ('targetAmount', 'currentAmount', 'donationGoal');
SHOW COLUMNS FROM campaigns WHERE Field IN ('targetAmount', 'currentAmount', 'donationGoal');

-- التحقق من Indexes
SHOW INDEXES FROM payments;
SHOW INDEXES FROM donations;
```

## Rollback (إرجاع التغييرات)

إذا احتجت لإرجاع التغييرات:

```sql
-- إرجاع precision/scale
ALTER TABLE `payments` MODIFY COLUMN `amount` DECIMAL(10, 0) NOT NULL;
ALTER TABLE `donations` MODIFY COLUMN `amount` DECIMAL(10, 3) NOT NULL;
ALTER TABLE `projects` 
  MODIFY COLUMN `targetAmount` DECIMAL(10, 0) NOT NULL,
  MODIFY COLUMN `currentAmount` DECIMAL(10, 0) NOT NULL DEFAULT 1,
  MODIFY COLUMN `donationGoal` DECIMAL(10, 0) NULL;
ALTER TABLE `campaigns` 
  MODIFY COLUMN `targetAmount` DECIMAL(10, 0) NOT NULL,
  MODIFY COLUMN `currentAmount` DECIMAL(10, 0) NOT NULL DEFAULT 0,
  MODIFY COLUMN `donationGoal` DECIMAL(10, 0) NULL;

-- حذف Indexes
DROP INDEX IF EXISTS `idx_payments_status` ON `payments`;
DROP INDEX IF EXISTS `idx_payments_paymentMethod` ON `payments`;
DROP INDEX IF EXISTS `idx_payments_currency` ON `payments`;
DROP INDEX IF EXISTS `idx_payments_createdAt` ON `payments`;
DROP INDEX IF EXISTS `idx_donations_paymentId` ON `donations`;
DROP INDEX IF EXISTS `idx_donations_projectId` ON `donations`;
DROP INDEX IF EXISTS `idx_donations_campaignId` ON `donations`;
DROP INDEX IF EXISTS `idx_donations_donorId` ON `donations`;
DROP INDEX IF EXISTS `idx_donations_status` ON `donations`;
DROP INDEX IF EXISTS `idx_donations_createdAt` ON `donations`;
```

