import React, { useState } from 'react';
import type { Project } from '../../types';
import type { ApiNotification } from '../../api';
import { 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  PlusCircle
} from 'lucide-react';

interface ProjectCatalogProps {
  projects: Project[];
  /** staff only: shows the "+ Create a new asset in the CRM panel" shortcut.
   *  Clients must never see a back-office entry point. */
  canManageAssets?: boolean;
  notifications?: ApiNotification[];
  onOpenInvestModal: (project: Project) => void;
  onSwitchToCrm: () => void;
}

export const ProjectCatalog: React.FC<ProjectCatalogProps> = ({
  projects,
  canManageAssets = false,
  notifications = [],
  onOpenInvestModal,
  onSwitchToCrm
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredProjects = projects.filter((project) => {
    const matchesCategory = selectedCategory === 'all' || project.category === selectedCategory;
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getRiskBadge = (risk: Project['riskLevel']) => {
    switch (risk) {
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Low risk
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-800 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Medium risk
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-700 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            High risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-[#1C412C] text-[#F5F2E9] p-8 rounded-3xl shadow-sm relative overflow-hidden border border-[#1C412C]">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B08B48]/20 border border-[#B08B48]/40 text-[#B08B48] text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Trading asset marketplace
          </div>
          <h1 className="font-serif text-3xl font-extrabold tracking-tight">
            Trade verified assets with returns up to 45% APR
          </h1>
          <p className="text-[#F5F2E9]/80 text-sm mt-2 leading-relaxed">
            Every asset passes a 4-stage compliance audit and legal review. You can invest online —
            the trade is automatically registered in the CRM.
          </p>
        </div>

        {canManageAssets && (
          <div className="mt-6 flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={onSwitchToCrm}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-[#F5F2E9] rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#B08B48]" />
              <span>+ Create a new asset in the CRM panel</span>
            </button>
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="bg-white border border-[#E4DECB] rounded-2xl p-4 space-y-2">
          <div className="text-[12px] font-bold uppercase tracking-wide text-[#213532]/60">Live market updates</div>
          {notifications.slice(0, 6).map(n => (
            <div key={n.id} className="text-[13px] text-[#1C412C] border-t border-[#E4DECB] pt-2 first:border-0 first:pt-0">
              <span className="font-semibold">{n.title}.</span> {n.message}
              <span className="block text-[11px] text-[#213532]/50 mt-0.5">{new Date(n.createdAt).toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter and search bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E4DECB] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: `All assets (${projects.length})` },
            { id: 'crypto', label: 'Crypto' },
            { id: 'futures', label: 'Futures' },
            { id: 'forex', label: 'Forex & Metals' },
            { id: 'pool', label: 'Algorithmic Pools' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1C412C] text-[#F5F2E9] shadow-sm'
                  : 'bg-[#1C412C]/[.05] text-[#213532]/80 hover:bg-[#1C412C]/[.10] border border-[#E4DECB]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#213532]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E4DECB] rounded-xl text-sm text-[#213532] placeholder:text-[#213532]/40 focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const percentRaised = Math.min(
            100,
            Math.round((project.raisedAmount / project.targetAmount) * 100)
          );
          const isClosed = project.status === 'funded' || project.status === 'closed' || percentRaised >= 100
            || Boolean(project.closesAt && new Date(project.closesAt).getTime() <= Date.now());
          const fill = percentRaised < 33 ? 'bg-rose-500' : percentRaised < 66 ? 'bg-amber-500' : 'bg-emerald-600';
          const leftMs = project.closesAt ? new Date(project.closesAt).getTime() - Date.now() : 0;

          return (
            <div
              key={project.id}
              className="bg-white rounded-2xl border border-[#E4DECB] shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
            >
              <div>
                {/* Image / Header */}
                <div className="relative h-48 w-full overflow-hidden bg-[#F5F2E9]">
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#1C412C]/90 backdrop-blur-md text-[#F5F2E9]">
                      {project.categoryLabel}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    {getRiskBadge(project.riskLevel)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[#1C412C] text-lg line-clamp-1">
                      {project.title}
                    </h3>
                  </div>

                  <p className="text-xs text-[#213532]/70 line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {project.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-[#1C412C]/[.06] text-[#213532]/80 text-[11px] font-medium border border-[#E4DECB]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E4DECB]">
                    <div>
                      <div className="text-[11px] text-[#213532]/60">Return</div>
                      <div className="text-sm font-extrabold text-emerald-700">
                        {project.apr}% APR
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#213532]/60">Term</div>
                      <div className="text-sm font-bold text-[#213532]">
                        {project.termMonths} mo
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#213532]/60">Min amount</div>
                      <div className="text-sm font-bold text-[#213532]">
                        ${project.minCheck.toLocaleString('en-US')}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-[#213532]">
                        Raised: ${project.raisedAmount.toLocaleString('en-US')}
                      </span>
                      <span className="text-[#B08B48] font-bold">{percentRaised}%</span>
                    </div>
                    <div className="w-full bg-[#EFEAD9] h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isClosed ? 'bg-[#213532]/40' : fill
                        }`}
                        style={{ width: `${percentRaised}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#213532]/60 mt-1">
                      <span>Target: ${project.targetAmount.toLocaleString('en-US')}</span>
                      {isClosed ? (
                        <span>Round closed</span>
                      ) : project.closesAt && leftMs > 0 ? (
                        <span>
                          {Math.floor(leftMs / 86400000)}d {Math.floor((leftMs % 86400000) / 3600000)}h {Math.floor((leftMs % 3600000) / 60000)}m left
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-5 pt-0">
                {isClosed ? (
                  <button
                    disabled
                    className="w-full py-3 bg-[#EFEAD9] text-[#213532]/50 font-semibold rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Round closed</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenInvestModal(project)}
                    className="w-full py-3 bg-[#B08B48] hover:bg-[#C59D55] text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Invest now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
