// windy.luxury - JavaScript pour le site e-commerce en français avec IndexedDB
const CONFIG = {
  API_BASE:
    window.API_BASE ||
    (window.location.hostname === "localhost"
      ? "http://localhost:4000/api"
      : "/api"),
  // Backend URL for image serving
  BACKEND_URL: window.API_BASE
    ? window.API_BASE.replace("/api", "")
    : window.location.hostname === "localhost"
      ? "http://localhost:4000"
      : "",
};

// Helper function to convert relative image URLs to full backend URLs
function getFullImageUrl(imagePath) {
  if (!imagePath) return null;

  // Handle Cloudinary object format: { image: "...", publicId: "..." } or { url: "..." }
  if (typeof imagePath === "object") {
    imagePath = imagePath.image || imagePath.url;
  }

  if (!imagePath) return null;

  // If already a data URL or full URL, return as is
  if (
    typeof imagePath === "string" &&
    (imagePath.startsWith("data:") ||
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://"))
  ) {
    return imagePath;
  }
  // Prepend backend URL for relative paths
  return CONFIG.BACKEND_URL + imagePath;
}

let shoppingCart = [];
let selectedDeliveryOption = "home";
let deliveryWilayas = [];
let selectedColor = null;
let selectedImageIndex = 0;
let selectedSize = null;

// Pagination variables
let currentPage = 1;
let productsPerPage = 10;
let totalProducts = 0;
let filteredProducts = [];

// IndexedDB wrapper
let db = null;

// Category icons configuration
const categoryIcons = {
  all: "fas fa-gem",
  parure: "fas fa-layer-group",
  bracelet: "fas fa-band-aid",
  bague: "fas fa-ring",
  boucles: "fas fa-gem",
  montre: "fas fa-clock",
  collier: "fas fa-necklace",
};

let allProducts = [];
let categories = {
  all: { name: "Tous", products: [], icon: categoryIcons.all },
  parure: { name: "Parure", products: [], icon: categoryIcons.parure },
  bracelet: { name: "Bracelet", products: [], icon: categoryIcons.bracelet },
  bague: { name: "Bague", products: [], icon: categoryIcons.bague },
  boucles: { name: "Boucles", products: [], icon: categoryIcons.boucles },
  montre: { name: "Montre", products: [], icon: categoryIcons.montre },
  collier: { name: "Collier", products: [], icon: categoryIcons.collier },
};

let activeCategory = "all";
let currentProduct = null;

// Initialize IndexedDB for cart storage
async function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("windyluxuryDB", 2);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log("IndexedDB initialized successfully");
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("cart")) {
        db.createObjectStore("cart", { keyPath: "id" });
      }

      console.log("IndexedDB stores created");
    };
  });
}

// Save item to IndexedDB
async function saveToIndexedDB(storeName, data) {
  if (!db) await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    // If data is an array, save all items
    if (Array.isArray(data)) {
      const requests = data.map((item) => store.put(item));
      Promise.all(
        requests.map(
          (req) =>
            new Promise((res, rej) => {
              req.onsuccess = () => res();
              req.onerror = (e) => rej(e.target.error);
            }),
        ),
      )
        .then(() => resolve())
        .catch(reject);
    } else {
      const request = store.put(data);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
    }
  });
}

// Get all items from IndexedDB
async function getAllFromIndexedDB(storeName) {
  if (!db) await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = (event) => {
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };
  });
}

// Get item from IndexedDB
async function getFromIndexedDB(storeName, key) {
  if (!db) await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = (event) => {
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Page loaded, initializing...");

  // Initialize IndexedDB
  try {
    await initIndexedDB();
  } catch (error) {
    console.error("Failed to initialize IndexedDB:", error);
  }

  setupEventListeners();
  setupScrollToTop();
  loadCartFromStorage();

  // Charger produits via API
  loadProductsFromApi();

  // Load delivery wilayas
  loadDeliveryWilayas();
  updateCartDisplay();
});

// Load products from API with pagination (10 products per page)
async function loadProductsFromApi() {
  showLoading(true);

  try {
    console.log("Loading products from API...");

    const response = await fetch(`${CONFIG.API_BASE}/products?status=active`);
    if (!response.ok) throw new Error("Failed to fetch products");

    allProducts = await response.json();

    console.log(`✅ ${allProducts.length} produits chargés depuis l'API`);

    // Save to IndexedDB as cache
    try {
      await saveToIndexedDB("products", allProducts);
      console.log("✅ Products saved to IndexedDB cache");
    } catch (error) {
      console.error("❌ Error saving to IndexedDB:", error);
    }

    // Reset categories
    resetCategories();

    // Organize products by category
    allProducts.forEach((product) => {
      const categoryMap = {
        Parure: "parure",
        Bracelet: "bracelet",
        Bague: "bague",
        Boucles: "boucles",
        Montre: "montre",
        Collier: "collier",
      };

      let categoryKey = "all";
      if (product.category) {
        const frenchCategory = product.category.trim();
        categoryKey = categoryMap[frenchCategory] || "all";
      }

      if (categories[categoryKey]) {
        categories[categoryKey].products.push(product);
      }
      categories.all.products.push(product);
    });

    // Update total products count
    totalProducts = allProducts.length;

    renderCategories();
    renderProducts("all", 1);
  } catch (error) {
    console.error("Error loading from API:", error);

    // Fallback to IndexedDB
    try {
      console.log("⚠️ Loading products from IndexedDB...");
      allProducts = await getAllFromIndexedDB("products");
      if (allProducts && allProducts.length > 0) {
        resetCategories();
        allProducts.forEach((product) => {
          const categoryMap = {
            Parure: "parure",
            Bracelet: "bracelet",
            Bague: "bague",
            Boucles: "boucles",
            Montre: "montre",
            Collier: "collier",
          };

          let categoryKey = "all";
          if (product.category) {
            const frenchCategory = product.category.trim();
            categoryKey = categoryMap[frenchCategory] || "all";
          }

          if (categories[categoryKey]) {
            categories[categoryKey].products.push(product);
          }
          categories.all.products.push(product);
        });
        totalProducts = allProducts.length;
        renderCategories();
        renderProducts("all", 1);
      }
    } catch (dbError) {
      console.error("❌ Error loading from IndexedDB:", dbError);
    }
  } finally {
    showLoading(false);
  }
}

