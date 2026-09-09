import React, { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { SEGMENTS } from '../../utils/constants';
import { SegmentId } from '../../types';
import { Award, Scale, Sparkles, Layers } from 'lucide-react';

export const CriteriaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'prelim' | 'final'>('all');

  const prelimSegments = [
    SEGMENTS[SegmentId.ProductionNumber],
    SEGMENTS[SegmentId.SchoolUniform],
    SEGMENTS[SegmentId.ProfessionalAttire],
    SEGMENTS[SegmentId.ModernBarong],
    SEGMENTS[SegmentId.PreliminaryQA],
  ];

  const finalSegments = [
    SEGMENTS[SegmentId.FinalQA],
  ];

  const displayedSegments = activeTab === 'all' 
    ? [...prelimSegments, ...finalSegments] 
    : activeTab === 'prelim' 
      ? prelimSegments 
      : finalSegments;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-heading-1 text-primary-900 font-display">Official Scoring Criteria</h1>
          <p className="text-neutral-500 mt-1">
            Segment breakdowns, criterion weights, and mathematical formulation for Mr. & Ms. IDSC 2026.
          </p>
        </div>

        {/* Tab Filter */}
        <div className="flex bg-neutral-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'all' 
                ? 'bg-white text-primary-900 shadow-sm' 
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            All Segments
          </button>
          <button
            onClick={() => setActiveTab('prelim')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'prelim' 
                ? 'bg-white text-primary-900 shadow-sm' 
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Preliminary (50%)
          </button>
          <button
            onClick={() => setActiveTab('final')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'final' 
                ? 'bg-white text-primary-900 shadow-sm' 
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Final Q&A (50%)
          </button>
        </div>
      </div>

      {/* Championship Formula Banner */}
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 text-white shadow-panel border border-gold-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold uppercase tracking-wider border border-gold-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Championship Formula
            </div>
            <h2 className="text-xl font-bold font-display text-white">50 / 50 Final Winner Calculation</h2>
            <p className="text-primary-100 text-sm max-w-2xl leading-relaxed">
              Top 3 winners (King & Queen, 1st & 2nd Runners-up) are determined exclusively by combining the cumulative Preliminary Score and the Final Q&A Score in equal 50% proportions.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-4 shrink-0">
            <div className="text-center">
              <div className="text-2xl font-black text-gold-400">50%</div>
              <div className="text-xs uppercase tracking-wide text-primary-100 mt-0.5">Preliminary Score</div>
            </div>
            <div className="text-xl font-light text-primary-200">+</div>
            <div className="text-center">
              <div className="text-2xl font-black text-gold-400">50%</div>
              <div className="text-xs uppercase tracking-wide text-primary-100 mt-0.5">Final Q&A Score</div>
            </div>
            <div className="text-xl font-light text-primary-200">=</div>
            <div className="text-center pl-2 border-l border-white/20">
              <div className="text-2xl font-black text-white">100%</div>
              <div className="text-xs uppercase tracking-wide text-gold-300 font-bold mt-0.5">Final Ranking</div>
            </div>
          </div>
        </div>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {displayedSegments.map((segment) => {
          const isFinal = segment.id === SegmentId.FinalQA;
          const isPrelimQA = segment.id === SegmentId.PreliminaryQA;

          return (
            <div 
              key={segment.id}
              className="bg-white rounded-xl shadow-panel border border-neutral-100 p-6 flex flex-col justify-between hover:border-gold-500/40 transition-all duration-200"
            >
              <div>
                {/* Segment Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-neutral-900 font-display">
                        {segment.label}
                      </h3>
                      {isFinal && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gold-100 text-gold-600 border border-gold-400/40">
                          Top 3 Finals
                        </span>
                      )}
                      {isPrelimQA && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-800 border border-primary-500/20">
                          Qualifier
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {isFinal 
                        ? 'Contributes 50% to overall Championship Score (Top 3 finalists only)'
                        : isPrelimQA 
                          ? 'Used for Top 3 finalist qualification and interview mastery'
                          : `Contributes ${(segment.preliminaryWeight * 100).toFixed(0)}% to the cumulative Preliminary Score`
                      }
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xl font-extrabold text-primary-800">
                      {isFinal ? '50%' : isPrelimQA ? 'Qualifier' : `${(segment.preliminaryWeight * 100).toFixed(0)}%`}
                    </span>
                    <div className="text-[10px] text-neutral-400 uppercase tracking-wider">
                      {isFinal ? 'Championship' : isPrelimQA ? 'Evaluation' : 'Prelim Weight'}
                    </div>
                  </div>
                </div>

                {/* Criteria Table */}
                <div className="mt-4 divide-y divide-neutral-100">
                  <div className="pb-2 flex justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    <span>Criterion</span>
                    <span>Weight</span>
                  </div>
                  {segment.criteria.map((crit) => (
                    <div key={crit.id} className="py-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-neutral-800">
                          {crit.label}
                        </span>
                        <span className="text-sm font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                          {(crit.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      {/* Weight progress bar */}
                      <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary-600 h-full rounded-full" 
                          style={{ width: `${crit.weight * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total weight footer */}
              <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                <span className="font-semibold text-neutral-700">Total Segment Weight</span>
                <span className="font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded">100% (Sum of Criteria)</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rules and Protocol Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-card flex gap-3">
          <Scale className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-neutral-800">Integer Input (1–100)</h4>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Judges score each criterion from 1 to 100 as whole integers. Weighted criterion totals are automatically computed by the system.
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-card flex gap-3">
          <Layers className="w-5 h-5 text-gold-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-neutral-800">High Precision Tabulation</h4>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Intermediate calculations are preserved up to 4 decimal places in Rust, with official rankings and reports rounded to 2 decimal places.
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-card flex gap-3">
          <Award className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-neutral-800">Independent Special Awards</h4>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Special titles (e.g. Best in Production Number) are determined per segment and never alter the cumulative Championship tally.
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};
