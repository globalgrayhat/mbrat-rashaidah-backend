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
      const campaigns: DbRow[] = await this.dataSource.query(
        'SELECT id, title, slug FROM campaigns',
      );
      const projects: DbRow[] = await this.dataSource.query(
        'SELECT id, title, slug FROM projects',
      );

      let restoredCampaigns = 0;
      let restoredProjects = 0;
      const logs: string[] = [];

      for (const m of media) {
        const fileName = String(m.path || '').toLowerCase();
        const matchedCampaign = campaigns.find(
          (c) =>
            fileName.includes(
              String(c.slug || '')
                .toLowerCase()
                .replace(/-/g, ''),
            ) || fileName.includes(String(c.title || '').toLowerCase()),
        );

        const matchedProject =
          !matchedCampaign &&
          projects.find(
            (p) =>
              fileName.includes(
                String(p.slug || '')
                  .toLowerCase()
                  .replace(/-/g, ''),
              ) || fileName.includes(String(p.title || '').toLowerCase()),
          );

        if (matchedCampaign) {
          logs.push(
            `Matched [${String(m.path)}] --> Campaign: ${String(matchedCampaign.title)}`,
          );
          await this.dataSource.query(
            'INSERT IGNORE INTO campaign_media_items (campaignId, mediaId) VALUES (?, ?)',
            [matchedCampaign.id, m.id],
          );
          restoredCampaigns++;
        } else if (matchedProject) {
          logs.push(
            `Matched [${String(m.path)}] --> Project: ${String(matchedProject.title)}`,
          );
          await this.dataSource.query(
            'INSERT IGNORE INTO project_media_items (projectId, mediaId) VALUES (?, ?)',
            [matchedProject.id, m.id],
          );
          restoredProjects++;
        }
      }

      return {
        message: 'Recovery Complete',
        restoredCampaigns,
        restoredProjects,
        logs,
      };
    } catch (e) {
      console.error(e);
      return { error: 'Recovery failed', details: (e as Error).message };
    }
  }
}
