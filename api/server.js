// ===== RTK Rental — Node.js HTTP Server =====
// Pure Node.js, no external dependencies.

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

// ── .ENV LOADER (no dotenv needed) ──────────────────────────────────────────
(function loadEnv() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
  console.log('[env] Loaded .env file');
})();

// ── PATHS & CONFIG ──────────────────────────────────────────────────────────
const ROOT_DIR          = path.join(__dirname, '..');
const IS_VERCEL         = !!process.env.VERCEL;
const DATA_DIR          = IS_VERCEL ? '/tmp/data' : path.join(ROOT_DIR, 'data');
const PRODUCTS_SEED_FILE = path.join(ROOT_DIR, 'data', 'products.js');
const PRODUCTS_DB_FILE  = path.join(DATA_DIR, 'products.db.json');
const BOOKINGS_DB_FILE  = path.join(DATA_DIR, 'bookings.db.json');
const BLACKLIST_DB_FILE = path.join(DATA_DIR, 'blacklist.db.json');
const TRACKING_DB_FILE  = path.join(DATA_DIR, 'tracking.db.json');
const USERS_DB_FILE     = path.join(DATA_DIR, 'users.db.json');
const CUSTOMERS_DB_FILE = path.join(DATA_DIR, 'customers.db.json');
const UPLOADS_DIR       = path.join(DATA_DIR, 'uploads');

const PORT           = Number(process.env.PORT || 3000);
const API_KEY        = process.env.RTK_API_KEY || 'rtk-internal-key-change-me';
const JWT_SECRET     = process.env.JWT_SECRET || 'rtk-jwt-secret-change-me';

// ── MIME TYPES ──────────────────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ── CORS HEADERS (allow admin panel on same origin, and dev localhost) ───────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

// ── LOGGING ─────────────────────────────────────────────────────────────────
function log(method, path, status) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${method.padEnd(7)} ${String(status).padStart(3)}  ${path}`);
}

// ── RESPONSE HELPERS ─────────────────────────────────────────────────────────
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type':   'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...CORS_HEADERS,
  });
  res.end(body);
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...CORS_HEADERS,
  });
  res.end(message);
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
// Note: apiKeyAuth is defined below to support role-based validation.

// ── FILE HELPERS ─────────────────────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[readJson] Failed to parse ${filePath}:`, err.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── SEED EXTRACTION ──────────────────────────────────────────────────────────
// Robust parser: reads from `const initialProducts = [` to the closing `];`
function extractSeedProducts() {
  if (!fs.existsSync(PRODUCTS_SEED_FILE)) {
    console.warn('[seed] products.js seed file not found — starting with empty catalog.');
    return [];
  }
  try {
    const content = fs.readFileSync(PRODUCTS_SEED_FILE, 'utf-8');

    // Find the start of the array literal
    const startIdx = content.indexOf('const initialProducts = [');
    if (startIdx === -1) {
      console.warn('[seed] Could not find `const initialProducts = [` in products.js');
      return [];
    }

    const arrayStart = content.indexOf('[', startIdx);

    // Walk the string to find the matching closing bracket
    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < content.length; i++) {
      const ch = content[i];
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) { arrayEnd = i; break; }
      }
    }

    if (arrayEnd === -1) {
      console.warn('[seed] Could not find closing `]` for initialProducts array.');
      return [];
    }

    const arrayStr = content.slice(arrayStart, arrayEnd + 1);
    const parsed = JSON.parse(arrayStr);
    console.log(`[seed] Extracted ${parsed.length} products from products.js`);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[seed] Failed to extract seed products:', err.message);
    return [];
  }
}

// ── DB INITIALISATION ────────────────────────────────────────────────────────
function ensureDbFiles() {
  ensureDataDir();

  if (IS_VERCEL) {
    const filesToCopy = [
      'products.db.json',
      'bookings.db.json',
      'blacklist.db.json',
      'tracking.db.json',
      'users.db.json',
      'customers.db.json'
    ];
    for (const file of filesToCopy) {
      const src = path.join(ROOT_DIR, 'data', file);
      const dest = path.join(DATA_DIR, file);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        try {
          fs.copyFileSync(src, dest);
          console.log(`[init] Copied ${file} to /tmp/data`);
        } catch (err) {
          console.error(`[init] Failed to copy ${file}:`, err.message);
        }
      }
    }
  }

  if (!fs.existsSync(PRODUCTS_DB_FILE) || fs.readFileSync(PRODUCTS_DB_FILE, 'utf-8').trim() === '[]' || fs.readFileSync(PRODUCTS_DB_FILE, 'utf-8').trim() === '') {
    const seed = extractSeedProducts();
    if (seed.length > 0) {
      writeJson(PRODUCTS_DB_FILE, seed);
      console.log(`[init] Seeded products.db.json with ${seed.length} products.`);
    } else {
      writeJson(PRODUCTS_DB_FILE, []);
    }
  }

  if (!fs.existsSync(BOOKINGS_DB_FILE)) {
    writeJson(BOOKINGS_DB_FILE, []);
    console.log('[init] Created empty bookings.db.json.');
  }

  if (!fs.existsSync(BLACKLIST_DB_FILE)) {
    writeJson(BLACKLIST_DB_FILE, []);
    console.log('[init] Created empty blacklist.db.json.');
  }

  if (!fs.existsSync(TRACKING_DB_FILE)) {
    writeJson(TRACKING_DB_FILE, []);
    console.log('[init] Created empty tracking.db.json.');
  }

  if (!fs.existsSync(USERS_DB_FILE)) {
    writeJson(USERS_DB_FILE, [
      { id: 'u1', username: 'admin', password: 'rtk2024admin', role: 'admin' },
      { id: 'u2', username: 'staff', password: 'rtk2024staff', role: 'staff' }
    ]);
    console.log('[init] Created default users.db.json (admin and staff).');
  }

  if (!fs.existsSync(CUSTOMERS_DB_FILE)) {
    writeJson(CUSTOMERS_DB_FILE, []);
    console.log('[init] Created empty customers.db.json.');
  }
}

