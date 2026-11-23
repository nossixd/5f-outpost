const { evaluateDelay } = require('./delays');

const STALE_AFTER_MS = 30_000;

function isoDate(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function coordinate(value, minimum, maximum, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`Nieprawidłowa współrzędna ${name} w danych floty.`);
  }
  return number;
}

function mapFleetRow(row, nowMs) {
  const updatedAt = isoDate(row.location_updated_at);
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
  const hasGps = row.location_updated_at !== null && row.location_updated_at !== undefined
    || row.latitude !== null && row.latitude !== undefined
    || row.longitude !== null && row.longitude !== undefined;
  const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, nowMs - updatedAtMs) : null;
  const coordinates = Array.isArray(row.route_coordinates) && row.route_coordinates.length >= 2
    ? row.route_coordinates : null;
  const routeCoordinates = coordinates?.map(point => ({
    lat: coordinate(point.lat, -90, 90, 'trasy'),
    lng: coordinate(point.lng, -180, 180, 'trasy'),
  })) || null;
  const latitude = row.latitude === null || row.latitude === undefined ? null : coordinate(row.latitude, -90, 90, 'GPS');
  const longitude = row.longitude === null || row.longitude === undefined ? null : coordinate(row.longitude, -180, 180, 'GPS');
  const speedKmh = row.speed_kmh === null || row.speed_kmh === undefined ? null : Number(row.speed_kmh);
  if (speedKmh !== null && (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 250)) {
    throw new Error(`Nieprawidłowa prędkość pojazdu ${row.vehicle_id}.`);
  }

  const order = row.order_id === null || row.order_id === undefined ? null : evaluateDelay({
    id: row.order_id,
    route: row.order_route,
    plannedAt: isoDate(row.planned_at),
    eta: isoDate(row.eta),
    etaReliable: row.eta_reliable,
    decision: row.decision,
    decisionAt: isoDate(row.decision_at),
  }, 5);

  return {
    id: row.vehicle_id,
    registration: row.registration,
    brand: row.brand,
    model: row.model,
    speedKmh,
    location: {
      street: row.street,
      city: row.city,
      country: row.country,
      latitude,
      longitude,
      updatedAt,
      ageSeconds: !hasGps || ageMs === null ? null : Math.ceil(ageMs / 1000),
      stale: !hasGps ? null : ageMs === null || ageMs > STALE_AFTER_MS,
    },
    route: row.route_id === null || row.route_id === undefined ? null : {
      id: row.route_id,
      name: row.route_name || row.order_route || 'Trasa planowana',
      coordinates: routeCoordinates,
    },
    order: order ? {
      id: row.order_id,
      route: row.order_route,
      status: row.order_status,
      delayStatus: order.status,
      delayMinutes: order.delayMinutes,
      plannedAt: order.plannedAt,
      eta: order.eta,
      etaReliable: order.etaReliable,
      decision: order.decision,
      decisionAt: order.decisionAt,
      notification: order.notification,
    } : null,
  };
}

function createFleetStore({
  pool: suppliedPool,
  now = Date.now,
} = {}) {
  const getPool = () => suppliedPool || require('./database/db');
  return {
    async list() {
      const { rows } = await getPool().query(`
        SELECT COALESCE(v.legacy_vehicle_id, v.vehicle_id::text) AS vehicle_id,
               v.registration_number AS registration, v.brand, v.model,
               l.street, l.city, l.country, l.latitude, l.longitude,
               l.speed_kmh, l.recorded_at AS location_updated_at,
               COALESCE(r.legacy_route_id, r.route_id::text) AS route_id,
               o.route AS route_name, r.route_data AS route_coordinates,
               COALESCE(o.legacy_order_id, o.order_id::text) AS order_id,
               o.route AS order_route, o.status AS order_status,
               o.planned_at, o.eta, o.eta_reliable, o.decision, o.decision_at
        FROM vehicle v
        LEFT JOIN LATERAL (
          SELECT o.order_id, o.legacy_order_id, o.route, o.status, o.planned_at,
                 o.eta, o.eta_reliable, o.decision, o.decision_at, o.created_at
          FROM "order" o
          WHERE o.vehicle_id = v.vehicle_id AND o.status = 'in_progress'
          ORDER BY o.created_at DESC, o.order_id DESC
          LIMIT 1
        ) o ON true
        LEFT JOIN LATERAL (
          SELECT r.route_id, r.legacy_route_id, r.route_data
          FROM route r
          WHERE r.order_id = o.order_id AND r.active = true
          ORDER BY r.created_at DESC, r.route_id DESC
          LIMIT 1
        ) r ON true
        LEFT JOIN LATERAL (
          SELECT g.street, g.city, g.country, g.latitude, g.longitude,
                 g.speed_kmh, g.recorded_at
          FROM gps_location g
          WHERE g.vehicle_id = v.vehicle_id
          ORDER BY g.recorded_at DESC, g.location_id DESC
          LIMIT 1
        ) l ON true
        WHERE v.active = true
        ORDER BY v.vehicle_id`);
      return rows.map(row => mapFleetRow(row, now()));
    },
  };
}

module.exports = { createFleetStore, mapFleetRow, STALE_AFTER_MS };
