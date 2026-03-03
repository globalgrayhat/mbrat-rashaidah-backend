const mysql = require('mysql2/promise');
const fs = require('fs');


async function fixCollations() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'alrashai_rashaidah',
      port: 3306,
    });

    const [tables] = await connection.execute('SHOW TABLES');
    const tableKey = 'Tables_in_alrashai_rashaidah';

    console.log('Dropping misaligned join tables...');
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    
    try {
      await connection.query('DROP TABLE IF EXISTS `campaign_media_items`');
      console.log('[SUCCESS] Dropped campaign_media_items');
    } catch (e) {
      console.error('[ERROR] Failed to drop campaign_media_items:', e.message);
    }

    try {
      await connection.query('DROP TABLE IF EXISTS `project_media_items`');
      console.log('[SUCCESS] Dropped project_media_items');
    } catch (e) {
      console.error('[ERROR] Failed to drop project_media_items:', e.message);
    }
    
    await connection.query('SET FOREIGN_KEY_CHECKS=1');

    await connection.end();
    console.log('\nAll tables processed successfully!');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
}

fixCollations();
