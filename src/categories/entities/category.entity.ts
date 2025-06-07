import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';

/**
 * Represents a category for organizing projects
 */
@Entity('categories')
export class Category {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Display name of the category
   */
  @Column({ length: 255 })
  name: string;

  /**
   * URL-friendly unique slug for the category
   */
  @Column({ unique: true, length: 255 })
  slug: string;

  /**
   * Optional detailed description of the category
   */
  @Column('text', { nullable: true })
  description?: string;

  /**
   * Icon identifier or URL for the category
   */
  @Column({ length: 255, nullable: true })
  icon?: string;

  /**
   * Hex code or color name for category labels
   */
  @Column({ length: 20, nullable: true })
  color?: string;

  /**
   * Order index for sorting categories
   */
  @Column('int', { default: 0 })
  order: number;

  /**
   * Flag indicating if the category is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Projects associated with this category
   */
  @OneToMany(() => Project, (project) => project.category)
  projects: Project[];

  /**
   * Timestamp when the category was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the category was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  /**
   * User who created the category (optional)
   */
  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  /**
   * Foreign key for the creator user
   */
  @Column('uuid', { nullable: true })
  createdById?: string;
}
