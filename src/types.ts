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
}
