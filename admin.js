// ===== RTK ADMIN — Full Dashboard (Auth + Katalog + Stok + Pemesanan + Kalender) =====

// ── CONFIG ──────────────────────────────────────────────────────────────
const SESSION_KEY    = 'rtk_admin_auth';
const BOOKING_KEY    = 'rtk_bookings';
const BOOKING_API_URL = '/api/bookings';

// Colour palette for bookings (cycles through)
const BOOKING_COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#854d0e'];

// ── BOOKING STORAGE ─────────────────────────────────────────────────────
function getBookings() {
  return JSON.parse(localStorage.getItem(BOOKING_KEY) || '[]');
}
function saveBookings(arr) {
  localStorage.setItem(BOOKING_KEY, JSON.stringify(arr));
}
async function syncBookingsFromApi() {
  try {
    const token = sessionStorage.getItem('rtk_api_key') || '';
    const res = await fetch(BOOKING_API_URL, { 
      method: 'GET',
      headers: { 'x-api-key': token }
    });
    if (!res.ok) return getBookings();
    const bookings = await res.json();
    if (Array.isArray(bookings)) {
      // Server returns newest-first; keep that order for localStorage too
      localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
      return bookings;
    }
  } catch (err) {
    // Keep local data when API is not available.
  }
  return getBookings();
}

// Load dashboard stat cards from /api/stats
async function loadDashboardStats() {
  try {
    const token = sessionStorage.getItem('rtk_api_key') || '';
    const res = await fetch('/api/stats', { headers: { 'x-api-key': token } });
    if (!res.ok) return;
    const s = await res.json();
    // Products
    const elTotal = document.getElementById('stat-total');
    const elPromo = document.getElementById('stat-promo');
    if (elTotal) elTotal.textContent = s.products.total;
    if (elPromo) elPromo.textContent = s.products.promo;
    // Bookings
    const elBookTotal  = document.getElementById('stat-book-total');
    const elBookActive = document.getElementById('stat-book-active');
    const elBookDone   = document.getElementById('stat-book-done');
    if (elBookTotal)  elBookTotal.textContent  = s.bookings.total;
    if (elBookActive) elBookActive.textContent = s.bookings.active;
    if (elBookDone)   elBookDone.textContent   = s.bookings.done;
    // Pending badge on sidebar
    const badge = document.getElementById('pending-badge');
    if (badge) {
      const pending = s.bookings.pending || 0;
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }
    // Pending KYC count
    try {
      const kycRes = await fetch('/api/admin/kyc', { headers: { 'Authorization': `Bearer ${token}`, 'x-api-key': token } });
      if (kycRes.ok) {
        const kycList = await kycRes.json();
        const kycBadge = document.getElementById('kyc-pending-badge');
        if (kycBadge) {
          kycBadge.textContent = kycList.length;
          kycBadge.style.display = kycList.length > 0 ? 'inline-flex' : 'none';
        }
        const kycStatPending = document.getElementById('stat-kyc-pending');
        if (kycStatPending) kycStatPending.textContent = kycList.length;
      }
    } catch (_) {}
  } catch (err) {
    // Non-critical — local counts will still show
  }
}
async function persistBookingsToApi(bookings) {
  try {
    const token = sessionStorage.getItem('rtk_api_key') || '';
    await fetch(BOOKING_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify(bookings)
    });
  } catch (err) {
    // Keep admin usable without API connection.
  }
}
function genBookingId() {
  return 'bk-' + Math.random().toString(36).substr(2, 9);
}

// ── FORMAT HELPERS ────────────────────────────────────────────────────────
function formatRp(num) {
  return 'Rp ' + parseInt(num || 0).toLocaleString('id-ID');
}
function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}
function daysBetween(start, end) {
  const a = new Date(start), b = new Date(end);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
function getCatLabel(key) {
  const m = { 'kamera-digital':'Kamera', 'action-cam':'Action', 'dslr':'DSLR',
               'mirrorless':'Mirrorless', 'camcorder':'Camcorder', 'lensa':'Lensa',
               'aksesoris':'Aksesoris', 'paket':'Paket' };
  return m[key] || key;
}
function statusBadge(s) {
  const map = {
    pending:   ['badge-orange','Pending'],
    confirmed: ['badge-blue','Dikonfirmasi'],
    active:    ['badge-green','Aktif'],
    done:      ['badge-gray','Selesai'],
    cancelled: ['badge-red','Dibatalkan'],
  };
  const [cls, label] = map[s] || ['badge-gray', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── AUTH ───────────────────────────────────────────────────────────────────
function isAuthenticated() { return sessionStorage.getItem(SESSION_KEY) === 'true'; }
async function login(username, pw) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pw })
    });
    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem(SESSION_KEY, 'true');
      sessionStorage.setItem('rtk_api_key', data.token);
      sessionStorage.setItem('rtk_role', data.role);
      sessionStorage.setItem('rtk_username', data.username);
      return true;
    }
  } catch (err) {
    console.error('Login error', err);
  }
  return false;
}
function logout() { 
  sessionStorage.removeItem(SESSION_KEY); 
  sessionStorage.removeItem('rtk_api_key'); 
  sessionStorage.removeItem('rtk_role'); 
  sessionStorage.removeItem('rtk_username'); 
  location.reload(); 
}

