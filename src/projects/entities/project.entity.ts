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

/**
 * Represents a charitable project in the system
 */
@Entity('projects')
export class Project {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Title of the project
   */
  @Column({ length: 255 })
  title: string;

  /**
   * URL-friendly unique slug for the project
   */
  @Column({ unique: true, length: 255 })
  slug: string;

  /**
   * Detailed description of the project
   */
  @Column('text')
  description: string;

  /**
   * Location where the project takes place
   */
  @Column({ length: 255 })
  location: string;

  /**
   * Start date and time of the project
   */
  @Column({ type: 'timestamp' })
  startDate: Date;

  /**
   * Optional end date and time of the project
   */
  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  /**
   * Target fundraising amount
   */
  @Column('decimal', { precision: 10, scale: 2 })
  targetAmount: number;

  /**
   * Current amount raised
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  currentAmount: number;

  /**
   * Category associated with this project
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
   * Country associated with this project
   */
  @ManyToOne(() => Country, { eager: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  /**
   * Foreign key for country
   */
  @Column('uuid')
  countryId: string;

  /**
   * Continent associated with this project
   */
  @ManyToOne(() => Continent, { eager: true })
  @JoinColumn({ name: 'continentId' })
  continent: Continent;

  /**
   * Foreign key for continent
   */
  @Column('uuid')
  continentId: string;

  /**
   * Media assets related to this project
   */
  @ManyToMany(() => Media, (media) => media.projects)
  @JoinTable({
    name: 'project_media',
    joinColumn: { name: 'projectId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'mediaId', referencedColumnName: 'id' },
  })
  media: Media[];

  /**
   * Current status of the project
   */
  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  status: ProjectStatus;

  /**
   * Flag indicating if the project is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Number of times the project page has been viewed
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
   * Optional specific donation goal
   */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  donationGoal?: number;

  /**
   * Timestamp when the project record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the project record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  /**
   * User who created the project (optional)
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
   * Donations associated with this project
   */
  @OneToMany(() => Donation, (donation) => donation.project)
  donations: Donation[];
}
