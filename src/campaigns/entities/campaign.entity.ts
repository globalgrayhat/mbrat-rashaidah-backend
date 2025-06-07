import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Project } from '../../projects/entities/project.entity';
import { User } from '../../user/entities/user.entity';
import { CampaignPurposeEnum } from '../../common/constants/campaignPurpose.constant';
import { CampaignStatusEnum } from '../../common/constants/campaignStatus.constant';

/**
 * Represents a fundraising campaign linked to a project or managed by an official
 */
@Entity('campaigns')
export class Campaign {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique campaign name
   */
  @Column({ unique: true, length: 255 })
  name: string;

  /**
   * Detailed description of the campaign
   */
  @Column('text', { nullable: true })
  description?: string;

  /**
   * Total amount required for the campaign
   */
  @Column('decimal', { precision: 10, scale: 2 })
  amountRequired: number;

  /**
   * Amount raised so far
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amountRaised: number;

  /**
   * Remaining amount left to raise
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amountLeft: number;

  /**
   * Purpose category of the campaign
   */
  @Column({
    type: 'enum',
    enum: CampaignPurposeEnum,
  })
  purpose: CampaignPurposeEnum;

  /**
   * Current status of the campaign
   */
  @Column({
    type: 'enum',
    enum: CampaignStatusEnum,
    default: CampaignStatusEnum.ACTIVE,
  })
  campaignStatus: CampaignStatusEnum;

  /**
   * Official user responsible for the campaign
   */
  @ManyToOne(() => User, { nullable: false, eager: true })
  @JoinColumn({ name: 'officialId' })
  official: User;

  /**
   * Foreign key for the official user
   */
  @Column('uuid')
  officialId: string;

  /**
   * Optional related project for the campaign
   */
  @ManyToOne(() => Project, { nullable: true, eager: true })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  /**
   * Foreign key for the related project
   */
  @Column('uuid', { nullable: true })
  projectId?: string;

  /**
   * Timestamp when the campaign was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the campaign was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
