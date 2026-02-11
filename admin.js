// Admin Dashboard JavaScript - Express API Version
const CONFIG = {
  API_BASE:
    window.API_BASE ||
    (window.location.hostname === "localhost"
      ? "http://localhost:4000/api"
      : "/api"),
};

// Default categories
const defaultCategories = [
  { id: "1", name: "Parure", icon: "fas fa-layer-group" },
  { id: "2", name: "Bracelet", icon: "fas fa-band-aid" },
  { id: "3", name: "Bague", icon: "fas fa-ring" },
  { id: "4", name: "Boucles", icon: "fas fa-gem" },
  { id: "5", name: "Montre", icon: "fas fa-clock" },
  { id: "6", name: "Collier", icon: "fas fa-necklace" },
];

// State
let products = [];
let categories = [...defaultCategories];
let orders = [];
let settings = {};
let editingProductId = null;
let editingCategoryId = null;

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  setupEventListeners();
  updateDate();
});

function updateDate() {
  const now = new Date();
  const options = { year: "numeric", month: "long", day: "numeric" };
  document.getElementById("currentDate").textContent = now.toLocaleDateString(
    "fr-FR",
    options,
  );
}

// Event Listeners
function setupEventListeners() {
  // Login form
  document.getElementById("loginForm").addEventListener("submit", handleLogin);

  // Product form
  document
    .getElementById("productForm")
    .addEventListener("submit", handleProductSubmit);

  // Category form
  document
    .getElementById("categoryForm")
    .addEventListener("submit", handleCategorySubmit);

  // Image upload handlers for 4 separate inputs
  for (let i = 1; i <= 4; i++) {
    const input = document.getElementById(`productImage${i}`);
    if (input) {
      input.addEventListener("change", (e) => previewSingleImage(e, i));
    }
  }

  // Search and filters
  document
    .getElementById("productSearch")
    .addEventListener("input", filterProducts);
  document
    .getElementById("categoryFilter")
    .addEventListener("change", filterProducts);
  document
    .getElementById("orderStatusFilter")
    .addEventListener("change", loadOrders);
}

// Toggle size stock input when checkbox is clicked
function toggleSizeStock(size) {
  const checkbox = document.getElementById(`size${size}cb`);
  const stockInput = document.getElementById(`size${size}`);

  if (checkbox.checked) {
    stockInput.disabled = false;
    if (stockInput.value === "") {
      stockInput.value = "0";
    }
  } else {
    stockInput.disabled = true;
    stockInput.value = "";
  }
}

// Populate size inputs when editing a product
function populateSizeInputs(product) {
  // Reset all
  for (let i = 14; i <= 20; i++) {
    const checkbox = document.getElementById(`size${i}cb`);
    const stockInput = document.getElementById(`size${i}`);
    if (checkbox) {
      checkbox.checked = false;
      stockInput.disabled = true;
      stockInput.value = "";
    }
  }

  // If product has sizes, populate them
  if (product.sizes && Array.isArray(product.sizes)) {
    product.sizes.forEach((sizeItem) => {
      const size = typeof sizeItem === "string" ? sizeItem : sizeItem.size;
      const stock = typeof sizeItem === "object" ? sizeItem.stock : 0;

      const checkbox = document.getElementById(`size${size}cb`);
      const stockInput = document.getElementById(`size${size}`);

      if (checkbox) {
        checkbox.checked = true;
        stockInput.disabled = false;
        stockInput.value = stock;
      }
    });
  }
}

// Login Handler
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  // Simple validation (in production, use proper authentication)
  if (username === "admin" && password === "windy123") {
    localStorage.setItem("adminAuth", "true");
    showDashboard();
    loadAllData();
  } else {
    showAlert("loginAlert", "Mot de passe incorrect", "error");
  }
}

// Logout
function logout() {
  localStorage.removeItem("adminAuth");
  document.getElementById("loginPage").style.display = "block";
  document.getElementById("dashboardPage").style.display = "none";
}

// Check auth on load
if (localStorage.getItem("adminAuth") === "true") {
  showDashboard();
  loadAllData();
}

function showDashboard() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("dashboardPage").style.display = "block";
}