// ── BODY PARSER ───────────────────────────────────────────────────────────────
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ── STATIC FILE SERVER ────────────────────────────────────────────────────────
function serveStatic(reqPath, res) {
  let safePath = reqPath === '/' ? '/index.html' : reqPath;
  try { safePath = decodeURIComponent(safePath); } catch (_) {}
  
  let absolutePath;
  if (safePath.startsWith('/data/')) {
    absolutePath = path.normalize(path.join(DATA_DIR, safePath.slice(6)));
  } else {
    absolutePath = path.normalize(path.join(ROOT_DIR, safePath));
  }

  // Security check: ensure path is within ROOT_DIR or DATA_DIR
  const inRootDir = absolutePath.startsWith(ROOT_DIR + path.sep) || absolutePath === ROOT_DIR;
  const inDataDir = absolutePath.startsWith(DATA_DIR + path.sep) || absolutePath === DATA_DIR;
  if (!inRootDir && !inDataDir) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.stat(absolutePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendText(res, 404, 'Not Found');
      return;
    }
    const ext  = path.extname(absolutePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, ...CORS_HEADERS });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

// ── ID GENERATOR ──────────────────────────────────────────────────────────────
function genId(prefix) {
  return prefix + Math.random().toString(36).substr(2, 9);
}

// ── VALIDATORS ────────────────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'kamera-digital', 'action-cam', 'dslr', 'mirrorless',
  'camcorder', 'lensa', 'aksesoris', 'paket',
];

function validateProduct(data) {
  const errors = [];
  if (!data.name || String(data.name).trim() === '')
    errors.push('name wajib diisi');
  if (!data.normalPrice || Number(data.normalPrice) <= 0)
    errors.push('normalPrice harus lebih dari 0');
  if (!data.category || !VALID_CATEGORIES.includes(data.category))
    errors.push(`category tidak valid — pilih salah satu: ${VALID_CATEGORIES.join(', ')}`);
  return errors;
}

function validateBooking(data) {
  const errors = [];
  if (!data.customerName || String(data.customerName).trim() === '')
    errors.push('customerName wajib diisi');
  if (!data.customerPhone || String(data.customerPhone).trim() === '')
    errors.push('customerPhone wajib diisi');
  if (!data.startDate) errors.push('startDate wajib diisi (YYYY-MM-DD)');
  if (!data.endDate)   errors.push('endDate wajib diisi (YYYY-MM-DD)');
  if (data.startDate && data.endDate && data.startDate > data.endDate)
    errors.push('startDate tidak boleh setelah endDate');
  if (!Array.isArray(data.items) || data.items.length === 0)
    errors.push('items harus berisi minimal 1 produk');
  return errors;
}

// ── SIMPLE JWT HELPERS (no external deps) ─────────────────────────────────────
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function signToken(payload, expiresInHours = 24) {
  const header  = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  payload.iat   = Math.floor(Date.now() / 1000);
  payload.exp   = payload.iat + (expiresInHours * 3600);
  const body    = base64url(JSON.stringify(payload));
  const sig     = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// Auth: returns role string ('admin' or 'staff') if valid, else false
function apiKeyAuth(req) {
  const key = req.headers['x-api-key'] || '';
  if (key === API_KEY) return 'admin';
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload && payload.role) return payload.role;
  }
  // Also check x-api-key as JWT
  const legacyPayload = verifyToken(key);
  if (legacyPayload && legacyPayload.role) return legacyPayload.role;
  return false;
}

// ── BOOKING CONFLICT CHECKER ──────────────────────────────────────────────────
// Returns array of conflict objects { productId, name, requested, available }
// excludeBookingId: skip a booking when checking (used for edits)
function checkBookingConflicts(newItems, startDate, endDate, allBookings, allProducts, excludeBookingId = null) {
  const conflicts = [];

  for (const item of newItems) {
    if (!item.productId) continue;
    const product = allProducts.find(p => p.id === item.productId);
    const totalUnits = product ? (product.units || 1) : 1;
    const requestedQty = item.qty || 1;

    // Sum all units of this product already booked in overlapping active bookings
    let alreadyBooked = 0;
    for (const b of allBookings) {
      if (b.id === excludeBookingId) continue;
      if (b.status === 'cancelled' || b.status === 'done') continue;
      // Overlap: b.start <= endDate AND b.end >= startDate
      if (b.startDate <= endDate && b.endDate >= startDate) {
        for (const bi of (b.items || [])) {
          if (bi.productId === item.productId) {
            alreadyBooked += (bi.qty || 1);
          }
        }
      }
    }

    const available = totalUnits - alreadyBooked;
    if (requestedQty > available) {
      conflicts.push({
        productId:  item.productId,
        name:       product ? product.name : item.productId,
        requested:  requestedQty,
        available:  Math.max(0, available),
        totalUnits,
      });
    }
  }

  return conflicts;
}

