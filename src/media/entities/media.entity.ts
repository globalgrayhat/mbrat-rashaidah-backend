import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { Banner } from '../../banners/entities/banner.entity';
import { MediaType } from '../../common/constants/media.constant';

/**
 * Represents a media asset stored in the system
 */
@Entity('media')
export class Media {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Base64-encoded file data
   */
  @Column('longtext')
  data: string;

  /**
   * MIME type of the media (e.g., image/png)
   */
  @Column({ length: 100 })
  mimeType: string;

  /**
   * Size of the file in bytes
   */
  @Column('int')
  size: number;

  /**
   * Type of media (image, video, etc.)
   */
  @Column({
    type: 'enum',
    enum: MediaType,
    default: MediaType.IMAGE,
  })
  type: MediaType;

  /**
   * Alternative text for accessibility
   */
  @Column({ length: 255, nullable: true })
  altText?: string;

  /**
   * Projects associated with this media
   */
  @ManyToMany(() => Project, (project) => project.media)
  projects: Project[];

  /**
   * Banner associated with this media (optional)
   */
  @ManyToOne(() => Banner, (banner) => banner.media, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bannerId' })
  banner?: Banner;

  /**
   * Foreign key for banner
   */
  @Column('uuid', { nullable: true })
  bannerId?: string;

  /**
   * Order for display in lists or galleries
   */
  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  /**
   * Flag indicating if the media is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Timestamp when the media record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the media record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  /**
   * User who uploaded the media (optional)
   */
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  /**
   * Foreign key for creator user
   */
  @Column('uuid', { nullable: true })
  createdById?: string;
}
