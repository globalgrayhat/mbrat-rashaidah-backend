import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

// Ensure correct path for this import
import { Country } from '../../countries/entities/country.entity';

@Entity('continents')
export class Continent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ length: 2, unique: true })
  code: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Country, (country) => country.continent)
  countries: Country[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
