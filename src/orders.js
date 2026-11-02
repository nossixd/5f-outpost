const demoOrders = [
  { id: 'TR-001', route: 'Warszawa → Kraków', plannedAt: '2026-11-02T14:00:00+01:00', eta: '2026-11-02T14:25:00+01:00', etaReliable: true },
  { id: 'TR-002', route: 'Łódź → Poznań', plannedAt: '2026-11-02T15:00:00+01:00', eta: '2026-11-02T14:55:00+01:00', etaReliable: true },
  { id: 'TR-003', route: 'Gdańsk → Toruń', plannedAt: '2026-11-02T16:00:00+01:00', eta: null, etaReliable: false },
  { id: 'TR-004', route: 'Wrocław → Opole', plannedAt: '2026-11-02T17:00:00+01:00', eta: '2026-11-02T17:40:00+01:00', etaReliable: false },
];
async function loadOrders(mode) {
  if (mode === 'demo') return demoOrders;
  const pool = require('./database/db');
  const { rows } = await pool.query('SELECT id, route, planned_at, eta, eta_reliable FROM transport_orders ORDER BY id');
  return rows.map(row => ({ id: row.id, route: row.route, plannedAt: row.planned_at?.toISOString() ?? null,
    eta: row.eta?.toISOString() ?? null, etaReliable: row.eta_reliable }));
}
module.exports = { loadOrders };
