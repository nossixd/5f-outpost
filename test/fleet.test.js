const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createServer } = require('../src/server');
const { createFleetStore, mapFleetRow, STALE_AFTER_MS } = require('../src/fleet');

const now = Date.parse('2026-11-16T18:00:00.000Z');

function databaseRow(index = 0, ageMs = 0) {
  return {
    vehicle_id: `VH-00${index + 1}`,
    registration: `WX 000${index}`,
    model: 'Demo truck',
    street: 'Aleje Jerozolimskie',
    city: 'Warszawa',
    country: 'Polska',
    latitude: 52.2297 + index / 100,
    longitude: 21.0122 + index / 100,
    speed_kmh: 62.5 + index,
    location_updated_at: new Date(now - ageMs),
    route_id: `VR-00${index + 1}`,
    route_name: 'Warszawa → Kraków',
    route_coordinates: [{ lat: 52.2297, lng: 21.0122 }, { lat: 50.0647, lng: 19.945 }],
    order_id: `TR-00${index + 1}`,
    order_route: 'Warszawa → Kraków',
    order_status: 'in_progress',
    planned_at: new Date(now),
    eta: new Date(now + 20 * 60_000),
    eta_reliable: true,
    decision: null,
    decision_at: null,
  };
}

async function listeningServer(t, options) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('FR-01: adapter PostgreSQL zwraca pojazdy, GPS i ERD-route data', async t => {
  const rows = Array.from({ length: 5 }, (_, index) => databaseRow(index, index * 10_000));
  let queryText = '';
  const fleetStore = createFleetStore({
    pool: { async query(sql) { queryText = sql; return { rows }; } },
    now: () => now,
  });
  const base = await listeningServer(t, { mode: 'postgres', fleetStore });
  const response = await fetch(`${base}/api/vehicles`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.vehicles.length, 5);
  assert.equal(data.vehicles[0].speedKmh, 62.5);
  assert.equal(data.vehicles[0].location.latitude, 52.2297);
  assert.equal(data.vehicles[0].order.id, 'TR-001');
  assert.equal(data.vehicles[0].route.coordinates.length, 2);
  assert.match(queryText, /FROM vehicle v/);
  assert.match(queryText, /FROM gps_location g/);
  assert.match(queryText, /FROM route r/);
  assert.match(queryText, /JOIN "order" o/);
});

test('FR-01: prog świeżości GPS pozostaje 30 sekund', () => {
  assert.equal(mapFleetRow(databaseRow(0, 30_000), now).location.stale, false);
  assert.equal(mapFleetRow(databaseRow(1, 30_001), now).location.stale, true);
  assert.equal(mapFleetRow({ ...databaseRow(2), location_updated_at: null }, now).location.updatedAt, null);
  assert.equal(STALE_AFTER_MS, 30_000);
});

test('FR-01: tryb demo nie tworzy fikcyjnej listy pojazdów', async t => {
  const demo = await listeningServer(t, { mode: 'demo' });
  const response = await fetch(`${demo}/api/vehicles`);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /DATA_SOURCE=postgres/);
});

test('frontend: jedna zakładka używa Leaflet i nie ma linku Google ani Monitoring floty', () => {
  const index = readFileSync('public/index.html', 'utf8');
  const fleet = readFileSync('public/fleet.js', 'utf8');
  const server = readFileSync('src/server.js', 'utf8');
  assert.match(index, /leaflet\.css/);
  assert.match(index, /leaflet\.js/);
  assert.match(index, /id="fleet-view"/);
  assert.doesNotMatch(index, /Monitoring floty/);
  assert.doesNotMatch(index, /Google Maps|googleapis|AdvancedMarkerElement|InfoWindow/);
  assert.match(fleet, /L\.map/);
  assert.match(fleet, /L\.tileLayer/);
  assert.match(fleet, /L\.polyline/);
  assert.match(fleet, /L\.popup|bindPopup/);
  assert.match(fleet, /L\.featureGroup/);
  assert.match(fleet, /fitBounds/);
  assert.match(fleet, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(fleet, /attribution:.*openstreetmap\.org\/copyright/);
  assert.match(fleet, /bindPopup\(popupContent\(vehicle\)\)/);
  assert.match(fleet, /element\.textContent = value/);
  assert.doesNotMatch(fleet, /bindPopup\(\s*`/);
  assert.doesNotMatch(server, /routes\.googleapis\.com|GOOGLE_/);
  assert.match(server, /img-src[^;]*tile\.openstreetmap\.org/);
  assert.match(server, /connect-src[^;]*tile\.openstreetmap\.org/);
});

test('serwer: nie serwuje starego osobnego widoku floty i posiada kafelki Leaflet', async t => {
  const base = await listeningServer(t, { mode: 'demo' });
  const old = await fetch(`${base}/monitoring-floty.html`);
  assert.equal(old.status, 404);
  const leaflet = await fetch(`${base}/leaflet/leaflet.css`);
  assert.equal(leaflet.status, 200);
  assert.match(leaflet.headers.get('content-type'), /text\/css/);
});
