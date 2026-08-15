import React, { useState } from 'react';
import type { Project } from '../../types';
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
  onOpenInvestModal: (project: Project) => void;
  onSwitchToCrm: () => void;
}

export const ProjectCatalog: React.FC<ProjectCatalogProps> = ({
  projects,
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            Low risk
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Medium risk
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            High risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Trading asset marketplace
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Trade verified assets with returns up to 45% APR
          </h1>
          <p className="text-slate-300 text-sm mt-2">
            Every asset passes a 4-stage compliance audit and legal review. You can invest online —
            the trade is automatically registered in the CRM.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onSwitchToCrm}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-blue-400" />
            <span>+ Create a new asset in the CRM panel</span>
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All assets ({projects.length})
          </button>
          <button
            onClick={() => setSelectedCategory('crypto')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'crypto'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Crypto
          </button>
          <button
            onClick={() => setSelectedCategory('futures')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'futures'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Futures
          </button>
          <button
            onClick={() => setSelectedCategory('forex')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'forex'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Forex & Metals
          </button>
          <button
            onClick={() => setSelectedCategory('pool')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'pool'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Algorithmic Pools
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
          const isClosed = project.status === 'funded' || percentRaised >= 100;

          return (
            <div
              key={project.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
            >
              <div>
                {/* Image / Header */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900/80 backdrop-blur-md text-white">
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
                    <h3 className="font-bold text-slate-900 text-lg line-clamp-1">
                      {project.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {project.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <div className="text-[11px] text-slate-400">Return</div>
                      <div className="text-sm font-extrabold text-emerald-600">
                        {project.apr}% APR
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Term</div>
                      <div className="text-sm font-bold text-slate-800">
                        {project.termMonths} mo
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Min amount</div>
                      <div className="text-sm font-bold text-slate-800">
                        ${project.minCheck.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-700">
                        Raised: ${project.raisedAmount.toLocaleString()}
                      </span>
                      <span className="text-blue-600">{percentRaised}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isClosed ? 'bg-slate-400' : 'bg-blue-600'
                        }`}
                        style={{ width: `${percentRaised}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                      <span>Target: ${project.targetAmount.toLocaleString()}</span>
                      <span>{isClosed ? 'Round closed' : 'Round open'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-5 pt-0">
                {isClosed ? (
                  <button
                    disabled
                    className="w-full py-3 bg-slate-100 text-slate-400 font-semibold rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Round closed</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenInvestModal(project)}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
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
