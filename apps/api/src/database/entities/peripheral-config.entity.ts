import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';

export type PeripheralType =
  | 'scanner'
  | 'printer'
  | 'drawer'
  | 'scale'
  | 'customer_display';
export type ConnectionType =
  | 'serial'
  | 'usb'
  | 'network'
  | 'bluetooth'
  | 'web_serial';

@Entity('peripheral_configs')
@Index(['store_id'])
@Index(['store_id', 'peripheral_type', 'is_active'])
@Index(['store_id', 'peripheral_type', 'is_default'], {
  where: 'is_default = true',
})
export class PeripheralConfig {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  peripheral_type: PeripheralType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  connection_type: ConnectionType;

  @Column({ type: 'jsonb' })
  connection_config: {
    // Para serial/usb
    serialPort?: string;
    baudRate?: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
    // Para network
    host?: string;
    networkPort?: number;
    // Para bluetooth
    deviceId?: string;
    // Para web_serial
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
    // Configuración específica por tipo
    printer?: {
      paperWidth?: number;
      encoding?: string;
    };
    scale?: {
      protocol?: string; // Mettler Toledo, etc.
      unit?: string; // kg, g, lb, oz
    };
    scanner?: {
      prefix?: string;
      suffix?: string;
      length?: number;
    };
  };

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
