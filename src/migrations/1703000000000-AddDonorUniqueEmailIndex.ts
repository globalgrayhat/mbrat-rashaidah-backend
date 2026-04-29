import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddDonorUniqueEmailIndex1703000000000
  implements MigrationInterface
{
  name = 'AddDonorUniqueEmailIndex1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Clean up any existing duplicates BEFORE adding unique constraint
    // This is critical - MySQL requires no duplicates for UNIQUE index

    // Find duplicate emails (non-null)
    const duplicates: any[] = await queryRunner.query(`
      SELECT LOWER(email) as email, COUNT(*) as cnt, MIN(id) as first_id
      FROM donors 
      WHERE email IS NOT NULL AND email != ''
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `);

    if (duplicates.length > 0) {
      console.log(
        `[Migration] Found ${duplicates.length} duplicate emails to clean up`,
      );

      for (const dup of duplicates) {
        const email = dup.email;
        const firstId = dup.first_id;

        // Keep the first record, update others to append UUID
        await queryRunner.query(
          `
          UPDATE donors 
          SET email = CONCAT(email, '-dup-', UUID())
          WHERE LOWER(email) = LOWER(?) AND id != ?
        `,
          [email, firstId],
        );
      }
    }

    // Step 2: Normalize all emails to lowercase
    await queryRunner.query(`
      UPDATE donors 
      SET email = LOWER(email) 
      WHERE email IS NOT NULL AND email != ''
    `);
    console.log('[Migration] Normalized all emails to lowercase');

    // Step 3: Add unique index (non-concurrent because we cleaned up first)
    await queryRunner.createIndex(
      'donors',
      new TableIndex({
        name: 'idx_donors_email_unique',
        columnNames: ['email'],
        isUnique: true,
      }),
    );
    console.log('[Migration] Added UNIQUE index on donors.email');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      await queryRunner.dropIndex('donors', 'idx_donors_email_unique');
      console.log('[Migration] Dropped UNIQUE index');
    } catch (e) {
      console.log('[Migration] Index may not exist');
    }
  }
}
