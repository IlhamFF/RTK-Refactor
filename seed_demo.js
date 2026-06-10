const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Tiny valid 100x100 pixel green and blue PNG base64 strings to serve as mock document files
const MOCK_KTP_BASE64 = 
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkBAMAAACCz7C+AAAAD1BMVEUAAAD/gICA/4CAgP+AgID///8+c4wGAAAABHRSTlMAECBAwP/f9wAAADlJREFUeF7t0EERAAAIA6HZv7Uz+EcCS6D0tgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCjoP9uIA/9Jd4mYAAAAASUVORK5CYII=';

const MOCK_SELFIE_BASE64 = 
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkBAMAAACCz7C+AAAAD1BMVEUAAAD///+AgID/gICA/4D///9kL6wTAAAABHRSTlMAECBAwP/f9wAAADlJREFUeF7t0EERAAAIA6HZv7Uz+EcCS6D0tgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCjoP9uIA/9Jd4mYAAAAASUVORK5CYII=';

// Write mock files
fs.writeFileSync(path.join(UPLOADS_DIR, 'ktp_cust_demo_pending.jpg'), Buffer.from(MOCK_KTP_BASE64, 'base64'));
fs.writeFileSync(path.join(UPLOADS_DIR, 'selfie_cust_demo_pending.jpg'), Buffer.from(MOCK_SELFIE_BASE64, 'base64'));
fs.writeFileSync(path.join(UPLOADS_DIR, 'ktp_cust_demo_verified.jpg'), Buffer.from(MOCK_KTP_BASE64, 'base64'));
fs.writeFileSync(path.join(UPLOADS_DIR, 'selfie_cust_demo_verified.jpg'), Buffer.from(MOCK_SELFIE_BASE64, 'base64'));
console.log('✓ Mock KYC upload files created.');

// 1. Customers Seed
const customers = [
  {
    id: "cust_demo_verified",
    name: "Ahmad Dahlan",
    email: "ahmad@example.com",
    phone: "081211112222",
    password: "ahmad123",
    role: "customer",
    kycStatus: "verified",
    kycFiles: { ktp: "ktp_cust_demo_verified.jpg", selfie: "selfie_cust_demo_verified.jpg" },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "cust_demo_pending",
    name: "Siti Rahma",
    email: "siti@example.com",
    phone: "081233334444",
    password: "siti123",
    role: "customer",
    kycStatus: "uploaded",
    kycFiles: { ktp: "ktp_cust_demo_pending.jpg", selfie: "selfie_cust_demo_pending.jpg" },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "cust_demo_rejected",
    name: "Budi Santoso",
    email: "budi@example.com",
    phone: "081255556666",
    password: "budi123",
    role: "customer",
    kycStatus: "rejected",
    kycFiles: { ktp: "ktp_cust_demo_pending.jpg", selfie: "selfie_cust_demo_pending.jpg" },
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "cust_demo_unverified",
    name: "Diana Lestari",
    email: "diana@example.com",
    phone: "081277778888",
    password: "diana123",
    role: "customer",
    kycStatus: "pending",
    kycFiles: null,
    createdAt: new Date().toISOString()
  }
];
fs.writeFileSync(path.join(DATA_DIR, 'customers.db.json'), JSON.stringify(customers, null, 2));
console.log('✓ customers.db.json pre-populated.');

// 2. Blacklist Seed
const blacklist = [
  {
    id: "bl_1",
    customerName: "Roni Penipu",
    phone: "081288888888",
    reason: "Membawa kabur kamera lensa fixed 85mm dan diblokir permanen",
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  }
];
fs.writeFileSync(path.join(DATA_DIR, 'blacklist.db.json'), JSON.stringify(blacklist, null, 2));
console.log('✓ blacklist.db.json pre-populated.');

// Load products database to link mock bookings to real products
const productsFile = path.join(DATA_DIR, 'products.db.json');
let products = [];
if (fs.existsSync(productsFile)) {
  products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
} else {
  products = [
    { id: "prod-3fe4720c", name: "Kamera Cetak Instan Hitam Putih", category: "kamera-digital", normalPrice: 150000, salePrice: 123000 },
    { id: "prod-fe435f51", name: "Retro Flip Screen Mini Camera (1982)", category: "kamera-digital", normalPrice: 100000, salePrice: 75000 },
    { id: "prod-1ea5efdd", name: "Canon EOS 80D", category: "dslr", normalPrice: 345000, salePrice: 300000 },
    { id: "prod-2ed1edb0", name: "SONY FDR-X3000", category: "action-cam", normalPrice: 200000, salePrice: 175000 }
  ];
  fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
}

