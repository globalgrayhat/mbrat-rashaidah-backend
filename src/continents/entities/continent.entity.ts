import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { Country } from '../../countries/entities/country.entity';

/**
 * Represents a continent with its associated countries
 */
@Entity('continents')
export class Continent {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Official name of the continent
   */
  @Column({ length: 255 })
  name: string;

  /**
   * ISO 2-letter code for the continent (unique)
   */
  @Column({ length: 2, unique: true })
  code: string;

  /**
   * Flag indicating if the continent is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * List of countries belonging to this continent
   */
  @OneToMany(() => Country, (country) => country.continent)
  countries: Country[];

  /**
   * Timestamp when the continent record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the continent record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
