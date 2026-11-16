const { evaluateDelay } = require('./delays');

const STALE_AFTER_MS = 30_000;
const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

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

function decodePolyline(encoded) {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('Google Routes API nie zwróciło poprawnej geometrii trasy.');
  }
  const coordinates = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  function readDelta() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      if (index >= encoded.length || shift > 30) {
        throw new Error('Google Routes API zwróciło nieprawidłową geometrię trasy.');
      }
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Google Routes API zwróciło nieprawidłową geometrię trasy.');
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
  while (index < encoded.length) {
    latitude += readDelta();
    longitude += readDelta();
    coordinates.push({ lat: latitude / 100_000, lng: longitude / 100_000 });
    if (coordinates.length > 10_000) throw new Error('Geometria trasy Google jest zbyt długa.');
  }
  return coordinates;
}

function mapFleetRow(row, nowMs) {
  const updatedAt = isoDate(row.location_updated_at);
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
  const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, nowMs - updatedAtMs) : null;
  const coordinates = row.route_coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error(`Nieprawidłowa geometria trasy pojazdu ${row.vehicle_id}.`);
  }

  const routeCoordinates = coordinates.map(point => ({
    lat: coordinate(point.lat, -90, 90, 'trasy'),
    lng: coordinate(point.lng, -180, 180, 'trasy'),
  }));
  const latitude = row.latitude === null ? null : coordinate(row.latitude, -90, 90, 'GPS');
  const longitude = row.longitude === null ? null : coordinate(row.longitude, -180, 180, 'GPS');
  const speedKmh = row.speed_kmh === null ? null : Number(row.speed_kmh);
  if (speedKmh !== null && (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 250)) {
    throw new Error(`Nieprawidłowa prędkość pojazdu ${row.vehicle_id}.`);
  }

  const order = evaluateDelay({
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
    model: row.model,
    speedKmh,
    location: {
      street: row.street,
      city: row.city,
      country: row.country,
      latitude,
      longitude,
      updatedAt,
      ageSeconds: ageMs === null ? null : Math.ceil(ageMs / 1000),
      stale: ageMs === null || ageMs > STALE_AFTER_MS,
    },
    route: {
      id: row.route_id,
      name: row.route_name,
      coordinates: routeCoordinates,
    },
    order: {
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
    },
  };
}

function createFleetStore({
  pool: suppliedPool,
  now = Date.now,
  routesApiKey = process.env.GOOGLE_ROUTES_API_KEY,
  fetchImpl = globalThis.fetch,
} = {}) {
  const getPool = () => suppliedPool || require('./database/db');
  return {
    async list() {
      const { rows } = await getPool().query(`
        SELECT v.id AS vehicle_id, v.registration, v.model,
               l.street, l.city, l.country, l.latitude, l.longitude,
               l.speed_kmh, l.updated_at AS location_updated_at,
               r.id AS route_id, r.name AS route_name, r.coordinates AS route_coordinates,
               o.id AS order_id, o.route AS order_route, o.status AS order_status,
               o.planned_at, o.eta, o.eta_reliable, o.decision, o.decision_at
        FROM vehicles v
        JOIN LATERAL (
          SELECT vr.id, vr.name, vr.coordinates, vr.order_id
          FROM vehicle_routes vr
          WHERE vr.vehicle_id = v.id AND vr.active = true
          ORDER BY vr.created_at DESC, vr.id
          LIMIT 1
        ) r ON true
        LEFT JOIN LATERAL (
          SELECT vl.street, vl.city, vl.country, vl.latitude, vl.longitude,
                 vl.speed_kmh, vl.updated_at
          FROM vehicle_locations vl
          WHERE vl.vehicle_id = v.id AND vl.route_id = r.id
          ORDER BY vl.updated_at DESC, vl.id DESC
          LIMIT 1
        ) l ON true
        JOIN transport_orders o ON o.id = r.order_id
        WHERE v.active = true
        ORDER BY v.id`);
      return rows.map(row => mapFleetRow(row, now()));
    },
    async roadRoute(vehicleId) {
      if (!routesApiKey) {
        const error = new Error('Opcjonalna usługa Google Routes API nie jest skonfigurowana.');
        error.statusCode = 503;
        throw error;
      }
      const { rows } = await getPool().query(`
        SELECT vr.name, vr.coordinates
        FROM vehicle_routes vr
        JOIN vehicles v ON v.id = vr.vehicle_id
        WHERE v.id = $1 AND v.active = true AND vr.active = true
        ORDER BY vr.created_at DESC, vr.id
        LIMIT 1`, [vehicleId]);
      if (!rows.length) return null;

      const points = rows[0].coordinates;
      if (!Array.isArray(points) || points.length < 2 || points.length > 12) {
        const error = new Error('Zapisana trasa nie spełnia wymagań Google Routes API.');
        error.statusCode = 422;
        throw error;
      }
      const routePoints = points.map(point => ({
        latitude: coordinate(point.lat, -90, 90, 'trasy'),
        longitude: coordinate(point.lng, -180, 180, 'trasy'),
      }));
      const response = await fetchImpl(ROUTES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': routesApiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          origin: { location: { latLng: routePoints[0] } },
          destination: { location: { latLng: routePoints[routePoints.length - 1] } },
          intermediates: routePoints.slice(1, -1).map(latLng => ({ location: { latLng } })),
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
          computeAlternativeRoutes: false,
          units: 'METRIC',
        }),
      });
      if (!response.ok) {
        const error = new Error('Google Routes API nie udostępniło trasy. Sprawdź klucz, rozliczenia i limity.');
        error.statusCode = 502;
        throw error;
      }
      const result = await response.json();
      const route = result.routes?.[0];
      if (!route?.polyline?.encodedPolyline) {
        const error = new Error('Google Routes API nie zwróciło trasy dla tego pojazdu.');
        error.statusCode = 502;
        throw error;
      }
      const coordinates = decodePolyline(route.polyline.encodedPolyline);
      if (coordinates.length < 2) {
        const error = new Error('Google Routes API zwróciło zbyt krótką geometrię trasy.');
        error.statusCode = 502;
        throw error;
      }
      coordinates.forEach(point => {
        coordinate(point.lat, -90, 90, 'trasy Google');
        coordinate(point.lng, -180, 180, 'trasy Google');
      });
      const distanceMeters = Number(route.distanceMeters);
      const durationSeconds = Number.parseFloat(route.duration);
      if (!Number.isFinite(distanceMeters) || distanceMeters < 0
        || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
        const error = new Error('Google Routes API zwróciło nieprawidłowy dystans lub czas trasy.');
        error.statusCode = 502;
        throw error;
      }
      return {
        name: rows[0].name,
        coordinates,
        distanceMeters,
        durationSeconds,
      };
    },
  };
}

module.exports = { createFleetStore, mapFleetRow, decodePolyline, STALE_AFTER_MS };