// 3. Bookings Seed (Generating rich data spanning last 6 months)
const bookings = [];
const now = new Date();

// Helper to format date
const formatDate = (d) => d.toISOString().slice(0, 10);

// Product lists by popularity
const popularProductIds = [
  "prod-3fe4720c", // Kamera Cetak Instan
  "prod-fe435f51", // Retro Flip Screen
  "prod-1ea5efdd", // Canon EOS 80D
  "prod-2ed1edb0", // SONY FDR-X3000
  "prod-ba03ddcc", // Canon EOS 40D
  "prod-705b43d5", // Samsung NX Mini
  "prod-efb97742", // Canon XL1s
  "prod-53258316"  // Samsung NX 50-200mm Lens
];

// Names for mock transactions
const names = [
  "Andi Wijaya", "Rudi Hermawan", "Dewi Lestari", "Eko Prasetyo", 
  "Gita Permata", "Hendra Setiawan", "Indah Wahyuni", "Joni Iskandar",
  "Kiki Fatmala", "Lukman Hakim", "Maria Olivia", "Novianti",
  "Oki Rahardjo", "Putra Pratama", "Rian Hidayat", "Siska Amelia"
];

// Generate completed bookings ('done') for last 5 months
for (let m = 5; m >= 1; m--) {
  const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
  
  // 5 to 8 bookings per month
  const bookingCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < bookingCount; i++) {
    const dayOffset = (i * 3) - 10;
    const bookingDate = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), targetMonthDate.getDate() + dayOffset);
    const startDate = new Date(bookingDate);
    const endDate = new Date(bookingDate);
    endDate.setDate(endDate.getDate() + 3);

    // Pick 1-2 random products
    const items = [];
    const itemNum = 1 + Math.floor(Math.random() * 2);
    let totalPrice = 0;
    for (let k = 0; k < itemNum; k++) {
      const pId = popularProductIds[Math.floor(Math.random() * popularProductIds.length)];
      const p = products.find(x => x.id === pId) || products[0];
      const price = p.salePrice || p.normalPrice || 100000;
      items.push({
        productId: p.id,
        name: p.name,
        qty: 1,
        price: price
      });
      totalPrice += price * 3; // 3 days rental
    }

    const name = names[Math.floor(Math.random() * names.length)];
    const bkId = `BK_DEMO_` + String(Math.floor(Math.random() * 90000) + 10000);

    bookings.push({
      id: bkId,
      customerId: "cust_demo_verified",
      customerName: name,
      customerPhone: "0812" + String(Math.floor(Math.random() * 90000000) + 10000000),
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      items: items,
      totalPrice: totalPrice,
      status: "done",
      createdAt: new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      deposit: {
        amount: 100000,
        status: "returned",
        method: "transfer",
        fineAmount: 0,
        notes: "Pengembalian tepat waktu, unit mulus."
      },
      checklist: {
        pickup: {
          checkedBy: "staff",
          timestamp: new Date(startDate.getTime() + 10 * 3600 * 1000).toISOString(),
          items: [
            { id: "body", status: "ok", notes: "Mulus" },
            { id: "lens", status: "ok", notes: "Bersih" },
            { id: "battery", status: "ok", notes: "Penuh" }
          ]
        },
        return: {
          checkedBy: "staff",
          timestamp: new Date(endDate.getTime() + 15 * 3600 * 1000).toISOString(),
          items: [
            { id: "body", status: "ok", notes: "Sesuai" },
            { id: "lens", status: "ok", notes: "Sesuai" },
            { id: "battery", status: "ok", notes: "Kembali" }
          ]
        }
      }
    });
  }
}

// Generate some pending bookings
for (let i = 0; i < 2; i++) {
  const start = new Date(now);
  start.setDate(start.getDate() + 5 + i * 2);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  
  const p = products.find(x => x.id === popularProductIds[i]) || products[0];
  const price = p.salePrice || p.normalPrice || 100000;

  bookings.push({
    id: `BK_DEMO_PEND_${i}`,
    customerId: "cust_demo_verified",
    customerName: "Ahmad Dahlan",
    customerPhone: "081211112222",
    startDate: formatDate(start),
    endDate: formatDate(end),
    items: [{ productId: p.id, qty: 1 }],
    totalPrice: price * 2,
    status: "pending",
    createdAt: new Date().toISOString()
  });
}

