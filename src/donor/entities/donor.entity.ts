import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Donation } from '../../donations/entities/donation.entity';
import { User } from '../../user/entities/user.entity';

@Entity('donors')
@Index('idx_donors_email', ['email'], { unique: false })
export class Donor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  fullName?: string;

  /**
   * Donor email - NOT unique at DB level because:
   * 1. MySQL doesn't allow UNIQUE on nullable columns
   * 2. Anonymous donors may share emails
   *
   * UNIQUE constraint is enforced at APPLICATION level + migration
   * This column stores lowercase email for case-insensitive matching.
   */
  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true, length: 50 })
  phoneNumber?: string;

  @Column({ default: false })
  isAnonymous: boolean;

  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column('uuid', { nullable: true, unique: true })
  userId?: string;

  @OneToMany(() => Donation, (donation) => donation.donor)
  donations: Donation[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
