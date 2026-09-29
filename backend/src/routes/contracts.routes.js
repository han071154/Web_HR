import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

const contractFieldsSchema = z.object({
  contractNumber: z.string().trim().min(2).max(60),
  employeeId: z.string().uuid(),
  contractType: z.enum(['PROBATION', 'FIXED_TERM', 'INDEFINITE', 'SEASONAL']),
  startDate: dateSchema,
  endDate: dateSchema.optional().nullable(),
  signedDate: dateSchema.optional().nullable(),
  salary: z.coerce.number().min(0),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
  notes: z.string().trim().max(5000).optional().nullable()
});

const contractSchema = contractFieldsSchema.superRefine((contract, context) => {
  if (contract.endDate && contract.endDate < contract.startDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date must be on or after start date'
    });
  }
});

const contractSelectSql = `
  SELECT
    c.*,
    e.employee_code,
    e.full_name AS employee_name
  FROM employment_contracts c
  JOIN employees e ON e.id = c.employee_id
`;

function mapContract(row) {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    contractType: row.contract_type,
    startDate: row.start_date,
    endDate: row.end_date,
    signedDate: row.signed_date,
    salary: Number(row.salary),
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.get('/', async (req, res, next) => {
  try {
    const employeeId = String(req.query.employeeId || '').trim();
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    const values = [];
    const where = [];

    if (employeeId) {
      values.push(employeeId);
      where.push(`c.employee_id = $${values.length}`);
    }

    if (status) {
      values.push(status);
      where.push(`c.status = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      where.push(`(c.contract_number ILIKE $${values.length} OR e.employee_code ILIKE $${values.length} OR e.full_name ILIKE $${values.length})`);
    }

    const result = await query(
      `${contractSelectSql}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY c.start_date DESC, c.created_at DESC`,
      values
    );

    res.json({ data: result.rows.map(mapContract) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${contractSelectSql} WHERE c.id = $1`, [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Employment contract not found');
    }

    res.json({ data: mapContract(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), async (req, res, next) => {
  try {
    const body = contractSchema.parse(req.body);
    const result = await query(
      `INSERT INTO employment_contracts (
        contract_number, employee_id, contract_type, start_date, end_date,
        signed_date, salary, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        body.contractNumber,
        body.employeeId,
        body.contractType,
        body.startDate,
        body.endDate ?? null,
        body.signedDate ?? null,
        body.salary,
        body.status,
        body.notes ?? null
      ]
    );
    const created = await query(`${contractSelectSql} WHERE c.id = $1`, [result.rows[0].id]);

    res.status(201).json({ data: mapContract(created.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM employment_contracts WHERE id = $1', [req.params.id]);

    if (!current.rows[0]) {
      throw httpError(404, 'Employment contract not found');
    }

    const body = contractFieldsSchema.partial().parse(req.body);
    const row = current.rows[0];
    const contract = contractSchema.parse({
      contractNumber: Object.hasOwn(body, 'contractNumber') ? body.contractNumber : row.contract_number,
      employeeId: Object.hasOwn(body, 'employeeId') ? body.employeeId : row.employee_id,
      contractType: Object.hasOwn(body, 'contractType') ? body.contractType : row.contract_type,
      startDate: Object.hasOwn(body, 'startDate') ? body.startDate : row.start_date,
      endDate: Object.hasOwn(body, 'endDate') ? body.endDate : row.end_date,
      signedDate: Object.hasOwn(body, 'signedDate') ? body.signedDate : row.signed_date,
      salary: Object.hasOwn(body, 'salary') ? body.salary : row.salary,
      status: Object.hasOwn(body, 'status') ? body.status : row.status,
      notes: Object.hasOwn(body, 'notes') ? body.notes : row.notes
    });

    await query(
      `UPDATE employment_contracts
       SET contract_number = $1,
           employee_id = $2,
           contract_type = $3,
           start_date = $4,
           end_date = $5,
           signed_date = $6,
           salary = $7,
           status = $8,
           notes = $9,
           updated_at = NOW()
       WHERE id = $10`,
      [
        contract.contractNumber,
        contract.employeeId,
        contract.contractType,
        contract.startDate,
        contract.endDate ?? null,
        contract.signedDate ?? null,
        contract.salary,
        contract.status,
        contract.notes ?? null,
        req.params.id
      ]
    );
    const updated = await query(`${contractSelectSql} WHERE c.id = $1`, [req.params.id]);

    res.json({ data: mapContract(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM employment_contracts WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (!result.rows[0]) {
      throw httpError(404, 'Employment contract not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
