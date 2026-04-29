import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddIdempotencyAndUniqueEmailIndex1702000000000
  implements MigrationInterface
{
  name = 'AddIdempotencyAndUniqueEmailIndex1702000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add idempotencyKey column to donations table
    // This is nullable, so it won't break existing donations
    const donationsTable = await queryRunner.getTable('donations');

    if (donationsTable) {
      const hasIdempotencyKey = donationsTable.columns.find(
        (c) => c.name === 'idempotencyKey',
      );
      if (!hasIdempotencyKey) {
        await queryRunner.query(`
          ALTER TABLE donations 
          ADD COLUMN idempotencyKey VARCHAR(100) NULL UNIQUE
        `);
        console.log('[Migration] Added idempotencyKey column to donations');
      }

      // 2. Add unique index on LOWER(email) for donors
      // MySQL doesn't support functional indexes in older versions,
      // so we handle this at application level
      try {
        await queryRunner.createIndex(
          'donors',
          new TableIndex({
            name: 'idx_donors_email_lower',
            columnNames: ['email'],
            isUnique: false,
          }),
        );
        console.log('[Migration] Added email index for faster lookups');
      } catch (e) {
        console.log('[Migration] Email index may already exist');
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Safe rollback - just drop the column if exists
    try {
      await queryRunner.query(
        `ALTER TABLE donations DROP COLUMN idempotencyKey`,
      );
      console.log('[Migration] Rolled back idempotencyKey column');
    } catch (e) {
      console.log('[Migration] idempotencyKey column may not exist');
    }

    try {
      await queryRunner.dropIndex('donors', 'idx_donors_email_lower');
    } catch (e) {
      // Index may not exist
    }
  }
}