// Load All Data
async function loadAllData() {
  await Promise.all([
    loadCategories(),
    loadProducts(),
    loadOrders(),
    loadSettings(),
  ]);
  updateDashboard();
}

// Categories
async function loadCategories() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/categories`);
    if (response.ok) {
      categories = await response.json();
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    categories = [...defaultCategories];
  }
  updateCategoryFilter();
}

// Products
async function loadProducts() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/products`);
    if (response.ok) {
      products = await response.json();
    }
  } catch (error) {
    console.error("Error loading products:", error);
    products = [];
  }
}

// Orders
async function loadOrders() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/orders`);
    if (response.ok) {
      orders = await response.json();
    }
  } catch (error) {
    console.error("Error loading orders:", error);
    orders = [];
  }
}

// Settings
async function loadSettings() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/settings`);
    if (response.ok) {
      settings = await response.json();
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    settings = {};
  }
}

// Update Dashboard
function updateDashboard() {
  // Stats
  document.getElementById("totalProducts").textContent = products.length;
  document.getElementById("totalOrders").textContent = orders.length;

  // Calculate revenue
  const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  document.getElementById("totalRevenue").textContent =
    `${revenue.toLocaleString()} DA`;

  // Recent orders
  const recentOrders = orders.slice(-5).reverse();
  renderRecentOrders(recentOrders);

  // Low stock products
  const lowStock = products.filter((p) => p.stock < 5);
  renderLowStockProducts(lowStock);

  // Products table
  renderProductsTable(products);
}

// Render Recent Orders
function renderRecentOrders(ordersList) {
  const tbody = document.getElementById("recentOrdersTable");
  if (!tbody) return;

  if (ordersList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center py-8">Aucune commande</td></tr>';
    return;
  }

  tbody.innerHTML = ordersList
    .map(
      (order) => `
    <tr>
      <td>${order.id?.slice(-6) || "N/A"}</td>
      <td>${order.customerName || "عميل"}</td>
      <td>${formatDate(order.createdAt)}</td>
      <td>${(order.total || 0).toLocaleString()} DA</td>
      <td><span class="status-badge status-${order.status || "pending"}">${getStatusText(
        order.status,
      )}</span></td>
      <td>
        <button onclick="viewOrder('${
          order.id
        }')" class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

// Render Low Stock Products
function renderLowStockProducts(productsList) {
  const tbody = document.getElementById("lowStockTable");
  if (!tbody) return;

  if (productsList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center py-8">Aucun produit en rupture de stock</td></tr>';
    return;
  }

  tbody.innerHTML = productsList
    .map(
      (product) => `
    <tr>
      <td><img src="${product.image || ""}" alt="${
        product.name
      }" class="w-10 h-10 object-cover rounded" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0iI0YwRjBGMCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjBGMDBBIi8+PC9zdmc+'"></td>
      <td>${product.name || product.title || "-"}</td>
      <td>${product.category || "-"}</td>
      <td>${(product.price || 0).toLocaleString()} DA</td>
      <td class="text-red-600 font-bold">${product.stock || 0}</td>
      <td>
        <button onclick="editProduct('${
          product.id
        }')" class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;">
          <i class="fas fa-edit"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

