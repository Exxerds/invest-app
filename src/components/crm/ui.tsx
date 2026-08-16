// ============================================================
//  Shared dark-gold UI primitives for the CRM / Admin panel
//  Palette taken from the reference screenshots:
//    page       #0a0b0e
//    surface    #14161c
//    surface-2  #1b1e26
//    border     rgba(255,255,255,.07)
//    accent     #f5b400 (gold)
//    success    #22c55e / danger #ef4444
// ============================================================
import React from 'react';

export const CRM = {
  page: '#0a0b0e',
  surface: '#14161c',
  surface2: '#1b1e26',
  gold: '#f5b400',
};

export const Card: React.FC<{
  className?: string;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ className = '', children, title, subtitle, actions }) => (
  <div
    className={`bg-[#14161c] border border-white/[.07] rounded-2xl shadow-[0_1px_0_rgba(255,255,255,.03)_inset] ${className}`}
  >
    {(title || actions) && (
      <div className="px-5 py-4 border-b border-white/[.06] flex items-center justify-between gap-3">
        <div>
          {title && <h3 className="text-[15px] font-semibold text-white">{title}</h3>}
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
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
    gold: 'bg-[#f5b400] hover:bg-[#ffc21f] text-[#17190f] shadow-[0_4px_14px_-4px_rgba(245,180,0,.6)]',
    ghost: 'bg-white/[.05] hover:bg-white/[.09] text-slate-200 border border-white/[.08]',
    dark: 'bg-[#1b1e26] hover:bg-[#232734] text-slate-300 border border-white/[.06]',
    danger: 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25',
    success: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25',
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
    gold: 'bg-[#f5b400]/15 text-[#f5b400] border-[#f5b400]/30',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    red: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    gray: 'bg-white/[.06] text-slate-400 border-white/10',
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
  <div className={`flex items-center justify-between gap-4 py-3.5 border-b border-white/[.05] last:border-0 ${className}`}>
    <span className="text-[13px] text-slate-500 shrink-0">{label}</span>
    <div className="text-[13px] text-slate-100 font-medium text-right min-w-0 truncate">{children}</div>
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input
    className={`px-3.5 py-2 bg-[#0f1116] border border-white/[.08] rounded-xl text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#f5b400]/50 focus:ring-2 focus:ring-[#f5b400]/15 ${className}`}
    {...rest}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...rest }) => (
  <select
    className={`px-3 py-2 bg-[#0f1116] border border-white/[.08] rounded-xl text-[13px] text-slate-100 focus:outline-none focus:border-[#f5b400]/50 cursor-pointer ${className}`}
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
    gold: 'text-[#f5b400] bg-[#f5b400]/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    red: 'text-rose-400 bg-rose-400/10',
    blue: 'text-sky-400 bg-sky-400/10',
  };
  return (
    <div className="bg-[#14161c] border border-white/[.07] rounded-2xl p-4 flex items-center gap-3.5">
      {Icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ring[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xl font-extrabold text-white leading-tight">{value}</div>
        <div className="text-[11px] text-slate-500 truncate">{label}</div>
        {hint && <div className="text-[10px] text-emerald-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
};

/** Table shells */
export const Th: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <th className={`py-3 px-5 text-[10px] uppercase tracking-wider font-bold text-slate-500 ${className}`}>{children}</th>
);
export const Td: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`py-3.5 px-5 text-[13px] text-slate-300 ${className}`}>{children}</td>
);

export const Avatar: React.FC<{ name: string; size?: number; className?: string }> = ({ name, size = 40, className = '' }) => (
  <div
    className={`rounded-full bg-[#f5b400] text-[#17190f] font-extrabold flex items-center justify-center shrink-0 ${className}`}
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
