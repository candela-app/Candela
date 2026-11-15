import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PasswordResetToken } from './password-reset-token.entity';
import { User } from './user.entity';

/**
 * Short-lived, single-use context after Google auth for an unactivated
 * doctor-created patient. Not a Candela session — no refresh token / cookies.
 */
@Entity('google_invitation_challenges')
export class GoogleInvitationChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'invitation_token_id', type: 'uuid' })
  invitationTokenId: string;

  @ManyToOne(() => PasswordResetToken, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitation_token_id' })
  invitationToken: PasswordResetToken;

  @Column({ name: 'google_sub', type: 'varchar', length: 255 })
  googleSub: string;

  @Column({ name: 'google_email', type: 'varchar', length: 255 })
  googleEmail: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
