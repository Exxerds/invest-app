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

/** Official crest — replace public/brand-crest.png to update the mark everywhere. */
export const CREST_SRC = '/brand-crest.png';

export const OakCrest: React.FC<{ size?: number; className?: string }> = ({ size = 56, className = '' }) => (
  <img
    src={CREST_SRC}
    alt="Oak Haven Yield"
    width={size}
    height={size}
    className={`object-contain shrink-0 ${className}`}
    style={{ width: size, height: size }}
  />
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
