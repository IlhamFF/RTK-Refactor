// ===== RTK — Main Script (Cart + WhatsApp Checkout) =====
const WA_NUMBER = '6287870456785'; // Format: 62xxxxxxx

// ===== CART STATE =====
let cart = JSON.parse(localStorage.getItem('rtk_cart') || '[]');
// Each item: { id, name, category, price, imageUrl, qty, days }

function saveCart() {
  localStorage.setItem('rtk_cart', JSON.stringify(cart));
}

// ===== UTILITIES =====
function formatRupiah(num) {
  return 'Rp ' + parseInt(num || 0).toLocaleString('id-ID');
}

function getCatLabel(key) {
  const map = {
    'kamera-digital': 'Kamera Digital',
    'action-cam':     'Action Cam',
    'dslr':           'DSLR',
    'mirrorless':     'Mirrorless',
    'camcorder':      'Camcorder',
    'lensa':          'Lensa',
    'aksesoris':      'Aksesoris',
    'paket':          'Paketan',
  };
  return map[key] || key;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ===== PRODUCT RENDER =====
function renderProducts(filter = 'all') {
  const grid = document.getElementById('product-grid');
  const all = getProducts();
  const filtered = filter === 'all' ? all : all.filter(p => p.category === filter);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="color:var(--slate-400); font-size:.95rem; padding:2rem 0; grid-column:1/-1;">Tidak ada produk di kategori ini.</p>`;
    return;
  }

  filtered.forEach(product => {
    const price  = (product.isPromo && product.salePrice > 0) ? product.salePrice : product.normalPrice;
    const isPromo = product.isPromo && product.salePrice > 0;

    const waMsg  = `Halo Min! Saya mau tanya info rental:\n*${product.name}*\nTolong info ketersediaan dan DP-nya ya. Terima kasih! 🙏`;
    const waUrl  = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;

    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = product.id;

    card.innerHTML = `
      <div class="card-img-wrapper">
        <img src="${product.imageUrl}" alt="${product.name}" class="card-img" loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=600&auto=format&fit=crop'">
        ${isPromo ? `<span class="card-badge">PROMO</span>` : ''}
      </div>
      <div class="card-body">
        <span class="card-category">${getCatLabel(product.category)}</span>
        <h3 class="card-title">${product.name}</h3>
        <div class="card-price-block">
          ${isPromo ? `<div class="card-price-original">${formatRupiah(product.normalPrice)} / hari</div>` : ''}
          <div class="card-price-main ${isPromo ? '' : 'no-promo'}">${formatRupiah(price)} <span style="font-size:.75rem; font-weight:500; color:var(--slate-400);">/ hari</span></div>
        </div>
        <div class="card-actions">
          <button class="btn-cart" data-id="${product.id}">
            <i class="fa-solid fa-cart-plus"></i> Tambah
          </button>
          <a href="${waUrl}" target="_blank" rel="noopener" class="btn-wa" title="Tanya langsung via WhatsApp">
            <i class="fa-brands fa-whatsapp"></i>
          </a>
        </div>
        <button class="btn-detail" data-id="${product.id}">Lihat Detail</button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Attach add-to-cart listeners
  grid.querySelectorAll('.btn-cart').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
  // Attach detail listeners
  grid.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => openPDP(btn.dataset.id));
  });
}

// ===== CART LOGIC =====
function addToCart(productId) {
  const all = getProducts();
  const product = all.find(p => p.id === productId);
  if (!product) return;

  const price = (product.isPromo && product.salePrice > 0) ? product.salePrice : product.normalPrice;
  const existing = cart.find(c => c.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id:       product.id,
      name:     product.name,
      category: product.category,
      price,
      imageUrl: product.imageUrl,
      qty:      1,
      days:     1
    });
  }

  saveCart();
  updateCartUI();
  showToast(`✓ ${product.name} ditambahkan ke keranjang`);
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.id !== productId);
  saveCart();
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(c => c.id === productId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  updateCartUI();
}

function changeDays(productId, val) {
  const item = cart.find(c => c.id === productId);
  if (!item) return;
  item.days = Math.max(1, parseInt(val) || 1);
  saveCart();
  updateCartUI();
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  const badge    = document.getElementById('cart-badge');
  const itemsEl  = document.getElementById('cart-items');
  const totalEl  = document.getElementById('cart-total-price');
  const checkBtn = document.getElementById('checkout-btn');

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  // Badge
  if (totalQty > 0) {
    badge.textContent = totalQty;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }

  // Items render
  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <i class="fa-solid fa-cart-shopping"></i>
        <p>Keranjang masih kosong</p>
        <small>Tambahkan produk dari katalog</small>
      </div>`;
    totalEl.textContent = 'Rp 0';
    checkBtn.disabled = true;
    return;
  }

  checkBtn.disabled = false;

  // Set checkout button to ERP style for both guest and logged-in states
  checkBtn.innerHTML = `<i class="fa-solid fa-credit-card"></i> Lanjutkan ke Checkout`;
  checkBtn.style.background = 'var(--blue-600)';
  checkBtn.style.boxShadow = '0 4px 12px rgba(37,99,235,0.35)';

  // Compute subtotal
  const grandTotal = cart.reduce((s, i) => s + i.price * i.qty * i.days, 0);
  totalEl.textContent = formatRupiah(grandTotal);

  itemsEl.innerHTML = '';
  cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-img"
        onerror="this.src='https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=200'">
      <div class="cart-item-info">
        <div class="cart-item-name" title="${item.name}">${item.name}</div>
        <div class="cart-item-price">${formatRupiah(item.price)} / hari</div>
        <div class="cart-item-qty">
          <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
          <span style="color:var(--slate-400); font-size:.78rem; margin-left:.25rem;">unit</span>
        </div>
        <div class="cart-duration">
          Durasi:&nbsp;
          <input type="number" min="1" value="${item.days}" data-id="${item.id}" class="cart-days-input">
          &nbsp;hari
        </div>
        <div style="font-size:.78rem; font-weight:700; color:var(--slate-600); margin-top:.3rem;">
          Subtotal: ${formatRupiah(item.price * item.qty * item.days)}
        </div>
      </div>
      <button class="cart-item-remove" data-id="${item.id}" title="Hapus"><i class="fa-solid fa-xmark"></i></button>
    `;
    itemsEl.appendChild(div);
  });

  // Bind qty buttons & days input
  itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => changeQty(btn.dataset.id, parseInt(btn.dataset.delta)));
  });
  itemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });
  itemsEl.querySelectorAll('.cart-days-input').forEach(inp => {
    inp.addEventListener('change', () => changeDays(inp.dataset.id, inp.value));
  });
}

