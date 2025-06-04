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


@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  data: string; // Base64 encoded file data

  @Column({ length: 100 })
  mimeType: string;

  @Column()
  size: number;

  @Column({
    type: 'enum',
    enum: MediaType,
    default: MediaType.IMAGE,
  })
  type: MediaType;

  @Column({ nullable: true })
  altText?: string;

  @ManyToMany(() => Project, (project) => project.media)
  projects: Project[];

  @ManyToOne(() => Banner, (banner) => banner.media, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bannerId' })
  banner?: Banner;

  @Column({ nullable: true })
  bannerId?: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  @Column({ nullable: true })
  createdById?: string;
}
