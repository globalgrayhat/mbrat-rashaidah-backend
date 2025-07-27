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
  OneToMany, // Import OneToMany
} from 'typeorm';

import { Category } from '../../categories/entities/category.entity';
import { Country } from '../../countries/entities/country.entity';
import { Continent } from '../../continents/entities/continent.entity';
import { Media } from '../../media/entities/media.entity';
import { User } from '../../user/entities/user.entity';
import { ProjectStatus } from '../../common/constants/project.constant';
import { Donation } from '../../donations/entities/donation.entity'; // Import Donation

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ unique: true, length: 255 })
  slug: string;

  @Column('text')
  description: string;

  @Column({ length: 255 })
  location: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  targetAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  currentAmount: number;

  @ManyToOne(() => Category, { eager: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column('uuid')
  categoryId: string;

  @ManyToOne(() => Country, { eager: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column('uuid')
  countryId: string;

  @ManyToOne(() => Continent, { eager: true })
  @JoinColumn({ name: 'continentId' })
  continent: Continent;

  @Column('uuid')
  continentId: string;

  @ManyToMany(() => Media, (media) => media.projects)
  @JoinTable({
    name: 'project_media',
    joinColumn: { name: 'projectId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'mediaId', referencedColumnName: 'id' },
  })
  media: Media[];

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  status: ProjectStatus;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  donationCount: number;

  @Column({ default: true })
  isDonationActive: boolean;

  @Column({ default: true })
  isProgressActive: boolean;

  @Column({ default: true })
  isTargetAmountActive: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  donationGoal?: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  @Column('uuid', { nullable: true })
  createdById?: string;

  @OneToMany(() => Donation, (donation) => donation.project)
  donations: Donation[];
}
