const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const client = require('prom-client');

function createApp(dbPath = process.env.DB_PATH || './data/rental.db') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, type TEXT NOT NULL,
      price_per_day REAL NOT NULL, available INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS bookings(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL, customer TEXT NOT NULL,
      days INTEGER NOT NULL, total_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  if (db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n === 0) {
    const ins = db.prepare('INSERT INTO vehicles(name,type,price_per_day) VALUES(?,?,?)');
    [['Maruti Swift', 'car', 1500], ['Hyundai Creta', 'suv', 2500],
     ['Royal Enfield Classic 350', 'bike', 800], ['Honda Activa', 'scooter', 400],
     ['Toyota Innova', 'suv', 3500]].forEach((v) => ins.run(...v));
  }

  // ---- Prometheus metrics ----
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const httpRequests = new client.Counter({
    name: 'http_requests_total', help: 'Total HTTP requests',
    labelNames: ['method', 'endpoint', 'status'], registers: [register],
  });
  const httpLatency = new client.Histogram({
    name: 'http_request_duration_seconds', help: 'Request latency in seconds',
    labelNames: ['endpoint'], registers: [register],
  });
  const bookingsTotal = new client.Counter({
    name: 'rental_bookings_total', help: 'Total bookings created', registers: [register],
  });
  new client.Gauge({
    name: 'rental_vehicles_available', help: 'Vehicles currently available',
    registers: [register],
    collect() {
      this.set(db.prepare('SELECT COUNT(*) AS n FROM vehicles WHERE available=1').get().n);
    },
  });

  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const end = httpLatency.startTimer();
    res.on('finish', () => {
      if (req.path === '/metrics') return;
      const endpoint = req.route ? req.baseUrl + req.route.path : 'static';
      httpRequests.inc({ method: req.method, endpoint, status: res.statusCode });
      end({ endpoint });
    });
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.get('/api/vehicles', (_req, res) => {
    res.json(db.prepare('SELECT * FROM vehicles').all());
  });

  app.post('/api/vehicles', (req, res) => {
    const { name, type, price_per_day } = req.body || {};
    if (!name || !type || !(Number(price_per_day) > 0)) {
      return res.status(400).json({ error: 'name, type, price_per_day required' });
    }
    const r = db.prepare('INSERT INTO vehicles(name,type,price_per_day) VALUES(?,?,?)')
      .run(name, type, Number(price_per_day));
    res.status(201).json({ id: r.lastInsertRowid });
  });

  app.get('/api/bookings', (_req, res) => {
    res.json(db.prepare('SELECT * FROM bookings ORDER BY id DESC').all());
  });

  const book = db.transaction((vehicleId, customer, days) => {
    const v = db.prepare('SELECT * FROM vehicles WHERE id=?').get(vehicleId);
    if (!v) return { code: 404, error: 'vehicle not found' };
    if (!v.available) return { code: 409, error: 'vehicle not available' };
    const total = v.price_per_day * days;
    const r = db.prepare('INSERT INTO bookings(vehicle_id,customer,days,total_price) VALUES(?,?,?,?)')
      .run(vehicleId, customer, days, total);
    db.prepare('UPDATE vehicles SET available=0 WHERE id=?').run(vehicleId);
    return { code: 201, id: r.lastInsertRowid, total_price: total };
  });

  app.post('/api/bookings', (req, res) => {
    const { vehicle_id, customer } = req.body || {};
    const days = parseInt(req.body && req.body.days, 10);
    if (!vehicle_id || !customer || !(days > 0)) {
      return res.status(400).json({ error: 'vehicle_id, customer, days(>0) required' });
    }
    const out = book(Number(vehicle_id), customer, days);
    if (out.error) return res.status(out.code).json({ error: out.error });
    bookingsTotal.inc();
    res.status(201).json({ id: out.id, total_price: out.total_price });
  });

  app.post('/api/bookings/:id/return', (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
    if (!b) return res.status(404).json({ error: 'booking not found' });
    db.prepare("UPDATE bookings SET status='returned' WHERE id=?").run(b.id);
    db.prepare('UPDATE vehicles SET available=1 WHERE id=?').run(b.vehicle_id);
    res.json({ status: 'returned' });
  });

  // ---- Serve built React app ----
  const staticDir = process.env.STATIC_DIR || path.join(__dirname, 'public');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  return { app, db };
}

module.exports = { createApp };