// Render Products Table
function renderProductsTable(productsList) {
  const tbody = document.getElementById("productsTable");
  if (!tbody) return;

  if (productsList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center py-8">Aucun produit</td></tr>';
    return;
  }

  tbody.innerHTML = productsList
    .map(
      (product) => `
    <tr>
      <td><img src="${product.image || ""}" alt="${
        product.name
      }" class="w-10 h-10 object-cover rounded" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0iI0YwRjBGMCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjBGMDBBIi8+PC9zdmc+'"></td>
      <td>${product.name || product.title || "-"}</td>
      <td>${product.category || "-"}</td>
      <td>${(product.price || 0).toLocaleString()} DA</td>
      <td>${product.stock || 0}</td>
      <td>${product.featured ? '<i class="fas fa-star text-yellow-500"></i>' : "-"}</td>
      <td>${formatDate(product.createdAt)}</td>
      <td>
        <button onclick="editProduct('${
          product.id
        }')" class="btn btn-primary" style="padding: 4px 8px;">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="deleteProduct('${
          product.id
        }')" class="btn btn-danger" style="padding: 4px 8px;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

// Render Orders Table
function renderOrdersTable(ordersList) {
  const tbody = document.getElementById("ordersTable");
  if (!tbody) return;

  if (ordersList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center py-8">Aucune commande</td></tr>';
    return;
  }

  tbody.innerHTML = ordersList
    .map(
      (order) => `
    <tr>
      <td>
        <input type="checkbox" class="order-checkbox" value="${order.id}" onchange="updateExportButton()" />
      </td>
      <td>${order.id?.slice(-6) || "N/A"}</td>
      <td>${order.customerName || "عميل"}</td>
      <td>${(order.products || []).length} produits</td>
      <td>${formatDate(order.createdAt)}</td>
      <td>${(order.total || 0).toLocaleString()} DA</td>
      <td><span class="status-badge status-${order.status || "pending"}">${getStatusText(
        order.status,
      )}</span></td>
      <td>
        <button onclick="viewOrder('${order.id}')" class="btn btn-primary" style="padding: 4px 8px;">
          <i class="fas fa-eye"></i> Voir
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

// Toggle Select All Orders
function toggleSelectAllOrders() {
  const selectAllCheckbox = document.getElementById("selectAllOrders");
  const checkboxes = document.querySelectorAll(".order-checkbox");
  checkboxes.forEach((cb) => (cb.checked = selectAllCheckbox.checked));
  updateExportButton();
}

// Update Export Button State
function updateExportButton() {
  const checkboxes = document.querySelectorAll(".order-checkbox:checked");
  const exportBtn = document.getElementById("exportSelectedBtn");
  if (exportBtn) {
    exportBtn.disabled = checkboxes.length === 0;
  }
}

// Export Selected Orders
function exportSelectedOrders() {
  const checkboxes = document.querySelectorAll(".order-checkbox:checked");
  const orderIds = Array.from(checkboxes).map((cb) => cb.value);

  if (orderIds.length === 0) {
    alert("Veuillez sélectionner au moins une commande");
    return;
  }

  // Build URL with order IDs
  const idsParam = orderIds.join(",");
  window.open(`/api/orders/export/zrexpress?ids=${idsParam}`, "_blank");
}

// Show Section
function showSection(sectionId) {
  // Hide all sections
  document.getElementById("dashboardSection").style.display = "none";
  document.getElementById("productsSection").style.display = "none";
  document.getElementById("ordersSection").style.display = "none";
  document.getElementById("categoriesSection").style.display = "none";
  document.getElementById("customersSection").style.display = "none";
  document.getElementById("settingsSection").style.display = "none";

  // Show selected section
  document.getElementById(`${sectionId}Section`).style.display = "block";

  // Update page title
  const titles = {
    dashboard: "Tableau de bord",
    products: "Gestion des produits",
    orders: "Gestion des commandes",
    categories: "Gestion des catégories",
    customers: "Gestion des clients",
    settings: "Paramètres",
  };
  document.getElementById("pageTitle").textContent =
    titles[sectionId] || sectionId;

  // Load section data
  if (sectionId === "orders") {
    renderOrdersTable(orders);
  } else if (sectionId === "settings") {
    loadSettings();
  }
}

// Toggle Sidebar
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
  document.getElementById("mainContent").classList.toggle("expanded");
}

// Category Filter
function updateCategoryFilter() {
  const filter = document.getElementById("categoryFilter");
  if (!filter) return;

  filter.innerHTML = '<option value="">Toutes les catégories</option>';
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat.name;
    option.textContent = cat.name;
    filter.appendChild(option);
  });
}

// Filter Products
function filterProducts() {
  const search = document.getElementById("productSearch").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;

  const filtered = products.filter((p) => {
    const matchSearch =
      (p.name || "").toLowerCase().includes(search) ||
      (p.title || "").toLowerCase().includes(search);
    const matchCategory = !category || p.category === category;
    return matchSearch && matchCategory;
  });

  renderProductsTable(filtered);
}

