import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SacrificeType } from '../../sacrifices-types/entities/sacrifice-type.entity';
import { Country } from '../../../countries/entities/country.entity';
import { ColumnNumericTransformer } from '../../../common/column-numeric.transformer';

@Entity('sacrifice_prices')
export class SacrificePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: ColumnNumericTransformer,
  })
  price: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => SacrificeType, (t) => t.sacrificePrices, { eager: true })
  @JoinColumn({ name: 'sacrificeTypeId' })
  sacrificeType: SacrificeType;

  @Column('uuid')
  sacrificeTypeId: string;

  @ManyToOne(() => Country, (c) => c.sacrificePrices, { eager: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column('uuid')
  countryId: string;
}
