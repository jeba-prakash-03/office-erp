import React, { useState, useEffect } from 'react';
import { 
   Award, Plus, Star, Search, Filter, Calendar, 
   User, CheckCircle, TrendingUp, AlertTriangle, Sparkles
 } from 'lucide-react';
import { performanceApi } from '../../api/services';
import { PerformanceReview } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatsCard } from '../../components/ui/StatsCard';
import { PerformanceModal } from './PerformanceModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const PerformanceList: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showNotification } = useNotification();

  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewPeriodFilter, setReviewPeriodFilter] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await performanceApi.getAll({
        review_period: reviewPeriodFilter || undefined,
        page,
        limit: 15,
      });
      setReviews(res.data.data.reviews || res.data.data);
      if (res.data.data.pagination) {
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalRecords(res.data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to load performance reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [reviewPeriodFilter, page]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + Number(r.overall_rating || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  const highPerformers = reviews.filter((r) => Number(r.overall_rating || 0) >= 4.0).length;
  const needsAttention = reviews.filter((r) => Number(r.overall_rating || 0) < 3.0).length;

  const columns: Column<PerformanceReview>[] = [
    {
      header: 'Employee',
      accessor: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
            {(r.employee_name || 'E').charAt(0)}
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white block text-sm">
              {r.employee_name || `Employee #${r.employee_id}`}
            </span>
            <div className="text-xs text-slate-500">{r.employee_code || `EMP-${r.employee_id}`} • {r.designation || 'Staff'}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Review Cycle',
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          {r.review_period}
        </span>
      ),
    },
    {
      header: 'Competency Breakdown',
      accessor: (r) => (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
          <span className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">Tech: <strong className="text-slate-900 dark:text-white">{r.technical_skills}/5</strong></span>
          <span className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">Prod: <strong className="text-slate-900 dark:text-white">{r.productivity}/5</strong></span>
          <span className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">Comm: <strong className="text-slate-900 dark:text-white">{r.communication}/5</strong></span>
          <span className="bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">Team: <strong className="text-slate-900 dark:text-white">{r.teamwork}/5</strong></span>
        </div>
      ),
    },
    {
      header: 'Overall Rating',
      accessor: (r) => {
        const rating = Number(r.overall_rating || 0);
        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
        if (rating >= 4.5) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
        else if (rating >= 3.5) badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
        else if (rating < 3.0) badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';

        return (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs ${badgeColor}`}>
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{rating.toFixed(1)} / 5.0</span>
          </div>
        );
      },
    },
    {
      header: 'Appraiser',
      accessor: (r) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {r.reviewer_name || 'Management'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance & Appraisals"
        subtitle="Manage employee evaluations, competency benchmarks, appraisal cycles, and growth plans"
        action={
          hasPermission('performance.create') && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Appraisal Review
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Appraisals Recorded"
          value={totalRecords.toString()}
          icon={<Award className="w-6 h-6" />}
        />
        <StatsCard
          title="Company Average Rating"
          value={`${avgRating} / 5.0`}
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <StatsCard
          title="High Performers (≥ 4.0)"
          value={highPerformers.toString()}
          icon={<Sparkles className="w-6 h-6" />}
        />
        <StatsCard
          title="Needs Support (< 3.0)"
          value={needsAttention.toString()}
          icon={<AlertTriangle className="w-6 h-6" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Cycle Filter:
          </span>
          <select
            value={reviewPeriodFilter}
            onChange={(e) => {
              setReviewPeriodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Review Cycles</option>
            <option value="Q1 2026">Q1 2026</option>
            <option value="Q2 2026">Q2 2026</option>
            <option value="Q3 2026">Q3 2026</option>
            <option value="Q4 2026">Q4 2026</option>
            <option value="Annual 2026">Annual 2026</option>
          </select>
        </div>
        {reviewPeriodFilter && (
          <button
            onClick={() => setReviewPeriodFilter('')}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Clear Filter
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        keyField="id"
        loading={loading}
        emptyMessage="No performance appraisals recorded for the selected filter."
        pagination={{
          page,
          totalPages,
          totalRecords,
          onPageChange: setPage,
        }}
      />

      {modalOpen && (
        <PerformanceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchReviews}
        />
      )}
    </div>
  );
};