// Load delivery prices via API (with IndexedDB fallback)
async function loadDeliveryWilayas() {
  try {
    console.log("Loading settings from API...");

    const response = await fetch(`${CONFIG.API_BASE}/settings`);
    if (!response.ok) throw new Error("Failed to fetch settings");

    const settings = await response.json();
    deliveryWilayas =
      settings.deliveryWilayas && settings.deliveryWilayas.length > 0
        ? settings.deliveryWilayas
        : getDefaultWilayas();

    console.log(
      `✅ ${deliveryWilayas.length} wilayas avec prix de livraison chargées depuis l'API`,
    );

    // Save to IndexedDB
    try {
      await saveToIndexedDB("settings", {
        id: "deliveryWilayas",
        wilayas: deliveryWilayas,
      });
    } catch (error) {
      console.error("❌ Error saving delivery wilayas to IndexedDB:", error);
    }

    updateWilayaSelectOptions();
  } catch (error) {
    console.error("Error loading delivery wilayas from API:", error);

    // Try IndexedDB
    try {
      const savedSettings = await getFromIndexedDB(
        "settings",
        "deliveryWilayas",
      );
      if (
        savedSettings &&
        savedSettings.wilayas &&
        savedSettings.wilayas.length > 0
      ) {
        deliveryWilayas = savedSettings.wilayas;
        console.log(
          `✅ ${deliveryWilayas.length} wilayas chargées depuis IndexedDB fallback`,
        );
      } else {
        deliveryWilayas = getDefaultWilayas();
      }
    } catch (dbError) {
      console.error("❌ Error loading from IndexedDB:", dbError);
      deliveryWilayas = getDefaultWilayas();
    }

    updateWilayaSelectOptions();
  }
}

function getDefaultWilayas() {
  return [
    { name: "Adrar", homePrice: 0, officePrice: 0 },
    { name: "Chlef", homePrice: 0, officePrice: 0 },
    { name: "Laghouat", homePrice: 0, officePrice: 0 },
    { name: "Oum El Bouaghi", homePrice: 0, officePrice: 0 },
    { name: "Batna", homePrice: 0, officePrice: 0 },
    { name: "Béjaïa", homePrice: 0, officePrice: 0 },
    { name: "Biskra", homePrice: 0, officePrice: 0 },
    { name: "Béchar", homePrice: 0, officePrice: 0 },
    { name: "Blida", homePrice: 0, officePrice: 0 },
    { name: "Bouïra", homePrice: 0, officePrice: 0 },
    { name: "Tamanrasset", homePrice: 0, officePrice: 0 },
    { name: "Tébessa", homePrice: 0, officePrice: 0 },
    { name: "Tlemcen", homePrice: 0, officePrice: 0 },
    { name: "Tiaret", homePrice: 0, officePrice: 0 },
    { name: "Tizi Ouzou", homePrice: 0, officePrice: 0 },
    { name: "Alger", homePrice: 0, officePrice: 0 },
    { name: "Djelfa", homePrice: 0, officePrice: 0 },
    { name: "Jijel", homePrice: 0, officePrice: 0 },
    { name: "Sétif", homePrice: 0, officePrice: 0 },
    { name: "Saïda", homePrice: 0, officePrice: 0 },
    { name: "Skikda", homePrice: 0, officePrice: 0 },
    { name: "Sidi Bel Abbès", homePrice: 0, officePrice: 0 },
    { name: "Annaba", homePrice: 0, officePrice: 0 },
    { name: "Guelma", homePrice: 0, officePrice: 0 },
    { name: "Constantine", homePrice: 0, officePrice: 0 },
    { name: "Médéa", homePrice: 0, officePrice: 0 },
    { name: "Mostaganem", homePrice: 0, officePrice: 0 },
    { name: "M'Sila", homePrice: 0, officePrice: 0 },
    { name: "Mascara", homePrice: 0, officePrice: 0 },
    { name: "Ouargla", homePrice: 0, officePrice: 0 },
    { name: "Oran", homePrice: 0, officePrice: 0 },
    { name: "El Bayadh", homePrice: 0, officePrice: 0 },
    { name: "Illizi", homePrice: 0, officePrice: 0 },
    { name: "Bordj Bou Arréridj", homePrice: 0, officePrice: 0 },
    { name: "Boumerdès", homePrice: 0, officePrice: 0 },
    { name: "El Tarf", homePrice: 0, officePrice: 0 },
    { name: "Tindouf", homePrice: 0, officePrice: 0 },
    { name: "Tissemsilt", homePrice: 0, officePrice: 0 },
    { name: "El Oued", homePrice: 0, officePrice: 0 },
    { name: "Khenchela", homePrice: 0, officePrice: 0 },
    { name: "Souk Ahras", homePrice: 0, officePrice: 0 },
    { name: "Tipaza", homePrice: 0, officePrice: 0 },
    { name: "Mila", homePrice: 0, officePrice: 0 },
    { name: "Aïn Defla", homePrice: 0, officePrice: 0 },
    { name: "Naâma", homePrice: 0, officePrice: 0 },
    { name: "Aïn Témouchent", homePrice: 0, officePrice: 0 },
    { name: "Ghardaïa", homePrice: 0, officePrice: 0 },
    { name: "Relizane", homePrice: 0, officePrice: 0 },
    { name: "Timimoun", homePrice: 0, officePrice: 0 },
    { name: "Bordj Badji Mokhtar", homePrice: 0, officePrice: 0 },
    { name: "Ouled Djellal", homePrice: 0, officePrice: 0 },
    { name: "Béni Abbès", homePrice: 0, officePrice: 0 },
    { name: "In Salah", homePrice: 0, officePrice: 0 },
    { name: "In Guezzam", homePrice: 0, officePrice: 0 },
    { name: "Touggourt", homePrice: 0, officePrice: 0 },
    { name: "Djanet", homePrice: 0, officePrice: 0 },
    { name: "El M'Ghair", homePrice: 0, officePrice: 0 },
    { name: "Meniaa", homePrice: 0, officePrice: 0 },
  ];
}

function updateWilayaSelectOptions() {
  const wilayaSelects = [
    document.getElementById("cartCustomerWilaya"),
    document.getElementById("customerWilaya"),
  ];

  wilayaSelects.forEach((select) => {
    if (select) {
      const currentValue = select.value;

      while (select.options.length > 1) {
        select.remove(1);
      }

      deliveryWilayas.forEach((wilaya) => {
        const option = document.createElement("option");
        option.value = wilaya.name;
        option.textContent = wilaya.name;
        select.appendChild(option);
      });

      if (
        currentValue &&
        deliveryWilayas.some((w) => w.name === currentValue)
      ) {
        select.value = currentValue;
      }

      select.addEventListener("change", function () {
        if (select.id === "cartCustomerWilaya") {
          updateCartModal();
        } else if (select.id === "customerWilaya") {
          updateOrderModalDeliveryPrice();
        }
      });
    }
  });
}

async function calculateDeliveryPrice(wilayaName, deliveryType) {
  try {
    if (!wilayaName) {
      return 0;
    }

    const wilaya = deliveryWilayas.find(
      (w) => w.name.toLowerCase() === wilayaName.toLowerCase(),
    );

    if (!wilaya) {
      console.log(`Wilaya "${wilayaName}" not found in delivery settings`);
      return 0;
    }

    if (deliveryType === "home") {
      return wilaya.homePrice || 0;
    } else if (deliveryType === "office") {
      return wilaya.officePrice || 0;
    } else {
      return 0;
    }
  } catch (error) {
    console.error("Error calculating delivery price:", error);
    return 0;
  }
}

