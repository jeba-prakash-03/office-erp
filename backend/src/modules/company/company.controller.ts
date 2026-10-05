import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLogger';

export async function getCompanySettings(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await query<any[]>('SELECT * FROM company_settings LIMIT 1');
    if (rows.length === 0) {
      return res.json({ success: true, data: {} });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
}

export async function updateCompanySettings(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      companyName, companyEmail, phone, website, address, city, state, country, postalCode,
      logoUrl, gstNumber, panNumber, cinNumber, taxId, currency, currencySymbol, timezone,
      workingDaysPerWeek, standardHoursPerDay, payrollPayDate
    } = req.body;

    const existing = await query<any[]>('SELECT * FROM company_settings LIMIT 1');
    const id = existing.length > 0 ? existing[0].id : 'company-settings-001';

    if (existing.length === 0) {
      await query(
        `INSERT INTO company_settings (
          id, company_name, company_email, phone, website, address, city, state, country, postal_code,
          logo_url, gst_number, pan_number, cin_number, tax_id, currency, currency_symbol, timezone,
          working_days_per_week, standard_hours_per_day, payroll_pay_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id, companyName || '', companyEmail || '', phone || null, website || null,
          address || null, city || null, state || null, country || null, postalCode || null,
          logoUrl || null, gstNumber || null, panNumber || null, cinNumber || null, taxId || null,
          currency || 'USD', currencySymbol || '$', timezone || 'UTC',
          workingDaysPerWeek || 5, standardHoursPerDay || 8.0, payrollPayDate || 1
        ]
      );
    } else {
      await query(
        `UPDATE company_settings 
         SET company_name = COALESCE(?, company_name),
             company_email = COALESCE(?, company_email),
             phone = COALESCE(?, phone),
             website = COALESCE(?, website),
             address = COALESCE(?, address),
             city = COALESCE(?, city),
             state = COALESCE(?, state),
             country = COALESCE(?, country),
             postal_code = COALESCE(?, postal_code),
             logo_url = COALESCE(?, logo_url),
             gst_number = COALESCE(?, gst_number),
             pan_number = COALESCE(?, pan_number),
             cin_number = COALESCE(?, cin_number),
             tax_id = COALESCE(?, tax_id),
             currency = COALESCE(?, currency),
             currency_symbol = COALESCE(?, currency_symbol),
             timezone = COALESCE(?, timezone),
             working_days_per_week = COALESCE(?, working_days_per_week),
             standard_hours_per_day = COALESCE(?, standard_hours_per_day),
             payroll_pay_date = COALESCE(?, payroll_pay_date)
         WHERE id = ?`,
        [
          companyName, companyEmail, phone, website, address, city, state, country, postalCode,
          logoUrl, gstNumber, panNumber, cinNumber, taxId, currency, currencySymbol, timezone,
          workingDaysPerWeek, standardHoursPerDay, payrollPayDate, id
        ]
      );
    }

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userName: `${req.user?.firstName} ${req.user?.lastName}`,
      action: 'UPDATE_COMPANY_SETTINGS',
      module: 'SETTINGS',
      recordId: id,
      newValue: req.body,
      ipAddress: req.ip,
    });

    const updated = await query<any[]>('SELECT * FROM company_settings WHERE id = ?', [id]);
    res.json({ success: true, message: 'Company settings updated successfully', data: updated[0] });
  } catch (error) {
    next(error);
  }
}
