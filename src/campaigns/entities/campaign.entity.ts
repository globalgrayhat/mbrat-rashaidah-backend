// [FIXED 2025-06-04]
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

export enum CampaignStatusEnum {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  INACTIVE = 'inactive',
}

export enum CampaignPurposeEnum {
  CHARITY = 'charity',
  EDUCATION = 'education',
  HEALTH = 'health',
  OTHER = 'other',
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amountRequired: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amountRaised: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amountLeft: number;

  @Column({ type: 'enum', enum: CampaignPurposeEnum })
  purpose: CampaignPurposeEnum;

  @Column({
    type: 'enum',
    enum: CampaignStatusEnum,
    default: CampaignStatusEnum.ACTIVE,
  })
  campaignStatus: CampaignStatusEnum;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'officialId' })
  official: User;

  @Column()
  officialId: string;

  // [FIXED 2025-06-04] Add relation to project
  @ManyToOne(() => Project, { nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ nullable: true })
  projectId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
