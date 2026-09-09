const API_URL = 'http://localhost:3001/api';
let products = [];
let currentLang = localStorage.getItem('pirate_lang') || (navigator.language.startsWith('en') ? 'en' : 'es');
let cart = JSON.parse(localStorage.getItem('pirate_cart')) || [];

let productGrid, cartTrigger, cartModal, closeCart, cartItems, cartCount, cartTotal, checkoutBtn;
let productModal, closeProductModal, modalProdTitle, modalProdImg, modalProdDesc, modalProdExtra;
let activeModalProductId = null;

document.addEventListener('DOMContentLoaded', () => {
  productGrid = document.getElementById('productGrid');
  cartTrigger = document.getElementById('cartTrigger');
  cartModal = document.getElementById('cartModal');
  closeCart = document.getElementById('closeCart');
  cartItems = document.getElementById('cartItems');
  cartCount = document.getElementById('cartCount');
  cartTotal = document.getElementById('cartTotal');
  checkoutBtn = document.getElementById('checkoutBtn');

  productModal = document.getElementById('productModal');
  closeProductModal = document.getElementById('closeProductModal');
  modalProdTitle = document.getElementById('modalProdTitle');
  modalProdImg = document.getElementById('modalProdImg');
  modalProdDesc = document.getElementById('modalProdDesc');
  modalProdExtra = document.getElementById('modalProdExtra');

  setupEventListeners();
  initLanguageUI();
  fetchProducts();
  updateCartUI(); // <- Aquí estaba el fallo de la persistencia en caliente
});

function initLanguageUI() {
  document.querySelectorAll('.btn-lang').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(currentLang));
  });
  updateStaticTexts();
}

function updateStaticTexts() {
  const heroTitleEl = document.getElementById('hero-title');
  const heroSubtitleEl = document.getElementById('hero-subtitle');
  const cartTitleEl = document.getElementById('cart-title-text');

  if (heroTitleEl && typeof translations !== 'undefined') heroTitleEl.textContent = translations[currentLang].heroTitle;
  if (heroSubtitleEl && typeof translations !== 'undefined') heroSubtitleEl.textContent = translations[currentLang].heroSubtitle;
  if (cartTitleEl && typeof translations !== 'undefined') cartTitleEl.textContent = translations[currentLang].cartTitle;
  if (checkoutBtn && typeof translations !== 'undefined') checkoutBtn.textContent = translations[currentLang].checkout;
}

function setupEventListeners() {
  if (cartTrigger) cartTrigger.addEventListener('click', () => cartModal?.classList.add('open'));
  if (closeCart) closeCart.addEventListener('click', () => cartModal?.classList.remove('open'));
  
  if (cartModal) {
    cartModal.addEventListener('click', (e) => {
      if (e.target === cartModal) cartModal.classList.remove('open');
    });
  }

  if (closeProductModal) closeProductModal.addEventListener('click', () => {
    productModal?.classList.remove('open');
    activeModalProductId = null;
  });

  if (productModal) {
    productModal.addEventListener('click', (e) => {
      if (e.target === productModal) {
        productModal.classList.remove('open');
        activeModalProductId = null;
      }
    });
  }

  if (checkoutBtn) checkoutBtn.addEventListener('click', processPayment);
}

async function fetchProducts() {
  try {
    if (productGrid) {
      productGrid.innerHTML = `
        <div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      `;
    }

    const res = await fetch(`${API_URL}/products`);
    if (!res.ok) throw new Error('Error en el servidor');
    products = await res.json();
    renderProductsOnce();
  } catch (err) {
    console.error('Error cargando productos:', err);
    if (productGrid) {
      productGrid.innerHTML = '<p style="color: #ff5252; text-align: center; grid-column: 1/-1;">Error al conectar con el inventario del puerto.</p>';
    }
  }
}

