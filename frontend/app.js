const API_URL = 'http://localhost:3001/api';
let products = [];
let productDictionary = new Map(); // Caché para búsquedas O(1)
let currentLang = localStorage.getItem('pirate_lang') || (navigator.language.startsWith('en') ? 'en' : 'es');
let cart = JSON.parse(localStorage.getItem('pirate_cart')) || [];

// Referencias al DOM cacheadas
const DOM = {
  grid: document.getElementById('productGrid'),
  cartTrigger: document.getElementById('cartTrigger'),
  cartModal: document.getElementById('cartModal'),
  closeCart: document.getElementById('closeCart'),
  cartItems: document.getElementById('cartItems'),
  cartCount: document.getElementById('cartCount'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutBtn: document.getElementById('checkoutBtn'),
  productModal: document.getElementById('productModal'),
  closeProductModal: document.getElementById('closeProductModal'),
  modalTitle: document.getElementById('modalProdTitle'),
  modalImg: document.getElementById('modalProdImg'),
  modalDesc: document.getElementById('modalProdDesc'),
  modalExtra: document.getElementById('modalProdExtra')
};

let activeModalProductId = null;

document.addEventListener('DOMContentLoaded', () => {
  initLanguageUI();
  setupEventListeners();
  fetchProducts();
  updateCartUI();
});

// --- UI Y LENGUAJE ---
function initLanguageUI() {
  document.querySelectorAll('.btn-lang').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(currentLang));
  });
  updateStaticTexts();
}

function updateStaticTexts() {
  const tDict = typeof translations !== 'undefined' ? translations[currentLang] : null;
  if (!tDict) return;

  const elements = {
    'hero-title': tDict.heroTitle,
    'hero-subtitle': tDict.heroSubtitle,
    'cart-title-text': tDict.cartTitle
  };

  for (const [id, text] of Object.entries(elements)) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  if (DOM.checkoutBtn) DOM.checkoutBtn.textContent = tDict.checkout;
}

// --- EVENT DELEGATION (Modo PRO) ---
function setupEventListeners() {
  // Modales
  DOM.cartTrigger?.addEventListener('click', () => DOM.cartModal?.classList.add('open'));
  DOM.closeCart?.addEventListener('click', () => DOM.cartModal?.classList.remove('open'));
  DOM.closeProductModal?.addEventListener('click', closeProductModal);
  
  window.addEventListener('click', (e) => {
    if (e.target === DOM.cartModal) DOM.cartModal.classList.remove('open');
    if (e.target === DOM.productModal) closeProductModal();
  });

  // Botones de idioma
  document.querySelector('.lang-selector')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-lang')) {
      changeLanguage(e.target.textContent.includes('ES') ? 'es' : 'en');
    }
  });

  // Delegación en el Grid de Productos
  DOM.grid?.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    const addToCartBtn = e.target.closest('.btn-pirate');
    
    if (addToCartBtn) {
      e.stopPropagation();
      const id = addToCartBtn.dataset.id;
      addToCart(id);
      return;
    }
    
    if (card) {
      const id = card.dataset.id;
      openProductModal(id);
    }
  });

  // Delegación en el Carrito
  DOM.cartItems?.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove')) {
      removeFromCart(e.target.dataset.id);
    }
  });

  DOM.checkoutBtn?.addEventListener('click', processPayment);
}

function closeProductModal() {
  DOM.productModal?.classList.remove('open');
  activeModalProductId = null;
}

// --- LÓGICA DE DATOS ---
async function fetchProducts() {
  try {
    if (DOM.grid) {
      DOM.grid.innerHTML = Array(3).fill('<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>').join('');
    }

    const res = await fetch(`${API_URL}/products`);
    if (!res.ok) throw new Error('Error en el servidor');
    products = await res.json();
    
    // Indexar para búsquedas O(1)
    products.forEach((p, i) => productDictionary.set(String(p.id || p._id), { ...p, index: i }));
    
    renderProducts();
  } catch (err) {
    console.error('Error cargando productos:', err);
    if (DOM.grid) DOM.grid.innerHTML = '<p style="color: #ff5252; text-align: center; grid-column: 1/-1;">Error al conectar con el inventario del puerto.</p>';
  }
}

function getProductLocalizedData(prodId) {
  const prod = productDictionary.get(String(prodId));
  if (!prod) return { title: "Item", description: "" };

  const pTrans = typeof productTranslations !== 'undefined' ? productTranslations : {};
  const tData = pTrans[prodId] || pTrans[Object.keys(pTrans)[prod.index]];
  
  if (tData && tData[currentLang]) return tData[currentLang];
  
  return { title: prod.title, description: prod.description || "Un valioso objeto." };
}

