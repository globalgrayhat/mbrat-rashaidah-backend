const mysql = require('mysql2/promise');
require('dotenv').config();

async function recover() {
  console.log('--- Starting Media Recovery Script ---');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.HOST_DATABASE,
      user: process.env.USER_DATABASE,
      password: process.env.PASSWORD_DATABASE,
      database: process.env.NAME_DATABASE,
    });

    console.log('Connected to Database. Fetching Media, Campaigns, and Projects...');

    const [media] = await connection.query('SELECT id, name, path FROM media');
    const [campaigns] = await connection.query('SELECT id, title, slug FROM campaigns');
    const [projects] = await connection.query('SELECT id, title, slug FROM projects');

    console.log(`Found ${media.length} media items, ${campaigns.length} campaigns, ${projects.length} projects.`);

    let restoredCampaigns = 0;
    let restoredProjects = 0;

    for (const m of media) {
      const fileName = m.path.toLowerCase();
      // Heuristic 1: Match with Campaign slug or title
      let matchedCampaign = campaigns.find(c => 
        fileName.includes(c.slug.toLowerCase().replace(/-/g, '')) || 
        fileName.includes(c.title.toLowerCase())
      );

      // Heuristic 2: Match with Project slug or title
      let matchedProject = !matchedCampaign && projects.find(p => 
        fileName.includes(p.slug.toLowerCase().replace(/-/g, '')) || 
        fileName.includes(p.title.toLowerCase())
      );

      if (matchedCampaign) {
        console.log(`Matching [${m.path}] --> Campaign: ${matchedCampaign.title}`);
        await connection.query(
          'INSERT IGNORE INTO campaign_media_items (campaignId, mediaId) VALUES (?, ?)',
          [matchedCampaign.id, m.id]
        );
        restoredCampaigns++;
      } else if (matchedProject) {
        console.log(`Matching [${m.path}] --> Project: ${matchedProject.title}`);
        await connection.query(
          'INSERT IGNORE INTO project_media_items (projectId, mediaId) VALUES (?, ?)',
          [matchedProject.id, m.id]
        );
        restoredProjects++;
      } else {
        console.log(`[Unmatched] Media: ${m.path}`);
      }
    }

    console.log(`\n--- Recovery Complete ---`);
    console.log(`Restored links for ${restoredCampaigns} Campaigns and ${restoredProjects} Projects.`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

recover();