// Generate active bookings (which will appear on Leaflet GPS tracker!)
const activeLocations = [
  { lat: -6.2225, lng: 106.6521, address: "Dekat Summarecon Mall Serpong" },
  { lat: -6.3015, lng: 106.6535, address: "Sekitar AEON Mall BSD City" }
];

for (let i = 0; i < 2; i++) {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  const end = new Date(now);
  end.setDate(end.getDate() + 2);

  const p = products.find(x => x.id === popularProductIds[i + 2]) || products[0];
  const price = p.salePrice || p.normalPrice || 100000;
  const custName = i === 0 ? "Ahmad Dahlan" : "Rudi Hermawan";
  const custPhone = i === 0 ? "081211112222" : "081299990000";

  bookings.push({
    id: `BK_DEMO_ACTV_${i}`,
    customerId: i === 0 ? "cust_demo_verified" : "cust_rudi",
    customerName: custName,
    customerPhone: custPhone,
    startDate: formatDate(start),
    endDate: formatDate(end),
    items: [{ productId: p.id, qty: 1 }],
    totalPrice: price * 3,
    status: "active",
    createdAt: new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    deposit: {
      amount: 100000,
      status: "paid",
      method: "qris"
    },
    checklist: {
      pickup: {
        checkedBy: "staff",
        timestamp: new Date(start.getTime() + 9 * 3600 * 1000).toISOString(),
        items: [
          { id: "body", status: "ok", notes: "Lecet tipis di grip" },
          { id: "lens", status: "ok", notes: "Bening" }
        ]
      }
    },
    tracking: {
      deviceId: "simulated-iot",
      lastUpdate: new Date().toISOString(),
      coords: { lat: activeLocations[i].lat, lng: activeLocations[i].lng },
      address: activeLocations[i].address
    }
  });
}

// Generate specific conflict bookings to show availability blocks
const startThumb = new Date(now);
startThumb.setDate(startThumb.getDate() - 1);
const endThumb = new Date(now);
endThumb.setDate(endThumb.getDate() + 2);

bookings.push({
  id: "BK_DEMO_THUMB_OCCUPIED",
  customerId: "cust_demo_verified",
  customerName: "Ahmad Dahlan",
  customerPhone: "081211112222",
  startDate: formatDate(startThumb),
  endDate: formatDate(endThumb),
  items: [{ productId: "prod-be2234ee", qty: 1 }],
  totalPrice: 135000,
  status: "confirmed",
  createdAt: new Date().toISOString()
});

const startFlip = new Date(now);
startFlip.setDate(startFlip.getDate() + 1);
const endFlip = new Date(now);
endFlip.setDate(endFlip.getDate() + 3);

bookings.push({
  id: "BK_DEMO_FLIP_OCCUPIED",
  customerId: "cust_demo_verified",
  customerName: "Siti Rahma",
  customerPhone: "081233334444",
  startDate: formatDate(startFlip),
  endDate: formatDate(endFlip),
  items: [{ productId: "prod-fe435f51", qty: 1 }],
  totalPrice: 225000,
  status: "confirmed",
  createdAt: new Date().toISOString()
});

// Generate some cancelled bookings
for (let i = 0; i < 2; i++) {
  bookings.push({
    id: `BK_DEMO_CNCL_${i}`,
    customerId: "cust_demo_verified",
    customerName: "Ahmad Dahlan",
    customerPhone: "081211112222",
    startDate: "2026-04-10",
    endDate: "2026-04-12",
    items: [{ productId: products[0].id, qty: 1 }],
    totalPrice: 300000,
    status: "cancelled",
    createdAt: "2026-04-09T10:00:00.000Z"
  });
}

fs.writeFileSync(path.join(DATA_DIR, 'bookings.db.json'), JSON.stringify(bookings, null, 2));
console.log(`✓ bookings.db.json seeded with ${bookings.length} total demo transactions.`);

// 4. Seeding tracking.db.json
const trackingList = bookings
  .filter(b => b.status === 'active' && b.tracking)
  .map(b => ({
    bookingId: b.id,
    deviceId: b.tracking.deviceId,
    lat: b.tracking.coords.lat,
    lng: b.tracking.coords.lng,
    address: b.tracking.address,
    timestamp: b.tracking.lastUpdate
  }));
fs.writeFileSync(path.join(DATA_DIR, 'tracking.db.json'), JSON.stringify(trackingList, null, 2));
console.log('✓ tracking.db.json seeded with active rentals.');

console.log('====================================================');
console.log('🎉 DEMO DATA SEEDING COMPLETE FOR RTK RENTAL PROTOTYPE');
console.log('====================================================');