// ===== CART DRAWER ===== 
function openCart() {
  document.getElementById('cart-overlay').classList.add('open');
  document.getElementById('cart-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-overlay').classList.remove('open');
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== WHATSAPP CHECKOUT =====
function buildWaMessage() {
  const lines = [
    '🎥 *Halo Min RTK! Saya mau rental kamera.*',
    '',
    '*Daftar Pesanan:*'
  ];

  cart.forEach((item, idx) => {
    const subtotal = item.price * item.qty * item.days;
    lines.push(
      `${idx + 1}. *${item.name}*`,
      `   • Jumlah: ${item.qty} unit`,
      `   • Durasi: ${item.days} hari`,
      `   • Harga: ${formatRupiah(item.price)} / hari`,
      `   • Subtotal: ${formatRupiah(subtotal)}`,
      ''
    );
  });

  const total = cart.reduce((s, i) => s + i.price * i.qty * i.days, 0);

  lines.push(
    `*Total Estimasi: ${formatRupiah(total)}*`,
    '',
    'Mohon info ketersediaan dan langkah selanjutnya. Terima kasih! 🙏'
  );

  return lines.join('\n');
}

// ===== PRODUCT DETAIL MODAL (PDP) =====
let _pdpCurrentId = null;

function openPDP(productId) {
  const all = getProducts();
  const p   = all.find(x => x.id === productId);
  if (!p) return;
  _pdpCurrentId = productId;

  const price   = (p.isPromo && p.salePrice > 0) ? p.salePrice : p.normalPrice;
  const isPromo = p.isPromo && p.salePrice > 0;

  document.getElementById('pdp-img').src = p.imageUrl;
  document.getElementById('pdp-img').alt = p.name;
  document.getElementById('pdp-img').onerror = function() {
    this.src = 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=800&auto=format&fit=crop';
  };

  const badge = document.getElementById('pdp-badge');
  badge.classList.toggle('visible', isPromo);

  document.getElementById('pdp-category').textContent = getCatLabel(p.category);
  document.getElementById('pdp-name').textContent = p.name;

  document.getElementById('pdp-price-sale').textContent = formatRupiah(price) + ' / hari';
  const origEl = document.getElementById('pdp-price-orig');
  origEl.textContent = isPromo ? formatRupiah(p.normalPrice) + ' / hari' : '';

  // Description — nanti bisa dari database field p.description
  document.getElementById('pdp-desc').textContent =
    p.description ||
    `${p.name} tersedia untuk disewa per hari. ` +
    `Hubungi admin untuk cek ketersediaan dan konfirmasi booking. ` +
    `Pastikan membawa identitas resmi saat pengambilan.`;

  // Gallery
  const galEl = document.getElementById('pdp-gallery');
  galEl.innerHTML = '';
  if (p.gallery && p.gallery.length > 0) {
    const allImgs = [p.imageUrl, ...p.gallery];
    allImgs.forEach((src, idx) => {
      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.loading = 'lazy';
      if (idx === 0) thumb.classList.add('active');
      thumb.addEventListener('click', () => {
        document.getElementById('pdp-img').src = src;
        galEl.querySelectorAll('img').forEach(i => i.classList.remove('active'));
        thumb.classList.add('active');
      });
      galEl.appendChild(thumb);
    });
  }

  // Meta chips
  const units = p.units || 1;
  document.getElementById('pdp-meta').innerHTML = `
    <div class="pdp-meta-item"><i class="fa-solid fa-layer-group"></i> ${units} unit tersedia</div>
    <div class="pdp-meta-item"><i class="fa-solid fa-tag"></i> ${getCatLabel(p.category)}</div>
    <div class="pdp-meta-item"><i class="fa-solid fa-calendar-days"></i> Harga per hari</div>
    ${isPromo ? `<div class="pdp-meta-item" style="background:#fee2e2;color:#dc2626;"><i class="fa-solid fa-fire"></i> PROMO AKTIF</div>` : ''}
  `;

  // WA link
  const waMsg = `Halo Min! Saya mau tanya info rental:\n*${p.name}*\nTolong info ketersediaan dan DP-nya ya 🙏`;
  document.getElementById('pdp-btn-wa').href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;

  // Open
  document.getElementById('pdp-overlay').classList.add('open');
  document.getElementById('pdp-modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Setup Availability Calendar
  const startDate = document.getElementById('pdp-date-start');
  const endDate   = document.getElementById('pdp-date-end');
  const statusEl  = document.getElementById('pdp-availability-status');
  const priceEstEl = document.getElementById('pdp-price-estimate');
  const btnCart   = document.getElementById('pdp-btn-cart');
  const calGrid   = document.getElementById('pdp-cal-grid');
  const monthLabel = document.getElementById('pdp-cal-month-label');

  const today     = new Date().toISOString().split('T')[0];
  const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  startDate.value = today;
  endDate.value   = tomorrow;
  startDate.min   = today;
  endDate.min     = today;

  // Calendar state
  let calYear  = new Date().getFullYear();
  let calMonth = new Date().getMonth() + 1;
  const calCache = {}; // cache per month key

  const MONTH_NAMES_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const DAY_HEADERS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

  async function fetchCalendarData(y, m) {
    const key = `${y}-${String(m).padStart(2,'0')}`;
    if (calCache[key]) return calCache[key];
    try {
      const res  = await fetch(`/api/availability/${productId}?month=${key}`);
      const data = await res.json();
      calCache[key] = data;
      return data;
    } catch (err) {
      return null;
    }
  }

  async function renderCalendar() {
    monthLabel.textContent = `${MONTH_NAMES_ID[calMonth - 1]} ${calYear}`;
    calGrid.innerHTML = '<div class="pdp-cal-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    const data = await fetchCalendarData(calYear, calMonth);
    calGrid.innerHTML = '';

    // Day headers
    DAY_HEADERS.forEach(d => {
      const h = document.createElement('div');
      h.className = 'pdp-cal-header';
      h.textContent = d;
      calGrid.appendChild(h);
    });

    // First day offset (0=Sunday)
    const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'pdp-cal-cell pdp-cal-empty';
      calGrid.appendChild(empty);
    }

    // Day cells
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div');
      cell.className = 'pdp-cal-cell';
      cell.textContent = d;

      const isPast = dateStr < today;
      const dayData = data ? data.days.find(x => x.date === dateStr) : null;
      const isFull  = dayData ? dayData.full : false;

      if (isPast) {
        cell.classList.add('pdp-cal-past');
      } else if (isFull) {
        cell.classList.add('pdp-cal-full');
        cell.title = 'Penuh';
      } else {
        cell.classList.add('pdp-cal-free');
        const avail = dayData ? dayData.available : units;
        cell.title = `${avail} unit tersedia`;
        // Click to set date range
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
          if (!startDate.value || (startDate.value && endDate.value && startDate.value !== endDate.value)) {
            startDate.value = dateStr;
            endDate.value = dateStr;
          } else {
            if (dateStr < startDate.value) {
              startDate.value = dateStr;
            } else {
              endDate.value = dateStr;
            }
          }
          checkAvailability();
          highlightSelectedRange();
        });
      }

      if (dateStr === today) cell.classList.add('pdp-cal-today');
      cell.dataset.date = dateStr;
      calGrid.appendChild(cell);
    }

    highlightSelectedRange();
  }

  function highlightSelectedRange() {
    const cells = calGrid.querySelectorAll('.pdp-cal-cell[data-date]');
    cells.forEach(c => c.classList.remove('pdp-cal-selected', 'pdp-cal-range'));
    if (!startDate.value || !endDate.value) return;
    cells.forEach(c => {
      const d = c.dataset.date;
      if (d === startDate.value || d === endDate.value) c.classList.add('pdp-cal-selected');
      else if (d > startDate.value && d < endDate.value) c.classList.add('pdp-cal-range');
    });
  }

  // Nav buttons
  document.getElementById('pdp-cal-prev').onclick = () => {
    calMonth--;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendar();
  };
  document.getElementById('pdp-cal-next').onclick = () => {
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    renderCalendar();
  };

  // Availability check on date range change
  async function checkAvailability() {
    if (!startDate.value || !endDate.value) {
      statusEl.innerHTML = '';
      priceEstEl.innerHTML = '';
      return;
    }
    if (startDate.value > endDate.value) {
      statusEl.innerHTML = '<span style="color:#ef4444;">Tanggal tidak valid</span>';
      priceEstEl.innerHTML = '';
      btnCart.disabled = true;
      return;
    }

    try {
      statusEl.innerHTML = '<span style="color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Mengecek...</span>';
      const res = await fetch('/api/availability');
      const activeBookings = await res.json();

      let maxRented = 0;
      activeBookings.forEach(b => {
        if (b.startDate <= endDate.value && b.endDate >= startDate.value) {
          const item = b.items.find(i => i.productId === productId);
          if (item) maxRented += item.qty;
        }
      });

      const available = units - maxRented;
      if (available > 0) {
        statusEl.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-circle-check"></i> Tersedia (${available} unit)</span>`;
        btnCart.disabled = false;
        btnCart.style.opacity = '1';
      } else {
        statusEl.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-circle-xmark"></i> Penuh pada tanggal tersebut</span>`;
        btnCart.disabled = true;
        btnCart.style.opacity = '0.5';
      }

      // Dynamic price estimate
      const daysBetween = Math.max(1, Math.round((new Date(endDate.value) - new Date(startDate.value)) / 86400000) + 1);
      const totalEst = price * daysBetween;
      priceEstEl.innerHTML = `${formatRupiah(price)} × ${daysBetween} hari = <strong>${formatRupiah(totalEst)}</strong>`;
    } catch (err) {
      statusEl.innerHTML = '<span style="color:#f59e0b;">Gagal mengecek ketersediaan</span>';
      btnCart.disabled = false;
    }
    highlightSelectedRange();
  }

  startDate.addEventListener('change', checkAvailability);
  endDate.addEventListener('change', checkAvailability);

  // Initial render
  renderCalendar();
  checkAvailability();
}

