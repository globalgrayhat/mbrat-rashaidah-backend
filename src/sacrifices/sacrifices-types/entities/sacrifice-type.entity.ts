import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { SacrificePrice } from '../../sacrifices-prices/entities/sacrifice-price.entity';

@Entity('sacrifice_types')
export class SacrificeType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(
    () => SacrificePrice,
    (sacrificePrice) => sacrificePrice.sacrificeType,
  )
  sacrificePrices: SacrificePrice[];
}
