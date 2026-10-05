import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.query.employeeId as string || req.query.employee_id as string || '';
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (req.query.myReviews === 'true' && req.user?.employeeId) {
      whereClause += ' AND pr.employee_id = ?';
      params.push(req.user.employeeId);
    } else if (employeeId) {
      whereClause += ' AND pr.employee_id = ?';
      params.push(employeeId);
    }

    const reviews = await query<any[]>(
      `SELECT pr.*, 
              e.employee_id as employee_code,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              e.designation,
              d.name as department_name,
              COALESCE(CONCAT(r.first_name, ' ', r.last_name), 'Executive Management') as reviewer_name
       FROM performance_reviews pr
       JOIN employees e ON pr.employee_id = e.id
       LEFT JOIN employees r ON pr.reviewer_id = r.id
       LEFT JOIN departments d ON e.department_id = d.id
       ${whereClause}
       ORDER BY pr.created_at DESC`,
      params
    );

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
}

export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    let reviewerId = req.user?.employeeId || null;
    if (!reviewerId && req.user?.id) {
      const empRows = await query<any[]>('SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', [req.user.id]);
      if (empRows.length > 0) reviewerId = empRows[0].id;
    }

    const employeeId = req.body.employeeId || req.body.employee_id;
    const period = req.body.period || req.body.review_period || req.body.reviewPeriod || 'Q1 2026';
    let cycle = req.body.cycle || 'quarterly';
    if (!req.body.cycle) {
      const pLow = period.toLowerCase();
      if (pLow.includes('month')) cycle = 'monthly';
      else if (pLow.includes('half') || pLow.includes('h1') || pLow.includes('h2')) cycle = 'half_yearly';
      else if (pLow.includes('annual') || pLow.includes('year')) cycle = 'yearly';
      else cycle = 'quarterly';
    }

    if (!employeeId) {
      throw new AppError('Employee selection is required', 400);
    }

    const tScore = parseFloat(req.body.taskCompletionRating || req.body.task_completion_rating || req.body.task_completion || req.body.technical_skills || '4.0');
    const qScore = parseFloat(req.body.qualityRating || req.body.quality_rating || req.body.productivity || '4.0');
    const pScore = parseFloat(req.body.productivityRating || req.body.productivity_rating || req.body.productivity || '4.0');
    const aScore = parseFloat(req.body.attendanceRating || req.body.attendance_rating || req.body.punctuality || '4.0');
    const cScore = parseFloat(req.body.communicationRating || req.body.communication_rating || req.body.communication || '4.0');
    const tmScore = parseFloat(req.body.teamworkRating || req.body.teamwork_rating || req.body.teamwork || '4.0');
    const techScore = parseFloat(req.body.technicalRating || req.body.technical_rating || req.body.technical_skills || '4.0');

    const calculatedAvg = Math.round(((tScore + qScore + pScore + aScore + cScore + tmScore + techScore) / 7) * 10) / 10;
    const overallScore = req.body.overall_rating || req.body.overallScore || req.body.overall_score || calculatedAvg;

    const managerFeedback = req.body.managerFeedback || req.body.manager_feedback || req.body.feedback || null;
    const strengths = req.body.strengths || null;
    const areasForImprovement = req.body.areasForImprovement || req.body.areas_for_improvement || null;
    const goals = req.body.goals || null;

    const reviewId = `perf-${uuidv4()}`;
    await query(
      `INSERT INTO performance_reviews (
        id, employee_id, reviewer_id, cycle, period,
        task_completion_rating, quality_rating, productivity_rating,
        attendance_rating, communication_rating, teamwork_rating, technical_rating,
        overall_score, manager_feedback, strengths, areas_for_improvement, goals, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())`,
      [
        reviewId, employeeId, reviewerId, cycle, period,
        tScore, qScore, pScore, aScore, cScore, tmScore, techScore,
        overallScore, managerFeedback, strengths, areasForImprovement, goals
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_PERFORMANCE_REVIEW',
      module: 'PERFORMANCE',
      recordId: reviewId,
      newValue: { employeeId, period, overallScore },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Performance review submitted successfully', data: { id: reviewId, overallScore } });
  } catch (error) {
    next(error);
  }
}
