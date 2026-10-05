import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.query.employeeId as string || '';
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
              CONCAT(r.first_name, ' ', r.last_name) as reviewer_name
       FROM performance_reviews pr
       JOIN employees e ON pr.employee_id = e.id
       JOIN employees r ON pr.reviewer_id = r.id
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
    const reviewerId = req.user?.employeeId;
    if (!reviewerId) throw new AppError('Only active employees / managers can submit reviews', 400);

    const {
      employeeId, cycle, period,
      taskCompletionRating, qualityRating, productivityRating,
      attendanceRating, communicationRating, teamworkRating, technicalRating,
      managerFeedback, strengths, areasForImprovement, goals
    } = req.body;

    if (!employeeId || !cycle || !period) {
      throw new AppError('Employee, review cycle, and period are required', 400);
    }

    const tScore = parseFloat(taskCompletionRating || '0');
    const qScore = parseFloat(qualityRating || '0');
    const pScore = parseFloat(productivityRating || '0');
    const aScore = parseFloat(attendanceRating || '0');
    const cScore = parseFloat(communicationRating || '0');
    const tmScore = parseFloat(teamworkRating || '0');
    const techScore = parseFloat(technicalRating || '0');

    const overallScore = Math.round(((tScore + qScore + pScore + aScore + cScore + tmScore + techScore) / 7) * 10) / 10;

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
        overallScore, managerFeedback || null, strengths || null, areasForImprovement || null, goals || null
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
