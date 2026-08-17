// ============================================================
//  Oak Haven Yield — brand assets
//
//  Drawn as inline SVG (not a bitmap) so the crest stays sharp
//  on any screen, scales to any size and can recolour itself
//  for light or dark surfaces.
//
//  Palette (supplied by the client):
//    Forest Green  #1C412C — crest outline, "OAK HAVEN"
//    Warm Gold     #B08B48 — inner shield, arrows, "YIELD"
//    Text Slate    #213532 — body copy
//    Cream         #F5F2E9 — page background
// ============================================================
import React from 'react';

export const BRAND = {
  green: '#1C412C',
  gold: '#B08B48',
  slate: '#213532',
  cream: '#F5F2E9',
} as const;

/**
 * The crest: a shield holding an oak whose branches double as
 * rising growth arrows — strength, shelter and yield in one mark.
 */
export const OakCrest: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
  <svg
    viewBox="0 0 200 240"
    width={size}
    height={size * 1.2}
    className={className}
    role="img"
    aria-label="Oak Haven Yield"
  >
    {/* outer shield */}
    <path
      d="M100 8 L188 52 v88 c0 46-40 74-88 92-48-18-88-46-88-92V52 Z"
      fill="none"
      stroke={BRAND.green}
      strokeWidth="9"
      strokeLinejoin="round"
    />
    {/* inner shield */}
    <path
      d="M100 26 L172 62 v78 c0 38-33 62-72 78-39-16-72-40-72-78V62 Z"
      fill="none"
      stroke={BRAND.gold}
      strokeWidth="5"
      strokeLinejoin="round"
    />

    {/* trunk */}
    <path
      d="M100 176 c-4-20-3-40 0-58 3 18 4 38 0 58Z"
      fill={BRAND.green}
    />
    <path d="M100 150 c-2-14-1-26 0-36 1 10 2 22 0 36Z" fill={BRAND.gold} opacity=".65" />

    {/* roots */}
    <g stroke={BRAND.green} strokeWidth="4.5" strokeLinecap="round" fill="none">
      <path d="M100 176 c-12 8-22 10-34 9" />
      <path d="M100 176 c12 8 22 10 34 9" />
      <path d="M100 176 c-7 12-16 18-27 21" />
      <path d="M100 176 c7 12 16 18 27 21" />
      <path d="M100 176 v22" />
    </g>

    {/* canopy */}
    <g fill={BRAND.green}>
      <ellipse cx="100" cy="74" rx="20" ry="15" />
      <ellipse cx="70" cy="88" rx="19" ry="14" />
      <ellipse cx="130" cy="88" rx="19" ry="14" />
      <ellipse cx="56" cy="106" rx="16" ry="12" />
      <ellipse cx="144" cy="106" rx="16" ry="12" />
      <ellipse cx="84" cy="100" rx="17" ry="13" />
      <ellipse cx="116" cy="100" rx="17" ry="13" />
    </g>

    {/* branches reaching into the canopy */}
    <g stroke={BRAND.green} strokeWidth="4" strokeLinecap="round" fill="none">
      <path d="M100 128 c-14-8-22-18-28-30" />
      <path d="M100 128 c14-8 22-18 28-30" />
      <path d="M100 118 c-8-12-12-22-13-34" />
      <path d="M100 118 c8-12 12-22 13-34" />
    </g>

    {/* growth arrows — the "yield" half of the mark */}
    <g stroke={BRAND.gold} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M104 132 L118 112 L132 96 L146 78" />
      <path d="M138 78 h10 v10" />
      <path d="M66 128 l10-12 10 8 12-16" />
      <path d="M92 104 h8 v8" />
    </g>
    <g stroke={BRAND.gold} strokeWidth="4" strokeLinecap="round">
      <path d="M74 130 v-14" />
      <path d="M84 130 v-22" />
      <path d="M124 130 v-22" />
      <path d="M134 130 v-14" />
    </g>
  </svg>
);

/**
 * Wordmark: "OAK HAVEN" in green over "YIELD" in gold, flanked by rules.
 * `tone="light"` keeps it readable when placed on a dark surface.
 */
export const OakWordmark: React.FC<{ className?: string; tone?: 'dark' | 'light' }> = ({
  className = '',
  tone = 'dark',
}) => {
  const top = tone === 'light' ? '#FFFFFF' : BRAND.green;
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span
        className="font-serif font-bold tracking-[0.06em] text-[15px]"
        style={{ color: top }}
      >
        OAK HAVEN
      </span>
      <span className="flex items-center gap-1.5 mt-0.5">
        <span className="h-px flex-1" style={{ background: BRAND.gold, opacity: 0.55 }} />
        <span
          className="font-serif font-bold italic tracking-[0.14em] text-[12px]"
          style={{ color: BRAND.gold }}
        >
          YIELD
        </span>
        <span className="h-px flex-1" style={{ background: BRAND.gold, opacity: 0.55 }} />
      </span>
    </span>
  );
};

/** Crest + wordmark side by side — the standard header lockup */
export const OakLogo: React.FC<{ size?: number; tone?: 'dark' | 'light'; className?: string }> = ({
  size = 38,
  tone = 'dark',
  className = '',
}) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <OakCrest size={size} />
    <OakWordmark tone={tone} />
  </span>
);
