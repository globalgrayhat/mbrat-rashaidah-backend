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

import { Project } from '../../projects/entities/project.entity';
import { Continent } from '../../continents/entities/continent.entity';

/**
 * Represents a country with metadata and its related projects
 */
@Entity('countries')
export class Country {
  /**
   * Primary key: UUID generated automatically
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Official name of the country
   */
  @Column({ length: 255 })
  name: string;

  /**
   * ISO 2-letter country code (unique)
   */
  @Column({ length: 2, unique: true })
  code: string;

  /**
   * URL to the country's flag image
   */
  @Column({ length: 500, nullable: true })
  flagUrl?: string;

  /**
   * International dialing code
   */
  @Column({ length: 10, nullable: true })
  phoneCode?: string;

  /**
   * ISO currency code
   */
  @Column({ length: 3, nullable: true })
  currencyCode?: string;

  /**
   * Symbol used for the currency
   */
  @Column({ length: 5, nullable: true })
  currencySymbol?: string;

  /**
   * Flag indicating if the country is active
   */
  @Column({ default: true })
  isActive: boolean;

  /**
   * Foreign key referencing the continent
   */
  @Column('uuid')
  continentId: string;

  /**
   * Continent associated with this country
   */
  @ManyToOne(() => Continent, { eager: true })
  @JoinColumn({ name: 'continentId' })
  continent: Continent;

  /**
   * List of projects under this country
   */
  @OneToMany(() => Project, (project) => project.country)
  projects: Project[];

  /**
   * Timestamp when the country record was created
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /**
   * Timestamp when the country record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
