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
    brand: 'Demo',
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
  assert.match(queryText, /FROM vehicle v/);
  assert.match(queryText, /LEFT JOIN LATERAL/);
  assert.match(queryText, /o\.status = 'in_progress'/);
  assert.match(queryText, /WHERE v\.active = true/);
});

test('FR-01: aktywny pojazd bez transportu, trasy i GPS wraca z null', async t => {
  const row = {
    ...databaseRow(),
    vehicle_id: 'VH-NEW',
    registration: 'WX NEW01',
    brand: 'Iveco',
    model: 'S-Way',
    street: null,
    city: null,
    country: null,
    latitude: null,
    longitude: null,
    speed_kmh: null,
    location_updated_at: null,
    route_id: null,
    route_name: null,
    route_coordinates: null,
    order_id: null,
    order_route: null,
    order_status: null,
    planned_at: null,
    eta: null,
    eta_reliable: null,
    decision: null,
    decision_at: null,
  };
  const fleetStore = createFleetStore({ pool: { async query() { return { rows: [row] }; } }, now: () => now });
  const base = await listeningServer(t, { mode: 'postgres', fleetStore });
  const response = await fetch(`${base}/api/vehicles`);
  assert.equal(response.status, 200);
  const { vehicles } = await response.json();
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0].brand, 'Iveco');
  assert.equal(vehicles[0].order, null);
  assert.equal(vehicles[0].route, null);
  assert.equal(vehicles[0].location.latitude, null);
  assert.equal(vehicles[0].location.longitude, null);
  assert.equal(vehicles[0].location.updatedAt, null);
  assert.equal(vehicles[0].location.stale, null);
  assert.equal(vehicles[0].speedKmh, null);
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
  assert.match(index, /id="unassigned-vehicles"/);
});

function fleetFixture({ id, order = null, route = null, gps = null }) {
  return {
    id,
    registration: `REG-${id}`,
    brand: 'Test',
    model: 'Truck',
    speedKmh: gps ? 55 : null,
    location: {
      street: gps ? 'Street' : null,
      city: gps ? 'City' : null,
      country: gps ? 'Country' : null,
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      updatedAt: gps ? new Date(now).toISOString() : null,
      ageSeconds: gps ? 0 : null,
      stale: gps ? false : null,
    },
    route,
    order,
  };
}

test('interfejs floty: odświeżenie pokazuje nowe pojazdy, liczniki, brak GPS/trasy i markery', async () => {
  const ids = ['fleet-view', 'fleet-refresh', 'fleet-show-all', 'fleet-error', 'fleet-count',
    'active-transports', 'unassigned-vehicles', 'fleet-vehicles', 'fleet-details',
    'fleet-details-content', 'fleet-map', 'fleet-map-status'];
  const elements = Object.fromEntries(ids.map(id => [id, {
    children: [], listeners: {}, textContent: '', disabled: false, hidden: false,
    attributes: {}, className: '',
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    addEventListener(event, callback) { this.listeners[event] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  const markerLayers = [];
  const polylines = [];
  const featureGroup = () => {
    const group = {
      layers: [],
      addTo() { markerLayers.push(this); return this; },
      addLayer(layer) { this.layers.push(layer); return this; },
      clearLayers() { this.layers = []; },
      getLayers() { return this.layers; },
      getBounds() { return { isValid: () => this.layers.length > 0 }; },
    };
    return group;
  };
  const leaflet = {
    map: () => ({ setView() { return this; }, fitBounds() {} }),
    tileLayer: () => ({ on() { return this; }, addTo() { return this; } }),
    featureGroup,
    divIcon: options => options,
    marker: position => ({
      position,
      addTo(group) { group.addLayer(this); return this; },
      bindPopup(content) { this.popup = content; return this; },
      on() { return this; },
      setOpacity() {},
      openPopup() {},
    }),
    polyline: points => ({ points, addTo(group) { polylines.push(this); group.addLayer(this); return this; } }),
    latLngBounds: points => points,
  };
  let vehicles = [
    fleetFixture({
      id: 'VH-1',
      order: { id: 'TR-1', status: 'in_progress', eta: new Date(now).toISOString(), etaReliable: true, delayStatus: 'on_time' },
      route: { id: 'RT-1', name: 'Route 1', coordinates: [{ lat: 52, lng: 21 }, { lat: 50, lng: 20 }] },
      gps: { latitude: 52, longitude: 21 },
    }),
    fleetFixture({ id: 'VH-2' }),
  ];
  let requests = 0;
  const document = {
    getElementById: id => elements[id],
    createElement: () => ({
      children: [], textContent: '', className: '', attributes: {},
      append(...items) { this.children.push(...items); },
      addEventListener(event, callback) { this.listeners = this.listeners || {}; this.listeners[event] = callback; },
      setAttribute(name, value) { this.attributes[name] = value; },
    }),
    addEventListener() {},
  };
  const vm = require('node:vm');
  vm.runInNewContext(readFileSync('public/fleet.js', 'utf8'), {
    document,
    window: { L: leaflet },
    fetch: async url => {
      assert.equal(url, '/api/vehicles');
      requests++;
      return { ok: true, json: async () => ({ vehicles }) };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  assert.equal(elements['fleet-count'].textContent, 'Pojazdy: 2');
  assert.equal(elements['active-transports'].textContent, 'Aktywne transporty: 1');
  assert.equal(elements['unassigned-vehicles'].textContent, 'Bez zlecenia: 1');
  assert.equal(elements['fleet-vehicles'].children[1].children[1].disabled, true);
  assert.equal(markerLayers[0].getLayers().length, 1);

  vehicles = [
    ...vehicles,
    fleetFixture({ id: 'VH-3', gps: { latitude: 51, longitude: 19 } }),
  ];
  elements['fleet-refresh'].listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 2);
  assert.equal(elements['fleet-count'].textContent, 'Pojazdy: 3');
  assert.equal(elements['active-transports'].textContent, 'Aktywne transporty: 1');
  assert.equal(elements['unassigned-vehicles'].textContent, 'Bez zlecenia: 2');
  assert.equal(elements['fleet-vehicles'].children.length, 3);
  assert.equal(markerLayers[0].getLayers().length, 2);
  assert.equal(elements['fleet-vehicles'].children[1].children[0].children[1].textContent, 'Brak danych GPS');
  elements['fleet-vehicles'].children[0].children[1].listeners.click();
  assert.equal(polylines.length, 1);
});

test('serwer: nie serwuje starego osobnego widoku floty i posiada kafelki Leaflet', async t => {
  const base = await listeningServer(t, { mode: 'demo' });
  const old = await fetch(`${base}/monitoring-floty.html`);
  assert.equal(old.status, 404);
  const leaflet = await fetch(`${base}/leaflet/leaflet.css`);
  assert.equal(leaflet.status, 200);
  assert.match(leaflet.headers.get('content-type'), /text\/css/);
});