// Refresh Products
async function refreshProducts() {
  await loadProducts();
  renderProductsTable(products);
  updateDashboard();
}

// Product Modal
function showAddProductModal() {
  editingProductId = null;
  document.getElementById("productModalTitle").textContent =
    "Ajouter un produit";
  document.getElementById("productSubmitText").textContent =
    "Ajouter le produit";
  document.getElementById("productForm").reset();
  document.getElementById("productId").value = "";
  document.getElementById("imagePreviews").innerHTML = "";
  document.getElementById("existingImages").value = "[]";

  // Reset size inputs
  populateSizeInputs({});

  // Populate categories
  const select = document.getElementById("productCategory");
  select.innerHTML = '<option value="">اختر الفئة</option>';
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat.name;
    option.textContent = cat.name;
    select.appendChild(option);
  });

  document.getElementById("productModal").classList.add("active");
}

function editProduct(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  editingProductId = productId;
  document.getElementById("productModalTitle").textContent =
    "Modifier le produit";
  document.getElementById("productSubmitText").textContent =
    "Mettre à jour le produit";
  document.getElementById("productId").value = productId;
  document.getElementById("productName").value =
    product.name || product.title || "";
  document.getElementById("productCategory").value = product.category || "";
  document.getElementById("productPrice").value = product.price || 0;
  document.getElementById("productOldPrice").value = product.oldPrice || "";
  document.getElementById("productStock").value = product.stock || 0;
  document.getElementById("productDescription").value =
    product.description || "";
  document.getElementById("productFeatured").value = product.featured
    ? "true"
    : "false";

  // Populate size inputs
  populateSizeInputs(product);

  // Show existing images
  const existingImages =
    product.images || (product.image ? [product.image] : []);
  document.getElementById("existingImages").value =
    JSON.stringify(existingImages);
  renderExistingImages(existingImages);

  // Populate categories
  const select = document.getElementById("productCategory");
  select.innerHTML = '<option value="">اختر الفئة</option>';
  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat.name;
    option.textContent = cat.name;
    if (cat.name === product.category) option.selected = true;
    select.appendChild(option);
  });

  document.getElementById("productModal").classList.add("active");
}

// Product Submit Handler
async function handleProductSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("productName").value;
  const category = document.getElementById("productCategory").value;
  const price = document.getElementById("productPrice").value;
  const oldPrice = document.getElementById("productOldPrice").value;
  const stock = document.getElementById("productStock").value;
  const description = document.getElementById("productDescription").value;
  const featured = document.getElementById("productFeatured").value;
  const sizesElement = document.getElementById("productSizes");
  const sizesInput = sizesElement ? sizesElement.value : "";

  // Collect files from 4 separate inputs
  const imageFiles = [];
  for (let i = 1; i <= 4; i++) {
    const input = document.getElementById(`productImage${i}`);
    if (input && input.files.length > 0) {
      imageFiles.push(input.files[0]);
    }
  }

  const existingImages = document.getElementById("existingImages").value;

  if (!name) {
    showAlert("productAlert", "Le nom du produit est requis", "error");
    return;
  }

  // Collect sizes from the size selector
  let sizes = [];
  for (let i = 14; i <= 20; i++) {
    const checkbox = document.getElementById(`size${i}cb`);
    const stockInput = document.getElementById(`size${i}`);

    if (checkbox && checkbox.checked) {
      sizes.push({
        size: i.toString(),
        stock: parseInt(stockInput.value) || 0,
      });
    }
  }

  // Create FormData for file upload
  const formData = new FormData();
  formData.append("name", name);
  formData.append("title", name);
  formData.append("category", category);
  formData.append("price", price);
  formData.append("oldPrice", oldPrice);
  formData.append("stock", stock);
  formData.append("description", description);
  formData.append("featured", featured);
  formData.append("status", "active");
  formData.append("existingImages", existingImages);

  if (sizes.length > 0) {
    formData.append("sizes", JSON.stringify(sizes));
  }

  // Add new image files
  if (imageFiles && imageFiles.length > 0) {
    for (let i = 0; i < imageFiles.length; i++) {
      formData.append("images", imageFiles[i]);
    }
  }

  try {
    let response;
    if (editingProductId) {
      formData.append("id", editingProductId);
      response = await fetch(
        `${CONFIG.API_BASE}/products/${editingProductId}`,
        {
          method: "PUT",
          body: formData,
        },
      );
    } else {
      formData.append("id", Date.now().toString());
      formData.append("createdAt", new Date().toISOString());
      response = await fetch(`${CONFIG.API_BASE}/products`, {
        method: "POST",
        body: formData,
      });
    }

    if (response.ok) {
      closeModal();
      await refreshProducts();
      showAlert("productAlert", "Produit enregistré avec succès", "success");
    } else {
      const errorText = await response.text();
      console.error("Server error:", errorText);
      throw new Error("Failed to save product");
    }
  } catch (error) {
    console.error("Error saving product:", error);
    showAlert(
      "productAlert",
      "Erreur lors de l'enregistrement du produit",
      "error",
    );
  }
}