function selectDeliveryOption(element, option) {
  document.querySelectorAll(".delivery-option").forEach((opt) => {
    opt.classList.remove("selected");
  });

  element.classList.add("selected");
  selectedDeliveryOption = option;

  updateCartModal();
  updateOrderModalDeliveryPrice();
}

// CART FUNCTIONS with IndexedDB support
async function loadCartFromStorage() {
  try {
    // Try localStorage first for backward compatibility
    const savedCart = localStorage.getItem("forqueenCart");
    if (savedCart) {
      shoppingCart = JSON.parse(savedCart);
      console.log("Cart loaded from localStorage:", shoppingCart);

      // Migrate to IndexedDB
      try {
        await saveToIndexedDB("cart", shoppingCart);
        console.log("Cart migrated to IndexedDB");
      } catch (error) {
        console.error("Error migrating cart to IndexedDB:", error);
      }
    } else {
      // Try IndexedDB
      try {
        shoppingCart = await getAllFromIndexedDB("cart");
        console.log("Cart loaded from IndexedDB:", shoppingCart);
      } catch (error) {
        console.error("Error loading cart from IndexedDB:", error);
        shoppingCart = [];
      }
    }
  } catch (e) {
    console.error("Error loading cart:", e);
    shoppingCart = [];
  }
}

async function saveCartToStorage() {
  try {
    // Save to both localStorage (for backward compatibility) and IndexedDB
    localStorage.setItem("forqueenCart", JSON.stringify(shoppingCart));

    try {
      await saveToIndexedDB("cart", shoppingCart);
    } catch (error) {
      console.error("Error saving cart to IndexedDB:", error);
    }

    console.log("Cart saved to storage");
  } catch (e) {
    console.error("Error saving cart:", e);
  }
}

function addToCart(productId, selectedColor = null, sizeItem = null) {
  console.log(
    "Adding to cart, product ID:",
    productId,
    "Color:",
    selectedColor,
    "Size item:",
    sizeItem,
  );

  const product = allProducts.find((p) => p.id == productId);
  if (!product) {
    console.error("Product not found:", productId);
    showNotification("Produit non trouvé");
    return;
  }

  // Extract size name and stock from sizeItem
  const hasSizeItem = sizeItem !== null;
  const sizeName = hasSizeItem
    ? typeof sizeItem === "string"
      ? sizeItem
      : sizeItem.size
    : null;
  const sizeStock = hasSizeItem
    ? typeof sizeItem === "object"
      ? sizeItem.stock
      : 999
    : 0;

  // Check stock for size-specific products
  if (hasSizeItem && sizeStock <= 0) {
    showNotification("Désolé, cette taille n'est pas disponible.");
    return;
  }

  // Check overall stock for non-size products
  if (!hasSizeItem && product.stock <= 0) {
    showNotification("Désolé, ce produit n'est pas disponible.");
    return;
  }

  const price = parseFloat(product.price.toString().replace(/[^\d.-]/g, ""));
  let finalPrice = price;
  let colorName = "";
  let colorPrice = 0;

  // Calculate additional price for selected color
  if (selectedColor && product.colors && Array.isArray(product.colors)) {
    const color = product.colors.find((c) => c.name === selectedColor);
    if (color) {
      colorPrice = color.price || 0;
      finalPrice = price + colorPrice;
      colorName = color.name;
    }
  }

  // Find existing item (match by id, color, and size)
  const existingItem = shoppingCart.find(
    (item) =>
      item.id == productId &&
      item.selectedColor === selectedColor &&
      item.selectedSize === sizeName,
  );

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    shoppingCart.push({
      id: product.id,
      title: product.title,
      price: finalPrice,
      basePrice: price,
      colorPrice: colorPrice,
      selectedColor: colorName,
      selectedSize: sizeName,
      hasSizes: hasSizeItem,
      image: product.image,
      quantity: 1,
    });
  }

  saveCartToStorage();
  updateCartDisplay();
  showNotification(
    `${product.title}${colorName ? " (" + colorName + ")" : ""}${sizeName ? " - Taille: " + sizeName : ""} ajouté au panier`,
  );
}

function removeFromCart(productId, selectedSize = null) {
  console.log("Removing from cart:", productId, "Size:", selectedSize);
  shoppingCart = shoppingCart.filter(
    (item) => !(item.id === productId && item.selectedSize === selectedSize),
  );
  saveCartToStorage();
  updateCartDisplay();
  showNotification("Produit retiré du panier");
}

function updateCartItemQuantity(productId, quantity, selectedSize = null) {
  console.log("Updating quantity:", productId, quantity, "Size:", selectedSize);
  const item = shoppingCart.find(
    (item) => item.id === productId && item.selectedSize === selectedSize,
  );
  if (item) {
    if (quantity <= 0) {
      removeFromCart(productId, selectedSize);
    } else {
      item.quantity = quantity;
      saveCartToStorage();
      updateCartDisplay();
    }
  }
}

function emptyCart() {
  if (shoppingCart.length === 0) {
    showNotification("Le panier est déjà vide");
    return;
  }

  if (confirm("Êtes-vous sûr de vouloir vider complètement le panier ?")) {
    shoppingCart = [];
    saveCartToStorage();
    updateCartDisplay();
    showNotification("Panier vidé");
  }
}

function updateCartDisplay() {
  console.log("Updating cart display");
  const totalItems = shoppingCart.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const badges = document.querySelectorAll(
    "#cartCount, #cartCountMobile, #mobileCartCount",
  );
  badges.forEach((badge) => {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? "flex" : "none";
  });

  updateCartModal();
}