// ── BOOT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const gate     = document.getElementById('login-gate');
  const body     = document.getElementById('admin-body');
  const errMsg   = document.getElementById('login-error');
  const loginForm= document.getElementById('login-form');
  const userInput= document.getElementById('login-username');
  const pwInput  = document.getElementById('login-password');

  body.style.visibility = 'visible';

  if (isAuthenticated()) {
    gate.classList.add('hidden');
    await initDashboard();
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (await login(userInput.value.trim(), pwInput.value.trim())) {
      errMsg.style.display = 'none';
      gate.classList.add('hidden');
      setTimeout(() => gate.remove(), 380);
      await initDashboard();
    } else {
      errMsg.style.display = 'flex';
      pwInput.value = '';
      pwInput.focus();
      const f = pwInput.closest('.login-field');
      f.style.animation = 'none'; f.offsetHeight;
      f.style.animation = 'shake .35s ease';
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

function applyRoleRestrictions() {
  const role = sessionStorage.getItem('rtk_role');
  if (role === 'staff') {
    // Hide restricted sidebar tabs
    document.querySelector('.nav-item[data-tab="keuangan"]')?.remove();
    document.querySelector('.nav-item[data-tab="blacklist"]')?.remove();
    // Add global CSS class to hide admin-only elements
    document.body.classList.add('role-staff');
  }
  // Display active username
  const name = sessionStorage.getItem('rtk_username') || role;
  document.getElementById('logout-btn').innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Logout (${name})`;
}

async function initDashboard() {
  initDatabase();
  applyRoleRestrictions();
  if (typeof syncProductsFromApi === 'function') await syncProductsFromApi();
  await syncBookingsFromApi();
  await loadDashboardStats();

  // ── Tab switching ──────────────────────────────────────────────────────
  const topbarTitles = {
    katalog:    { h:'Katalog Produk',       p:'Kelola daftar kamera dan aksesoris RTK' },
    stok:       { h:'Stok & Ketersediaan',  p:'Pantau unit tiap produk secara real-time' },
    pemesanan:  { h:'Manajemen Pemesanan',  p:'Catat dan pantau semua booking pelanggan' },
    kyc:        { h:'Persetujuan KYC',      p:'Verifikasi identitas (KTP & Selfie) customer baru' },
    kalender:   { h:'Kalender & Timeline',  p:'Visualisasi jadwal penyewaan per bulan' },
    keuangan:   { h:'Laporan Keuangan',     p:'Analitik omzet, deposit, dan top produk' },
    blacklist:  { h:'Blacklist Pelanggan',  p:'Kelola daftar pelanggan yang diblokir dari pemesanan' },
    monitoring: { h:'Monitoring GPS',       p:'Pantau lokasi barang sewaan secara real-time' },
  };
  const topbarActions = {
    katalog:    ['add-product-btn', 'import-json-btn', 'export-json-btn'],
    stok:       [],
    pemesanan:  ['add-booking-btn', 'export-bookings-btn'],
    kyc:        [],
    kalender:   [],
    keuangan:   [],
    blacklist:  [],
    monitoring: [],
  };

  // Lazy-init flags for new tabs
  let _blacklistInited  = false;
  let _monitoringInited = false;
  let _keuanganInited   = false;
  let _kycInited        = false;

  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.dataset.tab;
      document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('tab-' + tab).classList.add('active');

      const t = topbarTitles[tab];
      if (t) document.getElementById('topbar-title').innerHTML = `<h1>${t.h}</h1><p>${t.p}</p>`;

      // Refresh relevant tab
      if (tab === 'stok')      renderStok();
      if (tab === 'pemesanan') renderBookings();
      if (tab === 'kalender')  renderKalender();
      if (tab === 'kyc') {
        if (!_kycInited) { initKycApproval(); _kycInited = true; }
        else renderKycList();
      }
      if (tab === 'keuangan') {
        if (!_keuanganInited) { initKeuangan(); _keuanganInited = true; }
        else renderKeuangan();
      }
      if (tab === 'blacklist') {
        if (!_blacklistInited) { initBlacklist(); _blacklistInited = true; }
        else renderBlacklist();
      }
      if (tab === 'monitoring') {
        if (!_monitoringInited) { initMonitoring(); _monitoringInited = true; }
        else loadTrackingData();
      }
    });
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Yakin mau logout?')) logout();
  });

  // ── Init all tabs ──────────────────────────────────────────────────────
  initKatalog();
  initPemesanan();
  initKalender();
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1: KATALOG
// ════════════════════════════════════════════════════════════════════════════
function initKatalog() {
  let products = getProducts();

  // Search
  document.getElementById('katalog-search').addEventListener('input', e => {
    renderKatalog(e.target.value.toLowerCase());
  });

  // Tambah produk
  const modal      = document.getElementById('product-modal');
  const form       = document.getElementById('product-form');
  const btnAdd     = document.getElementById('add-product-btn');
  const btnClose   = document.getElementById('close-product-modal');
  const btnCancel  = document.getElementById('cancel-product-btn');
  const modalTitle = document.getElementById('product-modal-title');

  btnAdd.addEventListener('click', () => openProductModal());
  btnClose.addEventListener('click', closeProductModal);
  btnCancel.addEventListener('click', closeProductModal);

  function openProductModal(id = null) {
    modal.classList.add('active');
    if (id) {
      modalTitle.textContent = 'Edit Produk';
      const p = products.find(x => x.id === id);
      document.getElementById('form-id').value              = p.id;
      document.getElementById('form-name').value            = p.name;
      document.getElementById('form-category').value        = p.category;
      document.getElementById('form-units').value           = p.units || 1;
      document.getElementById('form-normal-price').value    = p.normalPrice;
      document.getElementById('form-sale-price').value      = p.salePrice || '';
      document.getElementById('form-image').value           = p.imageUrl;
      document.getElementById('form-description').value     = p.description || '';
      document.getElementById('form-serials').value         = (p.serialNumbers || []).join('\n');
    } else {
      modalTitle.textContent = 'Tambah Produk Baru';
      form.reset();
      document.getElementById('form-id').value = '';
    }
  }

  function closeProductModal() {
    modal.classList.remove('active');
    form.reset();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('form-id').value;
    const serialsRaw = document.getElementById('form-serials')?.value.trim();
    const serialNumbers = serialsRaw
      ? serialsRaw.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined;
    const prod = {
      id:          id || ('prod-' + Math.random().toString(36).substr(2, 9)),
      name:        document.getElementById('form-name').value.trim(),
      category:    document.getElementById('form-category').value,
      units:       parseInt(document.getElementById('form-units').value) || 1,
      normalPrice: parseInt(document.getElementById('form-normal-price').value),
      salePrice:   parseInt(document.getElementById('form-sale-price').value) || 0,
      imageUrl:    document.getElementById('form-image').value.trim(),
      description: document.getElementById('form-description').value.trim() || undefined,
      serialNumbers: serialNumbers && serialNumbers.length > 0 ? serialNumbers : undefined,
    };
    prod.isPromo = prod.salePrice > 0 && prod.salePrice < prod.normalPrice;
    if (!prod.description)   delete prod.description;
    if (!prod.serialNumbers) delete prod.serialNumbers;

    if (id) {
      const idx = products.findIndex(p => p.id === id);
      products[idx] = prod;
      fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sessionStorage.getItem('rtk_api_key') || '' },
        body: JSON.stringify(prod)
      }).catch(console.error);
    } else {
      products.push(prod);
      fetch(`/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sessionStorage.getItem('rtk_api_key') || '' },
        body: JSON.stringify(prod)
      }).catch(console.error);
    }
    
    // Update local cache without doing a full array sync
    localStorage.setItem('rtk_products', JSON.stringify(products));
    renderKatalog();
    closeProductModal();
  });

  // Export catalog JSON backup
  document.getElementById('export-json-btn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(products, null, 2));
    a.download = `rtk_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });

  // Import catalog JSON backup
  const importFileInput = document.getElementById('import-file-input');
  document.getElementById('import-json-btn').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text     = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) { alert('File tidak valid: harus berupa array JSON'); return; }
      if (!confirm(`Restore ${imported.length} produk dari file backup? Data produk saat ini akan diganti.`)) return;
      const token = sessionStorage.getItem('rtk_api_key') || '';
      const res   = await fetch('/api/products', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': token },
        body:    JSON.stringify(imported),
      });
      if (res.ok) {
        products = imported;
        localStorage.setItem('rtk_products', JSON.stringify(products));
        renderKatalog();
        alert(`✓ ${imported.length} produk berhasil di-restore!`);
      } else {
        alert('Restore gagal: ' + (await res.text()));
      }
    } catch (err) {
      alert('File tidak bisa dibaca: ' + err.message);
    }
    importFileInput.value = '';
  });

  // Also wire "add-booking-btn" in pemesanan tab topbar overrides
  renderKatalog();

  function deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    
    // Delete from API then update local
    const token = sessionStorage.getItem('rtk_api_key') || '';
    fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'x-api-key': token }
    }).catch(console.error);

    products = products.filter(p => p.id !== id);
    localStorage.setItem('rtk_products', JSON.stringify(products)); // local update
    renderKatalog();
  }

  window._editProduct   = openProductModal;
  window._deleteProduct = deleteProduct;
}

function renderKatalog(filter = '') {
  const products = getProducts();
  const tbody = document.getElementById('katalog-tbody');
  document.getElementById('stat-total').textContent = products.length;
  document.getElementById('stat-promo').textContent = products.filter(p => p.isPromo).length;

  const list = filter ? products.filter(p => p.name.toLowerCase().includes(filter)) : products;
  tbody.innerHTML = '';

  list.forEach(p => {
    const tr = document.createElement('tr');
    const sale = p.isPromo && p.salePrice > 0
      ? `<span style="color:#16a34a;font-weight:700;">${formatRp(p.salePrice)}</span>`
      : `<span style="color:#94a3b8;">—</span>`;
    tr.innerHTML = `
      <td><img src="${p.imageUrl}" class="thumb-img"
          onerror="this.src='https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=200'"></td>
      <td style="font-weight:600;max-width:180px;">${p.name}</td>
      <td><span class="badge badge-blue">${getCatLabel(p.category)}</span></td>
      <td>${formatRp(p.normalPrice)}</td>
      <td>${sale}</td>
      <td style="font-weight:700;">${p.units || 1}</td>
      <td>
        <div class="action-btn-group">
          <button class="btn btn-sm secondary admin-only" onclick="window._editProduct('${p.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm danger admin-only" onclick="window._deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2: STOK
// ════════════════════════════════════════════════════════════════════════════
function renderStok(filter = '') {
  const products = getProducts().filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase())
  );
  const allBookings = getBookings();
  const today = new Date().toISOString().slice(0,10);

  // Wire search once (guard with a flag)
  if (!renderStok._searchWired) {
    renderStok._searchWired = true;
    const searchEl = document.getElementById('stok-search');
    if (searchEl) searchEl.addEventListener('input', e => renderStok(e.target.value));
  }

  // Count rented per product (active bookings overlapping today)
  const rentedMap = {};
  allBookings.forEach(b => {
    if (b.status === 'cancelled' || b.status === 'done') return;
    if (b.startDate <= today && b.endDate >= today) {
      (b.items || []).forEach(item => {
        rentedMap[item.productId] = (rentedMap[item.productId] || 0) + (item.qty || 1);
      });
    }
  });

  let totalUnits = 0, totalRenting = 0, totalAvail = 0;

  const tbody = document.getElementById('stok-tbody');
  tbody.innerHTML = '';

  products.forEach(p => {
    const units   = p.units || 1;
    const rented  = rentedMap[p.id] || 0;
    const avail   = Math.max(0, units - rented);
    const pct     = Math.round((avail / units) * 100);

    totalUnits   += units;
    totalRenting += rented;
    totalAvail   += avail;

    const barClass = pct === 0 ? 'avail-zero' : pct < 50 ? 'avail-partial' : 'avail-full';
    const statusBadgeHtml = pct === 0
      ? `<span class="badge badge-red">Habis</span>`
      : pct === 100
      ? `<span class="badge badge-green">Tersedia</span>`
      : `<span class="badge badge-orange">Sebagian</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600;">${p.name}</td>
      <td><span class="badge badge-blue">${getCatLabel(p.category)}</span></td>
      <td style="font-weight:700;">${units}</td>
      <td style="color:${rented>0?'#ea580c':'#94a3b8'};font-weight:600;">${rented}</td>
      <td>
        <div style="font-weight:700;color:${avail>0?'#16a34a':'#ef4444'}">${avail}</div>
        <div class="avail-bar"><div class="avail-bar-fill ${barClass}" style="width:${pct}%"></div></div>
      </td>
      <td>${statusBadgeHtml}</td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('stat-stok-total').textContent     = totalUnits;
  document.getElementById('stat-stok-renting').textContent   = totalRenting;
  document.getElementById('stat-stok-available').textContent = totalAvail;
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3: PEMESANAN
// ════════════════════════════════════════════════════════════════════════════
function initPemesanan() {
  const modal      = document.getElementById('booking-modal');
  const form       = document.getElementById('booking-form');
  const btnAdd     = document.getElementById('add-booking-btn');
  const btnClose   = document.getElementById('close-booking-modal');
  const btnCancel  = document.getElementById('cancel-booking-btn');
  const btnAddItem = document.getElementById('add-booking-item');

  // Detail modal
  const detailModal    = document.getElementById('booking-detail-modal');
  const btnCloseDetail = document.getElementById('close-detail-modal');
  const btnDetailEdit  = document.getElementById('detail-edit-btn');
  const btnDetailPrint = document.getElementById('detail-print-btn');
  let   _detailOpenId  = null;

  btnCloseDetail.addEventListener('click', () => detailModal.classList.remove('active'));
  btnDetailEdit.addEventListener('click', () => {
    detailModal.classList.remove('active');
    if (_detailOpenId) openBookingModal(_detailOpenId);
  });
  btnDetailPrint.addEventListener('click', () => {
    if (_detailOpenId) printInvoice(_detailOpenId);
  });

  let editingId = null;

  btnAdd.addEventListener('click', () => openBookingModal());
  btnClose.addEventListener('click', closeBookingModal);
  btnCancel.addEventListener('click', closeBookingModal);

  // Search
  document.getElementById('booking-search').addEventListener('input', e => {
    renderBookings(e.target.value.toLowerCase());
  });

  function openBookingModal(id = null) {
    editingId = id;
    modal.classList.add('active');
    document.getElementById('booking-modal-title').textContent = id ? 'Edit Pemesanan' : 'Tambah Pemesanan';

    if (id) {
      const b = getBookings().find(x => x.id === id);
      document.getElementById('bform-id').value    = b.id;
      document.getElementById('bform-name').value  = b.customerName;
      document.getElementById('bform-phone').value = b.customerPhone;
      document.getElementById('bform-start').value = b.startDate;
      document.getElementById('bform-end').value   = b.endDate;
      document.getElementById('bform-notes').value = b.notes || '';
      document.getElementById('bform-status').value= b.status;
      // Deposit fields
      document.getElementById('bform-deposit').value          = b.deposit?.amount || '';
      document.getElementById('bform-deposit-method').value   = b.deposit?.method || '';
      document.getElementById('bform-deposit-status').value   = b.deposit?.status || 'pending';
      renderBookingItemRows(b.items || []);
    } else {
      form.reset();
      document.getElementById('bform-id').value = '';
      document.getElementById('bform-start').value = new Date().toISOString().slice(0,10);
      document.getElementById('bform-end').value   = new Date(Date.now()+86400000).toISOString().slice(0,10);
      renderBookingItemRows([{ productId: '', qty: 1 }]);
    }
    updateBookingTotal();
  }

  function closeBookingModal() {
    modal.classList.remove('active');
    form.reset();
    editingId = null;
  }

  function renderBookingItemRows(items) {
    const products = getProducts();
    const container = document.getElementById('booking-items-list');
    container.innerHTML = '';
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'booking-item-row';
      const opts = products.map(p =>
        `<option value="${p.id}" ${p.id===item.productId?'selected':''}>${p.name} (${formatRp(p.isPromo&&p.salePrice?p.salePrice:p.normalPrice)}/hr)</option>`
      ).join('');
      row.innerHTML = `
        <select class="item-product" data-idx="${idx}">
          <option value="">— Pilih Produk —</option>${opts}
        </select>
        <input type="number" class="item-qty" data-idx="${idx}" min="1" value="${item.qty||1}" placeholder="Qty">
        <button type="button" class="btn-icon remove-item" data-idx="${idx}" title="Hapus"><i class="fa-solid fa-xmark"></i></button>`;
      container.appendChild(row);
    });
    // Bind change events
    container.querySelectorAll('.item-product,.item-qty').forEach(el => {
      el.addEventListener('change', updateBookingTotal);
    });
    container.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.booking-item-row').remove();
        updateBookingTotal();
      });
    });
  }

  function getBookingItemRowsData() {
    return Array.from(document.querySelectorAll('.booking-item-row')).map(row => ({
      productId: row.querySelector('.item-product').value,
      qty:       parseInt(row.querySelector('.item-qty').value) || 1,
    })).filter(x => x.productId);
  }

  function updateBookingTotal() {
    const products = getProducts();
    const start = document.getElementById('bform-start').value;
    const end   = document.getElementById('bform-end').value;
    const days  = (start && end) ? daysBetween(start, end) : 1;
    const items = getBookingItemRowsData();
    let total = 0;
    items.forEach(item => {
      const p = products.find(x => x.id === item.productId);
      if (!p) return;
      const price = p.isPromo && p.salePrice ? p.salePrice : p.normalPrice;
      total += price * item.qty * days;
    });
    document.getElementById('bform-total').textContent = formatRp(total);
  }

  btnAddItem.addEventListener('click', () => {
    const container = document.getElementById('booking-items-list');
    const existing = getBookingItemRowsData();
    renderBookingItemRows([...existing, { productId:'', qty:1 }]);
  });

  document.getElementById('bform-start').addEventListener('change', updateBookingTotal);
  document.getElementById('bform-end').addEventListener('change', updateBookingTotal);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const products = getProducts();
    const start = document.getElementById('bform-start').value;
    const end   = document.getElementById('bform-end').value;
    const days  = daysBetween(start, end);
    const items = getBookingItemRowsData();

    let total = 0;
    items.forEach(item => {
      const p = products.find(x => x.id === item.productId);
      if (!p) return;
      const price = p.isPromo && p.salePrice ? p.salePrice : p.normalPrice;
      total += price * item.qty * days;
    });

    const depositAmount = parseInt(document.getElementById('bform-deposit').value) || 0;
    const depositMethod = document.getElementById('bform-deposit-method').value;
    const depositStatus = document.getElementById('bform-deposit-status').value;

    const booking = {
      id:           document.getElementById('bform-id').value || genBookingId(),
      customerName: document.getElementById('bform-name').value.trim(),
      customerPhone:document.getElementById('bform-phone').value.trim(),
      startDate:    start,
      endDate:      end,
      notes:        document.getElementById('bform-notes').value.trim(),
      status:       document.getElementById('bform-status').value,
      items,
      totalPrice: total,
      deposit: depositAmount > 0 ? {
        amount: depositAmount,
        method: depositMethod,
        status: depositStatus,
        createdAt: new Date().toISOString(),
      } : undefined,
    };

    let bookings = getBookings();
    if (editingId) {
      const idx = bookings.findIndex(b => b.id === editingId);
      bookings[idx] = booking;
      // Use PATCH for partial updates to avoid overwriting server-side timestamps
      fetch(`/api/bookings/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sessionStorage.getItem('rtk_api_key') || '' },
        body: JSON.stringify(booking)
      }).catch(console.error);
    } else {
      bookings.push(booking);
      fetch(`/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sessionStorage.getItem('rtk_api_key') || '' },
        body: JSON.stringify(booking)
      }).catch(console.error);
    }
    
    // Update local cache without full array sync
    localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
    renderBookings();
    closeBookingModal();
  });

  window._editBooking   = openBookingModal;
  window._deleteBooking = (id) => {
    if (!confirm('Hapus pemesanan ini?')) return;
    
    fetch(`/api/bookings/${id}`, {
      method: 'DELETE',
      headers: { 'x-api-key': sessionStorage.getItem('rtk_api_key') || '' }
    }).catch(console.error);

    const bookings = getBookings().filter(b => b.id !== id);
    localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
    renderBookings();
  };
  window._viewBooking = (id) => {
    _detailOpenId = id;
    const b = getBookings().find(x => x.id === id);
    const products = getProducts();
    const items = (b.items||[]).map(item => {
      const p = products.find(x => x.id === item.productId);
      const name = p ? p.name : 'Produk tidak ditemukan';
      const price = p ? (p.isPromo && p.salePrice ? p.salePrice : p.normalPrice) : 0;
      const days = daysBetween(b.startDate, b.endDate);
      return `<tr>
        <td>${name}</td>
        <td style="text-align:center;">${item.qty}</td>
        <td>${formatRp(price)}/hari</td>
        <td style="font-weight:700;">${formatRp(price*item.qty*days)}</td>
      </tr>`;
    }).join('');

    const kycHtml = b.kyc ? `
      <div style="margin-top:1rem;border-top:1px solid #e2e8f0;padding-top:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
          <div style="font-weight:700;font-size:.8rem;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Verifikasi KYC</div>
          ${b.kyc.verified
            ? '<span style="font-size:.75rem;color:#16a34a;font-weight:700;"><i class="fa-solid fa-shield-check"></i> Terverifikasi</span>'
            : `<button class="btn btn-sm primary" onclick="window._verifyKyc('${b.id}')"><i class="fa-solid fa-shield-check"></i> Verifikasi</button>`}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
          ${b.kyc.ktpImage ? `<div><div style="font-size:.72rem;color:#94a3b8;margin-bottom:.25rem;">Foto KTP</div><img src="${b.kyc.ktpImage}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;" onclick="window.open(this.src,'_blank')"></div>` : ''}
          ${b.kyc.selfieImage ? `<div><div style="font-size:.72rem;color:#94a3b8;margin-bottom:.25rem;">Selfie</div><img src="${b.kyc.selfieImage}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;" onclick="window.open(this.src,'_blank')"></div>` : ''}
        </div>
        <div style="font-size:.72rem;color:#94a3b8;margin-top:.35rem;">Upload: ${b.kyc.submittedAt ? b.kyc.submittedAt.slice(0,16).replace('T',' ') : '—'}</div>
      </div>` : '<div style="margin-top:.75rem;font-size:.82rem;color:#94a3b8;">Tidak ada data KYC</div>';

    document.getElementById('booking-detail-content').innerHTML = `
      <table style="width:100%;margin-bottom:1rem;font-size:.88rem;">
        <tr><td style="color:#64748b;width:140px;padding:.3rem 0;">Pelanggan</td><td style="font-weight:700;">${b.customerName}</td></tr>
        <tr><td style="color:#64748b;padding:.3rem 0;">WhatsApp</td><td><a href="https://wa.me/${b.customerPhone.replace(/\D/g,'')}" target="_blank" style="color:#16a34a;font-weight:600;">${b.customerPhone}</a></td></tr>
        <tr><td style="color:#64748b;padding:.3rem 0;">Tanggal</td><td>${formatDate(b.startDate)} — ${formatDate(b.endDate)} (${daysBetween(b.startDate,b.endDate)} hari)</td></tr>
        <tr><td style="color:#64748b;padding:.3rem 0;">Status</td><td>${statusBadge(b.status)}</td></tr>
        ${b.notes ? `<tr><td style="color:#64748b;padding:.3rem 0;">Catatan</td><td>${b.notes}</td></tr>` : ''}
      </table>
      <div style="font-weight:700;font-size:.8rem;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.5rem;">Produk Disewa</div>
      <table style="width:100%;border-collapse:collapse;font-size:.875rem;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:.5rem;text-align:left;font-size:.75rem;color:#64748b;">Produk</th>
          <th style="padding:.5rem;text-align:center;font-size:.75rem;color:#64748b;">Qty</th>
          <th style="padding:.5rem;font-size:.75rem;color:#64748b;">Harga</th>
          <th style="padding:.5rem;font-size:.75rem;color:#64748b;">Subtotal</th>
        </tr></thead>
        <tbody>${items}</tbody>
        <tfoot><tr>
          <td colspan="3" style="padding:.5rem;font-weight:700;text-align:right;color:#0f172a;">Total Estimasi</td>
          <td style="padding:.5rem;font-weight:800;color:#16a34a;">${formatRp(b.totalPrice)}</td>
        </tr></tfoot>
      </table>
      ${kycHtml}
      ${b.deposit ? (() => {
        const depStatusMap = { pending:'🟡 Belum Dibayar', paid:'🟢 Sudah Dibayar', returned:'🔵 Dikembalikan', forfeited:'🔴 Hangus' };
        const depMethodMap = { cash:'Cash / Tunai', transfer:'Transfer Bank', qris:'QRIS', ewallet:'E-Wallet' };
        return `<div style="margin-top:1rem;border:1.5px solid #e0f2fe;border-radius:10px;padding:.9rem;background:#f0f9ff;">
          <div style="font-size:.78rem;font-weight:800;color:#0369a1;margin-bottom:.5rem;">🛡 Deposit / Jaminan</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;font-size:.82rem;">
            <div><span style="color:#64748b;">Jumlah</span><br><strong>${formatRp(b.deposit.amount)}</strong></div>
            <div><span style="color:#64748b;">Metode</span><br><strong>${depMethodMap[b.deposit.method] || b.deposit.method || '—'}</strong></div>
            <div><span style="color:#64748b;">Status</span><br><strong>${depStatusMap[b.deposit.status] || b.deposit.status}</strong></div>
          </div>
        </div>`;
      })() : ''}
      <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap;">
        <button class="btn secondary" onclick="window._openChecklist('${b.id}')" style="color:#059669;border-color:#6ee7b7;">
          <i class="fa-solid fa-clipboard-check"></i> Checklist
        </button>
        <button class="btn secondary" onclick="window._openFine('${b.id}')" style="color:#dc2626;border-color:#fca5a5;">
          <i class="fa-solid fa-clock-rotate-left"></i> Hitung Denda
        </button>
        <button class="btn secondary" onclick="window._addToBlacklist('${b.customerPhone}','${b.customerName}')" style="color:#7c3aed;border-color:#c4b5fd;">
          <i class="fa-solid fa-ban"></i> Blacklist
        </button>
      </div>`;
    detailModal.classList.add('active');
  };

  window._verifyKyc = async function(id) {
    if (!confirm('Tandai KYC booking ini sebagai TERVERIFIKASI?')) return;
    const token = sessionStorage.getItem('rtk_api_key') || '';
    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === id);
    if (idx === -1) return;
    bookings[idx].kyc = { ...(bookings[idx].kyc || {}), verified: true, verifiedAt: new Date().toISOString() };
    localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify({ kyc: bookings[idx].kyc }),
    });
    window._viewBooking(id);
    renderBookings();
  };

  window._openFine = function(id) {
    const b = getBookings().find(x => x.id === id);
    if (!b) return;
    const products = getProducts();
    const avgPrice = (b.items || []).reduce((s, item) => {
      const p = products.find(x => x.id === item.productId);
      return s + (p ? (p.isPromo && p.salePrice ? p.salePrice : p.normalPrice) : 0);
    }, 0) / Math.max(1, (b.items||[]).length);
    const params = new URLSearchParams({
      action: 'fine', pricePerDay: Math.round(avgPrice),
      dueDate: b.endDate, phone: b.customerPhone,
    });
    window.open(`/index.html?${params.toString()}#fine`, '_blank');
  };

  window._addToBlacklist = async function(phone, name) {
    const reason = prompt(`Alasan blacklist ${name} (${phone})?`);
    if (!reason) return;
    const token = sessionStorage.getItem('rtk_api_key') || '';
    const res = await fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify({ phone, name, reason }),
    });
    if (res.status === 409) { alert('Nomor sudah ada di blacklist'); return; }
    if (res.ok) alert(`\u2713 ${name} berhasil ditambahkan ke blacklist`);
    else alert('Gagal: ' + (await res.text()));
  };

  // Export bookings to CSV
  document.getElementById('export-bookings-btn').addEventListener('click', () => {
    const bookings  = getBookings();
    const products  = getProducts();
    const headers   = ['ID','Pelanggan','WhatsApp','Produk','Mulai','Selesai','Total','Status','Dibuat'];
    const escape    = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows      = bookings.map(b => {
      const itemStr = (b.items || []).map(i => {
        const p = products.find(x => x.id === i.productId);
        return `${p ? p.name : i.productId} x${i.qty}`;
      }).join(' | ');
      return [
        escape(b.id), escape(b.customerName), escape(b.customerPhone),
        escape(itemStr), escape(b.startDate), escape(b.endDate),
        escape(b.totalPrice || 0), escape(b.status), escape(b.createdAt),
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const a   = document.createElement('a');
    a.href    = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = `rtk_bookings_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  });

  renderBookings();
}

function renderBookings(filter = '') {
  let bookings = getBookings();
  document.getElementById('stat-book-total').textContent  = bookings.length;
  document.getElementById('stat-book-active').textContent = bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length;
  document.getElementById('stat-book-done').textContent   = bookings.filter(b => b.status === 'done').length;

  if (filter) bookings = bookings.filter(b => b.customerName.toLowerCase().includes(filter));

  const tbody = document.getElementById('booking-tbody');
  tbody.innerHTML = '';

  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#94a3b8;">Belum ada pemesanan. Tambahkan booking pertama!</td></tr>`;
    return;
  }

  const products = getProducts();
  bookings.slice().reverse().forEach((b, idx) => {
    const itemNames = (b.items||[]).map(item => {
      const p = products.find(x => x.id === item.productId);
      return p ? `${p.name} ×${item.qty}` : '?';
    }).join(', ');

    // Inline status select — fires PATCH immediately on change
    const statusOptions = [
      ['pending','Pending'],['confirmed','Dikonfirmasi'],
      ['active','Aktif'],['done','Selesai'],['cancelled','Dibatalkan'],
    ].map(([val, label]) =>
      `<option value="${val}" ${b.status === val ? 'selected' : ''}>${label}</option>`
    ).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#94a3b8;font-size:.8rem;">#${bookings.length - idx}</td>
      <td style="font-weight:700;">${b.customerName}</td>
      <td style="font-size:.82rem;color:#475569;">${b.customerPhone}</td>
      <td style="max-width:180px;font-size:.8rem;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemNames}">${itemNames || '—'}</td>
      <td style="font-size:.82rem;">${formatDate(b.startDate)}</td>
      <td style="font-size:.82rem;">${formatDate(b.endDate)}</td>
      <td style="font-weight:700;color:#16a34a;font-size:.875rem;">${formatRp(b.totalPrice)}</td>
      <td>
        <select class="inline-status-select" data-id="${b.id}" style="font-size:.78rem;padding:.2rem .4rem;border-radius:6px;border:1px solid #e2e8f0;font-family:inherit;cursor:pointer;">
          ${statusOptions}
        </select>
      </td>
      <td>
        <div class="action-btn-group">
          <button class="btn btn-sm secondary" onclick="window._viewBooking('${b.id}')" title="Detail"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-sm secondary admin-only" onclick="window._editBooking('${b.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm secondary" onclick="window._openChecklist('${b.id}')" title="Checklist Kondisi" style="color:#059669;"><i class="fa-solid fa-clipboard-check"></i></button>
          <button class="btn btn-sm secondary" onclick="window._openFine('${b.id}')" title="Hitung Denda" style="color:#ea580c;"><i class="fa-solid fa-clock-rotate-left"></i></button>
          <button class="btn btn-sm danger admin-only" onclick="window._deleteBooking('${b.id}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div>
        ${b.kyc ? (b.kyc.verified
          ? '<div style="font-size:.7rem;color:#16a34a;margin-top:.25rem;"><i class="fa-solid fa-shield-check"></i> KYC \u2713</div>'
          : '<div style="font-size:.7rem;color:#f59e0b;margin-top:.25rem;"><i class="fa-solid fa-shield-halved"></i> KYC pending</div>')
          : ''}
        ${b.checklist ? (() => {
          const hasPickup = !!b.checklist.pickup;
          const hasReturn = !!b.checklist.return;
          const hasIssue  = [b.checklist.pickup, b.checklist.return].some(cl => cl && cl.items && cl.items.some(i => i.status === 'rusak' || i.status === 'tidak-ada'));
          return `<div style="font-size:.7rem;margin-top:.25rem;${hasIssue?'color:#dc2626;':'color:#059669;'}">
            <i class="fa-solid fa-clipboard-check"></i>
            ${hasPickup ? '📦' : '○'} ${hasReturn ? '↩' : '○'}${hasIssue ? ' ⚠' : ''}
          </div>`;
        })() : ''}
      </td>`;
    tbody.appendChild(tr);
  });

  // Wire inline status selects — apply color on load too
  const STATUS_COLORS = { pending:'#fff7ed', confirmed:'#eff6ff', active:'#f0fdf4', done:'#f8fafc', cancelled:'#fef2f2' };
  tbody.querySelectorAll('.inline-status-select').forEach(sel => {
    // Apply color immediately on render
    sel.style.background = STATUS_COLORS[sel.value] || '';
    sel.addEventListener('change', async () => {
      const id        = sel.dataset.id;
      const newStatus = sel.value;
      const token     = sessionStorage.getItem('rtk_api_key') || '';
      // Optimistic local update
      const bookings = getBookings();
      const idx      = bookings.findIndex(b => b.id === id);
      if (idx !== -1) {
        bookings[idx].status = newStatus;
        localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
        sel.style.background = STATUS_COLORS[newStatus] || '';
      }
      // Persist to server
      try {
        await fetch(`/api/bookings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-api-key': token },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch (err) { console.error('Status update failed', err); }
      // Refresh stat cards + pending badge
      await loadDashboardStats();
      // Re-render stat row counts only
      const bks = getBookings();
      document.getElementById('stat-book-total').textContent  = bks.length;
      document.getElementById('stat-book-active').textContent = bks.filter(b => b.status === 'active' || b.status === 'confirmed').length;
      document.getElementById('stat-book-done').textContent   = bks.filter(b => b.status === 'done').length;
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4: KALENDER
// ════════════════════════════════════════════════════════════════════════════
let calYear, calMonth;

function initKalender() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth(); // 0-indexed

  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderKalender();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderKalender();
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth();
    renderKalender();
  });
}

function renderKalender() {
  const bookings = getBookings().filter(b => b.status !== 'cancelled');
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni',
                      'Juli','Agustus','September','Oktober','November','Desember'];
  document.getElementById('cal-month-label').textContent = `${monthNames[calMonth]} ${calYear}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Day headers
  ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-header';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0,10);

  // Assign colours to bookings
  const bookingColors = {};
  bookings.forEach((b, i) => { bookingColors[b.id] = BOOKING_COLORS[i % BOOKING_COLORS.length]; });

  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell other-month';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (dateStr === todayStr ? ' today' : '');

    const dateNumEl = document.createElement('div');
    dateNumEl.className = 'cal-date';
    dateNumEl.textContent = d;
    cell.appendChild(dateNumEl);

    // Bookings on this day
    const dayBookings = bookings.filter(b => b.startDate <= dateStr && b.endDate >= dateStr);
    dayBookings.slice(0,3).forEach(b => {
      const ev = document.createElement('div');
      ev.className = 'cal-event';
      ev.style.background = bookingColors[b.id];
      ev.style.color = 'white';
      ev.textContent = b.customerName;
      ev.title = `${b.customerName} | ${formatDate(b.startDate)} – ${formatDate(b.endDate)}`;
      ev.addEventListener('click', () => window._viewBooking(b.id));
      cell.appendChild(ev);
    });

    if (dayBookings.length > 3) {
      const more = document.createElement('div');
      more.style.cssText = 'font-size:.6rem;color:#94a3b8;padding-left:.25rem;';
      more.textContent = `+${dayBookings.length - 3} lainnya`;
      cell.appendChild(more);
    }

    grid.appendChild(cell);
  }

  // Timeline
  renderTimeline(bookings, bookingColors);
}

function renderTimeline(bookings, colorMap) {
  const wrap = document.getElementById('timeline-wrap');
  wrap.innerHTML = '';

  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const firstDate  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
  const lastDate   = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

  // Filter to bookings overlapping this month
  const visible = bookings.filter(b =>
    b.startDate <= lastDate && b.endDate >= firstDate
  );

  if (visible.length === 0) {
    wrap.innerHTML = `<div class="timeline-empty">Tidak ada pemesanan di bulan ini.</div>`;
    return;
  }

  const products = getProducts();

  // Day markers header
  const markersEl = document.createElement('div');
  markersEl.className = 'timeline-day-markers';
  for (let d = 1; d <= daysInMonth; d++) {
    const m = document.createElement('div');
    m.className = 'timeline-day-marker';
    m.textContent = d % 5 === 1 || d === 1 ? d : '';
    markersEl.appendChild(m);
  }
  wrap.appendChild(markersEl);

  visible.forEach(b => {
    const itemNames = (b.items||[]).map(item => {
      const p = products.find(x => x.id === item.productId);
      return p ? p.name : '?';
    }).join(', ');

    const row = document.createElement('div');
    row.className = 'timeline-row';

    const label = document.createElement('div');
    label.className = 'timeline-label';
    label.title = b.customerName;
    label.textContent = b.customerName;
    row.appendChild(label);

    const track = document.createElement('div');
    track.className = 'timeline-track';

    // Clamp dates to month
    const clampStart = b.startDate < firstDate ? firstDate : b.startDate;
    const clampEnd   = b.endDate   > lastDate  ? lastDate  : b.endDate;

    const startDay = parseInt(clampStart.split('-')[2]) - 1; // 0-indexed
    const endDay   = parseInt(clampEnd.split('-')[2]) - 1;

    const leftPct  = (startDay / daysInMonth) * 100;
    const widthPct = ((endDay - startDay + 1) / daysInMonth) * 100;

    const bar = document.createElement('div');
    bar.className = 'timeline-bar';
    bar.style.left  = leftPct + '%';
    bar.style.width = widthPct + '%';
    bar.style.background = colorMap[b.id];
    bar.title = `${b.customerName}\n${formatDate(b.startDate)} – ${formatDate(b.endDate)}\n${itemNames}`;
    bar.textContent = itemNames;
    bar.addEventListener('click', () => window._viewBooking(b.id));

    track.appendChild(bar);
    row.appendChild(track);
    wrap.appendChild(row);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// INVOICE PRINT
// ════════════════════════════════════════════════════════════════════════════
function printInvoice(bookingId) {
  const b        = getBookings().find(x => x.id === bookingId);
  const products = getProducts();
  if (!b) return;

  const days = daysBetween(b.startDate, b.endDate);
  const rows = (b.items || []).map(item => {
    const p     = products.find(x => x.id === item.productId);
    const name  = p ? p.name : '—';
    const price = p ? (p.isPromo && p.salePrice ? p.salePrice : p.normalPrice) : 0;
    const sub   = price * (item.qty || 1) * days;
    return `<tr>
      <td>${name}</td>
      <td style="text-align:center">${item.qty || 1}</td>
      <td style="text-align:center">${days}</td>
      <td style="text-align:right">${formatRp(price)}</td>
      <td style="text-align:right;font-weight:700">${formatRp(sub)}</td>
    </tr>`;
  }).join('');

  const statusMap = {
    pending:'Pending', confirmed:'Dikonfirmasi',
    active:'Aktif', done:'Selesai', cancelled:'Dibatalkan'
  };

  const invoiceNo = 'INV-' + b.id.slice(-6).toUpperCase();
  const printDate = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNo} — RTK</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Plus Jakarta Sans',sans-serif;color:#0f172a;background:#f1f5f9;padding:2rem}
    .page{background:white;max-width:750px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
    .inv-header{background:#0f172a;color:white;padding:2rem 2.5rem;display:flex;justify-content:space-between;align-items:flex-start}
    .inv-header .brand{font-size:1.3rem;font-weight:800}
    .inv-header .brand span{color:#60a5fa}
    .inv-meta{text-align:right;font-size:.85rem;color:#94a3b8}
    .inv-meta strong{display:block;font-size:1.1rem;color:white;margin-bottom:.25rem}
    .inv-body{padding:2rem 2.5rem}
    .section-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:.6rem}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem}
    dl dt{font-size:.8rem;color:#64748b;margin-bottom:.15rem}
    dl dd{font-weight:700;margin-bottom:.5rem}
    table{width:100%;border-collapse:collapse;font-size:.875rem;margin-bottom:1.5rem}
    th{background:#f8fafc;padding:.6rem 1rem;text-align:left;font-size:.73rem;text-transform:uppercase;letter-spacing:.5px;color:#64748b}
    td{padding:.7rem 1rem;border-bottom:1px solid #f1f5f9}
    .total-row td{font-weight:800;font-size:1rem;border-bottom:none;background:#f8fafc}
    .status-pill{display:inline-block;padding:.2rem .65rem;border-radius:20px;font-size:.72rem;font-weight:700;background:#dcfce7;color:#16a34a}
    .inv-footer{padding:1.25rem 2.5rem;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:#94a3b8}
    @media print{
      body{background:white;padding:0}
      .page{box-shadow:none;border-radius:0}
      .no-print{display:none!important}
    }
  </style>
</head>
<body>
<div class="page">
  <div class="inv-header">
    <div>
      <div class="brand">📷 RTK <span>Tangerang</span></div>
      <div style="font-size:.8rem;color:#94a3b8;margin-top:.3rem">Rental Kamera Profesional</div>
      <div style="font-size:.75rem;color:#64748b;margin-top:.1rem">Kelapa Dua, Tangerang · 087870456785</div>
    </div>
    <div class="inv-meta">
      <strong>${invoiceNo}</strong>
      Dicetak: ${printDate}
      <div style="margin-top:.4rem"><span class="status-pill">${statusMap[b.status] || b.status}</span></div>
    </div>
  </div>

  <div class="inv-body">
    <div class="info-grid">
      <div>
        <p class="section-label">Data Pelanggan</p>
        <dl>
          <dt>Nama</dt><dd>${b.customerName}</dd>
          <dt>WhatsApp</dt><dd>${b.customerPhone}</dd>
        </dl>
      </div>
      <div>
        <p class="section-label">Periode Sewa</p>
        <dl>
          <dt>Mulai</dt><dd>${formatDate(b.startDate)}</dd>
          <dt>Selesai</dt><dd>${formatDate(b.endDate)} <span style="color:#64748b;font-weight:400">(${days} hari)</span></dd>
        </dl>
      </div>
    </div>

    <p class="section-label">Daftar Produk</p>
    <table>
      <thead><tr>
        <th>Produk</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:center">Hari</th>
        <th style="text-align:right">Harga/hari</th>
        <th style="text-align:right">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align:right">Total Estimasi</td>
          <td style="text-align:right;color:#16a34a">${formatRp(b.totalPrice)}</td>
        </tr>
      </tfoot>
    </table>

    ${b.notes ? `<div style="background:#f8fafc;border-radius:8px;padding:1rem;font-size:.85rem;color:#475569"><strong>Catatan:</strong> ${b.notes}</div>` : ''}
  </div>

  <div class="inv-footer">
    <span>Terima kasih telah mempercayakan rental Anda kepada RTK 🙏</span>
    <button class="no-print" onclick="window.print()" style="cursor:pointer;background:#2563eb;color:white;border:none;padding:.5rem 1.1rem;border-radius:6px;font-family:inherit;font-weight:700;font-size:.82rem">
      🖨️ Print / Save PDF
    </button>
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.focus(), 250);
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 5: BLACKLIST
// ════════════════════════════════════════════════════════════════════════════
let _blacklistData = [];

async function fetchBlacklist() {
  const token = sessionStorage.getItem('rtk_api_key') || '';
  const res   = await fetch('/api/blacklist', { headers: { 'x-api-key': token } });
  _blacklistData = res.ok ? await res.json() : [];
  return _blacklistData;
}

function renderBlacklist(filter = '') {
  const tbody  = document.getElementById('blacklist-tbody');
  const count  = document.getElementById('bl-count');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = filter
    ? _blacklistData.filter(b =>
        b.phone.includes(filter) ||
        (b.name || '').toLowerCase().includes(filter.toLowerCase())
      )
    : _blacklistData;

  if (count) count.textContent = _blacklistData.length;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:2rem;">Tidak ada data di blacklist</td></tr>`;
    return;
  }

  list.forEach((b, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#94a3b8;font-size:.8rem;">${i + 1}</td>
      <td><a href="https://wa.me/${b.phone.replace(/\D/g,'')}" target="_blank" style="color:#16a34a;font-weight:700;">
        <i class="fa-brands fa-whatsapp"></i> ${b.phone}
      </a></td>
      <td style="font-weight:600;">${b.name || '—'}</td>
      <td style="font-size:.82rem;color:#ef4444;">${b.reason || '—'}</td>
      <td style="font-size:.78rem;color:#94a3b8;">${b.createdAt ? b.createdAt.slice(0,10) : '—'}</td>
      <td>
        <button class="btn btn-sm danger" onclick="removeFromBlacklist('${b.id}')">
          <i class="fa-solid fa-trash"></i> Hapus
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function initBlacklist() {
  fetchBlacklist().then(() => renderBlacklist());

  // Search
  const searchEl = document.getElementById('bl-search');
  if (searchEl) searchEl.addEventListener('input', e => renderBlacklist(e.target.value));

  // Add form
  const form = document.getElementById('blacklist-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const phone  = document.getElementById('bl-phone').value.trim();
      const name   = document.getElementById('bl-name').value.trim();
      const reason = document.getElementById('bl-reason').value.trim();
      const token  = sessionStorage.getItem('rtk_api_key') || '';
      try {
        const res = await fetch('/api/blacklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': token },
          body: JSON.stringify({ phone, name, reason }),
        });
        if (res.status === 409) { alert('Nomor ini sudah ada di blacklist!'); return; }
        if (!res.ok) { alert('Gagal menambahkan: ' + (await res.text())); return; }
        form.reset();
        await fetchBlacklist();
        renderBlacklist();
      } catch (err) { alert('Error: ' + err.message); }
    });
  }
}

window.removeFromBlacklist = async function(id) {
  if (!confirm('Hapus dari blacklist?')) return;
  const token = sessionStorage.getItem('rtk_api_key') || '';
  const res = await fetch(`/api/blacklist/${id}`, {
    method: 'DELETE', headers: { 'x-api-key': token }
  });
  if (res.ok) {
    await fetchBlacklist();
    renderBlacklist();
  } else { alert('Gagal menghapus entry'); }
};

// ════════════════════════════════════════════════════════════════════════════
// TAB 6: GPS MONITORING
// ════════════════════════════════════════════════════════════════════════════
let _map      = null;
let _markers  = {};
let _trackingActive = [];

async function loadTrackingData() {
  const token = sessionStorage.getItem('rtk_api_key') || '';
  const res   = await fetch('/api/tracking/active', { headers: { 'x-api-key': token } });
  _trackingActive = res.ok ? await res.json() : [];

  const listEl    = document.getElementById('tracking-list');
  const countEl   = document.getElementById('tracking-count');
  const selBooking = document.getElementById('tr-booking');

  if (countEl) countEl.textContent = `${_trackingActive.length} terdeteksi`;

  // Populate booking select for manual update
  if (selBooking) {
    const all = getBookings().filter(b => b.status === 'active' || b.status === 'confirmed');
    selBooking.innerHTML = '<option value="">Pilih Booking Aktif...</option>' +
      all.map(b => `<option value="${b.id}">${b.customerName} — ${b.startDate} s/d ${b.endDate}</option>`).join('');
  }

  // Sidebar list
  if (listEl) {
    if (!_trackingActive.length) {
      listEl.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:1rem;"><i class="fa-solid fa-satellite-dish"></i><br>Tidak ada data lokasi aktif</div>';
    } else {
      listEl.innerHTML = _trackingActive.map(t => `
        <div style="padding:.6rem;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="_flyToMarker('${t.bookingId}')">
          <div style="font-weight:700;font-size:.82rem;color:#1e293b;">${t.customerName}</div>
          <div style="font-size:.75rem;color:#64748b;">${t.tracking.address || `${t.tracking.coords.lat.toFixed(5)}, ${t.tracking.coords.lng.toFixed(5)}`}</div>
          <div style="font-size:.7rem;color:#94a3b8;">⏱ ${t.tracking.lastUpdate.slice(0,16).replace('T',' ')}</div>
        </div>`).join('');
    }
  }

  // Update map markers
  if (_map) updateMapMarkers();
}

function updateMapMarkers() {
  // Clear old markers
  Object.values(_markers).forEach(m => _map.removeLayer(m));
  _markers = {};

  if (!_trackingActive.length) return;

  const bounds = [];
  _trackingActive.forEach(t => {
    const { lat, lng } = t.tracking.coords;
    const popup = `
      <div style="font-family:sans-serif;min-width:180px;">
        <div style="font-weight:800;font-size:.9rem;margin-bottom:.3rem;">${t.customerName}</div>
        <div style="font-size:.78rem;color:#64748b;">${t.tracking.address || 'Lokasi diketahui'}</div>
        <div style="font-size:.72rem;color:#94a3b8;margin-top:.3rem;">⏱ ${t.tracking.lastUpdate.slice(0,16).replace('T',' ')}</div>
        <hr style="margin:.5rem 0;border-color:#e2e8f0;">
        <a href="https://wa.me/${t.customerPhone}" target="_blank" style="color:#16a34a;font-weight:600;font-size:.78rem;">
          📞 ${t.customerPhone}
        </a>
      </div>`;

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:36px;height:36px;background:#2563eb;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;box-shadow:0 3px 10px rgba(0,0,0,.3);">📷</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(_map).bindPopup(popup);
    _markers[t.bookingId] = marker;
    bounds.push([lat, lng]);
  });

  if (bounds.length) _map.fitBounds(bounds, { padding: [40, 40] });
}

window._flyToMarker = function(bookingId) {
  const m = _markers[bookingId];
  if (m) { _map.flyTo(m.getLatLng(), 15, { duration: 1 }); m.openPopup(); }
};

function initMonitoring() {
  // Init Leaflet map centred on Tangerang
  _map = L.map('monitoring-map').setView([-6.2088, 106.7000], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(_map);

  // Load tracking data
  loadTrackingData();

  // Refresh button
  const refreshBtn = document.getElementById('tr-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', loadTrackingData);

  // Manual update form
  const form = document.getElementById('tracking-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const bookingId = document.getElementById('tr-booking').value;
      const lat       = parseFloat(document.getElementById('tr-lat').value);
      const lng       = parseFloat(document.getElementById('tr-lng').value);
      const address   = document.getElementById('tr-address').value.trim();
      if (!bookingId) { alert('Pilih booking terlebih dahulu'); return; }
      if (isNaN(lat) || isNaN(lng)) { alert('Koordinat tidak valid'); return; }
      const token = sessionStorage.getItem('rtk_api_key') || '';
      const res = await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': token },
        body: JSON.stringify({ bookingId, lat, lng, address, deviceId: 'admin-manual' }),
      });
      if (res.ok) {
        await loadTrackingData();
        alert('✓ Lokasi berhasil diupdate!');
      } else { alert('Gagal update: ' + (await res.text())); }
    });
  }

  // Use my location button
  const myLocBtn = document.getElementById('tr-myloc');
  if (myLocBtn) {
    myLocBtn.addEventListener('click', () => {
      if (!navigator.geolocation) { alert('Browser tidak mendukung geolokasi'); return; }
      myLocBtn.disabled = true;
      myLocBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detecting...';
      navigator.geolocation.getCurrentPosition(pos => {
        document.getElementById('tr-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('tr-lng').value = pos.coords.longitude.toFixed(6);
        myLocBtn.disabled = false;
        myLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Pakai Lokasiku';
        _map.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
      }, err => {
        alert('Gagal mendapatkan lokasi: ' + err.message);
        myLocBtn.disabled = false;
        myLocBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Pakai Lokasiku';
      });
    });
  }

  // Set up live polling interval (every 8 seconds)
  setInterval(() => {
    const monitoringTab = document.getElementById('tab-monitoring');
    if (monitoringTab && monitoringTab.classList.contains('active')) {
      loadTrackingData();
    }
  }, 8000);
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 EXTENSION: CONDITION CHECKLIST
// ════════════════════════════════════════════════════════════════════════════
const CHECKLIST_ITEMS = [
  { id: 'body',     icon: '📷', label: 'Body Kamera',        note: 'Cek goresan, retak, tombol' },
  { id: 'lens',     icon: '🔭', label: 'Lensa',              note: 'Jamur, goresan, aperture' },
  { id: 'battery',  icon: '🔋', label: 'Baterai',            note: 'Kondisi & charge level' },
  { id: 'charger',  icon: '🔌', label: 'Charger / Adaptor',  note: 'Kabel & kepala charger' },
  { id: 'strap',    icon: '🎀', label: 'Tali (Strap)',       note: 'Kondisi & pengait' },
  { id: 'bag',      icon: '🎒', label: 'Tas / Case',         note: 'Resleting, isi, kondisi' },
  { id: 'sdcard',   icon: '💾', label: 'SD Card',            note: 'Ada / tidak, kapasitas' },
  { id: 'filter',   icon: '🔘', label: 'Filter Lensa',       note: 'Kalau termasuk paket' },
  { id: 'hood',     icon: '🔲', label: 'Lens Hood',          note: 'Kondisi & kecocokan' },
  { id: 'bodycap',  icon: '🔵', label: 'Body Cap & Rear Cap',note: 'Penutup lensa & body' },
  { id: 'cable',    icon: '🔗', label: 'Kabel USB / HDMI',   note: 'Kalau termasuk paket' },
  { id: 'manual',   icon: '📖', label: 'Buku Manual / Box',  note: 'Kalau termasuk paket' },
];

let _checklistBookingId  = null;
let _checklistType       = 'pickup'; // 'pickup' | 'return'

window.setChecklistType = function(type) {
  _checklistType = type;
  document.getElementById('cl-type-pickup').classList.toggle('active', type === 'pickup');
  document.getElementById('cl-type-return').classList.toggle('active', type === 'return');
  renderChecklistItems();
  updateExistingBanner();
};

function updateExistingBanner() {
  const b       = getBookings().find(x => x.id === _checklistBookingId);
  const banner  = document.getElementById('cl-existing-banner');
  const textEl  = document.getElementById('cl-existing-text');
  if (!b || !b.checklist) { banner.style.display = 'none'; return; }
  const existing = b.checklist[_checklistType];
  if (existing) {
    textEl.textContent = `Sudah ada data ${_checklistType === 'pickup' ? 'Pengambilan' : 'Pengembalian'} dari ${existing.inspector || 'petugas'} pada ${existing.timestamp ? existing.timestamp.slice(0,16).replace('T',' ') : '—'}. Simpan lagi untuk menimpa.`;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

function renderChecklistItems() {
  const b        = getBookings().find(x => x.id === _checklistBookingId);
  const products = getProducts();
  const wrap     = document.getElementById('checklist-items-wrap');
  if (!wrap) return;

  // Collect all serial numbers for booked items
  const serialMap = {};
  (b?.items || []).forEach(item => {
    const p = products.find(x => x.id === item.productId);
    if (p?.serialNumbers?.length) {
      serialMap[item.productId] = p.serialNumbers.slice(0, item.qty);
    }
  });

  // Pre-fill from existing checklist data if available
  const existing = b?.checklist?.[_checklistType];
  const existingMap = {};
  (existing?.items || []).forEach(i => { existingMap[i.id] = i; });

  wrap.innerHTML = CHECKLIST_ITEMS.map(item => {
    const prev    = existingMap[item.id];
    const prevStatus = prev?.status || 'ok';
    const prevNote   = prev?.notes  || '';

    // Find relevant serial numbers for this item type
    const serials = Object.values(serialMap).flat().join(', ');

    return `
    <div class="cl-item-row">
      <div>
        <div class="cl-item-name">
          <span>${item.icon}</span> ${item.label}
          ${serials && item.id === 'body' ? `<span class="cl-item-serial">SN: ${serials}</span>` : ''}
        </div>
        <div style="font-size:.72rem;color:#94a3b8;margin-top:.15rem;">${item.note}</div>
        <input type="text" class="cl-item-notes" data-id="${item.id}"
          placeholder="Catatan..." value="${prevNote}"
          style="margin-top:.35rem;width:100%;font-size:.78rem;padding:.3rem .5rem;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;">
      </div>
      <div class="cl-status-group">
        <input type="radio" name="cl-${item.id}" id="cl-${item.id}-ok" value="ok" class="cl-radio" ${prevStatus === 'ok' ? 'checked' : ''}>
        <label for="cl-${item.id}-ok" class="cl-radio-label cl-ok-label">✓ OK</label>

        <input type="radio" name="cl-${item.id}" id="cl-${item.id}-rusak" value="rusak" class="cl-radio" ${prevStatus === 'rusak' ? 'checked' : ''}>
        <label for="cl-${item.id}-rusak" class="cl-radio-label cl-rusak-label">⚠ Rusak</label>

        <input type="radio" name="cl-${item.id}" id="cl-${item.id}-ta" value="tidak-ada" class="cl-radio" ${prevStatus === 'tidak-ada' ? 'checked' : ''}>
        <label for="cl-${item.id}-ta" class="cl-radio-label cl-na-label">✗ Tidak Ada</label>
      </div>
    </div>`;
  }).join('');
}

window._openChecklist = function(bookingId) {
  _checklistBookingId = bookingId;
  _checklistType = 'pickup';

  const b = getBookings().find(x => x.id === bookingId);
  if (!b) return;

  // Set booking label
  const labelEl = document.getElementById('checklist-booking-label');
  if (labelEl) labelEl.textContent = `${b.customerName} — ${b.startDate} s/d ${b.endDate}`;

  // Reset type toggle
  window.setChecklistType('pickup');

  // Pre-fill inspector & datetime
  document.getElementById('cl-inspector').value = '';
  document.getElementById('cl-datetime').value   = new Date().toISOString().slice(0, 16);
  document.getElementById('cl-overall-notes').value = '';

  // Load existing overall notes if any
  const existing = b.checklist?.[_checklistType];
  if (existing) {
    document.getElementById('cl-overall-notes').value = existing.overallNotes || '';
    document.getElementById('cl-inspector').value = existing.inspector || '';
  }

  updateExistingBanner();

  document.getElementById('checklist-modal').classList.add('active');
};

function closeChecklistModal() {
  document.getElementById('checklist-modal').classList.remove('active');
}

async function saveChecklist() {
  const b = getBookings().find(x => x.id === _checklistBookingId);
  if (!b) return;

  const items = CHECKLIST_ITEMS.map(item => {
    const radios = document.querySelectorAll(`input[name="cl-${item.id}"]`);
    const checked = [...radios].find(r => r.checked);
    const noteEl  = document.querySelector(`.cl-item-notes[data-id="${item.id}"]`);
    return {
      id:     item.id,
      label:  item.label,
      status: checked ? checked.value : 'ok',
      notes:  noteEl ? noteEl.value.trim() : '',
    };
  });

  const checklistEntry = {
    type:          _checklistType,
    timestamp:     document.getElementById('cl-datetime').value || new Date().toISOString(),
    inspector:     document.getElementById('cl-inspector').value.trim(),
    overallNotes:  document.getElementById('cl-overall-notes').value.trim(),
    items,
  };

  // Merge into booking
  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === _checklistBookingId);
  if (idx === -1) return;
  bookings[idx].checklist = {
    ...(bookings[idx].checklist || {}),
    [_checklistType]: checklistEntry,
  };
  localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));

  // Persist to server
  const token = sessionStorage.getItem('rtk_api_key') || '';
  try {
    await fetch(`/api/bookings/${_checklistBookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify({ checklist: bookings[idx].checklist }),
    });
  } catch (err) { console.error('Checklist save failed', err); }

  renderBookings();
  closeChecklistModal();
  // Show brief success toast
  const t = document.createElement('div');
  t.className = 'toast toast-success';
  t.textContent = `\u2713 Checklist ${_checklistType === 'pickup' ? 'Pengambilan' : 'Pengembalian'} tersimpan`;
  t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:#16a34a;color:white;padding:.7rem 1.25rem;border-radius:10px;font-weight:700;font-size:.875rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}


function initChecklistModal() {
  document.getElementById('close-checklist-modal')?.addEventListener('click', closeChecklistModal);
  document.getElementById('close-checklist-modal-2')?.addEventListener('click', closeChecklistModal);
  document.getElementById('cl-save-btn')?.addEventListener('click', saveChecklist);
  // Close on overlay click
  document.getElementById('checklist-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('checklist-modal')) closeChecklistModal();
  });
}

// Init checklist once DOM is ready (called from initDashboard)
document.addEventListener('DOMContentLoaded', () => {
  initChecklistModal();
});

// ════════════════════════════════════════════════════════════════════════════
// PHASE 4: KEUANGAN (Financial Analytics + PDF Invoice)
// ════════════════════════════════════════════════════════════════════════════
let _chartRevenue  = null;
let _chartStatus   = null;
let _chartProducts = null;

function getFinancialData() {
  const bookings = getBookings();
  const products = getProducts();
  const now      = new Date();

  // ── KPI cards ────────────────────────────────────────────────────────────
  const totalRevenue = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((s, b) => s + (b.totalPrice || 0), 0);

  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthRevenue = bookings
    .filter(b => b.status !== 'cancelled' && (b.startDate || '').startsWith(thisMonth))
    .reduce((s, b) => s + (b.totalPrice || 0), 0);

  const depositHeld = bookings
    .filter(b => b.deposit?.status === 'paid')
    .reduce((s, b) => s + (b.deposit?.amount || 0), 0);

  const paidCount = bookings.filter(b => b.status === 'done').length;

  // ── Monthly data (last 6 months) ──────────────────────────────────────────
  const monthlyMap = {};
  for (let i = 5; i >= 0; i--) {
    const d    = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label= d.toLocaleDateString('id-ID', { month:'short', year:'2-digit' });
    monthlyMap[key] = { label, revenue:0, count:0, done:0, deposit:0 };
  }
  bookings.forEach(b => {
    const m = (b.startDate || '').slice(0, 7);
    if (!monthlyMap[m] || b.status === 'cancelled') return;
    monthlyMap[m].revenue  += b.totalPrice || 0;
    monthlyMap[m].count    += 1;
    if (b.status === 'done') monthlyMap[m].done += 1;
    if (b.deposit?.status === 'paid') monthlyMap[m].deposit += b.deposit.amount || 0;
  });
  const months = Object.values(monthlyMap);

  // ── Status counts ────────────────────────────────────────────────────────
  const statusCount = { pending:0, confirmed:0, active:0, done:0, cancelled:0 };
  bookings.forEach(b => { if (statusCount[b.status] !== undefined) statusCount[b.status]++; });

  // ── Top 5 products by booking frequency ─────────────────────────────────
  const productFreq = {};
  bookings.filter(b => b.status !== 'cancelled').forEach(b => {
    (b.items || []).forEach(item => {
      productFreq[item.productId] = (productFreq[item.productId] || 0) + (item.qty || 1);
    });
  });
  const topProducts = Object.entries(productFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      name: products.find(p => p.id === id)?.name || id,
      count,
    }));

  // ── Deposits with status 'paid' ──────────────────────────────────────────
  const deposits = bookings
    .filter(b => b.deposit?.amount > 0)
    .map(b => ({ name: b.customerName, ...b.deposit }));

  return { totalRevenue, monthRevenue, depositHeld, paidCount, months, statusCount, topProducts, deposits };
}

function renderKeuangan() {
  const d = getFinancialData();

  // KPI cards
  document.getElementById('fin-total-revenue').textContent = formatRp(d.totalRevenue);
  document.getElementById('fin-month-revenue').textContent = formatRp(d.monthRevenue);
  document.getElementById('fin-deposit-held').textContent  = formatRp(d.depositHeld);
  document.getElementById('fin-paid-count').textContent    = d.paidCount;

  // Update chart data if already created
  if (_chartRevenue) {
    _chartRevenue.data.labels                = d.months.map(m => m.label);
    _chartRevenue.data.datasets[0].data      = d.months.map(m => m.revenue);
    _chartRevenue.update();
  }
  if (_chartStatus) {
    const vals = [d.statusCount.pending, d.statusCount.confirmed, d.statusCount.active, d.statusCount.done, d.statusCount.cancelled];
    _chartStatus.data.datasets[0].data = vals;
    _chartStatus.update();
  }
  if (_chartProducts) {
    _chartProducts.data.labels                = d.topProducts.map(p => p.name.length > 18 ? p.name.slice(0,18)+'…' : p.name);
    _chartProducts.data.datasets[0].data      = d.topProducts.map(p => p.count);
    _chartProducts.update();
  }

  // Deposit table
  const depBody = document.getElementById('deposit-tbody');
  if (depBody) {
    const depStatusMap = { pending:'🟡 Belum', paid:'🟢 Lunas', returned:'🔵 Kembali', forfeited:'🔴 Hangus' };
    const depMethodMap = { cash:'Cash', transfer:'Transfer', qris:'QRIS', ewallet:'E-Wallet' };
    depBody.innerHTML = d.deposits.length
      ? d.deposits.map(dep => `<tr>
          <td style="padding:.4rem .5rem;border-bottom:1px solid #f1f5f9;">${dep.name}</td>
          <td style="padding:.4rem .5rem;border-bottom:1px solid #f1f5f9;font-weight:700;">${formatRp(dep.amount)}</td>
          <td style="padding:.4rem .5rem;border-bottom:1px solid #f1f5f9;">${depMethodMap[dep.method] || dep.method || '—'}</td>
          <td style="padding:.4rem .5rem;border-bottom:1px solid #f1f5f9;">${depStatusMap[dep.status] || dep.status}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" style="padding:1rem;text-align:center;color:#94a3b8;">Belum ada data deposit</td></tr>';

    const totalDep = document.getElementById('fin-deposit-total');
    if (totalDep) totalDep.textContent = `${d.deposits.length} entri`;
  }

  // Monthly table
  const mBody = document.getElementById('monthly-tbody');
  if (mBody) {
    mBody.innerHTML = d.months.map(m => `<tr>
      <td style="padding:.6rem 1rem;">${m.label}</td>
      <td style="padding:.6rem 1rem;text-align:right;">${m.count}</td>
      <td style="padding:.6rem 1rem;text-align:right;">${m.done}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-weight:700;color:#16a34a;">${formatRp(m.revenue)}</td>
      <td style="padding:.6rem 1rem;text-align:right;color:#ea580c;">${m.deposit > 0 ? formatRp(m.deposit) : '—'}</td>
    </tr>`).join('');
  }
}

function initKeuangan() {
  if (typeof Chart === 'undefined') {
    document.getElementById('tab-keuangan').innerHTML += '<p style="color:red;padding:1rem;">Chart.js gagal dimuat. Cek koneksi internet.</p>';
    return;
  }

  renderKeuangan();
  const d = getFinancialData();

  const CHART_DEFAULTS = {
    responsive: true,
    plugins: { legend: { labels: { font: { family: 'Plus Jakarta Sans, sans-serif', size: 11 } } } },
  };

  // ── Monthly revenue bar chart ────────────────────────────────────────────
  const ctxRev = document.getElementById('chart-revenue')?.getContext('2d');
  if (ctxRev) {
    if (_chartRevenue) _chartRevenue.destroy();
    _chartRevenue = new Chart(ctxRev, {
      type: 'bar',
      data: {
        labels:   d.months.map(m => m.label),
        datasets: [{
          label: 'Omzet (Rp)',
          data:  d.months.map(m => m.revenue),
          backgroundColor: 'rgba(37,99,235,.75)',
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          y: {
            ticks: {
              callback: v => 'Rp ' + (v >= 1000000 ? (v/1000000).toFixed(1)+'jt' : (v/1000).toFixed(0)+'rb'),
              font: { size: 10 },
            },
          },
          x: { ticks: { font: { size: 10 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  // ── Status doughnut chart ────────────────────────────────────────────────
  const ctxStatus = document.getElementById('chart-status')?.getContext('2d');
  if (ctxStatus) {
    if (_chartStatus) _chartStatus.destroy();
    _chartStatus = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels:   ['Pending', 'Dikonfirmasi', 'Aktif', 'Selesai', 'Dibatalkan'],
        datasets: [{
          data: [
            d.statusCount.pending, d.statusCount.confirmed,
            d.statusCount.active,  d.statusCount.done, d.statusCount.cancelled,
          ],
          backgroundColor: ['#f59e0b','#2563eb','#16a34a','#7c3aed','#ef4444'],
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        cutout: '60%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } } },
      },
    });
  }

  // ── Top products horizontal bar ──────────────────────────────────────────
  const ctxProd = document.getElementById('chart-products')?.getContext('2d');
  if (ctxProd) {
    if (_chartProducts) _chartProducts.destroy();
    _chartProducts = new Chart(ctxProd, {
      type: 'bar',
      data: {
        labels:   d.topProducts.map(p => p.name.length > 20 ? p.name.slice(0,20)+'…' : p.name),
        datasets: [{
          label: 'Frekuensi Sewa',
          data:  d.topProducts.map(p => p.count),
          backgroundColor: ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a'],
          borderRadius: 5,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        indexAxis: 'y',
        scales: {
          x: { ticks: { stepSize: 1, font: { size: 10 } } },
          y: { ticks: { font: { size: 10 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

// CSV Export (Advanced Finance)
window.exportFinanceCSV = function() {
  const bookings = getBookings().filter(b => b.status === 'done' || b.status === 'active');
  const rows = [
    ['ID Pesanan', 'Nama Pelanggan', 'Telepon', 'Tanggal Mulai', 'Tanggal Selesai', 'Status', 'Uang Jaminan (Rp)', 'Denda (Rp)', 'Total Omzet (Rp)']
  ];
  
  bookings.forEach(b => {
    const depositAmt = b.deposit ? b.deposit.amount : 0;
    const fineAmt = b.fine ? b.fine.amount : 0;
    const total = b.totalPrice || 0;
    
    rows.push([
      b.id,
      `"${b.customerName}"`,
      `'${b.customerPhone}`, // leading quote prevents excel scientific notation
      b.startDate,
      b.endDate,
      b.status,
      depositAmt,
      fineAmt,
      total
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  const a   = document.createElement('a');
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM for Excel
  const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
  a.href    = URL.createObjectURL(blob);
  a.download= `RTK_Keuangan_Lengkap_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
};
}

// ── PDF / Print Invoice ───────────────────────────────────────────────────
function printInvoice(bookingId) {
  const b = getBookings().find(x => x.id === bookingId);
  if (!b) return;
  const products = getProducts();

  const days  = daysBetween(b.startDate, b.endDate);
  const items = (b.items || []).map(item => {
    const p     = products.find(x => x.id === item.productId);
    const name  = p ? p.name : 'Produk tidak ditemukan';
    const price = p ? (p.isPromo && p.salePrice ? p.salePrice : p.normalPrice) : 0;
    const subtotal = price * item.qty * days;
    return { name, price, qty: item.qty, days, subtotal };
  });

  const depStatusMap = { pending:'Belum Dibayar', paid:'Sudah Dibayar', returned:'Sudah Dikembalikan', forfeited:'Hangus' };
  const depMethodMap = { cash:'Cash / Tunai', transfer:'Transfer Bank', qris:'QRIS', ewallet:'E-Wallet' };

  const now       = new Date().toLocaleDateString('id-ID',{ day:'numeric', month:'long', year:'numeric' });
  const invoiceNo = `INV-${b.id.toUpperCase().replace('BOOK-','').slice(0,8)}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Invoice ${invoiceNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background:#fff; color:#0f172a; font-size:13px; padding:2rem; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2rem; }
  .logo-area h1 { font-size:1.6rem; font-weight:800; color:#1e3a5f; }
  .logo-area p  { color:#64748b; font-size:.8rem; margin-top:.2rem; }
  .inv-info { text-align:right; }
  .inv-info .inv-num { font-size:1.1rem; font-weight:800; color:#2563eb; }
  .inv-info .inv-date { color:#64748b; font-size:.8rem; margin-top:.25rem; }
  .divider { border:none; border-top:2px solid #e2e8f0; margin:1.25rem 0; }
  .bill-to { margin-bottom:1.5rem; }
  .bill-to .label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:.35rem; }
  .bill-to .name  { font-size:1rem; font-weight:800; }
  .bill-to .phone { color:#16a34a; font-weight:600; font-size:.85rem; margin-top:.15rem; }
  .bill-to .dates { color:#475569; font-size:.82rem; margin-top:.2rem; }
  table { width:100%; border-collapse:collapse; margin-bottom:1.5rem; }
  th { background:#f8fafc; padding:.6rem .75rem; text-align:left; font-size:.72rem; text-transform:uppercase; letter-spacing:.5px; color:#64748b; }
  td { padding:.6rem .75rem; border-bottom:1px solid #f1f5f9; font-size:.85rem; }
  td.right, th.right { text-align:right; }
  .total-row td { font-weight:800; background:#f0f9ff; font-size:.95rem; }
  .deposit-box { border:1.5px solid #e0f2fe; border-radius:8px; padding:.85rem 1rem; background:#f0f9ff; margin-bottom:1.5rem; }
  .deposit-box .dep-title { font-size:.72rem; font-weight:800; color:#0369a1; margin-bottom:.5rem; text-transform:uppercase; letter-spacing:.5px; }
  .deposit-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.5rem; font-size:.82rem; }
  .deposit-grid .d-label { color:#64748b; font-size:.7rem; margin-bottom:.1rem; }
  .deposit-grid strong { font-weight:700; }
  .footer { margin-top:2rem; padding-top:1.25rem; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:flex-end; }
  .footer-left p { font-size:.8rem; color:#475569; margin-top:.2rem; }
  .footer-left strong { font-size:.9rem; }
  .status-badge { display:inline-block; padding:.2rem .7rem; border-radius:20px; font-size:.72rem; font-weight:700; }
  .badge-pending    { background:#fef9c3; color:#854d0e; }
  .badge-confirmed  { background:#dbeafe; color:#1e40af; }
  .badge-active     { background:#dcfce7; color:#166534; }
  .badge-done       { background:#f0fdf4; color:#14532d; }
  .badge-cancelled  { background:#fee2e2; color:#991b1b; }
  @media print {
    body { padding:1rem; }
    button { display:none !important; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>RTK Rental</h1>
      <p>Jl. Tangerang • +62 812-3456-7890 • rtkretntal.com</p>
    </div>
    <div class="inv-info">
      <div class="inv-num">${invoiceNo}</div>
      <div class="inv-date">Dicetak: ${now}</div>
      <span class="status-badge badge-${b.status || 'pending'}">${
        { pending:'Pending', confirmed:'Dikonfirmasi', active:'Aktif', done:'Selesai', cancelled:'Dibatalkan' }[b.status] || b.status
      }</span>
    </div>
  </div>

  <hr class="divider">

  <div class="bill-to">
    <div class="label">Pelanggan</div>
    <div class="name">${b.customerName}</div>
    <div class="phone">📱 ${b.customerPhone}</div>
    <div class="dates">📅 ${formatDate(b.startDate)} — ${formatDate(b.endDate)} &nbsp;|&nbsp; ${days} hari</div>
    ${b.notes ? `<div style="margin-top:.3rem;color:#64748b;font-size:.8rem;">📝 ${b.notes}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Produk</th>
        <th class="right">Harga/hari</th>
        <th class="right">Qty</th>
        <th class="right">Hari</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(it => `<tr>
        <td>${it.name}</td>
        <td class="right">${formatRp(it.price)}</td>
        <td class="right">${it.qty}</td>
        <td class="right">${it.days}</td>
        <td class="right"><strong>${formatRp(it.subtotal)}</strong></td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="4" class="right">TOTAL ESTIMASI</td>
        <td class="right">${formatRp(b.totalPrice)}</td>
      </tr>
    </tfoot>
  </table>

  ${b.deposit ? `
  <div class="deposit-box">
    <div class="dep-title">🛡 Deposit / Jaminan</div>
    <div class="deposit-grid">
      <div><div class="d-label">Jumlah</div><strong>${formatRp(b.deposit.amount)}</strong></div>
      <div><div class="d-label">Metode</div><strong>${depMethodMap[b.deposit.method] || b.deposit.method || '—'}</strong></div>
      <div><div class="d-label">Status</div><strong>${depStatusMap[b.deposit.status] || b.deposit.status}</strong></div>
    </div>
  </div>` : ''}

  <div class="footer">
    <div class="footer-left">
      <strong>Terima kasih atas kepercayaan Anda! 🙏</strong>
      <p>Barang harap dikembalikan dalam kondisi semula.</p>
      <p>Pertanyaan? WhatsApp kami di +62 812-3456-7890</p>
    </div>
    <div style="text-align:right;">
      <button onclick="window.print()" style="padding:.5rem 1.25rem;background:#2563eb;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:.85rem;">
        🖨 Cetak / Simpan PDF
      </button>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=900');
  win.document.write(html);
  win.document.close();
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 7: PERSETUJUAN KYC (KYC Approval)
// ════════════════════════════════════════════════════════════════════════════
let _kycPendingList = [];

async function fetchPendingKyc() {
  const token = sessionStorage.getItem('rtk_api_key') || '';
  try {
    const res = await fetch('/api/admin/kyc', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-api-key': token }
    });
    _kycPendingList = res.ok ? await res.json() : [];
  } catch (err) {
    _kycPendingList = [];
  }
  return _kycPendingList;
}

function renderKycList() {
  const tbody = document.getElementById('kyc-tbody');
  const countEl = document.getElementById('stat-kyc-pending');
  const badge = document.getElementById('kyc-pending-badge');
  
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (countEl) countEl.textContent = _kycPendingList.length;
  if (badge) {
    badge.textContent = _kycPendingList.length;
    badge.style.display = _kycPendingList.length > 0 ? 'inline-flex' : 'none';
  }

  if (!_kycPendingList.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#94a3b8;"><i class="fa-solid fa-circle-check" style="color:#16a34a;font-size:1.5rem;margin-bottom:0.5rem;display:block;"></i>Semua berkas KYC telah diproses!</td></tr>`;
    return;
  }

  _kycPendingList.forEach((c, idx) => {
    const tr = document.createElement('tr');
    
    // Resolve upload URLs
    const ktpUrl = c.kycFiles?.ktp ? `/data/uploads/${c.kycFiles.ktp}` : '';
    const selfieUrl = c.kycFiles?.selfie ? `/data/uploads/${c.kycFiles.selfie}` : '';
    
    tr.innerHTML = `
      <td style="font-weight:700;vertical-align:middle;">${c.name}</td>
      <td style="font-size:0.82rem;vertical-align:middle;">
        <div><i class="fa-solid fa-envelope" style="color:#64748b;width:14px;"></i> ${c.email}</div>
        <div style="margin-top:0.2rem;"><i class="fa-brands fa-whatsapp" style="color:#16a34a;width:14px;"></i> ${c.phone}</div>
      </td>
      <td style="vertical-align:middle;">
        ${ktpUrl ? `<img src="${ktpUrl}" style="height:55px;width:80px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;cursor:pointer;" onclick="window.open('${ktpUrl}','_blank')">` : '<span style="color:#94a3b8;">Tidak ada</span>'}
      </td>
      <td style="vertical-align:middle;">
        ${selfieUrl ? `<img src="${selfieUrl}" style="height:55px;width:80px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;cursor:pointer;" onclick="window.open('${selfieUrl}','_blank')">` : '<span style="color:#94a3b8;">Tidak ada</span>'}
      </td>
      <td style="font-size:0.8rem;color:#64748b;vertical-align:middle;">${c.createdAt ? c.createdAt.slice(0,16).replace('T',' ') : '—'}</td>
      <td style="vertical-align:middle;">
        <div class="action-btn-group">
          <button class="btn btn-sm primary" onclick="approveKyc('${c.id}')" style="background:#16a34a;border-color:#16a34a;" title="Setujui"><i class="fa-solid fa-check"></i> Setujui</button>
          <button class="btn btn-sm danger" onclick="rejectKyc('${c.id}')" title="Tolak"><i class="fa-solid fa-xmark"></i> Tolak</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function initKycApproval() {
  fetchPendingKyc().then(() => renderKycList());
}

window.approveKyc = async function(customerId) {
  if (!confirm('Setujui berkas identitas (KYC) pelanggan ini?')) return;
  const token = sessionStorage.getItem('rtk_api_key') || '';
  try {
    const res = await fetch(`/api/admin/kyc/${customerId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': token
      },
      body: JSON.stringify({ status: 'verified' })
    });
    if (res.ok) {
      await fetchPendingKyc();
      renderKycList();
      await loadDashboardStats();
    } else {
      alert('Gagal menyetujui KYC');
    }
  } catch (err) {
    alert('Koneksi gagal');
  }
};

window.rejectKyc = async function(customerId) {
  if (!confirm('Tolak berkas identitas (KYC) pelanggan ini? Pelanggan harus mengunggah ulang.')) return;
  const token = sessionStorage.getItem('rtk_api_key') || '';
  try {
    const res = await fetch(`/api/admin/kyc/${customerId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-api-key': token
      },
      body: JSON.stringify({ status: 'rejected' })
    });
    if (res.ok) {
      await fetchPendingKyc();
      renderKycList();
      await loadDashboardStats();
    } else {
      alert('Gagal menolak KYC');
    }
  } catch (err) {
    alert('Koneksi gagal');
  }
};