// Delete Product
async function deleteProduct(productId) {
  if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/products/${productId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      await refreshProducts();
    } else {
      throw new Error("Failed to delete product");
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    alert("Une erreur est survenue lors de la suppression du produit");
  }
}

// View Order
function viewOrder(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;

  // Store current order ID for status update
  window.currentOrderId = orderId;

  // Render products list
  const productsHtml = (order.products || [])
    .map(
      (product) => `
    <div class="flex items-center gap-3 p-2 border-b">
      <img src="${product.image || "https://via.placeholder.com/50"}" alt="${product.title}" class="w-12 h-12 object-cover rounded">
      <div class="flex-1">
        <p class="font-bold">${product.title || "Produit"}</p>
        <p class="text-sm text-gray-600">
          ${product.quantity} × ${(product.price || 0).toLocaleString()} DA
          ${product.size ? ` | Taille: ${product.size}` : ""}
          ${product.color ? ` | Couleur: ${product.color}` : ""}
        </p>
      </div>
      <p class="font-bold">${((product.price || 0) * product.quantity).toLocaleString()} DA</p>
    </div>
  `,
    )
    .join("");

  const content = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-600">Numéro de commande:</p>
          <p class="font-bold">${order.id?.slice(-6) || "N/A"}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Statut actuel:</p>
          <p><span class="status-badge status-${order.status || "pending"}">${getStatusText(order.status)}</span></p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Client:</p>
          <p class="font-bold">${order.customerName || "Client"}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Téléphone:</p>
          <p class="font-bold">${order.customerPhone || "-"}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Wilaya:</p>
          <p class="font-bold">${order.wilaya || "-"}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Commune:</p>
          <p class="font-bold">${order.commune || "-"}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Total:</p>
          <p class="font-bold text-lg">${(order.total || 0).toLocaleString()} DA</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Date:</p>
          <p class="font-bold">${formatDate(order.createdAt)}</p>
        </div>
      </div>

      <div>
        <label class="block text-sm font-bold mb-2">Changer le statut:</label>
        <select id="orderStatusSelect" class="form-control" style="width: 100%; padding: 8px;">
          <option value="pending" ${order.status === "pending" ? "selected" : ""}>En attente</option>
          <option value="processing" ${order.status === "processing" ? "selected" : ""}>En cours</option>
          <option value="completed" ${order.status === "completed" ? "selected" : ""}>Terminé</option>
          <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>Annulé</option>
        </select>
        <button onclick="updateOrderStatusFromModal()" class="btn btn-success mt-2" style="width: 100%;">
          <i class="fas fa-check"></i> Mettre à jour le statut
        </button>
      </div>

      <div class="mt-4">
        <h4 class="font-bold mb-2">Produits:</h4>
        <div class="border rounded">
          ${productsHtml}
        </div>
      </div>
    </div>
  `;

  document.getElementById("orderDetailsContent").innerHTML = content;
  document.getElementById("orderDetailsModal").classList.add("active");
}

// Update Order Status
async function updateOrderStatus(orderId, status) {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      await loadOrders();
      updateDashboard();
    }
  } catch (error) {
    console.error("Error updating order status:", error);
  }
}

// Category Modal
function showAddCategoryModal() {
  editingCategoryId = null;
  document.getElementById("categoryModalTitle").textContent =
    "Ajouter une catégorie";
  document.getElementById("categorySubmitText").textContent =
    "Ajouter la catégorie";
  document.getElementById("categoryForm").reset();
  document.getElementById("categoryId").value = "";
  document.getElementById("categoryModal").classList.add("active");
}

// Category Submit Handler
async function handleCategorySubmit(e) {
  e.preventDefault();

  const categoryData = {
    id: editingCategoryId || Date.now().toString(),
    name: document.getElementById("categoryName").value,
    description: document.getElementById("categoryDescription").value,
    icon: document.getElementById("categoryIcon").value,
  };

  if (!categoryData.name) {
    alert("Le nom de la catégorie est requis");
    return;
  }

  // Save to local storage (categories are stored in products.json)
  // For now, just close the modal
  closeModal();
  await loadCategories();
}

// Image Previews for Multiple Images
function previewImages(e) {
  const files = e.target.files;
  const previewContainer = document.getElementById("imagePreviews");
  previewContainer.innerHTML = "";

  if (!files || files.length === 0) {
    return;
  }

  Array.from(files).forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const div = document.createElement("div");
      div.className = "relative";
      div.innerHTML = `
        <img src="${e.target.result}" class="w-20 h-20 object-cover rounded-lg" />
        <button type="button" onclick="removeImage(${index})" 
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
          <i class="fas fa-times"></i>
        </button>
      `;
      previewContainer.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// Preview single image from one of the 4 inputs
function previewSingleImage(e, imageNum) {
  const file = e.target.files[0];
  const previewContainer = document.getElementById("imagePreviews");

  // Create or update preview for this image slot
  let previewDiv = document.getElementById(`preview-image-${imageNum}`);
  if (!previewDiv) {
    previewDiv = document.createElement("div");
    previewDiv.id = `preview-image-${imageNum}`;
    previewDiv.className = "relative";
    previewContainer.appendChild(previewDiv);
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      previewDiv.innerHTML = `
        <img src="${e.target.result}" class="w-20 h-20 object-cover rounded-lg" />
        <button type="button" onclick="clearImageInput(${imageNum})" 
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
          <i class="fas fa-times"></i>
        </button>
        ${imageNum === 1 ? '<span class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-1 rounded">رئيسية</span>' : ""}
      `;
    };
    reader.readAsDataURL(file);
  } else {
    previewDiv.innerHTML = "";
  }
}

// Clear image input and preview
function clearImageInput(imageNum) {
  const input = document.getElementById(`productImage${imageNum}`);
  if (input) {
    input.value = "";
  }
  const previewDiv = document.getElementById(`preview-image-${imageNum}`);
  if (previewDiv) {
    previewDiv.innerHTML = "";
  }
}

// Remove image from selection
function removeImage(index) {
  // This is a visual removal only - actual removal happens on form submit
  const previewContainer = document.getElementById("imagePreviews");
  if (previewContainer.children[index]) {
    previewContainer.children[index].style.opacity = "0.3";
    previewContainer.children[index].style.pointerEvents = "none";
  }
}

// Render existing images for editing
function renderExistingImages(images) {
  const previewContainer = document.getElementById("imagePreviews");
  previewContainer.innerHTML = "";

  if (!images || images.length === 0) {
    return;
  }

  images.forEach((img, index) => {
    const div = document.createElement("div");
    div.className = "relative";
    div.innerHTML = `
      <img src="${img}" class="w-20 h-20 object-cover rounded-lg" />
      <button type="button" onclick="deleteExistingImage('${img}', ${index})" 
        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
        <i class="fas fa-times"></i>
      </button>
      ${index === 0 ? '<span class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-1 rounded">رئيسية</span>' : ""}
    `;
    previewContainer.appendChild(div);
  });
}

// Delete existing image
function deleteExistingImage(imgUrl, index) {
  if (!confirm("Voulez-vous supprimer cette image ?")) return;

  // Get current existing images from hidden field
  let existingImages = JSON.parse(
    document.getElementById("existingImages").value || "[]",
  );

  // Remove the image
  existingImages.splice(index, 1);

  // Update hidden field
  document.getElementById("existingImages").value =
    JSON.stringify(existingImages);

  // Re-render
  renderExistingImages(existingImages);
}

// Close Modal
function closeModal() {
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.classList.remove("active");
  });
  editingProductId = null;
  editingCategoryId = null;
}

// Show Alert
function showAlert(elementId, message, type) {
  const alert = document.getElementById(elementId);
  alert.textContent = message;
  alert.className = `alert alert-${type}`;
  alert.style.display = "block";

  setTimeout(() => {
    alert.style.display = "none";
  }, 3000);
}

// Helper Functions
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusText(status) {
  const statusMap = {
    pending: "En attente",
    processing: "En cours",
    completed: "Terminé",
    cancelled: "Annulé",
  };
  return statusMap[status] || "En attente";
}

// Make functions globally available
window.showSection = showSection;
window.toggleSidebar = toggleSidebar;
window.logout = logout;
window.showAddProductModal = showAddProductModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewOrder = viewOrder;
window.updateOrderStatus = updateOrderStatus;
window.showAddCategoryModal = showAddCategoryModal;
window.closeModal = closeModal;
window.refreshProducts = refreshProducts;
window.showAddWilayaModal = showAddWilayaModal;
window.saveWilaya = saveWilaya;
window.deleteWilaya = deleteWilaya;
window.saveStoreInfo = saveStoreInfo;
window.clearImageInput = clearImageInput;
window.previewSingleImage = previewSingleImage;

// ==================== WILAYA MANAGEMENT ====================

let editingWilayaIndex = null;

// Load Settings and render wilayas
async function loadSettings() {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/settings`);
    if (response.ok) {
      settings = await response.json();
      renderWilayasTable();

      // Populate store info
      document.getElementById("storeName").value = settings.storeName || "";
      document.getElementById("storePhone").value = settings.storePhone || "";
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

function renderWilayasTable() {
  const tbody = document.getElementById("wilayasTable");
  if (!tbody) return;

  const wilayas = settings.deliveryWilayas || [];

  if (wilayas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center py-8">Aucune wilaya ajoutée</td></tr>';
    return;
  }

  tbody.innerHTML = wilayas
    .map(
      (wilaya, index) => `
    <tr>
      <td class="font-bold">${wilaya.name}</td>
      <td>${wilaya.homePrice?.toLocaleString() || 0} DA</td>
      <td>${wilaya.officePrice?.toLocaleString() || 0} DA</td>
      <td>
        <button onclick="editWilaya(${index})" class="btn btn-primary" style="padding: 4px 8px;">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="deleteWilaya(${index})" class="btn btn-danger" style="padding: 4px 8px;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

function showAddWilayaModal(index = null) {
  editingWilayaIndex = index;

  if (index !== null && settings.deliveryWilayas[index]) {
    const wilaya = settings.deliveryWilayas[index];
    document.getElementById("wilayaModalTitle").textContent =
      "Modifier la wilaya";
    document.getElementById("wilayaName").value = wilaya.name || "";
    document.getElementById("wilayaHomePrice").value = wilaya.homePrice || 0;
    document.getElementById("wilayaOfficePrice").value =
      wilaya.officePrice || 0;
    document.getElementById("wilayaIndex").value = index;
  } else {
    document.getElementById("wilayaModalTitle").textContent =
      "Ajouter une wilaya";
    document.getElementById("wilayaForm").reset();
    document.getElementById("wilayaIndex").value = "";
  }

  document.getElementById("wilayaModal").classList.add("active");
}

function editWilaya(index) {
  showAddWilayaModal(index);
}

async function saveWilaya(e) {
  e.preventDefault();

  const name = document.getElementById("wilayaName").value;
  const homePrice =
    parseFloat(document.getElementById("wilayaHomePrice").value) || 0;
  const officePrice =
    parseFloat(document.getElementById("wilayaOfficePrice").value) || 0;
  const index = document.getElementById("wilayaIndex").value;

  if (!name) {
    alert("Le nom de la wilaya est requis");
    return;
  }

  const wilayaData = { name, homePrice, officePrice };

  try {
    // Load current settings
    const response = await fetch(`${CONFIG.API_BASE}/settings`);
    if (response.ok) {
      const currentSettings = await response.json();

      // Initialize deliveryWilayas array if not exists
      if (!currentSettings.deliveryWilayas) {
        currentSettings.deliveryWilayas = [];
      }

      // Add or update wilaya
      if (index !== "") {
        currentSettings.deliveryWilayas[parseInt(index)] = wilayaData;
      } else {
        currentSettings.deliveryWilayas.push(wilayaData);
      }

      // Save settings
      const saveResponse = await fetch(`${CONFIG.API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentSettings),
      });

      if (saveResponse.ok) {
        settings = currentSettings;
        renderWilayasTable();
        closeModal();
        alert("Wilaya enregistrée avec succès");
      } else {
        throw new Error("Failed to save wilaya");
      }
    }
  } catch (error) {
    console.error("Error saving wilaya:", error);
    alert("Erreur lors de l'enregistrement de la wilaya");
  }
}

