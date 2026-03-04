const mysql = require('mysql2/promise');
require('dotenv').config();

// Accurate mappings from slug to filename parts (e.g. suqia-amaa -> water_supply)
const keywordMap = {
  'aftar-saeem': ['aftarsaem', 'iftar'],
  'alaqraboon-ui': ['aqraboon', 'agraboon', 'relatives'],
  'alnhor-altabhh': ['aqiqah', 'vows', 'alaqaweqq'],
  'alsral-amtaffa': ['amutafffa', 'alsra'],
  'alzkaaa-aiai': ['zkao', 'zakat'],
  'bardalehhm': ['bardale', 'cold_winter'],
  'daeemmarda': ['daeeem', 'patient'],
  'General-donations': ['general_charity', 'generalsadd'],
  'kaffarat-kaf': ['kafarat', 'expiation'],
  'ksoashtaa': ['kasoashtaa', 'clothing', 'harsh_winter'],
  'Medical-Students': ['medical_students', 'medical'],
  'rasd-alkher': ['needy_families'],
  'Rsoom-drasyaa': ['rsomdrasaaa', 'tuition_fee', 'rsoom'],
  'sdad-aldioons': ['sadadadeon', 'debtors'],
  'suqia-amaa': ['suqia', 'water_supply'],
  'Waqf-alrshaida': ['waqf_building']
};

async function recover() {
  console.log('--- Starting Exact Media Recovery Script ---');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.HOST_DATABASE,
      user: process.env.USER_DATABASE,
      password: process.env.PASSWORD_DATABASE,
      database: process.env.NAME_DATABASE,
      port: process.env.PORT_DATABASE,
    });

    console.log('Connected to Database. Fetching Media and Projects...');

    const [media] = await connection.query('SELECT id, name, path FROM media');
    const [projects] = await connection.query('SELECT id, title, slug FROM projects');

    console.log(`Found ${media.length} media items and ${projects.length} projects.`);

    let restoredProjects = 0;

    for (const project of projects) {
      let matchedMedia = null;
      let Keywords = keywordMap[project.slug];
      
      if (!Keywords) {
        console.log(`[Warning] No manual map configured for slug: ${project.slug}`);
        continue;
      }
      
      for (const m of media) {
        const p = m.path.toLowerCase();
        if (Keywords.some(kw => p.includes(kw.toLowerCase()))) {
          matchedMedia = m;
          break;
        }
      }

      if (matchedMedia) {
        console.log(`Match Found: ${project.slug} --> ${matchedMedia.path}`);
        await connection.query(
          'INSERT IGNORE INTO project_media_items (projectId, mediaId) VALUES (?, ?)',
          [project.id, matchedMedia.id]
        );
        restoredProjects++;
      } else {
        console.log(`[Unmatched Project]: ${project.slug}`);
      }
    }

    console.log(`--- Recovery Complete ---`);
    console.log(`Restored links for ${restoredProjects} Projects.`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

recover();
