export type LegalSlug = 'client' | 'aml' | 'terms' | 'risk';

export const LEGAL_DOCS: {
  slug: LegalSlug;
  title: string;
  paragraphs: string[];
}[] = [
  {
    slug: 'client',
    title: 'Client Agreement',
    paragraphs: [
      'This Client Agreement (“Agreement”) is entered into between Oak Haven Yield (“the Firm”, “we”) and the individual or entity that opens an account (“the Client”). By registering, funding or using the platform the Client accepts these terms in full.',
      'The Firm provides access to a web-based trading environment covering listed and OTC instruments, including but not limited to equities, currencies, commodities, indices and digital assets. Nothing on the platform is investment advice, a solicitation to buy or sell, or a guarantee of profit.',
      'The Client confirms that they are of legal age, act on their own behalf, have the legal capacity to enter into this Agreement, and will provide accurate identification and contact data. The account is personal and may not be transferred. The Client is solely responsible for the security of login credentials.',
      'Orders are executed on a best-effort basis at the displayed price or the next available market price. The Firm may refuse, delay or reverse an order in case of obvious error, insufficient margin, suspected abuse or legal restriction. Open positions may be adjusted or closed by the desk where required for risk, compliance or operational integrity.',
      'Deposits and withdrawals are processed only to accounts or wallets in the Client’s own name after identity verification. The Firm may withhold a payout pending review. Fees, spreads and margin requirements are published in the cabinet and may change with notice on the platform.',
      'This Agreement is governed by the laws applicable to the Firm’s place of establishment. Disputes shall first be referred to the support desk; unresolved matters may be submitted to the competent courts.',
    ],
  },
  {
    slug: 'aml',
    title: 'AML & KYC Policy',
    paragraphs: [
      'Oak Haven Yield applies a risk-based anti-money-laundering and know-your-customer programme consistent with FATF recommendations and applicable AML statutes.',
      'Before withdrawals (and, where required, before trading) the Client must complete identity verification: a government photo ID (front and back) and a recent proof of address. The Firm may request source-of-funds evidence, a video call or additional documents at any time.',
      'We screen clients against sanctions, PEP and adverse-media lists. We will not onboard or will terminate relationships with persons from restricted jurisdictions or those we reasonably suspect of money laundering, terrorist financing, fraud or sanctions evasion.',
      'Transactions are monitored. Unusual patterns — structuring, third-party deposits, rapid in-and-out flows, mismatched names on payment methods — are escalated. The Firm may freeze the account, refuse a transfer and file a suspicious-activity report without notifying the Client where the law so requires.',
      'Records of identification and transactions are retained for at least five years after the relationship ends, or longer if required by law. Staff access is limited to a need-to-know basis.',
    ],
  },
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    paragraphs: [
      'These Terms govern use of oakhavenyield.com, the client cabinet, support chat, voice calls and any related services. Access may be suspended for maintenance, security or legal reasons.',
      'The Client must not use the service for unlawful activity, market manipulation, sharing of access, reverse engineering, or automated scraping. Communications with advisors may be recorded for quality and compliance when the call-recording setting is enabled.',
      'Market data displayed on the site is provided “as is” from third-party feeds. Charts, quotes and social-proof indicators are informational and may be delayed. The Firm is not liable for interruptions, quote gaps, or losses arising from the Client’s hardware, network or decisions.',
      'Intellectual property in the brand, software and content remains with Oak Haven Yield. The Client receives a limited, revocable licence to use the cabinet for personal trading only.',
      'We may update these Terms by publishing a new version on this page. Continued use after the update constitutes acceptance. If a provision is held invalid, the remainder stays in force.',
    ],
  },
  {
    slug: 'risk',
    title: 'Risk Disclosure',
    paragraphs: [
      'Trading leveraged products such as CFDs, futures, forex and digital assets involves a high level of risk and may not be suitable for all investors. You can lose some or all of the capital you deposit, and in certain market conditions losses may exceed the deposited amount.',
      'Leverage magnifies both gains and losses. A small adverse move can trigger a margin call or automatic liquidation. Spreads, slippage and overnight financing can reduce returns. Past performance is not indicative of future results. Hypothetical or back-tested figures are not a promise of profit.',
      'Crypto-assets are volatile and may become illiquid or untradeable. Regulatory changes can restrict access overnight. You should not speculate with funds you cannot afford to lose. Seek independent financial, tax and legal advice if you are unsure.',
      'By opening an account you confirm that you have read this disclosure, understand the risks, and accept that Oak Haven Yield does not guarantee any particular outcome.',
    ],
  },
];

export function legalBySlug(slug: string | undefined) {
  return LEGAL_DOCS.find(d => d.slug === slug) || LEGAL_DOCS[0];
}
