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

  @Column({ type: 'uuid' })
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
}