function getProductLocalizedData(prod, index = 0) {
  const key = String(prod.id || prod._id);
  
  if (typeof productTranslations !== 'undefined' && productTranslations[key]) {
    if (productTranslations[key][currentLang]) {
      return productTranslations[key][currentLang];
    }
  }

  const translationKeys = Object.keys(productTranslations);
  const matchedKey = translationKeys[index];
  if (matchedKey && productTranslations[matchedKey][currentLang]) {
    return productTranslations[matchedKey][currentLang];
  }

  return {
    title: prod.title,
    description: prod.description || "Un valioso objeto para los hermanos de la costa."
  };
}

function renderProductsOnce() {
  if (!productGrid) return;
  
  productGrid.innerHTML = products.map((prod, index) => {
    const prodId = prod.id || prod._id;
    const localized = getProductLocalizedData(prod, index);
    
    return `
      <div class="card" onclick="openProductModal('${prodId}', ${index})">
        <div class="card-img-container">
          <img src="${prod.image}" alt="${localized.title}" class="card-img" loading="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title" data-field="title" data-id="${prodId}">${localized.title}</h3>
          <div class="card-info">
            <span class="price-tag">$${prod.price.toLocaleString('es-CL')} CLP</span>
            <span class="stock-tag ${prod.stock < 4 ? 'low' : ''}" data-field="stock-label" data-id="${prodId}">Stock: ${prod.stock}</span>
          </div>
          
          <div class="card-actions" onclick="event.stopPropagation()">
            <div class="quantity-control">
              <label data-field="qty-label" data-id="${prodId}">Cant:</label>
              <input type="number" id="qty-${prodId}" class="qty-input" value="1" min="1" max="${prod.stock}">
            </div>

            <button 
              class="btn-pirate" 
              id="btn-cart-${prodId}"
              onclick="addToCart('${prodId}', ${index})"
              data-field="btn-text"
              data-id="${prodId}"
              ${prod.stock === 0 ? 'disabled' : ''}
            >
              ${prod.stock > 0 ? t('addToCart') : t('soldOut')}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  updateDynamicTexts();
}

function updateDynamicTexts() {
  products.forEach((prod, index) => {
    const prodId = prod.id || prod._id;
    const localized = getProductLocalizedData(prod, index);

    const titleEl = document.querySelector(`[data-field="title"][data-id="${prodId}"]`);
    if (titleEl) titleEl.textContent = localized.title;

    const stockEl = document.querySelector(`[data-field="stock-label"][data-id="${prodId}"]`);
    if (stockEl) stockEl.textContent = `${t('stock')} ${prod.stock}`;

    const qtyLabelEl = document.querySelector(`[data-field="qty-label"][data-id="${prodId}"]`);
    if (qtyLabelEl) qtyLabelEl.textContent = t('qty');

    const btnEl = document.querySelector(`[data-field="btn-text"][data-id="${prodId}"]`);
    if (btnEl && prod.stock > 0) btnEl.textContent = t('addToCart');
    if (btnEl && prod.stock === 0) btnEl.textContent = t('soldOut');
  });
}

window.openProductModal = function(id, index = 0) {
  const prod = products.find(p => String(p.id || p._id) === String(id));
  if (!prod || !productModal) return;

  activeModalProductId = id;
  const localized = getProductLocalizedData(prod, index);

  if (modalProdTitle) modalProdTitle.textContent = localized.title;
  if (modalProdImg) modalProdImg.src = prod.image;
  if (modalProdDesc) modalProdDesc.textContent = localized.description;
  if (modalProdExtra) modalProdExtra.textContent = `$${prod.price.toLocaleString('es-CL')} CLP — ${t('stock')} ${prod.stock}`;

  productModal.classList.add('open');
};

window.addToCart = function(id, index = 0) {
  const product = products.find(p => String(p.id || p._id) === String(id));
  const qtyInput = document.getElementById(`qty-${id}`);
  const quantityToAdd = qtyInput ? parseInt(qtyInput.value) : 1;
  const localized = getProductLocalizedData(product, index);

  if (isNaN(quantityToAdd) || quantityToAdd < 1 || quantityToAdd > product.stock) {
    alert('¡Cantidad inválida o excede el botín disponible!');
    return;
  }

  const cartItem = cart.find(item => String(item.id) === String(id));

  if (cartItem) {
    if (cartItem.quantity + quantityToAdd <= product.stock) {
      cartItem.quantity += quantityToAdd;
    } else {
      alert(`¡Ahoy! Solo quedan ${product.stock} en la bodega.`);
      return;
    }
  } else {
    cart.push({ id: id, title: localized.title, price: product.price, quantity: quantityToAdd });
  }

  updateCartUI();
  showToast(`¡${quantityToAdd}x ${localized.title} añadido al cofre!`);
};

window.removeFromCart = function(id) {
  cart = cart.filter(item => String(item.id) !== String(id));
  updateCartUI();
};

function updateCartUI() {
  localStorage.setItem('pirate_cart', JSON.stringify(cart));

  const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  if (cartCount) cartCount.textContent = totalCount;
  if (cartTotal) cartTotal.textContent = `$${totalPrice.toLocaleString('es-CL')} CLP`;

  if (cartItems) {
    cartItems.innerHTML = cart.length === 0 
      ? '<p style="text-align: center; color: #888; padding: 2rem;">Tu cofre está vacío, marinero.</p>'
      : cart.map(item => {
          const productObj = products.find(p => String(p.id || p._id) === String(item.id));
          const productIndex = products.findIndex(p => String(p.id || p._id) === String(item.id));
          const localized = productObj ? getProductLocalizedData(productObj, productIndex !== -1 ? productIndex : 0) : { title: item.title };
          return `
            <div class="cart-item">
              <div style="flex-grow: 1;">
                <strong>${item.quantity}x ${localized.title}</strong><br>
                <small style="color: #aaa;">$${item.price.toLocaleString('es-CL')} c/u</small>
              </div>
              <div style="display: flex; gap: 15px; align-items: center;">
                <strong>$${(item.price * item.quantity).toLocaleString('es-CL')}</strong>
                <button class="btn-remove" onclick="removeFromCart('${item.id}')" title="Eliminar">✕</button>
              </div>
            </div>
          `;
        }).join('');
  }

  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

async function processPayment() {
  if (cart.length === 0) return;

  const paymentWindow = window.open('', '_blank');
  if (paymentWindow) {
    paymentWindow.document.write(`
      <html>
        <head><title>Procesando Pago...</title></head>
        <body style="background: #09090b; color: #f4f4f5; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
          <h2 style="color: #eab308; font-weight: 500;">Preparando pasarela de pago segura...</h2>
        </body>
      </html>
    `);
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Generando Orden...';
  }

  try {
    const response = await fetch(`${API_URL}/create-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart })
    });

    const data = await response.json();

    if (data.init_point && paymentWindow) {
      paymentWindow.location.href = data.init_point;
    } else {
      if (paymentWindow) paymentWindow.close();
      alert('Error: ' + (data.error || 'No se pudo iniciar el pago.'));
    }
  } catch (error) {
    console.error('Error procesando pago:', error);
    if (paymentWindow) paymentWindow.close();
    alert('Ocurrió un error al conectar con la pasarela.');
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = t('checkout');
    }
  }
}

window.changeLanguage = function(lang) {
  currentLang = lang;
  localStorage.setItem('pirate_lang', lang);
  
  document.querySelectorAll('.btn-lang').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(lang));
  });

  updateStaticTexts();
  updateDynamicTexts();
  updateCartUI();

  if (productModal && productModal.classList.contains('open') && activeModalProductId) {
    const prod = products.find(p => String(p.id || p._id) === String(activeModalProductId));
    const index = products.findIndex(p => String(p.id || p._id) === String(activeModalProductId));
    if (prod) openProductModal(activeModalProductId, index !== -1 ? index : 0);
  }
};

function t(key) {
  try {
    if (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang][key]) {
      return translations[currentLang][key];
    }
  } catch (e) {}
  return key;
}