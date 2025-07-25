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

/**
 * Represents a donor, which can be an anonymous or registered user.
 */
@Entity('donors')
export class Donor {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Full name of the donor (optional, null for anonymous)
   */
  @Column({ nullable: true, length: 255 })
  fullName?: string;

  /**
   * Email of the donor (optional, can be provided for anonymous donors for receipt)
   */
  @Column({ nullable: true, unique: false }) // Not unique because multiple anonymous donors might use similar general emails or none at all.
  email?: string;

  /**
   * Phone number of the donor (optional)
   */
  @Column({ nullable: true, length: 50 })
  phoneNumber?: string;

  /**
   * Indicates if the donor wishes to remain anonymous for this specific donation.
   * This flag can be per-donation, but here it's on the donor record itself for simplicity.
   * If true, `fullName` and `email` might be null or generated.
   */
  @Column({ default: false })
  isAnonymous: boolean;

  /**
   * The associated registered user, if the donor is not anonymous.
   */
  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) // If User is deleted, set donorId to null
  @JoinColumn({ name: 'userId' })
  user?: User;

  /**
   * Foreign key for the associated user.
   */
  @Column('uuid', { nullable: true, unique: true }) // userId should be unique if a donor links to a specific user
  userId?: string;

  /**
   * Donations made by this donor.
   */
  @OneToMany(() => Donation, (donation) => donation.donor)
  donations: Donation[];

  /**
   * Timestamp when the donor record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the donor record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
