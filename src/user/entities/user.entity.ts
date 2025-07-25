import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../common/constants/roles.constant';

/**
 * Represents a user in the system
 */
@Entity('users')
export class User {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  fullName: string;

  @Column({ unique: true, length: 255 })
  username: string;
  /**
   * User's unique email address
   */
  @Column({ unique: true, length: 255 })
  email: string;

  /**
   * User's hashed password
   */
  @Column({ length: 255 })
  password: string;

  /**
   * One-time password for MFA or verification
   */
  @Column({ nullable: true, length: 6 })
  otp?: string;

  /**
   * Expiration time for the one-time password
   */
  @Column({ type: 'timestamp', nullable: true })
  otpExpires?: Date;

  /**
   * Indicates whether the user's email has been verified
   */
  @Column({ default: false })
  isVerified: boolean;

  /**
   * Refresh token for session management
   */
  @Column({ nullable: true, length: 500 })
  refreshToken?: string;

  /**
   * Role of the user (e.g., USER, ADMIN)
   */
  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  /**
   * Timestamp when the user was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the user was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
