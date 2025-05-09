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

// Ensure correct paths for these imports based on your project structure
import { Project } from '../../projects/entities/project.entity';
import { Continent } from '../../continents/entities/continent.entity';
import { SacrificePrice } from '../../sacrifices/sacrifices-prices/entities/sacrifice-price.entity';

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ length: 2, unique: true })
  code: string;

  @Column({ nullable: true })
  flagUrl: string;

  @Column({ nullable: true })
  phoneCode: string;

  @Column({ nullable: true })
  currencyCode: string;

  @Column({ nullable: true })
  currencySymbol: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid' }) // Make sure the column type matches the Continent ID type
  continentId: string;

  @ManyToOne(() => Continent)
  @JoinColumn({ name: 'continentId' })
  continent: Continent;

  @OneToMany(() => Project, (project) => project.country)
  projects: Project[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SacrificePrice, (sacrificePrice) => sacrificePrice.country)
  sacrificePrices: SacrificePrice[];
}
