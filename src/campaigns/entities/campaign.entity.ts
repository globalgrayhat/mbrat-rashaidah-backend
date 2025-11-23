import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';

import { Category } from '../../categories/entities/category.entity';
import { Media } from '../../media/entities/media.entity';
import { User } from '../../user/entities/user.entity';
import { CampaignStatus } from '../../common/constants/campaignStatus.constant';
import { Donation } from '../../donations/entities/donation.entity'; // Import Donation

/**
 * Represents a charitable campaign in the system
 */
@Entity('campaigns')
export class Campaign {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Title of the campaign
   */
  @Column({ length: 255 })
  title: string;

  /**
   * URL-friendly unique slug for the campaign
   */
  @Column({ unique: true, length: 255 })
  slug: string;

  /**
   * Detailed description of the campaign
   */
  @Column('text')
  description: string;

  /**
   * Start date and time of the campaign
   */
  @Column({ type: 'timestamp' })
  startDate: Date;

  /**
   * Optional end date and time of the campaign
   */
  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  /**
   * Target fundraising amount.
   * Using precision 15 and scale 3 to support KWD and other currencies with up to 3 decimal places.
   */
  @Column('decimal', { precision: 15, scale: 3 })
  targetAmount: number;

  /**
   * Current amount raised.
   * Using precision 15 and scale 3 to support KWD and other currencies with up to 3 decimal places.
   */
  @Column('decimal', { precision: 15, scale: 3, default: 0 })
  currentAmount: number;

  /**
   * Category associated with this campaign
   */
  @ManyToOne(() => Category, { eager: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  /**
   * Foreign key for category
   */
  @Column('uuid')
  categoryId: string;

  /**
   * Media assets related to this campaign
   */
  @ManyToMany(() => Media, (media) => media.campaigns)
  @JoinTable({
    name: 'campaign_media',
    joinColumn: { name: 'campaignId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'mediaId', referencedColumnName: 'id' },
  })
  media: Media[];

  /**
   * Current status of the campaign
   */
  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  /**
   * Flag indicating if the campaign is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Number of times the campaign page has been viewed
   */
  @Column({ default: 0 })
  viewCount: number;

  /**
   * Total number of donations made
   */
  @Column({ default: 0 })
  donationCount: number;

  /**
   * Flag to show or hide donation functionality
   */
  @Column({ default: true })
  isDonationActive: boolean;

  /**
   * Flag to show or hide progress bar
   */
  @Column({ default: true })
  isProgressActive: boolean;

  /**
   * Flag to show or hide target amount
   */
  @Column({ default: true })
  isTargetAmountActive: boolean;

  /**
   * Optional specific donation goal.
   * Using precision 15 and scale 3 to support KWD and other currencies with up to 3 decimal places.
   */
  @Column('decimal', { precision: 15, scale: 3, nullable: true })
  donationGoal?: number;

  /**
   * Timestamp when the campaign record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the campaign record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  /**
   * User who created the campaign (optional)
   */
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  /**
   * Foreign key for the creator user
   */
  @Column('uuid', { nullable: true })
  createdById?: string;

  /**
   * Donations associated with this campaign
   */
  @OneToMany(() => Donation, (donation) => donation.campaign)
  donations: Donation[];
}