// ── API ROUTER ────────────────────────────────────────────────────────────────
async function handleApi(req, res, pathname, url) {
  const method = req.method.toUpperCase();

  // ── OPTIONS preflight ────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // ── Health ───────────────────────────────────────────────────────────────
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok:      true,
      version: '2.0.0',
      time:    new Date().toISOString(),
    });
  }

  // ── Login (returns JWT) ──────────────────────────────────────────────────
  if (pathname === '/api/login' && method === 'POST') {
    try {
      const data = await parseRequestBody(req);
      const users = readJson(USERS_DB_FILE, []);
      // Support legacy login format or new username format
      const username = data.username || (data.password === 'rtk2024admin' ? 'admin' : '');
      const user = users.find(u => u.username === username && u.password === data.password);
      
      if (user) {
        const token = signToken({ role: user.role, sub: user.username }, 24);
        return sendJson(res, 200, { ok: true, token, role: user.role, username: user.username });
      }
      return sendJson(res, 401, { error: 'Username atau password salah' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/products — list all (supports ?category=xxx&search=xxx&promo=1)
  if (pathname === '/api/products' && method === 'GET') {
    let products = readJson(PRODUCTS_DB_FILE, []);
    const { searchParams } = url;

    const category = searchParams.get('category');
    const search   = (searchParams.get('search') || '').toLowerCase();
    const promo    = searchParams.get('promo');

    if (category && category !== 'all') {
      products = products.filter(p => p.category === category);
    }
    if (search) {
      products = products.filter(p => p.name.toLowerCase().includes(search));
    }
    if (promo === '1' || promo === 'true') {
      products = products.filter(p => p.isPromo);
    }

    return sendJson(res, 200, products);
  }

  // GET /api/products/:id — single product
  if (pathname.startsWith('/api/products/') && method === 'GET') {
    const id = pathname.split('/')[3];
    if (!id) return sendJson(res, 400, { error: 'Missing product id' });
    const products = readJson(PRODUCTS_DB_FILE, []);
    const product  = products.find(p => p.id === id);
    if (!product) return sendJson(res, 404, { error: 'Product not found' });
    return sendJson(res, 200, product);
  }

  // POST /api/products — add new product (admin)
  if (pathname === '/api/products' && method === 'POST') {
    if (apiKeyAuth(req) !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    try {
      const data   = await parseRequestBody(req);
      if (!data)   return sendJson(res, 400, { error: 'Empty body' });
      const errs   = validateProduct(data);
      if (errs.length) return sendJson(res, 422, { error: 'Validasi gagal', details: errs });
      const products = readJson(PRODUCTS_DB_FILE, []);
      const newProd  = {
        ...data,
        id:          data.id || genId('prod-'),
        name:        String(data.name).trim(),
        normalPrice: Number(data.normalPrice),
        salePrice:   Number(data.salePrice || 0),
        units:       Math.max(1, Number(data.units || 1)),
        isPromo:     !!(data.salePrice > 0 && data.salePrice < data.normalPrice),
      };
      products.push(newProd);
      writeJson(PRODUCTS_DB_FILE, products);
      return sendJson(res, 201, { ok: true, product: newProd });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PUT /api/products — replace entire catalog (bulk, admin)
  if (pathname === '/api/products' && method === 'PUT') {
    if (apiKeyAuth(req) !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    try {
      const data = await parseRequestBody(req);
      if (!Array.isArray(data)) return sendJson(res, 400, { error: 'Payload must be an array' });
      writeJson(PRODUCTS_DB_FILE, data);
      return sendJson(res, 200, { ok: true, count: data.length });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PUT /api/products/:id — update single product (admin)
  if (pathname.startsWith('/api/products/') && method === 'PUT') {
    if (apiKeyAuth(req) !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    try {
      const id       = pathname.split('/')[3];
      const data     = await parseRequestBody(req);
      const products = readJson(PRODUCTS_DB_FILE, []);
      const idx      = products.findIndex(p => p.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Product not found' });
      products[idx] = { ...products[idx], ...data, id }; // id immutable
      writeJson(PRODUCTS_DB_FILE, products);
      return sendJson(res, 200, { ok: true, product: products[idx] });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PATCH /api/products/:id — partial update (admin)
  if (pathname.startsWith('/api/products/') && method === 'PATCH') {
    if (apiKeyAuth(req) !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    try {
      const id       = pathname.split('/')[3];
      const data     = await parseRequestBody(req);
      const products = readJson(PRODUCTS_DB_FILE, []);
      const idx      = products.findIndex(p => p.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Product not found' });
      products[idx] = { ...products[idx], ...data, id };
      writeJson(PRODUCTS_DB_FILE, products);
      return sendJson(res, 200, { ok: true, product: products[idx] });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // DELETE /api/products/:id — remove product (admin)
  if (pathname.startsWith('/api/products/') && method === 'DELETE') {
    if (apiKeyAuth(req) !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    const id = pathname.split('/')[3];
    let products = readJson(PRODUCTS_DB_FILE, []);
    const before = products.length;
    products = products.filter(p => p.id !== id);
    if (products.length === before) return sendJson(res, 404, { error: 'Product not found' });
    writeJson(PRODUCTS_DB_FILE, products);
    return sendJson(res, 200, { ok: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CUSTOMER API & KYC
  // ══════════════════════════════════════════════════════════════════════════

  if (pathname === '/api/customer/register' && method === 'POST') {
    try {
      const data = await parseRequestBody(req);
      if (!data.email || !data.password || !data.name || !data.phone) {
        return sendJson(res, 400, { error: 'Missing required fields' });
      }
      const customers = readJson(CUSTOMERS_DB_FILE, []);
      if (customers.find(c => c.email === data.email)) {
        return sendJson(res, 400, { error: 'Email already registered' });
      }
      const newCustomer = {
        id: genId('cust_'),
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password, // In prod, hash this!
        role: 'customer',
        kycStatus: 'pending', // pending, uploaded, verified, rejected
        kycFiles: null,
        createdAt: new Date().toISOString()
      };
      customers.push(newCustomer);
      writeJson(CUSTOMERS_DB_FILE, customers);
      const token = signToken({ id: newCustomer.id, role: 'customer' });
      return sendJson(res, 201, { ok: true, token, customer: newCustomer });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/customer/login' && method === 'POST') {
    try {
      const { email, password } = await parseRequestBody(req);
      const customers = readJson(CUSTOMERS_DB_FILE, []);
      const c = customers.find(x => x.email === email && x.password === password);
      if (!c) return sendJson(res, 401, { error: 'Invalid credentials' });
      const token = signToken({ id: c.id, role: 'customer' });
      return sendJson(res, 200, { ok: true, token, customer: c });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/customer/kyc-upload' && method === 'POST') {
    const authRole = apiKeyAuth(req);
    if (authRole !== 'customer') return sendJson(res, 401, { error: 'Customer only' });
    
    // Extract customer ID from token
    const tokenStr = req.headers['authorization'].slice(7);
    const payload = verifyToken(tokenStr);
    
    try {
      const { ktpBase64, selfieBase64 } = await parseRequestBody(req);
      if (!ktpBase64 || !selfieBase64) return sendJson(res, 400, { error: 'Missing images' });

      // Save base64 as files in uploads dir
      const ktpPath = path.join(UPLOADS_DIR, `ktp_${payload.id}.jpg`);
      const selfiePath = path.join(UPLOADS_DIR, `selfie_${payload.id}.jpg`);
      
      fs.writeFileSync(ktpPath, ktpBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(selfiePath, selfieBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const customers = readJson(CUSTOMERS_DB_FILE, []);
      const idx = customers.findIndex(c => c.id === payload.id);
      if (idx > -1) {
        customers[idx].kycStatus = 'uploaded';
        customers[idx].kycFiles = { ktp: `ktp_${payload.id}.jpg`, selfie: `selfie_${payload.id}.jpg` };
        writeJson(CUSTOMERS_DB_FILE, customers);
        return sendJson(res, 200, { ok: true, status: 'uploaded' });
      }
      return sendJson(res, 404, { error: 'Customer not found' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Get list of KYC for admin
  if (pathname === '/api/admin/kyc' && method === 'GET') {
    if (apiKeyAuth(req) !== 'admin' && apiKeyAuth(req) !== 'staff') return sendJson(res, 401, { error: 'Unauthorized' });
    const customers = readJson(CUSTOMERS_DB_FILE, []).filter(c => c.kycStatus === 'uploaded');
    // Hide passwords
    const safeData = customers.map(c => { const {password, ...rest} = c; return rest; });
    return sendJson(res, 200, safeData);
  }

  // Admin approves/rejects KYC
  if (pathname.startsWith('/api/admin/kyc/') && method === 'PUT') {
    if (apiKeyAuth(req) !== 'admin' && apiKeyAuth(req) !== 'staff') return sendJson(res, 401, { error: 'Unauthorized' });
    const customerId = pathname.split('/')[4];
    try {
      const { status } = await parseRequestBody(req); // 'verified' or 'rejected'
      const customers = readJson(CUSTOMERS_DB_FILE, []);
      const idx = customers.findIndex(c => c.id === customerId);
      if (idx === -1) return sendJson(res, 404, { error: 'Customer not found' });
      
      customers[idx].kycStatus = status;
      writeJson(CUSTOMERS_DB_FILE, customers);
      return sendJson(res, 200, { ok: true, customer: customers[idx] });
    } catch(err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Self-Service Booking (Customer)
  if (pathname === '/api/customer/book' && method === 'POST') {
    if (apiKeyAuth(req) !== 'customer') return sendJson(res, 401, { error: 'Customer only' });
    const payload = verifyToken(req.headers['authorization'].slice(7));
    
    try {
      const data = await parseRequestBody(req);
      const errors = validateBooking(data);
      if (errors.length > 0) return sendJson(res, 400, { error: 'Validation failed', details: errors });

      const customers = readJson(CUSTOMERS_DB_FILE, []);
      const customer = customers.find(c => c.id === payload.id);
      if (!customer || customer.kycStatus !== 'verified') {
        return sendJson(res, 403, { error: 'Akun belum terverifikasi KYC' });
      }

      const products = readJson(PRODUCTS_DB_FILE, []);
      const bookings = readJson(BOOKINGS_DB_FILE, []);

      // Check conflicts
      const conflicts = checkBookingConflicts(data.items, data.startDate, data.endDate, bookings, products);
      if (conflicts.length > 0) {
        return sendJson(res, 409, { error: 'Tanggal bentrok', details: conflicts });
      }

      const newBooking = {
        id: genId('BK'),
        customerId: customer.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        startDate: data.startDate,
        endDate: data.endDate,
        items: data.items,
        totalPrice: data.totalPrice || 0,
        status: 'pending', // Pending payment/pickup
        createdAt: new Date().toISOString(),
      };
      
      bookings.push(newBooking);
      writeJson(BOOKINGS_DB_FILE, bookings);
      return sendJson(res, 201, { ok: true, booking: newBooking });
    } catch(err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // GET /api/customer/bookings — list customer's own bookings
  if (pathname === '/api/customer/bookings' && method === 'GET') {
    if (apiKeyAuth(req) !== 'customer') return sendJson(res, 401, { error: 'Customer only' });
    const payload = verifyToken(req.headers['authorization'].slice(7));
    const bookings = readJson(BOOKINGS_DB_FILE, []);
    const customerBookings = bookings.filter(b => b.customerId === payload.id);
    return sendJson(res, 200, customerBookings);
  }

  // POST /api/customer/pay/:id — simulate payment success
  if (pathname.startsWith('/api/customer/pay/') && method === 'POST') {
    if (apiKeyAuth(req) !== 'customer') return sendJson(res, 401, { error: 'Customer only' });
    const bookingId = pathname.split('/')[4];
    const bookings = readJson(BOOKINGS_DB_FILE, []);
    const idx = bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) return sendJson(res, 404, { error: 'Booking not found' });
    
    // Check if it belongs to current customer
    const payload = verifyToken(req.headers['authorization'].slice(7));
    if (bookings[idx].customerId !== payload.id) return sendJson(res, 403, { error: 'Forbidden' });
    
    // Update status to confirmed
    bookings[idx].status = 'confirmed';
    
    // Set up tracking coordinates (simulated GPS tracker around Tangerang/BSD)
    bookings[idx].tracking = {
      deviceId: 'simulated-iot',
      lastUpdate: new Date().toISOString(),
      coords: { 
        lat: -6.2235 + (Math.random() - 0.5) * 0.02, 
        lng: 106.6493 + (Math.random() - 0.5) * 0.02 
      },
      address: 'Tangerang, Indonesia (Simulated GPS Active)'
    };
    
    writeJson(BOOKINGS_DB_FILE, bookings);
    
    // Also save to tracking DB
    const tracks = readJson(TRACKING_DB_FILE, []);
    const trackEntry = {
      bookingId,
      deviceId: 'simulated-iot',
      lat: bookings[idx].tracking.coords.lat,
      lng: bookings[idx].tracking.coords.lng,
      address: bookings[idx].tracking.address,
      timestamp: bookings[idx].tracking.lastUpdate
    };
    const tIdx = tracks.findIndex(t => t.bookingId === bookingId);
    if (tIdx !== -1) tracks[tIdx] = trackEntry;
    else tracks.push(trackEntry);
    writeJson(TRACKING_DB_FILE, tracks);

    return sendJson(res, 200, { ok: true, booking: bookings[idx] });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BOOKINGS
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/bookings — list all bookings (admin only)
  if (pathname === '/api/bookings' && method === 'GET') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const { searchParams } = url;
    let bookings = readJson(BOOKINGS_DB_FILE, []);

    const status = searchParams.get('status');
    const search = (searchParams.get('search') || '').toLowerCase();

    if (status) bookings = bookings.filter(b => b.status === status);
    if (search) bookings = bookings.filter(b =>
      (b.customerName || '').toLowerCase().includes(search) ||
      (b.customerPhone || '').toLowerCase().includes(search)
    );

    // Sort newest first
    bookings = bookings.slice().sort((a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    return sendJson(res, 200, bookings);
  }

  // GET /api/bookings/:id — single booking (admin only)
  if (pathname.startsWith('/api/bookings/') && method === 'GET') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const id = pathname.split('/')[3];
    const bookings = readJson(BOOKINGS_DB_FILE, []);
    const booking  = bookings.find(b => b.id === id);
    if (!booking) return sendJson(res, 404, { error: 'Booking not found' });
    return sendJson(res, 200, booking);
  }

  // GET /api/availability — public: anonymised date ranges for conflict checking
  if (pathname === '/api/availability' && method === 'GET') {
    const bookings = readJson(BOOKINGS_DB_FILE, []);
    const active   = bookings.filter(b =>
      b.status === 'confirmed' || b.status === 'active' || b.status === 'pending'
    );
    const availability = active.map(b => ({
      startDate: b.startDate,
      endDate:   b.endDate,
      items:     b.items || [],
    }));
    return sendJson(res, 200, availability);
  }

  // GET /api/availability/:productId?month=2026-05 — per-product day-by-day availability calendar
  if (pathname.startsWith('/api/availability/') && method === 'GET') {
    const productId = pathname.split('/')[3];
    if (!productId) return sendJson(res, 400, { error: 'Missing product id' });

    const products  = readJson(PRODUCTS_DB_FILE, []);
    const product   = products.find(p => p.id === productId);
    if (!product) return sendJson(res, 404, { error: 'Product not found' });

    const totalUnits = product.units || 1;

    // Determine the month range (default: current month)
    const { searchParams } = url;
    const monthParam = searchParams.get('month'); // e.g. '2026-05'
    let year, month;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split('-').map(Number);
    } else {
      const now = new Date();
      year  = now.getFullYear();
      month = now.getMonth() + 1;
    }

    // Build first and last day of the month
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay  = new Date(year, month, 0); // last day of month
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const daysInMonth = lastDay.getDate();

    // Get all active bookings that overlap this month for this product
    const bookings = readJson(BOOKINGS_DB_FILE, []);
    const relevant = bookings.filter(b => {
      if (b.status === 'cancelled' || b.status === 'done') return false;
      if (b.endDate < firstDay || b.startDate > lastDayStr) return false;
      return (b.items || []).some(i => i.productId === productId);
    });

    // For each day in the month, count how many units are booked
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let booked = 0;
      for (const b of relevant) {
        if (b.startDate <= dateStr && b.endDate >= dateStr) {
          for (const item of (b.items || [])) {
            if (item.productId === productId) {
              booked += (item.qty || 1);
            }
          }
        }
      }
      days.push({
        date:      dateStr,
        booked,
        available: Math.max(0, totalUnits - booked),
        full:      booked >= totalUnits,
      });
    }

    return sendJson(res, 200, {
      productId,
      productName: product.name,
      totalUnits,
      month:       `${year}-${String(month).padStart(2, '0')}`,
      days,
    });
  }

  // POST /api/bookings — create new booking (public, from storefront checkout)
  if (pathname === '/api/bookings' && method === 'POST') {
    try {
      const data = await parseRequestBody(req);
      if (!data) return sendJson(res, 400, { error: 'Empty body' });

      // ── Input validation ───────────────────────────────────────────────
      const errs = validateBooking(data);
      if (errs.length) return sendJson(res, 422, { error: 'Validasi gagal', details: errs });

      const bookings = readJson(BOOKINGS_DB_FILE, []);
      const products = readJson(PRODUCTS_DB_FILE, []);

      // ── Conflict detection ────────────────────────────────────────────
      // Skip conflict check if the booking is just a draft/cancelled status
      const skipConflict = data.status === 'cancelled';

      // ── Blacklist check ───────────────────────────────────────────────
      const blacklist = readJson(BLACKLIST_DB_FILE, []);
      const phone     = String(data.customerPhone || '').replace(/\D/g, '');
      const blocked   = blacklist.find(b => b.phone.replace(/\D/g, '') === phone);
      if (blocked) {
        console.warn(`[blacklist] Blocked booking attempt from ${phone}`);
        return sendJson(res, 403, {
          error: 'Nomor WhatsApp Anda tidak dapat melakukan pemesanan. Hubungi admin untuk informasi lebih lanjut.',
          blocked: true,
        });
      }

      if (!skipConflict) {
        const conflicts = checkBookingConflicts(
          data.items || [],
          data.startDate,
          data.endDate,
          bookings,
          products
        );
        if (conflicts.length > 0) {
          return sendJson(res, 409, {
            error: 'Konflik ketersediaan — beberapa item sudah penuh pada tanggal tersebut',
            conflicts,
          });
        }
      }

      const newBook = {
        ...data,
        id:           data.id || genId('bk-'),
        customerName: String(data.customerName).trim(),
        customerPhone:String(data.customerPhone).trim(),
        status:       data.status || 'pending',
        createdAt:    new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
      };
      bookings.push(newBook);
      writeJson(BOOKINGS_DB_FILE, bookings);
      console.log(`[booking] New booking ${newBook.id} — ${newBook.customerName} (${newBook.status})`);
      return sendJson(res, 201, { ok: true, booking: newBook });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PUT /api/bookings — bulk replace (admin)
  if (pathname === '/api/bookings' && method === 'PUT') {
    if (apiKeyAuth(req) !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    try {
      const data = await parseRequestBody(req);
      if (!Array.isArray(data)) return sendJson(res, 400, { error: 'Payload must be an array' });
      writeJson(BOOKINGS_DB_FILE, data);
      return sendJson(res, 200, { ok: true, count: data.length });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PUT /api/bookings/:id — full update of a single booking (admin)
  if (pathname.startsWith('/api/bookings/') && method === 'PUT') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    try {
      const id       = pathname.split('/')[3];
      const data     = await parseRequestBody(req);
      const bookings = readJson(BOOKINGS_DB_FILE, []);
      const idx      = bookings.findIndex(b => b.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Booking not found' });
      bookings[idx] = { ...bookings[idx], ...data, id, updatedAt: new Date().toISOString() };
      writeJson(BOOKINGS_DB_FILE, bookings);
      return sendJson(res, 200, { ok: true, booking: bookings[idx] });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PATCH /api/bookings/:id — partial update, e.g. status change (admin)
  if (pathname.startsWith('/api/bookings/') && method === 'PATCH') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    try {
      const id       = pathname.split('/')[3];
      const data     = await parseRequestBody(req);
      const bookings = readJson(BOOKINGS_DB_FILE, []);
      const idx      = bookings.findIndex(b => b.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Booking not found' });
      bookings[idx] = { ...bookings[idx], ...data, id, updatedAt: new Date().toISOString() };
      writeJson(BOOKINGS_DB_FILE, bookings);
      console.log(`[booking] Updated ${id} — status: ${bookings[idx].status}`);
      return sendJson(res, 200, { ok: true, booking: bookings[idx] });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // DELETE /api/bookings/:id — remove booking (admin)
  if (pathname.startsWith('/api/bookings/') && method === 'DELETE') {
    if (apiKeyAuth(req) !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    const id = pathname.split('/')[3];
    let bookings = readJson(BOOKINGS_DB_FILE, []);
    const before = bookings.length;
    bookings = bookings.filter(b => b.id !== id);
    if (bookings.length === before) return sendJson(res, 404, { error: 'Booking not found' });
    writeJson(BOOKINGS_DB_FILE, bookings);
    return sendJson(res, 200, { ok: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS (admin dashboard summary)
  // ══════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/stats' && method === 'GET') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });

    const products = readJson(PRODUCTS_DB_FILE, []);
    const bookings = readJson(BOOKINGS_DB_FILE, []);
    const today    = new Date().toISOString().slice(0, 10);

    const activeBookings = bookings.filter(b =>
      b.status === 'active' || b.status === 'confirmed'
    );
    const pendingCount  = bookings.filter(b => b.status === 'pending').length;
    const doneCount     = bookings.filter(b => b.status === 'done').length;
    const totalRevenue  = bookings
      .filter(b => b.status === 'done')
      .reduce((s, b) => s + (b.totalPrice || 0), 0);

    // Units rented today
    const rentedTodayMap = {};
    bookings.forEach(b => {
      if (b.status === 'cancelled' || b.status === 'done') return;
      if (b.startDate <= today && b.endDate >= today) {
        (b.items || []).forEach(item => {
          rentedTodayMap[item.productId] = (rentedTodayMap[item.productId] || 0) + (item.qty || 1);
        });
      }
    });
    const totalRentedToday = Object.values(rentedTodayMap).reduce((s, n) => s + n, 0);

    return sendJson(res, 200, {
      products: {
        total: products.length,
        promo: products.filter(p => p.isPromo).length,
        totalUnits: products.reduce((s, p) => s + (p.units || 1), 0),
      },
      bookings: {
        total:   bookings.length,
        active:  activeBookings.length,
        pending: pendingCount,
        done:    doneCount,
        rentedToday: totalRentedToday,
      },
      revenue: {
        totalFromCompleted: totalRevenue,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLACKLIST (admin)
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/blacklist
  if (pathname === '/api/blacklist' && method === 'GET') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, readJson(BLACKLIST_DB_FILE, []));
  }

  // POST /api/blacklist — add customer to blacklist
  if (pathname === '/api/blacklist' && method === 'POST') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    try {
      const data = await parseRequestBody(req);
      if (!data || !data.phone) return sendJson(res, 400, { error: 'phone wajib diisi' });
      const list = readJson(BLACKLIST_DB_FILE, []);
      // Prevent duplicates
      if (list.find(b => b.phone === data.phone)) {
        return sendJson(res, 409, { error: 'Nomor sudah ada di blacklist' });
      }
      const entry = {
        id:        genId('bl-'),
        phone:     String(data.phone).trim(),
        name:      String(data.name || '').trim(),
        reason:    String(data.reason || '').trim(),
        createdAt: new Date().toISOString(),
      };
      list.push(entry);
      writeJson(BLACKLIST_DB_FILE, list);
      console.log(`[blacklist] Added ${entry.phone} — ${entry.reason}`);
      return sendJson(res, 201, { ok: true, entry });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // DELETE /api/blacklist/:id — remove from blacklist
  if (pathname.startsWith('/api/blacklist/') && method === 'DELETE') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const id = pathname.split('/')[3];
    let list = readJson(BLACKLIST_DB_FILE, []);
    const before = list.length;
    list = list.filter(b => b.id !== id);
    if (list.length === before) return sendJson(res, 404, { error: 'Entry not found' });
    writeJson(BLACKLIST_DB_FILE, list);
    return sendJson(res, 200, { ok: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GPS TRACKING (for active rentals)
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/tracking — device/courier reports location
  if (pathname === '/api/tracking' && method === 'POST') {
    try {
      const data = await parseRequestBody(req);
      if (!data || !data.bookingId) return sendJson(res, 400, { error: 'bookingId wajib' });
      if (!data.lat || !data.lng) return sendJson(res, 400, { error: 'lat & lng wajib' });

      const tracks = readJson(TRACKING_DB_FILE, []);
      const entry  = {
        bookingId: data.bookingId,
        deviceId:  data.deviceId || 'manual',
        lat:       Number(data.lat),
        lng:       Number(data.lng),
        address:   data.address || '',
        timestamp: new Date().toISOString(),
      };
      // Keep only latest per bookingId (replace existing)
      const idx = tracks.findIndex(t => t.bookingId === data.bookingId);
      if (idx !== -1) tracks[idx] = entry;
      else tracks.push(entry);
      writeJson(TRACKING_DB_FILE, tracks);

      // Also update booking record
      const bookings = readJson(BOOKINGS_DB_FILE, []);
      const bIdx = bookings.findIndex(b => b.id === data.bookingId);
      if (bIdx !== -1) {
        bookings[bIdx].tracking = {
          deviceId:   entry.deviceId,
          lastUpdate: entry.timestamp,
          coords:     { lat: entry.lat, lng: entry.lng },
          address:    entry.address,
        };
        writeJson(BOOKINGS_DB_FILE, bookings);
      }

      return sendJson(res, 200, { ok: true, entry });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // GET /api/tracking/active — admin: get all active rental locations
  if (pathname === '/api/tracking/active' && method === 'GET') {
    if (!apiKeyAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const bookings = readJson(BOOKINGS_DB_FILE, []);
    const active = bookings.filter(b =>
      (b.status === 'active' || b.status === 'confirmed') && b.tracking
    ).map(b => ({
      bookingId:    b.id,
      customerName: b.customerName,
      customerPhone:b.customerPhone,
      items:        (b.items || []).map(i => i.productId),
      tracking:     b.tracking,
      startDate:    b.startDate,
      endDate:      b.endDate,
    }));
    return sendJson(res, 200, active);
  }

  // ── 404 fallback ─────────────────────────────────────────────────────────
  return sendJson(res, 404, { error: `API route not found: ${method} ${pathname}` });
}

// ── BOOTSTRAP ─────────────────────────────────────────────────────────────────
ensureDbFiles();

// ── GPS IoT SIMULATION ────────────────────────────────────────────────────────
// Periodically update active bookings' GPS tracking coordinates to simulate real-time movement
if (!IS_VERCEL) {
  setInterval(() => {
    const bookingsFile = path.join(DATA_DIR, 'bookings.db.json');
    const trackingFile = path.join(DATA_DIR, 'tracking.db.json');
    if (!fs.existsSync(bookingsFile)) return;
    
    try {
      let bookings = [];
      try {
        bookings = JSON.parse(fs.readFileSync(bookingsFile, 'utf-8'));
      } catch (_) { return; }
      
      let tracks = [];
      if (fs.existsSync(trackingFile)) {
        try { tracks = JSON.parse(fs.readFileSync(trackingFile, 'utf-8')); } catch (_) {}
      }
      
      let updated = false;
      bookings.forEach(b => {
        if ((b.status === 'active' || b.status === 'confirmed') && b.tracking) {
          // Shift latitude/longitude slightly (simulating movement)
          const latShift = (Math.random() - 0.5) * 0.0008;
          const lngShift = (Math.random() - 0.5) * 0.0008;
          b.tracking.coords.lat += latShift;
          b.tracking.coords.lng += lngShift;
          b.tracking.lastUpdate = new Date().toISOString();
          
          // Reverse geocoding simulation (random nearby landmarks in Tangerang)
          const landmarks = [
            'Dekat Universitas Pelita Harapan, Karawaci',
            'Sekitar Supermal Karawaci',
            'Jl. Boulevard Gading Serpong',
            'Dekat Summarecon Mall Serpong',
            'Sekitar AEON Mall BSD City',
            'Jl. Grand Boulevard, BSD City',
            'Dekat Grha Mesra, Kelapa Dua',
            'Dekat Summarecon Mall Serpong',
            'Dekat Scientia Square Park, Serpong'
          ];
          
          // 15% chance to update address text or if it doesn't exist
          if (Math.random() < 0.15 || !b.tracking.address) {
            b.tracking.address = landmarks[Math.floor(Math.random() * landmarks.length)];
          }
          
          // Update tracking.db
          const entry = {
            bookingId: b.id,
            deviceId: b.tracking.deviceId || 'simulated-iot',
            lat: b.tracking.coords.lat,
            lng: b.tracking.coords.lng,
            address: b.tracking.address,
            timestamp: b.tracking.lastUpdate
          };
          
          const idx = tracks.findIndex(t => t.bookingId === b.id);
          if (idx !== -1) tracks[idx] = entry;
          else tracks.push(entry);
          
          updated = true;
        }
      });
      
      if (updated) {
        fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));
        fs.writeFileSync(trackingFile, JSON.stringify(tracks, null, 2));
        console.log('[GPS Simulation] Updated active IoT coordinates.');
      }
    } catch (err) {
      console.error('[GPS Simulation] Error:', err.message);
    }
  }, 8000); // every 8 seconds
}

// ── HTTP SERVER ───────────────────────────────────────────────────────────────
async function requestListener(req, res) {
  // Parse URL safely
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (_) {
    return sendText(res, 400, 'Bad Request');
  }

  let pathname = url.pathname;
  if (url.searchParams.has('_originalPath')) {
    pathname = url.searchParams.get('_originalPath');
  }
  const method   = req.method.toUpperCase();

  // CORS preflight shortcut
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, pathname, url);
    } catch (err) {
      console.error('[server] Unhandled error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    log(method, pathname, res.statusCode);
    return;
  }

  serveStatic(pathname, res);
}

// Export request handler for Vercel Serverless Function compatibility
module.exports = requestListener;

// Only listen locally if run directly
if (require.main === module) {
  const server = http.createServer(requestListener);

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${PORT} is already in use. Kill the existing process or set PORT env var.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    console.log('');
    console.log('  ┌────────────────────────────────────────┐');
    console.log(`  │  RTK Rental Server v2.0                │`);
    console.log(`  │  http://localhost:${PORT}                   │`);
    console.log(`  │  Admin: http://localhost:${PORT}/admin.html │`);
    console.log('  └────────────────────────────────────────┘');
    console.log('');
  });
}
