import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Donation } from '../../donations/entities/donation.entity';
import { User } from '../../user/entities/user.entity';

@Entity('donors')
export class Donor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, length: 255 })
  fullName?: string;

  @Column({ nullable: true, unique: false }) // Not unique because multiple anonymous donors might use similar general emails or none at all.
  email?: string;

  @Column({ nullable: true, length: 50 })
  phoneNumber?: string;

  @Column({ default: false })
  isAnonymous: boolean;

  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) // If User is deleted, set donorId to null
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column('uuid', { nullable: true, unique: true }) // userId should be unique if a donor links to a specific user
  userId?: string;

  @OneToMany(() => Donation, (donation) => donation.donor)
  donations: Donation[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
