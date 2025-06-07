import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Media } from '../../media/entities/media.entity';

/**
 * Represents a banner for promotional or informational display
 */
@Entity('banners')
export class Banner {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Title of the banner
   */
  @Column({ length: 255 })
  title: string;

  /**
   * Optional detailed description of the banner
   */
  @Column('text', { nullable: true })
  description?: string;

  /**
   * Associated media asset for the banner (optional)
   */
  @ManyToOne(() => Media, { nullable: true, eager: true })
  @JoinColumn({ name: 'mediaId' })
  media?: Media;

  /**
   * Foreign key for the media asset
   */
  @Column('uuid', { nullable: true })
  mediaId?: string;

  /**
   * Optional link URL when the banner is clicked
   */
  @Column({ length: 500, nullable: true })
  linkUrl?: string;

  /**
   * Flag indicating if the banner is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Order for displaying the banner relative to others
   */
  @Column('int', { default: 0 })
  displayOrder: number;

  /**
   * Timestamp when the banner record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the banner record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  /**
   * User who created the banner (optional)
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