function closePDP() {
  document.getElementById('pdp-overlay').classList.remove('open');
  document.getElementById('pdp-modal').classList.remove('open');
  document.body.style.overflow = '';
  _pdpCurrentId = null;
}

// ===== FILTERS =====
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts(btn.dataset.filter);
    });
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  initDatabase();
  if (typeof syncProductsFromApi === 'function') {
    await syncProductsFromApi();
  }
  renderProducts();
  initFilters();
  updateCartUI();

  // Cart
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('close-cart').addEventListener('click', closeCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);
  document.getElementById('clear-cart').addEventListener('click', () => {
    if (confirm('Kosongkan semua isi keranjang?')) clearCart();
  });

  document.getElementById('checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) return;
    openCheckoutModal();
  });

  // PDP
  document.getElementById('pdp-close').addEventListener('click', closePDP);
  document.getElementById('pdp-overlay').addEventListener('click', closePDP);
  document.getElementById('pdp-btn-cart').addEventListener('click', () => {
    if (_pdpCurrentId) {
      addToCart(_pdpCurrentId);
      closePDP();
    }
  });

  // ESC key closes all modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePDP(); closeCart(); closeCheckoutModal(); closeFineModal(); }
  });

  // Auto-open fine modal from admin link params
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get('action') === 'fine') {
    setTimeout(() => {
      openFineModal({
        pricePerDay:  parseInt(urlParams.get('pricePerDay')) || 0,
        dueDate:      urlParams.get('dueDate') || '',
        actualDate:   new Date().toISOString().split('T')[0],
        customerPhone: urlParams.get('phone') || '',
      });
    }, 400);
  }
});

