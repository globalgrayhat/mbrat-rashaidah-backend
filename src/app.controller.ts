import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHealth(): {
    message: string;
    appName: string;
  } {
    return this.appService.getHealth();
  }

  @Get('recover-media')
  async recoverMedia(): Promise<Record<string, unknown>> {
    console.log('--- Starting Media Recovery (from AppController) ---');
    try {
      type DbRow = Record<string, string>;
      const media: DbRow[] = await this.dataSource.query(
        'SELECT id, name, path FROM media',
      );
      const projects: DbRow[] = await this.dataSource.query(
        'SELECT id, title, slug FROM projects',
      );

      let restoredProjects = 0;
      const logs: string[] = [];

      const keywordMap: Record<string, string[]> = {
        'aftar-saeem': ['aftarsaem', 'iftar'],
        'alaqraboon-ui': ['aqraboon', 'agraboon', 'relatives'],
        'alnhor-altabhh': ['aqiqah', 'vows', 'alaqaweqq'],
        'alsral-amtaffa': ['amutafffa', 'alsra'],
        'alzkaaa-aiai': ['zkao', 'zakat'],
        bardalehhm: ['bardale', 'cold_winter'],
        daeemmarda: ['daeeem', 'patient'],
        'General-donations': ['general_charity', 'generalsadd'],
        'kaffarat-kaf': ['kafarat', 'expiation'],
        ksoashtaa: ['kasoashtaa', 'clothing', 'harsh_winter'],
        'Medical-Students': ['medical_students', 'medical'],
        'rasd-alkher': ['needy_families'],
        'Rsoom-drasyaa': ['rsomdrasaaa', 'tuition_fee', 'rsoom'],
        'sdad-aldioons': ['sadadadeon', 'debtors'],
        'suqia-amaa': ['suqia', 'water_supply'],
        'Waqf-alrshaida': ['waqf_building'],
      };

      for (const project of projects) {
        let matchedMedia: DbRow | undefined;
        const keywords = keywordMap[String(project.slug || '')];

        if (keywords) {
          matchedMedia = media.find((m) => {
            const path = String(m.path || '').toLowerCase();
            return keywords.some((kw) => path.includes(kw));
          });
        }

        if (matchedMedia) {
          logs.push(
            `Matched Project: ${String(project.title || project.slug)} --> [${String(matchedMedia.path)}]`,
          );
          await this.dataSource.query(
            'INSERT IGNORE INTO project_media_items (projectId, mediaId) VALUES (?, ?)',
            [project.id, matchedMedia.id],
          );
          restoredProjects++;
        }
      }

      return {
        message: 'Recovery Complete',
        restoredProjects,
        logs,
      };
    } catch (e) {
      console.error(e);
      return { error: 'Recovery failed', details: (e as Error).message };
    }
  }
}
