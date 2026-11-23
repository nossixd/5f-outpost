const { evaluateDelay } = require('./delays');
function approvalConflict() {
  const error = new Error('Nie można zatwierdzić opóźnienia bez wiarygodnej prognozy. Najpierw zaktualizuj ETA.');
  error.statusCode = 409; return error;
}
function completionConflict() {
  const error = new Error('Transport został już zakończony.');
  error.statusCode = 409;
  return error;
}
const initialOrders = [
  { id: 'TR-001', route: 'Warszawa → Kraków', plannedAt: '2026-11-02T14:00:00+01:00', eta: '2026-11-02T14:25:00+01:00', etaReliable: true, transportStatus: 'in_progress', completedAt: null, completedBy: null },
  { id: 'TR-002', route: 'Łódź → Poznań', plannedAt: '2026-11-02T15:00:00+01:00', eta: '2026-11-02T15:40:00+01:00', etaReliable: true, transportStatus: 'in_progress', completedAt: null, completedBy: null },
  { id: 'TR-003', route: 'Gdańsk → Toruń', plannedAt: '2026-11-02T16:00:00+01:00', eta: '2026-11-02T16:15:00+01:00', etaReliable: true, transportStatus: 'in_progress', completedAt: null, completedBy: null },
  { id: 'TR-004', route: 'Wrocław → Opole', plannedAt: '2026-11-02T17:00:00+01:00', eta: null, etaReliable: false, transportStatus: 'in_progress', completedAt: null, completedBy: null },
];
function mapDatabaseOrder(row) {
  return {
    id: row.id,
    route: row.route,
    plannedAt: row.planned_at?.toISOString() ?? null,
    eta: row.eta?.toISOString() ?? null,
    etaReliable: row.eta_reliable,
    decision: row.decision,
    decisionAt: row.decision_at?.toISOString() ?? null,
    transportStatus: row.status,
    completedAt: row.completed_at?.toISOString() ?? null,
    completedBy: row.completed_by ?? null,
  };
}
function createOrderStore(mode, { pool: suppliedPool } = {}) {
  const orders = structuredClone(initialOrders);
  const getPool = () => suppliedPool || require('./database/db');
  const orderIdPredicate = '(legacy_order_id = $1 OR (legacy_order_id IS NULL AND order_id::text = $1))';
  return {
    async list() {
      if (mode === 'demo') return structuredClone(orders);
      const { rows } = await getPool().query(
        `SELECT COALESCE(legacy_order_id, order_id::text) AS id, route, planned_at, eta,
                eta_reliable, decision, decision_at, status, completed_at, completed_by
         FROM "order" ORDER BY order_id`);
      return rows.map(mapDatabaseOrder);
    },
    async update(id, action, eta) {
      if (mode === 'demo') {
        const order = orders.find(order => order.id === id);
        if (!order) return false;
        if (action === 'approve' && evaluateDelay(order, 5).status !== 'at_risk') throw approvalConflict();
        if (action === 'reschedule') Object.assign(order, { eta, etaReliable: true, decision: null, decisionAt: null });
        else Object.assign(order, { decision: action === 'approve' ? 'approved' : 'rejected', decisionAt: new Date().toISOString(), etaReliable: action === 'approve' });
        return true;
      }
      const pool = getPool();
      if (action === 'approve') {
        const result = await pool.query(
          `UPDATE "order" SET decision = 'approved', decision_at = CURRENT_TIMESTAMP
           WHERE ${orderIdPredicate} AND eta_reliable = true AND decision IS DISTINCT FROM 'rejected'
           AND eta > planned_at + INTERVAL '5 minutes'`, [id]);
        if (result.rowCount > 0) return true;
        const existing = await pool.query(`SELECT order_id FROM "order" WHERE ${orderIdPredicate}`, [id]);
        if (!existing.rowCount) return false;
        throw approvalConflict();
      }
      const result = action === 'reschedule'
        ? await pool.query(`UPDATE "order" SET eta = $2, eta_reliable = true, decision = NULL, decision_at = NULL WHERE ${orderIdPredicate}`, [id, eta])
        : await pool.query(`UPDATE "order" SET decision = 'rejected', decision_at = CURRENT_TIMESTAMP, eta_reliable = false WHERE ${orderIdPredicate}`, [id]);
      return result.rowCount > 0;
    },
    async complete(id, completedBy = null) {
      if (mode === 'demo') {
        const order = orders.find(item => item.id === id);
        if (!order) return null;
        if (order.transportStatus === 'completed') throw completionConflict();
        order.transportStatus = 'completed';
        order.completedAt = new Date().toISOString();
        order.completedBy = completedBy;
        return structuredClone(order);
      }

      const pool = getPool();
      const result = await pool.query(
        `WITH updated AS (
         UPDATE "order"
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = $2
         WHERE ${orderIdPredicate} AND status = 'in_progress'
         RETURNING order_id, COALESCE(legacy_order_id, order_id::text) AS id, route,
                   planned_at, eta, eta_reliable, decision, decision_at, status,
                   completed_at, completed_by
         ), history AS (
           INSERT INTO order_status_history (order_id, old_status, new_status, changed_at, description)
           SELECT order_id, 'in_progress', 'completed', completed_at, 'Transport zakończony'
           FROM updated
           RETURNING history_id
         )
         SELECT updated.* FROM updated JOIN history ON true`,
        [id, completedBy]);
      if (result.rowCount) return mapDatabaseOrder(result.rows[0]);

      const existing = await pool.query(`SELECT status FROM "order" WHERE ${orderIdPredicate}`, [id]);
      if (!existing.rowCount) return null;
      throw completionConflict();
    },
  };
}
module.exports = { createOrderStore };