async function updateCartModal() {
  console.log("Updating cart modal");
  const cartItemsContainer = document.getElementById("cartItemsContainer");
  const emptyCartMessage = document.getElementById("emptyCartMessage");
  const cartSummary = document.getElementById("cartSummary");
  const cartItemCount = document.getElementById("cartItemCount");
  const cartTotal = document.getElementById("cartTotal");

  if (!cartItemsContainer) return;

  if (shoppingCart.length === 0) {
    if (emptyCartMessage) {
      emptyCartMessage.style.display = "block";
    }
    if (cartSummary) {
      cartSummary.style.display = "none";
    }
    if (cartItemCount) {
      cartItemCount.textContent = "0 article";
    }
    cartItemsContainer.innerHTML = "";
    if (emptyCartMessage) {
      cartItemsContainer.appendChild(emptyCartMessage);
    }
  } else {
    if (emptyCartMessage) {
      emptyCartMessage.style.display = "none";
    }
    if (cartSummary) {
      cartSummary.style.display = "block";
    }

    const subtotal = shoppingCart.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    const totalItems = shoppingCart.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    if (cartItemCount) {
      cartItemCount.textContent = `${totalItems} article${totalItems > 1 ? "s" : ""}`;
    }

    const wilayaSelect = document.getElementById("cartCustomerWilaya");
    const selectedWilaya = wilayaSelect ? wilayaSelect.value : "";

    let deliveryPrice = 0;
    if (selectedWilaya) {
      deliveryPrice = await calculateDeliveryPrice(
        selectedWilaya,
        selectedDeliveryOption,
      );
    }

    const totalPrice = subtotal + deliveryPrice;

    if (cartTotal) {
      cartTotal.innerHTML = `
                <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span>Sous-total:</span>
                        <span>${subtotal.toLocaleString("fr-FR")} DA</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span>Livraison (${selectedWilaya || "Choisissez une wilaya"}):</span>
                        <span>${deliveryPrice.toLocaleString("fr-FR")} DA</span>
                    </div>
                    <div class="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>${totalPrice.toLocaleString("fr-FR")} DA</span>
                    </div>
                </div>
            `;
    }

    cartItemsContainer.innerHTML = "";
    shoppingCart.forEach((item) => {
      const cartItem = document.createElement("div");
      cartItem.className = "cart-item";

      const itemTotal = item.price * item.quantity;

      cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.title} ${item.selectedColor ? `<span class="text-xs text-gray-600">(${item.selectedColor})</span>` : ""} ${item.selectedSize ? `<span class="text-xs text-gray-600">- Taille: ${item.selectedSize}</span>` : ""}</div>
                    <div class="cart-item-price">${item.price.toLocaleString("fr-FR")} DA × ${item.quantity}</div>
                </div>
                <div class="cart-item-actions">
                    <div class="cart-quantity-controls">
                        <button class="quantity-btn add" onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1}, '${item.selectedSize || ""}')">
                            <i class="fas fa-plus"></i>
                        </button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn remove" onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1}, '${item.selectedSize || ""}')">
                            <i class="fas fa-minus"></i>
                        </button>
                    </div>
                    <span class="cart-item-total">
                        ${itemTotal.toLocaleString("fr-FR")} DA
                    </span>
                    <button class="remove-item-btn" onclick="removeFromCart('${item.id}', '${item.selectedSize || ""}')" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

      cartItemsContainer.appendChild(cartItem);
    });
  }
}

