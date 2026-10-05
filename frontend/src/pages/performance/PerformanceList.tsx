import React, { useState, useEffect } from 'react';
import { 
  Award, Plus, Star, Search, Filter, Calendar, 
  User, CheckCircle, TrendingUp 
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

  const columns: Column<PerformanceReview>[] = [
    {
      header: 'Employee',
      accessor: (r) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">
            {r.employee_name || `Employee #${r.employee_id}`}
          </span>
          <div className="text-xs text-slate-500">{r.employee_code} • {r.designation}</div>
        </div>
      ),
    },
    {
      header: 'Period',
      accessor: (r) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
          {r.review_period}
        </span>
      ),
    },
    {
      header: 'Score Breakdown',
      accessor: (r) => (
        <div className="text-xs text-slate-600 dark:text-slate-400 space-x-2">
          <span>Tech: <b>{r.technical_skills}/5</b></span>
          <span>Prod: <b>{r.productivity}/5</b></span>
          <span>Comm: <b>{r.communication}/5</b></span>
          <span>Team: <b>{r.teamwork}/5</b></span>
        </div>
      ),
    },
    {
      header: 'Overall Rating',
      accessor: (r) => (
        <div className="flex items-center gap-1.5 font-bold text-amber-500">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span className="text-sm">{Number(r.overall_rating || 0).toFixed(1)} / 5.0</span>
        </div>
      ),
    },
    {
      header: 'Reviewer',
      accessor: (r) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {r.reviewer_name || 'Management'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance & Appraisals"
        subtitle="Manage quarterly evaluations, KPI metrics, competency scoring, and employee growth"
        action={
          hasPermission('performance.create') && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Appraisal Review
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Total Appraisals Conducted"
          value={totalRecords.toString()}
          icon={<Award className="w-6 h-6" />}
        />
        <StatsCard
          title="Company Performance Average"
          value={`${avgRating} / 5.0`}
          icon={<TrendingUp className="w-6 h-6" />}
        />
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        keyField="id"
        loading={loading}
        emptyMessage="No performance reviews recorded."
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