// ===== CHECKOUT MODAL =====
// ===== CUSTOMER AUTH STATE & SERVICES =====
function getCustomerToken() {
  return localStorage.getItem('rtk_cust_token');
}
function getCustomerInfo() {
  const info = localStorage.getItem('rtk_cust_info');
  return info ? JSON.parse(info) : null;
}
function setCustomerSession(token, customer) {
  localStorage.setItem('rtk_cust_token', token);
  localStorage.setItem('rtk_cust_info', JSON.stringify(customer));
  updateAuthWidget();
}
function clearCustomerSession() {
  localStorage.removeItem('rtk_cust_token');
  localStorage.removeItem('rtk_cust_info');
  updateAuthWidget();
}

function updateAuthWidget() {
  const widget = document.getElementById('auth-widget');
  if (!widget) return;
  const token = getCustomerToken();
  const info = getCustomerInfo();
  
  if (token && info) {
    let kycStatusText = '';
    if (info.kycStatus === 'verified') kycStatusText = ' <i class="fa-solid fa-circle-check" style="color:var(--green-500);font-size:0.75rem;"></i>';
    widget.innerHTML = `
      <div class="cust-dropdown" id="cust-dropdown">
        <button class="cust-dropdown-btn" id="cust-dropdown-btn">
          <i class="fa-regular fa-circle-user"></i> ${info.name.split(' ')[0]}${kycStatusText}
        </button>
        <div class="cust-dropdown-menu" id="cust-dropdown-menu">
          <button class="cust-dropdown-item" id="nav-profile-btn"><i class="fa-solid fa-user-gear"></i> Profil & KYC</button>
          <button class="cust-dropdown-item" id="nav-logout-action"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
        </div>
      </div>
    `;
    
    // Wire dropdown toggle
    document.getElementById('cust-dropdown-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('cust-dropdown-menu').classList.toggle('open');
    });
    document.getElementById('nav-profile-btn').addEventListener('click', () => openProfileModal());
    document.getElementById('nav-logout-action').addEventListener('click', () => handleLogout());
  } else {
    widget.innerHTML = `
      <button id="nav-login-btn" class="nav-auth-btn">
        <i class="fa-regular fa-user"></i> Masuk / Daftar
      </button>
    `;
    document.getElementById('nav-login-btn').addEventListener('click', () => openAuthModal());
  }
}

// Global click handler to close dropdowns
document.addEventListener('click', () => {
  const menu = document.getElementById('cust-dropdown-menu');
  if (menu) menu.classList.remove('open');
});

function handleLogout() {
  if (confirm('Yakin ingin keluar dari akun Anda?')) {
    clearCustomerSession();
    showToast('✓ Berhasil keluar');
    closeProfileModal();
    updateCartUI();
  }
}