function openCartModal() {
  console.log("Opening cart modal");
  updateCartModal();
  const cartModal = document.getElementById("cartModal");
  if (cartModal) {
    cartModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeCartModal() {
  console.log("Closing cart modal");
  const cartModal = document.getElementById("cartModal");
  if (cartModal) {
    cartModal.classList.remove("active");
    document.body.style.overflow = "auto";
  }
}

function showNotification(message) {
  console.log("Showing notification:", message);

  const existingNotifications = document.querySelectorAll(".notification");
  existingNotifications.forEach((n) => n.remove());

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function resetCategories() {
  Object.keys(categories).forEach((key) => {
    categories[key].products = [];
  });
}

function renderCategories() {
  const container = document.getElementById("categories-container");
  if (!container) return;

  container.innerHTML = "";

  Object.keys(categories).forEach((categoryKey) => {
    const category = categories[categoryKey];
    if (category.products.length === 0 && categoryKey !== "all") return;

    const button = document.createElement("button");
    button.className = `category-card ${activeCategory === categoryKey ? "active" : ""}`;
    button.onclick = () => selectCategory(categoryKey);

    button.innerHTML = `
            <div class="category-icon">
                <i class="${category.icon}"></i>
            </div>
            <h3 class="font-semibold text-gray-800">${category.name}</h3>
            <p class="text-gray-600 text-xs">${category.products.length}</p>
        `;

    container.appendChild(button);
  });
}

function selectCategory(category) {
  activeCategory = category;
  currentPage = 1; // Reset to first page when category changes

  document.querySelectorAll(".category-card").forEach((card) => {
    card.classList.remove("active");
  });

  const activeCard = document.querySelector(
    `.category-card[onclick*="${category}"]`,
  );
  if (activeCard) {
    activeCard.classList.add("active");
  }

  const categoryTitle = document.getElementById("category-title");
  const categoryDescription = document.getElementById("category-description");

  if (categoryTitle) {
    categoryTitle.textContent = categories[category].name;
  }

  if (categoryDescription) {
    const count = categories[category].products.length;
    categoryDescription.textContent = `${count} produit${count !== 1 ? "s" : ""}`;
  }

  renderProducts(category, currentPage);
  scrollToCollection();
}

// Updated renderProducts function with pagination
function renderProducts(category, page = 1) {
  const container = document.getElementById("products-container");
  const loadingContainer = document.getElementById("loading-container");
  const emptyState = document.getElementById("empty-state");

  if (!container) return;

  const products = categories[category].products;
  totalProducts = products.length;
  filteredProducts = products; // Store for pagination

  if (products.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    renderPagination(category, page, 0);
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  // Calculate pagination
  const totalPages = Math.ceil(totalProducts / productsPerPage);
  const startIndex = (page - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const paginatedProducts = products.slice(startIndex, endIndex);

  container.innerHTML = "";

  paginatedProducts.forEach((product) => {
    const isProductAvailable = product.stock > 0;
    // Support both single image and multiple images
    const images = (product.images || []).map((img) => {
      // Handle Cloudinary object format: { image: "...", publicId: "..." } or { url: "..." }
      if (typeof img === "object") {
        return img.image || img.url;
      }
      return img;
    });
    const mainImage = images[0] || null;

    const productCard = document.createElement("div");
    productCard.className = "product-card";

    productCard.innerHTML = `
            <div class="relative">
                ${!isProductAvailable ? '<div class="price-tag" style="background: #ef4444; color: white;">Non disponible</div>' : '<div class="price-tag">' + formatPrice(product.price) + " DA</div>"}
                <div class="image-container">
                    ${
                      mainImage
                        ? `<img src="${mainImage}" 
                                alt="${product.title}" 
                                class="product-image"
                                loading="lazy"
                                onclick="showProductImage('${product.id}')"
                                style="cursor: pointer;"
                                onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNGMEYwRjAiLz48cGF0aCBkPSJNNTAgNzVMMTAwIDEyNUwxNTAgNzUiIHN0cm9rZT0iI0YwNTc2QyIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iMTAwIiBjeT0iNzUiIHI9IjEwIiBmaWxsPSIjRjA1NzZDIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSIxMjUiIHI9IjEwIiBmaWxsPSIjRjA1NzZDIi8+PGNpcmNsZSBjeD0iMTUwIiBjeT0iMTI1IiByPSIxMCIgZmlsbD0iI0YwNTc2QyIvPjwvc3ZnPg==';\">`
                        : `<div class="fallback-image">
                                <i class="${categoryIcons[product.category] || "fas fa-gem"}" 
                                style="font-size: 24px; margin-bottom: 5px;"></i><br>
                                <span class="text-xs">${product.title.substring(0, 15)}...</span>
                            </div>`
                    }
                    ${images.length > 1 ? '<div class="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">' + images.length + " photos</div>" : ""}
                </div>
            </div>
            
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <div class="product-price">${formatPrice(product.price)} DA</div>
                
                <div class="product-actions">
                    <button onclick="openOrderModal('${product.id}')" 
                            class="action-btn buy"
                            ${!isProductAvailable ? "disabled" : ""}>
                        <i class="fas fa-shopping-bag"></i>
                        ${!isProductAvailable ? "Non disponible" : "Commander"}
                    </button>
                    <button onclick="addToCart('${product.id}')" 
                            class="action-btn cart"
                            ${!isProductAvailable ? "disabled" : ""}>
                        <i class="fas fa-cart-plus"></i>
                        Panier
                    </button>
                </div>
            </div>
        `;

    container.appendChild(productCard);
  });

  // Render pagination controls
  renderPagination(category, page, totalPages);
}

function renderPagination(
  category = activeCategory,
  current = currentPage,
  totalPages = 0,
) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    // Create pagination container if it doesn't exist
    const collectionSection = document.getElementById("collection");
    if (collectionSection) {
      const container = document.createElement("div");
      container.id = "pagination-container";
      container.className = "mt-8 flex justify-center items-center space-x-4";
      collectionSection.appendChild(container);
      return renderPagination(category, current, totalPages);
    }
    return;
  }

  if (totalPages <= 1) {
    paginationContainer.innerHTML = "";
    return;
  }

  let paginationHTML = `
        <div class="flex items-center space-x-2">
            <button onclick="changePage('${category}', ${current - 1})" 
                    class="pagination-btn ${current === 1 ? "disabled" : ""}"
                    ${current === 1 ? "disabled" : ""}>
                <i class="fas fa-chevron-left"></i>
            </button>
    `;

  // Show page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
      paginationHTML += `
                <button onclick="changePage('${category}', ${i})" 
                        class="pagination-btn ${current === i ? "active" : ""}">
                    ${i}
                </button>
            `;
    } else if (i === current - 2 || i === current + 2) {
      paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  paginationHTML += `
            <button onclick="changePage('${category}', ${current + 1})" 
                    class="pagination-btn ${current === totalPages ? "disabled" : ""}"
                    ${current === totalPages ? "disabled" : ""}>
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        
        <div class="pagination-info">
            Page ${current} sur ${totalPages} (${totalProducts} produit${totalProducts !== 1 ? "s" : ""})
        </div>
    `;

  paginationContainer.innerHTML = paginationHTML;
}

function changePage(category, page) {
  const totalPages = Math.ceil(totalProducts / productsPerPage);

  if (page < 1 || page > totalPages) return;

  currentPage = page;
  renderProducts(category, page);

  // Scroll to products section
  const collectionSection = document.getElementById("collection");
  if (collectionSection) {
    collectionSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Quick Order Modal
async function openOrderModal(productId) {
  const product = allProducts.find((p) => p.id == productId);
  if (!product) {
    alert("Produit non trouvé");
    return;
  }

  // Check stock for products with sizes
  const hasSizes =
    product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0;
  if (hasSizes) {
    const availableSizes = product.sizes.filter((s) =>
      typeof s === "object" ? s.stock > 0 : true,
    );
    if (availableSizes.length === 0) {
      alert("Désolé, ce produit n'est pas disponible pour le moment.");
      return;
    }
  } else if (product.stock <= 0) {
    alert("Désolé, ce produit n'est pas disponible pour le moment.");
    return;
  }

  currentProduct = product;

  const modalName = document.getElementById("modalProductName");
  const modalPrice = document.getElementById("modalProductPrice");
  const modalSizeDisplay = document.getElementById("modalSizeDisplay");
  const modalSelectedSize = document.getElementById("modalSelectedSize");
  const sizeSelectionOrder = document.getElementById("sizeSelectionOrder");
  const customerSize = document.getElementById("customerSize");

  if (!modalName || !modalPrice) {
    alert("Erreur : éléments de la fenêtre non trouvés");
    return;
  }

  modalName.textContent = product.title;

  // Handle size display in order modal
  if (hasSizes) {
    modalSizeDisplay.classList.remove("hidden");
    modalSelectedSize.textContent = selectedSize || "(اختر الحجم)";

    // Show and populate size dropdown
    sizeSelectionOrder.classList.remove("hidden");
    customerSize.required = true;

    // Populate sizes from product (only available sizes)
    customerSize.innerHTML = '<option value="">اختر الحجم</option>';
    product.sizes.forEach((sizeItem) => {
      const sizeName = typeof sizeItem === "string" ? sizeItem : sizeItem.size;
      const sizeStock = typeof sizeItem === "object" ? sizeItem.stock : 999;
      const isSoldOut = sizeStock <= 0;

      if (!isSoldOut) {
        const option = document.createElement("option");
        option.value = sizeName;
        option.textContent = sizeName;
        customerSize.appendChild(option);
      }
    });

    // Set selected size if already selected
    if (selectedSize) {
      customerSize.value = selectedSize;
    }
  } else {
    modalSizeDisplay.classList.add("hidden");
    sizeSelectionOrder.classList.add("hidden");
    customerSize.required = false;
    customerSize.value = "";
  }

  await updateOrderModalDeliveryPrice();

  const orderForm = document.getElementById("orderForm");
  if (orderForm) {
    orderForm.reset();
    selectedDeliveryOption = "home";
    document.querySelectorAll(".delivery-option").forEach((opt) => {
      opt.classList.remove("selected");
    });
    const homeOption = document.querySelector(
      '.delivery-option[onclick*="home"]',
    );
    if (homeOption) {
      homeOption.classList.add("selected");
    }
  }

  const orderModal = document.getElementById("orderModal");
  if (orderModal) {
    // Fermer d'abord les autres modales
    document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
      modal.classList.remove("active");
    });

    orderModal.classList.add("active");
    orderModal.style.zIndex = "2001";
    document.body.style.overflow = "hidden";
  }
}

async function updateOrderModalDeliveryPrice() {
  if (!currentProduct) return;

  const wilayaSelect = document.getElementById("customerWilaya");
  const selectedWilaya = wilayaSelect ? wilayaSelect.value : "";

  const productPrice = parseFloat(
    currentProduct.price.toString().replace(/[^\d.-]/g, ""),
  );

  const deliveryPrice = selectedWilaya
    ? await calculateDeliveryPrice(selectedWilaya, selectedDeliveryOption)
    : 0;
  const totalPrice = productPrice + deliveryPrice;

  const priceElement = document.getElementById("modalProductPrice");
  if (priceElement) {
    priceElement.innerHTML = `
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-semibold text-gray-800">Produit:</span>
                    <span class="text-sm font-bold text-pink-600">${formatPrice(productPrice)} DA</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm font-semibold text-gray-800">Livraison:</span>
                    <span class="text-sm font-bold text-pink-600" id="deliveryPriceDisplay">${deliveryPrice.toLocaleString("fr-FR")} DA</span>
                </div>
                <div class="flex justify-between items-center border-t pt-2">
                    <span class="text-lg font-bold text-gray-800">Total:</span>
                    <span class="text-xl font-bold text-pink-600">${totalPrice.toLocaleString("fr-FR")} DA</span>
                </div>
            </div>
        `;
  }
}

// Product Details Modal
function showProductImage(productId) {
  const product = allProducts.find((p) => p.id == productId);
  if (!product) return;

  currentProduct = product;
  selectedSize = null; // Reset size selection
  selectedImageIndex = 0; // Reset image index

  // Support both single image and multiple images - extract URLs from objects
  const rawImages = product.images || (product.image ? [product.image] : []);
  const images = rawImages.map((img) => {
    if (typeof img === "object") {
      return img.image || img.url;
    }
    return img;
  });

  // Update modal content
  const modalImage = document.getElementById("productDetailsImage");
  const modalTitle = document.getElementById("productDetailsTitle");
  const modalPrice = document.getElementById("productDetailsPrice");
  const modalStock = document.getElementById("productDetailsStock");
  const modalCategory = document.getElementById("productDetailsCategory");
  const modalDescription = document.getElementById("productDetailsDescription");
  const imageGallery = document.getElementById("imageGallery");

  if (modalImage) {
    modalImage.src = images[0] || "";
    modalImage.onerror = function () {
      this.src =
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNGMEYwRjAiLz48cGF0aCBkPSJNNTAgNzVMMTAwIDEyNUwxNTAgNzUiIHN0cm9rZT0iI0YwNTc2QyIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iMTAwIiBjeT0iNzUiIHI9IjEwIiBmaWxsPSIjRjA1NzZDIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSIxMjUiIHI9IjEwIiBmaWxsPSIjRjA1NzZDIi8+PGNpcmNsZSBjeD0iMTUwIiBjeT0iMTI1IiByPSIxMCIgZmlsbD0iI0YwNTc2QyIvPjwvc3ZnPg==";
    };
  }

  // Render image gallery thumbnails
  if (imageGallery && images.length > 1) {
    imageGallery.innerHTML = images
      .map(
        (img, index) => `
      <img src="${img}" 
           class="w-16 h-16 object-cover rounded cursor-pointer border-2 ${index === 0 ? "border-purple-600" : "border-transparent"}" 
           onclick="changeProductImage(${index})"
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiNGMEYwRjAiLz48cGF0aCBkPSJNMjAgMjBsMjAgMjBsMjAtMjAiIHN0cm9rZT0iI0YwNTc2QyIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMTAiIGZpbGw9IiNGMDU3NkMiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjIwIiByPSIxMCIgZmlsbD0iI0YwNTc2QyIvPjwvc3ZnPg==';">
    `,
      )
      .join("");
    imageGallery.classList.remove("hidden");
  } else if (imageGallery) {
    imageGallery.classList.add("hidden");
  }

  if (modalTitle) modalTitle.textContent = product.name || product.title || "-";
  if (modalPrice) modalPrice.textContent = formatPrice(product.price) + " DA";
  // Stock is hidden on frontend - uncomment if needed
  // if (modalStock) modalStock.textContent = product.stock || 0;
  if (modalCategory) modalCategory.textContent = product.category || "-";
  if (modalDescription)
    modalDescription.textContent =
      product.description || "Aucune description disponible.";

  // Handle size selection
  renderSizeOptions(product);

  // Show modal
  const modal = document.getElementById("productDetailsModal");
  if (modal) {
    document.querySelectorAll(".modal-overlay.active").forEach((m) => {
      m.classList.remove("active");
    });
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

// Change product image in modal
function changeProductImage(index) {
  const product = currentProduct;
  if (!product) return;

  const images = product.images || (product.image ? [product.image] : []);
  if (index >= 0 && index < images.length) {
    selectedImageIndex = index;
    const modalImage = document.getElementById("productDetailsImage");
    if (modalImage) {
      modalImage.src = images[index];
    }

    // Update gallery thumbnails
    const imageGallery = document.getElementById("imageGallery");
    if (imageGallery) {
      const thumbs = imageGallery.querySelectorAll("img");
      thumbs.forEach((thumb, i) => {
        thumb.classList.toggle("border-purple-600", i === index);
        thumb.classList.toggle("border-transparent", i !== index);
      });
    }
  }
}

// Render size options if product has sizes
function renderSizeOptions(product) {
  const sizeSelection = document.getElementById("sizeSelection");
  const sizeOptions = document.getElementById("sizeOptions");

  if (!sizeSelection || !sizeOptions) return;

  // Check if product has sizes (support both old string array and new object array)
  const hasSizes =
    product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0;

  if (hasSizes) {
    sizeSelection.classList.remove("hidden");
    sizeOptions.innerHTML = "";

    product.sizes.forEach((sizeItem) => {
      // Support both old format (string) and new format {size, stock}
      const sizeName = typeof sizeItem === "string" ? sizeItem : sizeItem.size;
      const sizeStock = typeof sizeItem === "object" ? sizeItem.stock : 999; // Default high stock for old format
      const isSoldOut = sizeStock <= 0;

      const sizeBtn = document.createElement("button");
      sizeBtn.className = `size-option${isSoldOut ? " out-of-stock" : ""}`;
      sizeBtn.innerHTML = isSoldOut ? `${sizeName} (sold out)` : sizeName;

      if (!isSoldOut) {
        sizeBtn.onclick = () => selectSize(sizeItem, sizeBtn);
      }

      sizeOptions.appendChild(sizeBtn);
    });
  } else {
    sizeSelection.classList.add("hidden");
  }
}

// Select size
function selectSize(sizeItem, element) {
  // Support both old format (string) and new format {size, stock}
  selectedSize = typeof sizeItem === "string" ? sizeItem : sizeItem.size;

  // Update UI
  document.querySelectorAll(".size-option").forEach((btn) => {
    btn.classList.remove("selected");
  });
  if (element) {
    element.classList.add("selected");
  }
}

function closeProductDetailsModal() {
  const modal = document.getElementById("productDetailsModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

function addToCartFromDetails() {
  if (currentProduct) {
    // Check if size is required
    const hasSizes =
      currentProduct.sizes &&
      Array.isArray(currentProduct.sizes) &&
      currentProduct.sizes.length > 0;
    if (hasSizes && !selectedSize) {
      alert("Veuillez sélectionner une taille");
      return;
    }

    // Find the full sizeItem object from currentProduct.sizes
    let sizeItem = null;
    if (hasSizes && selectedSize) {
      sizeItem = currentProduct.sizes.find(
        (s) => (typeof s === "string" ? s : s.size) === selectedSize,
      );
    }

    addToCart(currentProduct.id, null, sizeItem);
    closeProductDetailsModal();
  }
}

function buyNowFromDetails() {
  if (currentProduct) {
    // Check if size is required
    const hasSizes =
      currentProduct.sizes &&
      Array.isArray(currentProduct.sizes) &&
      currentProduct.sizes.length > 0;
    if (hasSizes && !selectedSize) {
      alert("Veuillez sélectionner une taille");
      return;
    }
    closeProductDetailsModal();
    setTimeout(() => {
      openOrderModal(currentProduct.id);
    }, 100);
  }
}

// Mobile Menu Functions
function openMobileMenu() {
  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu) {
    mobileMenu.classList.remove("hidden");
    mobileMenu.style.display = "block";
    document.body.style.overflow = "hidden";
  }
}

function closeMobileMenu() {
  const mobileMenu = document.getElementById("mobileMenu");
  if (mobileMenu) {
    mobileMenu.classList.add("hidden");
    mobileMenu.style.display = "none";
    document.body.style.overflow = "auto";
  }
}

// Scroll functions
function scrollToCategories() {
  const categoriesSection = document.getElementById("categories");
  if (categoriesSection) {
    categoriesSection.scrollIntoView({ behavior: "smooth" });
  }
}

function scrollToCollection() {
  const collectionSection = document.getElementById("collection");
  if (collectionSection) {
    collectionSection.scrollIntoView({ behavior: "smooth" });
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Setup scroll to top button
function setupScrollToTop() {
  const scrollToTopBtn = document.getElementById("scrollToTop");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      scrollToTopBtn.classList.add("active");
    } else {
      scrollToTopBtn.classList.remove("active");
    }
  });
}

function showLoading(show) {
  const loadingContainer = document.getElementById("loading-container");
  if (loadingContainer) {
    loadingContainer.style.display = show ? "block" : "none";
  }
}

function closeModal() {
  const orderModal = document.getElementById("orderModal");
  if (orderModal) {
    orderModal.classList.remove("active");
    document.body.style.overflow = "auto";
  }
}

function showSuccessMessage(orderId, totalPrice) {
  console.log("Showing success modal for order:", orderId);

  // Remove any existing success modal first
  const existingModal = document.getElementById("successModal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "successModal";
  modal.className = "modal-overlay active";
  modal.innerHTML = `
        <div class="modal-content success-modal">
            <div class="success-icon">
                <i class="fas fa-check"></i>
            </div>
            <h3 class="text-2xl font-bold text-green-400 mb-4">Votre commande est confirmée ! 👑</h3>
            <p class="text-gray-300 mb-2">Numéro de commande: <span class="font-bold">${orderId}</span></p>
            <p class="text-gray-300 mb-6">Montant total: <span class="font-bold text-green-400">${totalPrice.toLocaleString("fr-FR")} DA</span></p>
            <p class="text-gray-400 mb-8">Nous vous contacterons bientôt pour confirmer les détails</p>
            <button onclick="closeSuccessModal()" class="gradient-gold text-black px-8 py-3 rounded-full font-bold text-lg hover:shadow-xl transition">
                <i class="fas fa-check ml-2"></i>OK
            </button>
        </div>
    `;
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // Fallback - also show alert after 2 seconds if modal not visible
  setTimeout(() => {
    const modalCheck = document.getElementById("successModal");
    if (!modalCheck) {
      alert(
        `✅ Commande confirmée!\nNuméro: ${orderId}\nTotal: ${totalPrice.toLocaleString("fr-FR")} DA`,
      );
    }
  }, 2000);
}

function closeSuccessModal() {
  const modal = document.getElementById("successModal");
  if (modal) {
    modal.remove();
    document.body.style.overflow = "auto";
  }
}

function formatPrice(price) {
  if (!price) return "0";
  const num = parseFloat(price.toString().replace(/[^\d.-]/g, ""));
  if (isNaN(num)) return "0";
  return num.toLocaleString("fr-FR");
}

function fetchDataFromSheet() {
  if (unsubscribeProducts) {
    unsubscribeProducts();
  }
  setupProductListener();
  loadDeliveryWilayas();
  showNotification("Produits et prix de livraison mis à jour");
}

// Order submission flag to prevent double clicks
let isSubmittingOrder = false;

function setupEventListeners() {
  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  });

  // Cart order form
  const cartOrderForm = document.getElementById("cartOrderForm");
  if (cartOrderForm) {
    cartOrderForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (isSubmittingOrder) {
        console.log("Order already being submitted...");
        return;
      }
      isSubmittingOrder = true;

      console.log("Cart order form submitted");

      const name = document.getElementById("cartCustomerName")?.value || "";
      const phone = document.getElementById("cartCustomerPhone")?.value || "";
      const wilaya = document.getElementById("cartCustomerWilaya")?.value || "";
      const commune =
        document.getElementById("cartCustomerCommune")?.value || "";
      const size = document.getElementById("cartCustomerSize")?.value || "";

      if (!name.trim()) {
        alert("❌ Veuillez entrer votre nom complet");
        return;
      }

      if (!phone.trim()) {
        alert("❌ Veuillez entrer votre numéro de téléphone");
        return;
      }

      if (!wilaya) {
        alert("❌ Veuillez sélectionner une wilaya");
        return;
      }

      if (!commune.trim()) {
        alert("❌ Veuillez entrer votre commune");
        return;
      }

      if (!size) {
        alert("❌ Veuillez sélectionner une taille");
        return;
      }

      const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
      const cleanPhone = phone.replace(/\s+/g, "");

      if (!phoneRegex.test(cleanPhone)) {
        alert(
          "❌ Numéro de téléphone invalide\n\nExemples valides:\n0551925318\n+213551925318\n0774123456",
        );
        return;
      }

      if (shoppingCart.length === 0) {
        alert("❌ Le panier est vide");
        return;
      }

      console.log("All fields valid, proceeding with cart order...");

      const subtotal = shoppingCart.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      );
      const deliveryPrice = await calculateDeliveryPrice(
        wilaya,
        selectedDeliveryOption,
      );
      const totalPrice = subtotal + deliveryPrice;

      const products = shoppingCart.map((item) => ({
        id: item.id,
        title: item.title,
        image: item.image,
        color: item.selectedColor,
        quantity: item.quantity,
        price: item.price,
        size: item.selectedSize,
      }));

      const orderData = {
        customerName: name,
        customerPhone: phone,
        customerEmail: "",
        products: products,
        deliveryType: selectedDeliveryOption,
        deliveryPrice: deliveryPrice,
        subtotal: subtotal,
        total: totalPrice,
        status: "pending",
        date: new Date().toISOString(),
        wilaya: wilaya,
        commune: commune,
        notes: "Commande depuis le panier",
      };

      console.log("Saving cart order to API:", orderData);

      try {
        const apiRes = await fetch(`${CONFIG.API_BASE}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (!apiRes.ok) throw new Error("API order create failed");
        const savedOrder = await apiRes.json();

        showSuccessMessage(savedOrder.id || "commande", totalPrice);

        shoppingCart = [];
        saveCartToStorage();
        updateCartDisplay();

        closeCartModal();

        // Reset flag and loading
        isSubmittingOrder = false;
        setOrderButtonLoading(false, true);

        // Refresh products display with latest stock
        loadProductsFromApi();
      } catch (error) {
        console.error("❌ Error saving cart order:", error);
        alert(
          "Erreur lors de l'enregistrement de la commande. Veuillez réessayer.",
        );
        isSubmittingOrder = false;
        setOrderButtonLoading(false, true);
      }
    });
  }

  // Helper function to show loading on order button
  function setOrderButtonLoading(loading, isCart = false) {
    const btnId = isCart ? "cartOrderBtn" : "orderSubmitBtn";
    const btn = document.getElementById(btnId);
    if (btn) {
      if (loading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Traitement en cours...</span>`;
        btn.style.opacity = "0.7";
      } else {
        btn.disabled = false;
        btn.innerHTML =
          btn.dataset.originalText ||
          `<i class="fas fa-check-circle"></i> <span>Confirmer la Commande</span>`;
        btn.style.opacity = "1";
      }
    }
  }

  // Single product order form
  const orderForm = document.getElementById("orderForm");
  if (orderForm) {
    orderForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (isSubmittingOrder) {
        console.log("Order already being submitted...");
        return;
      }
      isSubmittingOrder = true;

      console.log("Single product form submitted - Checking fields...");

      if (!currentProduct) {
        alert("Aucun produit sélectionné");
        return;
      }

      if (currentProduct.stock <= 0) {
        alert("Désolé, ce produit n'est pas disponible.");
        return;
      }

      const name = document.getElementById("customerName")?.value || "";
      const phone = document.getElementById("customerPhone")?.value || "";
      const wilaya = document.getElementById("customerWilaya")?.value || "";
      const commune = document.getElementById("customerCommune")?.value || "";
      const size = document.getElementById("customerSize")?.value || "";

      if (!name.trim()) {
        alert("❌ Veuillez entrer votre nom complet");
        return;
      }

      if (!phone.trim()) {
        alert("❌ Veuillez entrer votre numéro de téléphone");
        return;
      }

      if (!wilaya) {
        alert("❌ Veuillez sélectionner une wilaya");
        return;
      }

      if (!commune.trim()) {
        alert("❌ Veuillez entrer votre commune");
        return;
      }

      // Check if size is required for this product
      const hasSizes =
        currentProduct.sizes &&
        Array.isArray(currentProduct.sizes) &&
        currentProduct.sizes.length > 0;
      if (hasSizes && !size) {
        alert("❌ Veuillez sélectionner une taille");
        return;
      }

      const phoneRegex = /^(\+213|0)(5|6|7)[0-9]{8}$/;
      const cleanPhone = phone.replace(/\s+/g, "");

      if (!phoneRegex.test(cleanPhone)) {
        alert(
          "❌ Numéro de téléphone invalide\n\nExemples valides:\n0551925318\n+213551925318\n0774123456",
        );
        return;
      }

      console.log("All fields valid, proceeding with order...");

      const productPrice = parseFloat(
        currentProduct.price.toString().replace(/[^\d.-]/g, ""),
      );

      const deliveryPrice = await calculateDeliveryPrice(
        wilaya,
        selectedDeliveryOption,
      );
      const totalPrice = productPrice + deliveryPrice;

      const orderData = {
        customerName: name,
        customerPhone: phone,
        customerEmail: "",
        products: [
          {
            id: currentProduct.id,
            title: currentProduct.title,
            image: currentProduct.image,
            quantity: 1,
            price: productPrice,
            size: size,
          },
        ],
        deliveryType: selectedDeliveryOption,
        deliveryPrice: deliveryPrice,
        subtotal: productPrice,
        total: totalPrice,
        status: "pending",
        date: new Date().toISOString(),
        wilaya: wilaya,
        commune: commune,
        notes: "Commande individuelle depuis le site",
      };

      console.log("Saving order to API:", orderData);

      try {
        const apiRes = await fetch(`${CONFIG.API_BASE}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (!apiRes.ok) throw new Error("API order create failed");
        const savedOrder = await apiRes.json();

        // Update local product stock with response decrement assumption
        currentProduct.stock = Math.max(0, currentProduct.stock - 1);

        showSuccessMessage(savedOrder.id || "commande", totalPrice);

        closeModal();

        // Reset flag
        isSubmittingOrder = false;

        // Refresh products display
        loadProductsFromApi();
      } catch (error) {
        console.error("❌ Error saving order:", error);
        alert(
          "Erreur lors de l'enregistrement de la commande. Veuillez réessayer.",
        );
        isSubmittingOrder = false;
      }
    });
  }

  // Cart button
  const cartButton = document.getElementById("cartButton");
  if (cartButton) {
    cartButton.addEventListener("click", openCartModal);
  }

  // Mobile menu button
  const menuBtn = document.getElementById("menuBtn");
  if (menuBtn) {
    menuBtn.addEventListener("click", openMobileMenu);
  }

  // Wilaya change listeners
  const cartWilayaSelect = document.getElementById("cartCustomerWilaya");
  if (cartWilayaSelect) {
    cartWilayaSelect.addEventListener("change", function () {
      updateCartModal();
    });
  }

  const orderWilayaSelect = document.getElementById("customerWilaya");
  if (orderWilayaSelect) {
    orderWilayaSelect.addEventListener("change", function () {
      updateOrderModalDeliveryPrice();
    });
  }

  document.addEventListener("click", function (e) {
    const mobileMenu = document.getElementById("mobileMenu");
    const menuBtn = document.getElementById("menuBtn");
    const orderModal = document.getElementById("orderModal");
    const cartModal = document.getElementById("cartModal");

    if (
      mobileMenu &&
      !mobileMenu.contains(e.target) &&
      menuBtn &&
      !menuBtn.contains(e.target)
    ) {
      closeMobileMenu();
    }

    if (orderModal && e.target === orderModal) {
      closeModal();
    }

    if (cartModal && e.target === cartModal) {
      closeCartModal();
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 70,
          behavior: "smooth",
        });
        closeMobileMenu();
      }
    });
  });
}

// Make functions globally available
window.fetchDataFromSheet = fetchDataFromSheet;
window.selectCategory = selectCategory;
window.openOrderModal = openOrderModal;
window.closeModal = closeModal;
window.openCartModal = openCartModal;
window.closeCartModal = closeCartModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.emptyCart = emptyCart;
window.selectDeliveryOption = selectDeliveryOption;
window.closeSuccessModal = closeSuccessModal;
window.openMobileMenu = openMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.scrollToCategories = scrollToCategories;
window.scrollToCollection = scrollToCollection;
window.scrollToTop = scrollToTop;
window.changePage = changePage;
window.showProductImage = showProductImage;
window.changeProductImage = changeProductImage;
window.closeProductDetailsModal = closeProductDetailsModal;
window.addToCartFromDetails = addToCartFromDetails;
window.buyNowFromDetails = buyNowFromDetails;
window.loadProductsFromApi = loadProductsFromApi;

// Debug function to check products
window.debugCheckSiteProducts = () => {
  console.log("=== SITE DEBUG CHECK ===");
  console.log(`Total products loaded: ${allProducts.length}`);
  console.log(
    "Active products:",
    allProducts.filter((p) => p.status === "active").length,
  );
  console.log("Sample product:", allProducts[0]);
};
