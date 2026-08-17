export type AssetCategory = 'crypto' | 'forex' | 'futures' | 'pool';

export interface Project {
  id: string;
  title: string;
  category: AssetCategory;
  categoryLabel: string;
  targetAmount: number;
  raisedAmount: number;
  apr: number; // e.g. 24.5 (%)
  termMonths: number;
  minCheck: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'active' | 'funded' | 'closed';
  description: string;
  imageUrl: string;
  tags: string[];
}

export type KycStatus = 'verified' | 'pending' | 'rejected';

export interface Investor {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: KycStatus;
  balance: number;
  invested: number;
  totalProfit: number;
  registrationDate: string;
  manager: string;
  documentName?: string;
}

export type LeadStage = 'new' | 'contact' | 'kyc' | 'active';

export interface LeadComment {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  potentialAmount: number;
  stage: LeadStage;
  notes: string;
  manager: string;
  createdAt: string;
  comments: LeadComment[];
}

/** CRM settings (admin-only toggles) */
export interface CrmSettings {
  /** Hide full phone numbers from agents/managers (admin sees full numbers) */
  hidePhonesFromAgents: boolean;
}

export interface TransactionRequest {
  id: string;
  investorId: string;
  investorName: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
  method: string;
}

export interface ActiveInvestment {
  id: string;
  projectId: string;
  projectTitle: string;
  categoryLabel: string;
  amount: number;
  date: string;
  apr: number;
  nextPayoutDate: string;
  accruedProfit: number;
  /** Asset price at the moment the position was opened */
  entryPrice?: number;
  /** TradingView symbol used to pull the live price */
  tv?: string;
}

/** Extra client fields used by the CRM "User details" screen (reference design) */
export interface ClientExtras {
  firstName?: string;
  lastName?: string;
  password?: string;
  country?: string;
  city?: string;
  language?: string;
  affiliate?: string;
  withdrawBlocked?: boolean;
  status?: 'active' | 'blocked';
  lastActivity?: string;
  online?: boolean;
}

export type CallStatus = 'answered' | 'missed' | 'declined';

export interface CallRecord {
  id: string;
  client: string;
  direction: 'in' | 'out';
  status: CallStatus;
  duration: string;
  date: string;
  manager: string;
  recorded: boolean;
}

/**
 * Daily note left by an agent on a client card.
 * Append-only by design: once sent it can never be edited or deleted,
 * so the history stays audit-proof.
 */
export interface ClientNote {
  id: string;
  clientId: string;
  author: string;
  authorRole: 'ADMIN' | 'MANAGER';
  text: string;
  createdAt: string;
}

/**
 * Client workflow status. The exact list is supplied by the client later —
 * these are placeholders so the field already works end-to-end.
 */
export type ClientStatus = string;

export const CLIENT_STATUSES: string[] = [
  'New',
  'Call Back - Low Potential',
  'Call Back - Middle Potential',
  'Call Back - Top Potential',
  'No Answer - Low Potential',
  'No Answer - Middle Potential',
  'No Answer - High Potential',
  'Deposited - Low Potential',
  'Deposited - Middle Potential',
  'Deposited - High Potential',
];

export type StatusTone = 'green' | 'red' | 'blue' | 'gold' | 'gray';

/**
 * Colour coding requested by the client:
 *   Call Back  → green
 *   No Answer  → red
 *   Deposited  → blue
 *   New        → gold (a fresh lead nobody has touched yet)
 */
export function statusTone(status: string): StatusTone {
  const s = (status || '').toLowerCase();
  if (s.startsWith('call back')) return 'green';
  if (s.startsWith('no answer')) return 'red';
  if (s.startsWith('deposited')) return 'blue';
  if (s === 'new') return 'gold';
  return 'gray';
}

/** KYC document slots the client must upload */
export type KycDocType = 'front' | 'back' | 'address';

export type KycDocStatus = 'missing' | 'pending' | 'approved' | 'rejected';

export interface KycDocument {
  id: string;
  clientId: string;
  type: KycDocType;
  fileName: string;
  /** data-URL preview (real deployment stores the file on the server) */
  dataUrl: string;
  status: KycDocStatus;
  uploadedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
}

export const KYC_DOC_LABELS: Record<KycDocType, string> = {
  front: 'Front of ID',
  back: 'Back of ID',
  address: 'Proof of Address',
};