function renderProducts() {
  if (!DOM.grid) return;
  
  // Usamos DocumentFragment para inyectar al DOM una sola vez (Performance+)
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  tempDiv.innerHTML = products.map((prod) => {
    const prodId = String(prod.id || prod._id);
    const localized = getProductLocalizedData(prodId);
    
    return `
      <div class="card" data-id="${prodId}">
        <div class="card-img-container">
          <img src="${prod.image}" alt="${localized.title}" class="card-img" loading="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title">${localized.title}</h3>
          <div class="card-info">
            <span class="price-tag">$${prod.price.toLocaleString('es-CL')} CLP</span>
            <span class="stock-tag ${prod.stock < 4 ? 'low' : ''}">${t('stock')} ${prod.stock}</span>
          </div>
          
          <div class="card-actions">
            <div class="quantity-control">
              <label>${t('qty')}</label>
              <input type="number" id="qty-${prodId}" class="qty-input" value="1" min="1" max="${prod.stock}" onclick="event.stopPropagation()">
            </div>
            <button class="btn-pirate" data-id="${prodId}" ${prod.stock === 0 ? 'disabled' : ''}>
              ${prod.stock > 0 ? t('addToCart') : t('soldOut')}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);
  
  DOM.grid.innerHTML = '';
  DOM.grid.appendChild(fragment);
}

// --- ACCIONES ---
function openProductModal(id) {
  const prod = productDictionary.get(id);
  if (!prod || !DOM.productModal) return;

  activeModalProductId = id;
  const localized = getProductLocalizedData(id);

  if (DOM.modalTitle) DOM.modalTitle.textContent = localized.title;
  if (DOM.modalImg) DOM.modalImg.src = prod.image;
  if (DOM.modalDesc) DOM.modalDesc.textContent = localized.description;
  if (DOM.modalExtra) DOM.modalExtra.textContent = `$${prod.price.toLocaleString('es-CL')} CLP — ${t('stock')} ${prod.stock}`;

  DOM.productModal.classList.add('open');
}

function addToCart(id) {
  const product = productDictionary.get(id);
  if (!product) return;

  const qtyInput = document.getElementById(`qty-${id}`);
  const quantityToAdd = qtyInput ? parseInt(qtyInput.value, 10) : 1;
  const localized = getProductLocalizedData(id);

  if (isNaN(quantityToAdd) || quantityToAdd < 1 || quantityToAdd > product.stock) {
    alert('¡Cantidad inválida o excede el botín disponible!');
    return;
  }

  const existingItem = cart.find(item => String(item.id) === id);

  if (existingItem) {
    if (existingItem.quantity + quantityToAdd <= product.stock) {
      existingItem.quantity += quantityToAdd;
    } else {
      alert(`¡Ahoy! Solo quedan ${product.stock} en la bodega.`);
      return;
    }
  } else {
    cart.push({ id, price: product.price, quantity: quantityToAdd });
  }

  updateCartUI();
  showToast(`¡${quantityToAdd}x ${localized.title} añadido al cofre!`);
}

function removeFromCart(id) {
  cart = cart.filter(item => String(item.id) !== id);
  updateCartUI();
}

function updateCartUI() {
  localStorage.setItem('pirate_cart', JSON.stringify(cart));

  let totalCount = 0;
  let totalPrice = 0;
  
  const cartHTML = cart.length === 0 
    ? '<p style="text-align: center; color: #888; padding: 2rem;">Tu cofre está vacío, marinero.</p>'
    : cart.map(item => {
        totalCount += item.quantity;
        totalPrice += (item.price * item.quantity);
        
        const localized = getProductLocalizedData(item.id);
        return `
          <div class="cart-item">
            <div style="flex-grow: 1;">
              <strong>${item.quantity}x ${localized.title}</strong><br>
              <small style="color: #aaa;">$${item.price.toLocaleString('es-CL')} c/u</small>
            </div>
            <div style="display: flex; gap: 15px; align-items: center;">
              <strong>$${(item.price * item.quantity).toLocaleString('es-CL')}</strong>
              <button class="btn-remove" data-id="${item.id}" title="Eliminar">✕</button>
            </div>
          </div>
        `;
      }).join('');

  if (DOM.cartCount) DOM.cartCount.textContent = totalCount;
  if (DOM.cartTotal) DOM.cartTotal.textContent = `$${totalPrice.toLocaleString('es-CL')} CLP`;
  if (DOM.cartItems) DOM.cartItems.innerHTML = cartHTML;
  if (DOM.checkoutBtn) DOM.checkoutBtn.disabled = cart.length === 0;
}

// --- UTILIDADES ---
function changeLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('pirate_lang', lang);
  initLanguageUI();
  renderProducts(); // Re-renderiza con el nuevo idioma
  updateCartUI();
  
  if (DOM.productModal?.classList.contains('open') && activeModalProductId) {
    openProductModal(activeModalProductId);
  }
}

function t(key) {
  return (typeof translations !== 'undefined' && translations[currentLang]?.[key]) ? translations[currentLang][key] : key;
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
      <html lang="es">
        <head><title>Procesando Pago...</title></head>
        <body style="background: #09090b; color: #f4f4f5; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
          <h2 style="color: #eab308; font-weight: 500;">Preparando pasarela de pago segura...</h2>
        </body>
      </html>
    `);
  }

  if (DOM.checkoutBtn) {
    DOM.checkoutBtn.disabled = true;
    DOM.checkoutBtn.textContent = 'Generando Orden...';
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
    } else throw new Error(data.error || 'No se pudo iniciar el pago.');
  } catch (error) {
    console.error('Error procesando pago:', error);
    if (paymentWindow) paymentWindow.close();
    alert('Ocurrió un error al conectar con la pasarela.');
  } finally {
    if (DOM.checkoutBtn) {
      DOM.checkoutBtn.disabled = false;
      DOM.checkoutBtn.textContent = t('checkout');
    }
  }
}