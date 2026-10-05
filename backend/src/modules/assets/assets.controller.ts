import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listAssets(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const search = req.query.search as string || '';
    const category = req.query.category as string || '';
    const status = req.query.status as string || '';
    const assignedEmployeeId = req.query.assignedEmployeeId as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (a.name LIKE ? OR a.asset_code LIKE ? OR a.serial_number LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (category) {
      whereClause += ' AND a.category = ?';
      params.push(category);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }
    if (assignedEmployeeId) {
      whereClause += ' AND a.assigned_employee_id = ?';
      params.push(assignedEmployeeId);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM assets a ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT a.*, 
             e.employee_id as employee_code,
             CONCAT(e.first_name, ' ', e.last_name) as assigned_employee_name,
             e.profile_photo as assigned_employee_photo,
             d.name as department_name
      FROM assets a
      LEFT JOIN employees e ON a.assigned_employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const assets = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const { assetCode, name, category, serialNumber, purchaseDate, purchaseCost, warrantyExpiryDate, status, location, notes } = req.body;

    if (!name || !category) throw new AppError('Asset name and category are required', 400);

    const code = assetCode || `AST-${Math.floor(1000 + Math.random() * 9000)}`;
    const assetId = `ast-${uuidv4()}`;

    await query(
      `INSERT INTO assets (
        id, asset_code, name, category, serial_number, purchase_date, purchase_cost,
        warranty_expiry_date, status, location, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        assetId, code, name.trim(), category, serialNumber || null, purchaseDate || null,
        purchaseCost || 0.00, warrantyExpiryDate || null, status || 'available', location || null, notes || null
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'CREATE_ASSET',
      module: 'ASSETS',
      recordId: assetId,
      newValue: { assetCode: code, name, category },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Asset created successfully', data: { id: assetId } });
  } catch (error) {
    next(error);
  }
}

export async function assignAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { employeeId, conditionOnAssignment, notes } = req.body;

    if (!employeeId) throw new AppError('Employee is required for assignment', 400);

    await withTransaction(async (conn) => {
      await conn.query(
        'UPDATE assets SET assigned_employee_id = ?, status = "assigned" WHERE id = ?',
        [employeeId, id]
      );

      await conn.query(
        `INSERT INTO asset_assignments (id, asset_id, employee_id, assigned_at, condition_on_assignment, assigned_by_user_id, notes, created_at)
         VALUES (?, ?, ?, CURDATE(), ?, ?, ?, NOW())`,
        [uuidv4(), id, employeeId, conditionOnAssignment || 'Good', req.user!.id, notes || null]
      );
    });

    res.json({ success: true, message: 'Asset assigned to employee successfully' });
  } catch (error) {
    next(error);
  }
}

export async function returnAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { conditionOnReturn, notes } = req.body;

    await withTransaction(async (conn) => {
      await conn.query('UPDATE assets SET assigned_employee_id = NULL, status = "available" WHERE id = ?', [id]);

      await conn.query(
        `UPDATE asset_assignments 
         SET returned_at = CURDATE(), condition_on_return = ?, notes = COALESCE(?, notes)
         WHERE asset_id = ? AND returned_at IS NULL`,
        [conditionOnReturn || 'Good', notes, id]
      );
    });

    res.json({ success: true, message: 'Asset marked as returned' });
  } catch (error) {
    next(error);
  }
}

export async function deleteAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM assets WHERE id = ?', [id]);
    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    next(error);
  }
}
