import { AuditLog } from './audit-log.entity.js';
import { AuthToken } from './auth-token.entity.js';
import { Consent } from './consent.entity.js';
import { DepositAddress } from './deposit-address.entity.js';
import { LegalDocument } from './legal-document.entity.js';
import { License } from './license.entity.js';
import { LicensePeriod } from './license-period.entity.js';
import { Notification } from './notification.entity.js';
import { PartnerProfile } from './partner-profile.entity.js';
import { PaymentOrder } from './payment-order.entity.js';
import { Plan } from './plan.entity.js';
import { RecoveryCode } from './recovery-code.entity.js';
import { Setting } from './setting.entity.js';
import { TradingAccount } from './trading-account.entity.js';
import { UserDevice } from './user-device.entity.js';
import { User } from './user.entity.js';

export {
  AuditLog,
  AuthToken,
  Consent,
  DepositAddress,
  LegalDocument,
  License,
  LicensePeriod,
  Notification,
  PartnerProfile,
  PaymentOrder,
  Plan,
  RecoveryCode,
  Setting,
  TradingAccount,
  User,
  UserDevice,
};
export { PROPOSITO_ENLACE, type PropositoEnlace } from './auth-token.entity.js';
export { ESTADO_AVISO, type EstadoAviso } from './notification.entity.js';

export const ENTIDADES = [
  AuditLog,
  AuthToken,
  Consent,
  DepositAddress,
  LegalDocument,
  License,
  LicensePeriod,
  Notification,
  PartnerProfile,
  PaymentOrder,
  Plan,
  RecoveryCode,
  Setting,
  TradingAccount,
  User,
  UserDevice,
];