async function deleteWilaya(index) {
  if (!confirm("Êtes-vous sûr de vouloir supprimer cette wilaya ?")) return;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/settings`);
    if (response.ok) {
      const currentSettings = await response.json();

      if (currentSettings.deliveryWilayas) {
        currentSettings.deliveryWilayas.splice(index, 1);

        const saveResponse = await fetch(`${CONFIG.API_BASE}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentSettings),
        });

        if (saveResponse.ok) {
          settings = currentSettings;
          renderWilayasTable();
        }
      }
    }
  } catch (error) {
    console.error("Error deleting wilaya:", error);
    alert("Erreur lors de la suppression de la wilaya");
  }
}

async function saveStoreInfo() {
  const storeName = document.getElementById("storeName").value;
  const storePhone = document.getElementById("storePhone").value;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/settings`);
    if (response.ok) {
      const currentSettings = await response.json();

      currentSettings.storeName = storeName;
      currentSettings.storePhone = storePhone;

      const saveResponse = await fetch(`${CONFIG.API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentSettings),
      });

      if (saveResponse.ok) {
        settings = currentSettings;
        alert("Informations du magasin enregistrées avec succès");
      }
    }
  } catch (error) {
    console.error("Error saving store info:", error);
    alert("Erreur lors de l'enregistrement des informations du magasin");
  }
}

