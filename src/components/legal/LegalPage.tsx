import React, { useEffect } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { OakLogo } from '../brand/Logo';
import { LEGAL_DOCS, legalBySlug, type LegalSlug } from '../../legal/docs';

export const LegalPage: React.FC<{ slug?: string; onBack: () => void; onOpen: (slug: LegalSlug) => void }> = ({
  slug,
  onBack,
  onOpen,
}) => {
  const doc = legalBySlug(slug);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [doc.slug]);

  return (
    <div className="min-h-screen bg-[#F5F2E9] text-[#213532]">
      <header className="sticky top-0 z-40 bg-[#F5F2E9]/95 backdrop-blur border-b border-[#1C412C]/12">
        <div className="max-w-4xl mx-auto px-5 h-[68px] flex items-center justify-between gap-4">
          <button onClick={onBack} className="flex items-center shrink-0 cursor-pointer">
            <OakLogo size={58} />
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1C412C] hover:text-[#B08B48] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to site
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-10">
        <div className="flex flex-wrap gap-2 mb-8">
          {LEGAL_DOCS.map(d => (
            <button
              key={d.slug}
              onClick={() => onOpen(d.slug)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold border cursor-pointer ${
                d.slug === doc.slug
                  ? 'bg-[#1C412C] text-white border-[#1C412C]'
                  : 'bg-white text-[#213532] border-[#1C412C]/12 hover:border-[#B08B48]/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              {d.title}
            </button>
          ))}
        </div>

        <article className="bg-white border border-[#1C412C]/12 rounded-2xl p-6 md:p-8">
          <h1 className="text-[28px] font-extrabold text-[#1C412C] mb-5">{doc.title}</h1>
          <div className="space-y-4 text-[14.5px] leading-relaxed text-[#213532]/85">
            {doc.paragraphs.map(p => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
};
