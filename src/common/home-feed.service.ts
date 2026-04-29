import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Media } from '../media/entities/media.entity';

export interface FeedItem {
  type: 'project' | 'campaign' | 'media';
  data: Project | Campaign | Media;
}

@Injectable()
export class HomeFeedService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  async getFeed(
    limit = 10,
    offset = 0,
  ): Promise<{ data: FeedItem[]; total: number }> {
    const [
      projects,
      campaigns,
      media,
      totalProjects,
      totalCampaigns,
      totalMedia,
    ] = await Promise.all([
      this.projectRepository.find({
        relations: ['category', 'country', 'continent', 'media'],
        order: {
          isPinned: 'DESC',
          createdAt: 'DESC',
        },
      }),
      this.campaignRepository.find({
        relations: ['category', 'media'],
        order: {
          isPinned: 'DESC',
          createdAt: 'DESC',
        },
      }),
      this.mediaRepository.find({
        order: {
          displayOrder: 'ASC',
          createdAt: 'DESC',
        },
      }),
      this.projectRepository.count(),
      this.campaignRepository.count(),
      this.mediaRepository.count(),
    ]);

    const total = totalProjects + totalCampaigns + totalMedia;

    const feed: FeedItem[] = [];

    for (const project of projects) {
      feed.push({ type: 'project', data: project });
    }
    for (const campaign of campaigns) {
      feed.push({ type: 'campaign', data: campaign });
    }
    for (const medium of media) {
      feed.push({ type: 'media', data: medium });
    }

    const pinnedFirst = feed.sort((a, b) => {
      const aPinned = (a.data as any).isPinned ? 1 : 0;
      const bPinned = (b.data as any).isPinned ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      return 0;
    });

    const pagedData = pinnedFirst.slice(offset, offset + limit);

    return { data: pagedData, total };
  }
}