// Add event listener for wilaya form
document.addEventListener("DOMContentLoaded", function () {
  const wilayaForm = document.getElementById("wilayaForm");
  if (wilayaForm) {
    wilayaForm.addEventListener("submit", saveWilaya);
  }
});

// Add all default Algerian wilayas
window.addAllDefaultWilayas = async function () {
  const defaultWilayas = [
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

  try {
    const response = await fetch(`${CONFIG.API_BASE}/settings`);
    if (response.ok) {
      const currentSettings = await response.json();

      if (!currentSettings.deliveryWilayas) {
        currentSettings.deliveryWilayas = [];
      }

      defaultWilayas.forEach((wilaya) => {
        const exists = currentSettings.deliveryWilayas.some(
          (w) => w.name === wilaya.name,
        );
        if (!exists) {
          currentSettings.deliveryWilayas.push(wilaya);
        }
      });

      const saveResponse = await fetch(`${CONFIG.API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentSettings),
      });

      if (saveResponse.ok) {
        settings = currentSettings;
        renderWilayasTable();
        alert("Toutes les wilayas ont été ajoutées!");
      }
    }
  } catch (error) {
    console.error("Error adding default wilayas:", error);
    alert("Erreur lors de l'ajout des wilayas");
  }
};

// Update Order Status from Modal
window.updateOrderStatusFromModal = async function () {
  const orderId = window.currentOrderId;
  const status = document.getElementById("orderStatusSelect").value;

  if (!orderId) return;

  try {
    const response = await fetch(
      `${CONFIG.API_BASE}/orders/${orderId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );

    if (response.ok) {
      closeModal();
      await loadOrders();
      updateDashboard();
    }
  } catch (error) {
    console.error("Error updating order status:", error);
  }
};
