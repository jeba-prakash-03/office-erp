import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const category = req.query.category as string || '';
    const entityType = req.query.entityType as string || '';
    const entityId = req.query.entityId as string || '';
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Client portal isolation
    if (req.user?.roleName === 'client' && req.user?.clientId) {
      whereClause += ' AND doc.entity_type = "client" AND doc.entity_id = ?';
      params.push(req.user.clientId);
    }

    if (search) {
      whereClause += ' AND doc.title LIKE ?';
      params.push(`%${search}%`);
    }
    if (category) {
      whereClause += ' AND doc.category = ?';
      params.push(category);
    }
    if (entityType) {
      whereClause += ' AND doc.entity_type = ?';
      params.push(entityType);
    }
    if (entityId) {
      whereClause += ' AND doc.entity_id = ?';
      params.push(entityId);
    }

    const countRows = await query<any[]>(`SELECT COUNT(*) as total FROM documents doc ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT doc.*, 
             CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM documents doc
      LEFT JOIN users u ON doc.uploaded_by_user_id = u.id
      ${whereClause}
      ORDER BY doc.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const documents = await query<any[]>(dataSql, [...params, limit, offset]);

    res.json({
      success: true,
      data: documents,
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

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, category, entityType, entityId, version, expiryDate } = req.body;
    const file = req.file;

    if (!file) throw new AppError('File upload required', 400);
    if (!title) throw new AppError('Document title is required', 400);

    const docId = `doc-${uuidv4()}`;
    const fileUrl = `/uploads/${file.filename}`;

    await query(
      `INSERT INTO documents (
        id, title, category, file_url, file_size, mime_type, entity_type,
        entity_id, version, expiry_date, uploaded_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        docId, title.trim(), category || 'company', fileUrl, file.size, file.mimetype,
        entityType || null, entityId || null, version || '1.0', expiryDate || null, req.user!.id
      ]
    );

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPLOAD_DOCUMENT',
      module: 'DOCUMENTS',
      recordId: docId,
      newValue: { title, category, fileUrl },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Document uploaded successfully', data: { id: docId, fileUrl } });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await query('DELETE FROM documents WHERE id = ?', [id]);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
}
