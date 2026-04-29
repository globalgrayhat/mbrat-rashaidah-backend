import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCollationsUtf8mb41700000000000 implements MigrationInterface {
  name = 'FixCollationsUtf8mb41700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbName = queryRunner.manager.connection.driver.database;

    if (!dbName) {
      console.warn(
        '[Migration] Database name not found, skipping collation fix',
      );
      return;
    }

    console.log(`[Migration] Fixing collations for database: ${dbName}`);

    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS=0');
    } catch {
      console.log('[Migration] FK checks already disabled or already set');
    }

    try {
      await queryRunner.query(
        `ALTER DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      console.log('[Migration] Database charset updated');
    } catch (e) {
      console.log(
        `[Migration] Database charset already correct or error: ${(e as Error).message}`,
      );
    }

    const tables: any[] = await queryRunner.query('SHOW TABLES');
    const tableKey = `Tables_in_${dbName}`;

    for (const row of tables) {
      const tableName = row[tableKey] || Object.values(row)[0];
      if (!tableName) continue;

      try {
        await queryRunner.query(
          `ALTER TABLE \`${String(tableName)}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
        console.log(`[Migration] Converted table: ${tableName}`);
      } catch (e) {
        console.log(
          `[Migration] Table ${tableName} already correct: ${(e as Error).message}`,
        );
      }
    }

    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS=1');
    } catch {
      console.log('[Migration] FK checks already enabled');
    }

    console.log('[Migration] Collations fix completed');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    console.log(
      '[Migration] Rollback not supported - collation changes are permanent',
    );
  }
}
