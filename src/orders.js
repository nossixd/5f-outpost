const initialOrders = [
  { id: 'TR-001', route: 'Warszawa → Kraków', plannedAt: '2026-11-02T14:00:00+01:00', eta: '2026-11-02T14:25:00+01:00', etaReliable: true },
  { id: 'TR-002', route: 'Łódź → Poznań', plannedAt: '2026-11-02T15:00:00+01:00', eta: '2026-11-02T15:40:00+01:00', etaReliable: true },
  { id: 'TR-003', route: 'Gdańsk → Toruń', plannedAt: '2026-11-02T16:00:00+01:00', eta: '2026-11-02T16:15:00+01:00', etaReliable: true },
  { id: 'TR-004', route: 'Wrocław → Opole', plannedAt: '2026-11-02T17:00:00+01:00', eta: null, etaReliable: false },
];
function createOrderStore(mode) {
  const orders = structuredClone(initialOrders);
  return {
    async list() {
      if (mode === 'demo') return structuredClone(orders);
      const pool = require('./database/db');
      const { rows } = await pool.query('SELECT id, route, planned_at, eta, eta_reliable, decision, decision_at FROM transport_orders ORDER BY id');
      return rows.map(row => ({ id: row.id, route: row.route, plannedAt: row.planned_at?.toISOString() ?? null,
        eta: row.eta?.toISOString() ?? null, etaReliable: row.eta_reliable, decision: row.decision, decisionAt: row.decision_at?.toISOString() ?? null }));
    },
    async update(id, action, eta) {
      if (mode === 'demo') {
        const order = orders.find(order => order.id === id);
        if (!order) return false;
        if (action === 'reschedule') Object.assign(order, { eta, etaReliable: true, decision: null, decisionAt: null });
        else Object.assign(order, { decision: action === 'approve' ? 'approved' : 'rejected', decisionAt: new Date().toISOString() });
        return true;
      }
      const pool = require('./database/db');
      const result = action === 'reschedule'
        ? await pool.query('UPDATE transport_orders SET eta = $2, eta_reliable = true, decision = NULL, decision_at = NULL WHERE id = $1', [id, eta])
        : await pool.query('UPDATE transport_orders SET decision = $2, decision_at = CURRENT_TIMESTAMP WHERE id = $1', [id, action === 'approve' ? 'approved' : 'rejected']);
      return result.rowCount > 0;
    },
  };
}
module.exports = { createOrderStore };