// ===== AUTH MODALS =====
function openAuthModal(defaultTab = 'login') {
  document.getElementById('auth-overlay').classList.add('open');
  document.getElementById('auth-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  switchAuthTab(defaultTab);
  
  // Clear inputs and errors
  document.getElementById('cust-login-form').reset();
  document.getElementById('cust-register-form').reset();
  document.getElementById('cust-login-err').textContent = '';
  document.getElementById('cust-register-err').textContent = '';
}

function closeAuthModal() {
  document.getElementById('auth-overlay').classList.remove('open');
  document.getElementById('auth-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function switchAuthTab(tab) {
  const loginBtn = document.getElementById('tab-login-btn');
  const regBtn = document.getElementById('tab-register-btn');
  const loginForm = document.getElementById('cust-login-form');
  const regForm = document.getElementById('cust-register-form');
  
  if (tab === 'login') {
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
    loginForm.classList.add('active');
    regForm.classList.remove('active');
  } else {
    loginBtn.classList.remove('active');
    regBtn.classList.add('active');
    loginForm.classList.remove('active');
    regForm.classList.add('active');
  }
}

// ===== PROFILE & KYC MODAL =====
async function openProfileModal() {
  const info = getCustomerInfo();
  if (!info) return;

  // Sync latest customer status from server
  try {
    const res = await fetch(`/api/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: info.email, password: info.password })
    });
    if (res.ok) {
      const data = await res.json();
      setCustomerSession(data.token, data.customer);
    }
  } catch (err) {}

  const currentInfo = getCustomerInfo();

  document.getElementById('prof-name').textContent = currentInfo.name;
  document.getElementById('prof-email').textContent = currentInfo.email;
  document.getElementById('prof-phone').textContent = currentInfo.phone;
  
  // Render KYC Badge & Upload Form
  const badge = document.getElementById('prof-kyc-badge');
  const uploadSection = document.getElementById('prof-kyc-upload-section');
  
  const statusMap = {
    pending: ['badge-kyc-pending', 'Belum Upload'],
    uploaded: ['badge-kyc-uploaded', 'Menunggu Verifikasi'],
    verified: ['badge-kyc-verified', 'Terverifikasi (KYC Sukses)'],
    rejected: ['badge-kyc-rejected', 'Ditolak (Upload Ulang)']
  };
  const [cls, label] = statusMap[currentInfo.kycStatus] || ['badge-kyc-pending', currentInfo.kycStatus];
  badge.innerHTML = `<span class="${cls}">${label}</span>`;
  
  if (currentInfo.kycStatus === 'pending' || currentInfo.kycStatus === 'rejected') {
    uploadSection.style.display = 'block';
    
    // Reset file inputs & previews
    document.getElementById('prof-ktp-preview').style.display = 'none';
    document.getElementById('prof-selfie-preview').style.display = 'none';
    document.getElementById('prof-ktp-label').textContent = 'Upload foto KTP';
    document.getElementById('prof-selfie-label').textContent = 'Foto Selfie';
    document.getElementById('prof-ktp-drop').classList.remove('has-image');
    document.getElementById('prof-selfie-drop').classList.remove('has-image');
    document.getElementById('prof-ktp').value = '';
    document.getElementById('prof-selfie').value = '';
    document.getElementById('prof-kyc-err').textContent = '';
  } else {
    uploadSection.style.display = 'none';
  }

  // Load and render booking history
  await loadCustomerBookings();

  document.getElementById('profile-overlay').classList.add('open');
  document.getElementById('profile-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  document.getElementById('profile-overlay').classList.remove('open');
  document.getElementById('profile-modal').classList.remove('open');
  document.body.style.overflow = '';
}

async function loadCustomerBookings() {
  const container = document.getElementById('cust-bookings-list');
  if (!container) return;
  const token = getCustomerToken();
  if (!token) return;

  try {
    container.innerHTML = '<p style="font-size:.82rem;color:var(--slate-400);text-align:center;padding:1rem 0;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</p>';
    const res = await fetch(`/api/customer/bookings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      container.innerHTML = '<p style="font-size:.82rem;color:var(--red-600);text-align:center;padding:1rem 0;">Gagal memuat riwayat booking</p>';
      return;
    }
    const bookings = await res.json();
    if (!bookings.length) {
      container.innerHTML = '<p style="font-size:.82rem;color:var(--slate-400);text-align:center;padding:1.5rem 0;">Belum ada riwayat booking.</p>';
      return;
    }

    const products = getProducts();
    
    // Render bookings
    container.innerHTML = bookings.reverse().map(b => {
      const pNames = (b.items || []).map(item => {
        const p = products.find(x => x.id === item.productId);
        return p ? `${p.name} (x${item.qty})` : '?';
      }).join(', ');

      const statusMap = {
        pending: ['#d97706', 'Pending'],
        confirmed: ['#2563eb', 'Terkonfirmasi'],
        active: ['#059669', 'Aktif'],
        done: ['#64748b', 'Selesai'],
        cancelled: ['#dc2626', 'Dibatalkan']
      };
      const [color, label] = statusMap[b.status] || ['#64748b', b.status];

      return `
        <div class="cust-booking-item">
          <div class="cust-booking-info">
            <span class="cust-booking-id">${b.id}</span>
            <span class="cust-booking-products" title="${pNames}">${pNames}</span>
            <span class="cust-booking-dates">${formatDateShort(b.startDate)} s/d ${formatDateShort(b.endDate)}</span>
          </div>
          <div class="cust-booking-meta">
            <span class="cust-booking-price">${formatRupiah(b.totalPrice)}</span>
            <span style="font-size:0.7rem;font-weight:700;color:${color};text-transform:uppercase;">${label}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p style="font-size:.82rem;color:var(--red-600);text-align:center;padding:1rem 0;">Koneksi gagal</p>';
  }
}

function formatDateShort(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

// ===== PAYMENT GATEWAY MODAL =====
let _payCountdownInterval = null;
let _payCurrentBooking = null;

function openPaymentModal(bookingTotal, bookingData = null) {
  _payCurrentBooking = bookingData;
  document.getElementById('pay-amount-label').textContent = formatRupiah(bookingTotal);
  
  // Set mock Virtual Account number
  document.getElementById('pay-va-number').textContent = '8830 ' + (getCustomerInfo()?.phone || '081234567890');
  
  // Reset tabs
  switchPaymentMethod('qris');

  // Start 5-minute countdown
  let duration = 5 * 60;
  const timerEl = document.getElementById('pay-timer');
  timerEl.textContent = '05:00';
  
  if (_payCountdownInterval) clearInterval(_payCountdownInterval);
  
  _payCountdownInterval = setInterval(() => {
    let minutes = Math.floor(duration / 60);
    let seconds = duration % 60;
    minutes = String(minutes).padStart(2, '0');
    seconds = String(seconds).padStart(2, '0');
    
    timerEl.textContent = `${minutes}:${seconds}`;
    
    if (--duration < 0) {
      clearInterval(_payCountdownInterval);
      alert('Sesi pembayaran telah berakhir.');
      closePaymentModal();
    }
  }, 1000);

  document.getElementById('payment-overlay').classList.add('open');
  document.getElementById('payment-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
  if (_payCountdownInterval) clearInterval(_payCountdownInterval);
  document.getElementById('payment-overlay').classList.remove('open');
  document.getElementById('payment-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function switchPaymentMethod(method) {
  const tabs = document.querySelectorAll('.pay-method-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.method === method);
  });
  
  document.getElementById('pay-method-qris').style.display = method === 'qris' ? 'block' : 'none';
  document.getElementById('pay-method-va').style.display = method === 'va' ? 'block' : 'none';
}

// ===== CHECKOUT MODAL REFACTOR =====
function openCheckoutModal() {
  const info = getCustomerInfo();
  if (!info) {
    openAuthModal('login');
    return;
  }
  
  if (info.kycStatus !== 'verified') {
    if (info.kycStatus === 'uploaded') {
      alert('Akun Anda sedang menunggu verifikasi KYC oleh admin. Harap tunggu persetujuan.');
    } else {
      alert('Anda harus melengkapi Verifikasi Identitas (KYC) di profil Anda sebelum menyewa kamera.');
      openProfileModal();
    }
    return;
  }

  // Pre-fill fields
  document.getElementById('cform-name').value = info.name;
  document.getElementById('cform-phone').value = info.phone;

  const today    = new Date().toISOString().split('T')[0];
  const maxDays  = Math.max(...cart.map(i => i.days || 1));
  const endDate  = new Date(Date.now() + maxDays * 86400000).toISOString().split('T')[0];

  const startEl = document.getElementById('cform-start');
  const endEl   = document.getElementById('cform-end');
  startEl.value = today;
  startEl.min   = today;
  endEl.value   = endDate;
  endEl.min     = today;

  // Clear errors
  ['cform-name-err','cform-phone-err','cform-date-err','cform-conflict-err']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });

  renderCheckoutSummary();

  document.getElementById('checkout-overlay').classList.add('open');
  document.getElementById('checkout-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  document.getElementById('checkout-overlay').classList.remove('open');
  document.getElementById('checkout-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCheckoutSummary() {
  const sumEl = document.getElementById('checkout-summary');
  if (!sumEl) return;
  const start   = document.getElementById('cform-start').value;
  const end     = document.getElementById('cform-end').value;
  
  function daysBetween(a, b) { return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1); }
  const days = (start && end) ? daysBetween(start, end) : 1;
  
  const total = cart.reduce((s, i) => s + i.price * i.qty * days, 0);
  const rows  = cart.map(i =>
    `<div class="checkout-summary-row" style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:0.25rem;color:var(--slate-700);">
      <span>${i.name} ×${i.qty} × ${days} hari</span>
      <span>${formatRupiah(i.price * i.qty * days)}</span>
    </div>`
  ).join('');
  sumEl.innerHTML = `
    <div class="checkout-summary-title" style="font-weight:700;font-size:0.85rem;color:var(--slate-900);border-top:1.5px solid var(--slate-100);padding-top:0.75rem;margin:0.75rem 0 0.5rem 0;">Ringkasan Pesanan</div>
    ${rows}
    <div class="checkout-summary-total" style="display:flex;justify-content:space-between;font-weight:800;font-size:0.95rem;color:var(--slate-900);border-top:1.5px solid var(--slate-200);padding-top:0.5rem;margin-top:0.5rem;">
      <span>Total Pembayaran</span><span style="color:var(--blue-700);">${formatRupiah(total)}</span>
    </div>`;
}

// ===== QUICK LOGIN (Admin/Staff) =====
async function quickLoginAs(username, password) {
  const errEl = document.getElementById('cust-login-err');
  if (errEl) errEl.textContent = '';
  const btn = document.getElementById(username === 'admin' ? 'quick-login-admin' : 'quick-login-staff');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('Login gagal: ' + (data.error || 'Error'));
      return;
    }
    // Store admin/staff token and redirect
    localStorage.setItem('rtk_admin_token', data.token);
    localStorage.setItem('rtk_admin_role', data.role);
    showToast(`Masuk sebagai ${data.role}...`);
    closeAuthModal();
    setTimeout(() => { window.location.href = '/admin.html'; }, 500);
  } catch(err) {
    showToast('Koneksi gagal');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = username === 'admin'
        ? '<i class="fa-solid fa-shield-halved"></i> Login sebagai Admin'
        : '<i class="fa-solid fa-user-tie"></i> Login sebagai Staff';
    }
  }
}

// Wired up after DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Checkout modal wiring
  document.getElementById('checkout-close').addEventListener('click', closeCheckoutModal);
  document.getElementById('checkout-overlay').addEventListener('click', closeCheckoutModal);

  // Dynamic Auth Boot
  updateAuthWidget();

  // Auth Modals closes
  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.getElementById('auth-overlay').addEventListener('click', closeAuthModal);
  document.getElementById('tab-login-btn').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-register-btn').addEventListener('click', () => switchAuthTab('register'));

  // Auth Forms Submit
  document.getElementById('cust-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pw').value;
    const errEl = document.getElementById('cust-login-err');
    errEl.textContent = '';

    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Gagal login';
        return;
      }
      setCustomerSession(data.token, data.customer);
      showToast(`Selamat datang kembali, ${data.customer.name}!`);
      closeAuthModal();
      updateCartUI();
    } catch(err) {
      errEl.textContent = 'Koneksi gagal';
    }
  });

  document.getElementById('cust-register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-pw').value;
    const errEl = document.getElementById('cust-register-err');
    errEl.textContent = '';

    if (password.length < 6) {
      errEl.textContent = 'Password minimal 6 karakter';
      return;
    }

    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Gagal registrasi';
        return;
      }
      setCustomerSession(data.token, data.customer);
      showToast(`Akun berhasil dibuat! Silakan verifikasi KYC.`);
      closeAuthModal();
      openProfileModal();
    } catch(err) {
      errEl.textContent = 'Koneksi gagal';
    }
  });

  // ===== QUICK LOGIN ADMIN / STAFF =====
  document.getElementById('quick-login-admin')?.addEventListener('click', () => quickLoginAs('admin', 'rtk2024admin'));
  document.getElementById('quick-login-staff')?.addEventListener('click', () => quickLoginAs('staff', 'rtk2024staff'));

  // Profile modal wire
  document.getElementById('profile-close').addEventListener('click', closeProfileModal);
  document.getElementById('profile-overlay').addEventListener('click', closeProfileModal);

  // KYC upload file preview
  function setupProfKycPreview(inputId, previewId, labelId, dropId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const preview = document.getElementById(previewId);
      const label   = document.getElementById(labelId);
      const drop    = document.getElementById(dropId);
      const reader  = new FileReader();
      reader.onload  = e => {
        if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
        if (label)   label.textContent = file.name;
        if (drop)    drop.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    });
  }
  setupProfKycPreview('prof-ktp',    'prof-ktp-preview',    'prof-ktp-label',    'prof-ktp-drop');
  setupProfKycPreview('prof-selfie', 'prof-selfie-preview', 'prof-selfie-label', 'prof-selfie-drop');

  // KYC Form Submit
  document.getElementById('prof-kyc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ktpFile = document.getElementById('prof-ktp').files[0];
    const selfieFile = document.getElementById('prof-selfie').files[0];
    const errEl = document.getElementById('prof-kyc-err');
    const btn = document.getElementById('prof-kyc-btn');
    errEl.textContent = '';

    if (!ktpFile) {
      errEl.textContent = 'Foto KTP wajib diunggah';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Mengunggah...';

    async function fileToBase64(file) {
      if (!file) return null;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    try {
      const ktpBase64 = await fileToBase64(ktpFile);
      const selfieBase64 = await fileToBase64(selfieFile) || ktpBase64; // Fallback to KTP if no selfie provided

      const token = getCustomerToken();
      const res = await fetch(`/api/customer/kyc-upload`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ktpBase64, selfieBase64 })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        errEl.textContent = data.error || 'Gagal mengunggah KYC';
        btn.disabled = false;
        btn.textContent = 'Kirim Dokumen KYC';
        return;
      }

      showToast('✓ Berkas KYC berhasil diunggah. Menunggu persetujuan admin.');
      
      // Update local storage status
      const info = getCustomerInfo();
      info.kycStatus = 'uploaded';
      localStorage.setItem('rtk_cust_info', JSON.stringify(info));
      
      openProfileModal(); // Reload profile modal state
    } catch(err) {
      errEl.textContent = 'Koneksi gagal';
      btn.disabled = false;
      btn.textContent = 'Kirim Dokumen KYC';
    }
  });

  // Payment modal close & cancel
  document.getElementById('pay-close').addEventListener('click', closePaymentModal);
  document.getElementById('payment-overlay').addEventListener('click', closePaymentModal);
  document.getElementById('pay-cancel-btn').addEventListener('click', closePaymentModal);

  // VA / QRIS Tab Toggle
  document.querySelectorAll('.pay-method-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchPaymentMethod(tab.dataset.method);
    });
  });

  // Simulated Pay Success click
  document.getElementById('pay-simulate-btn').addEventListener('click', async () => {
    if (!_payCurrentBooking) return;
    const btn = document.getElementById('pay-simulate-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi Pembayaran...';

    try {
      // 1. Create booking first (POST /api/customer/book)
      const token = getCustomerToken();
      const info = getCustomerInfo();
      
      const bookRes = await fetch(`/api/customer/book`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerName: info.name,
          customerPhone: info.phone,
          startDate: _payCurrentBooking.startDate,
          endDate: _payCurrentBooking.endDate,
          notes: _payCurrentBooking.notes,
          items: _payCurrentBooking.items,
          totalPrice: _payCurrentBooking.totalPrice
        })
      });

      const bookData = await bookRes.json();
      if (!bookRes.ok) {
        alert('Gagal membuat pesanan: ' + (bookData.error || 'Terjadi kesalahan'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Simulasikan Pembayaran Berhasil';
        return;
      }

      const bookingId = bookData.booking.id;

      // 2. Simulate payment confirmation (POST /api/customer/pay/:id)
      const payRes = await fetch(`/api/customer/pay/${bookingId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });

      if (!payRes.ok) {
        alert('Gagal memproses pembayaran di server');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Simulasikan Pembayaran Berhasil';
        return;
      }

      showToast('✓ Pembayaran Berhasil! Pesanan Anda dikonfirmasi.');
      
      closePaymentModal();
      clearCart();
      
      // Open Profile Modal to show booking history
      openProfileModal();
    } catch(err) {
      alert('Koneksi gagal saat memproses pembayaran');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Simulasikan Pembayaran Berhasil';
    }
  });

  // Re-calculate checkout summaries when dates change
  document.getElementById('cform-start').addEventListener('change', renderCheckoutSummary);
  document.getElementById('cform-end').addEventListener('change', renderCheckoutSummary);

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const start   = document.getElementById('cform-start').value;
    const end     = document.getElementById('cform-end').value;
    const notes   = document.getElementById('cform-notes').value.trim();
    const btn     = document.getElementById('checkout-confirm-btn');

    document.getElementById('cform-date-err').textContent    = '';
    document.getElementById('cform-conflict-err').textContent = '';

    if (!start || !end) {
      document.getElementById('cform-date-err').textContent = 'Tanggal sewa wajib diisi';
      return;
    } else if (start > end) {
      document.getElementById('cform-date-err').textContent = 'Tanggal mulai tidak boleh setelah tanggal selesai';
      return;
    }

    function daysBetween(a, b) { return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1); }
    const days  = daysBetween(start, end);
    const total = cart.reduce((s, i) => s + i.price * i.qty * days, 0);

    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

    // Verify conflicts on server
    try {
      const resAvailability = await fetch('/api/availability');
      const activeBookings = await resAvailability.json();
      const products = getProducts();
      
      const conflicts = [];
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        const totalUnits = product ? (product.units || 1) : 1;
        let maxRented = 0;
        activeBookings.forEach(b => {
          if (b.startDate <= end && b.endDate >= start) {
            const bi = b.items.find(x => x.productId === item.id);
            if (bi) maxRented += bi.qty;
          }
        });
        const available = totalUnits - maxRented;
        if (item.qty > available) {
          conflicts.push({ name: item.name, requested: item.qty, available: Math.max(0, available) });
        }
      }

      if (conflicts.length > 0) {
        const detail = conflicts.map(c => `• ${c.name}: diminta ${c.requested} unit, tersedia ${c.available}`).join('\n');
        document.getElementById('cform-conflict-err').innerHTML = `<span style="color:var(--red-600);">⚠️ Bentrok tanggal:\n${detail}</span>`;
        btn.disabled  = false;
        btn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Lanjutkan ke Pembayaran';
        return;
      }

      // Close checkout and open simulated payment
      closeCheckoutModal();
      openPaymentModal(total, {
        startDate: start,
        endDate: end,
        notes: notes || 'Self-Service Web Booking',
        items: cart.map(i => ({ productId: i.id, qty: i.qty })),
        totalPrice: total
      });
      
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Lanjutkan ke Pembayaran';
    } catch (err) {
      console.error(err);
      document.getElementById('cform-conflict-err').textContent = 'Koneksi gagal, coba lagi.';
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Lanjutkan ke Pembayaran';
    }
  });
});

