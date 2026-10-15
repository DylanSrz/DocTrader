import type { EstadoTicket, PrioridadTicket, TemaTicket } from '@doctrader/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Un ticket de soporte (`docs/MODELO-DATOS.md` §3.6). "Sin responder" es un ticket ABIERTO. */
@Entity({ name: 'tickets' })
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número visible, consecutivo desde 1000. */
  @Column({ type: 'integer', insert: false, update: false })
  number: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  topic: TemaTicket;

  @Column({ name: 'trading_account_id', type: 'uuid', nullable: true })
  tradingAccountId: string | null;

  @Column({ name: 'payment_order_id', type: 'uuid', nullable: true })
  paymentOrderId: string | null;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'varchar', length: 16 })
  status: EstadoTicket;

  @Column({ type: 'varchar', length: 8 })
  priority: PrioridadTicket;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'first_response_at', type: 'timestamptz', nullable: true })
  firstResponseAt: Date | null;

  @Column({ name: 'last_client_message_at', type: 'timestamptz' })
  lastClientMessageAt: Date;

  @Column({ name: 'last_message_at', type: 'timestamptz' })
  lastMessageAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** Un mensaje del hilo. Las notas internas solo las ven los admins. */
@Entity({ name: 'ticket_messages' })
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Respuestas guardadas de soporte, para no escribir lo mismo cada vez. */
@Entity({ name: 'saved_replies' })
export class SavedReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
