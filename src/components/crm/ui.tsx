// ============================================================
//  Shared Oak Haven brand UI primitives for CRM & Investor platform
//  Palette:
//    oak-green  #1C412C
//    oak-gold   #B08B48
//    oak-slate  #213532
//    oak-cream  #F5F2E9
//    oak-line   #E4DECB
//    card       #FFFFFF
// ============================================================
import React from 'react';

export const CRM = {
  page: '#F5F2E9',
  surface: '#FFFFFF',
  surface2: '#FBF9F2',
  line: '#E4DECB',
  green: '#1C412C',
  gold: '#B08B48',
  slate: '#213532',
};

export const Card: React.FC<{
  className?: string;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ className = '', children, title, subtitle, actions }) => (
  <div
    className={`bg-white border border-[#E4DECB] rounded-2xl shadow-sm ${className}`}
  >
    {(title || actions) && (
      <div className="px-5 py-4 border-b border-[#E4DECB] flex items-center justify-between gap-3">
        <div>
          {title && <h3 className="text-[15px] font-semibold text-[#1C412C]">{title}</h3>}
          {subtitle && <p className="text-[11px] text-[#213532]/70 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </div>
);

type BtnVariant = 'gold' | 'ghost' | 'dark' | 'danger' | 'success';

export const Btn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: BtnVariant;
    icon?: React.ElementType;
    size?: 'sm' | 'md';
  }
> = ({ variant = 'ghost', icon: Icon, size = 'md', className = '', children, ...rest }) => {
  const base =
    'inline-flex items-center gap-2 rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs';
  const variants: Record<BtnVariant, string> = {
    gold: 'bg-[#B08B48] hover:bg-[#C59D55] text-white shadow-sm',
    ghost: 'bg-[#1C412C]/[.06] hover:bg-[#1C412C]/[.12] text-[#213532] border border-[#E4DECB]',
    dark: 'bg-[#1C412C] hover:bg-[#245238] text-[#F5F2E9] shadow-sm',
    danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-500/25',
    success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/25',
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </button>
  );
};

type Tone = 'gold' | 'green' | 'red' | 'blue' | 'gray' | 'violet';

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'gray',
  children,
  className = '',
}) => {
  const tones: Record<Tone, string> = {
    gold: 'bg-[#B08B48]/15 text-[#B08B48] border-[#B08B48]/30',
    green: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    red: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
    blue: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
    violet: 'bg-violet-500/15 text-violet-700 border-violet-500/30',
    gray: 'bg-[#1C412C]/[.06] text-[#213532]/70 border-[#E4DECB]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = '',
}) => (
  <div className={`flex items-center justify-between gap-4 py-3.5 border-b border-[#E4DECB] last:border-0 ${className}`}>
    <span className="text-[13px] text-[#213532]/70 shrink-0">{label}</span>
    <div className="text-[13px] text-[#213532] font-medium text-right min-w-0 truncate">{children}</div>
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input
    className={`px-3.5 py-2 bg-white border border-[#E4DECB] rounded-xl text-[13px] text-[#213532] placeholder:text-[#213532]/40 focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20 ${className}`}
    {...rest}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...rest }) => (
  <select
    className={`px-3 py-2 bg-white border border-[#E4DECB] rounded-xl text-[13px] text-[#213532] focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20 cursor-pointer ${className}`}
    {...rest}
  >
    {children}
  </select>
);

export const Kpi: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon?: React.ElementType;
  tone?: 'gold' | 'green' | 'red' | 'blue';
}> = ({ label, value, hint, icon: Icon, tone = 'gold' }) => {
  const ring: Record<string, string> = {
    gold: 'text-[#B08B48] bg-[#B08B48]/10',
    green: 'text-emerald-700 bg-emerald-500/10',
    red: 'text-rose-700 bg-rose-500/10',
    blue: 'text-sky-700 bg-sky-500/10',
  };
  return (
    <div className="bg-white border border-[#E4DECB] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
      {Icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ring[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xl font-extrabold text-[#1C412C] leading-tight">{value}</div>
        <div className="text-[11px] text-[#213532]/70 truncate">{label}</div>
        {hint && <div className="text-[10px] text-emerald-700 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
};

/** Table shells */
export const Th: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <th className={`py-3 px-5 text-[10px] uppercase tracking-wider font-bold text-[#213532]/60 ${className}`}>{children}</th>
);
export const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`py-3.5 px-5 text-[13px] text-[#213532] ${className}`}>{children}</td>
);

export const Avatar: React.FC<{ name: string; size?: number; className?: string }> = ({ name, size = 40, className = '' }) => (
  <div
    className={`rounded-full bg-[#1C412C] text-[#F5F2E9] font-extrabold flex items-center justify-center shrink-0 shadow-sm ${className}`}
    style={{ width: size, height: size, fontSize: size * 0.4 }}
  >
    {name
      .split(' ')
      .map(p => p[0])
      .join('')
      .slice(0, 1)
      .toUpperCase()}
  </div>
);