// ===== PHASE 3: LATE FINE CALCULATOR =====
let _fineContext = null;

function openFineModal(opts = {}) {
  _fineContext = opts;
  const today = new Date().toISOString().split('T')[0];
  const priceEl  = document.getElementById('fine-price-per-day');
  const pctEl    = document.getElementById('fine-pct');
  const dueEl    = document.getElementById('fine-due');
  const actualEl = document.getElementById('fine-actual');
  const resultEl = document.getElementById('fine-result');
  if (priceEl)  priceEl.value  = opts.pricePerDay || '';
  if (pctEl)    pctEl.value    = opts.finePct     || 100;
  if (dueEl)    dueEl.value    = opts.dueDate      || today;
  if (actualEl) actualEl.value = opts.actualDate   || today;
  if (resultEl) resultEl.style.display = 'none';
  document.getElementById('fine-overlay').classList.add('open');
  document.getElementById('fine-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeFineModal() {
  document.getElementById('fine-overlay').classList.remove('open');
  document.getElementById('fine-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function calcLateFine() {
  const pricePerDay = parseInt(document.getElementById('fine-price-per-day').value) || 0;
  const pct         = parseFloat(document.getElementById('fine-pct').value) || 100;
  const dueDate     = document.getElementById('fine-due').value;
  const actualDate  = document.getElementById('fine-actual').value;
  if (!dueDate || !actualDate) { alert('Lengkapi tanggal terlebih dahulu'); return; }
  const daysLate   = Math.max(0, Math.round((new Date(actualDate) - new Date(dueDate)) / 86400000));
  const finePerDay = Math.round(pricePerDay * (pct / 100));
  const totalFine  = finePerDay * daysLate;
  document.getElementById('fine-days-late').textContent     = daysLate === 0 ? '0 hari (tepat waktu)' : `${daysLate} hari`;
  document.getElementById('fine-price-label').textContent   = formatRupiah(pricePerDay);
  document.getElementById('fine-pct-label').textContent     = `${pct}%`;
  document.getElementById('fine-per-day-amount').textContent = formatRupiah(finePerDay);
  document.getElementById('fine-total-amount').textContent  = formatRupiah(totalFine);
  document.getElementById('fine-result').style.display      = 'block';
}

function copyFineToWA() {
  const daysLate  = document.getElementById('fine-days-late').textContent;
  const totalFine = document.getElementById('fine-total-amount').textContent;
  const dueDate   = document.getElementById('fine-due').value;
  const actual    = document.getElementById('fine-actual').value;
  const phone     = _fineContext?.customerPhone || '';
  const msg = [
    '\u23f0 *Notifikasi Denda Keterlambatan RTK Rental*', '',
    `\uD83D\uDCC5 Jadwal Kembali: *${dueDate}*`,
    `\uD83D\uDCC5 Kembali Aktual: *${actual}*`,
    `\u231B Terlambat: *${daysLate}*`,
    `\uD83D\uDCB0 Total Denda: *${totalFine}*`, '',
    'Mohon segera lakukan pembayaran denda. Terima kasih \uD83D\uDE4F',
    '\u2014 RTK Rental Tangerang'
  ].join('\n');
  const waUrl = phone
    ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('fine-close');
  if (closeBtn) closeBtn.addEventListener('click', closeFineModal);
  const overlay  = document.getElementById('fine-overlay');
  if (overlay)  overlay.addEventListener('click', closeFineModal);
});
