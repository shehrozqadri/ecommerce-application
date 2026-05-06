const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export const TOKEN_KEY =
  process.env.NEXT_PUBLIC_ACCESS_TOKEN_STORAGE_KEY || "ruhab_access_token";

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return null;
}

function formatApiError(detail) {
  if (!detail) {
    return null;
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const location = Array.isArray(item.loc) ? item.loc.slice(1).join(" → ") : "field";
          return `${location}: ${item.msg || "Invalid value"}`;
        }

        return "Invalid request";
      })
      .join(" | ");
  }

  if (typeof detail === "object") {
    if (typeof detail.message === "string") {
      return detail.message;
    }

    return JSON.stringify(detail);
  }

  return String(detail);
}

function throwApiError(data, fallbackMessage) {
  throw new Error(formatApiError(data?.detail) || fallbackMessage);
}

export async function loginAdmin({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Unable to login");
  }
  return data;
}

export async function fetchMe(token) {
  const response = await fetch(`${API_BASE_URL}/admin/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Unauthorized");
  }
  return data;
}

export async function fetchProducts(token) {
  const response = await fetch(`${API_BASE_URL}/admin/products?skip=0&limit=1000`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to load products");
  }
  return data;
}

export async function createProduct(token, payload) {
  const response = await fetch(`${API_BASE_URL}/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to create product");
  }
  return data;
}

export async function updateProduct(token, productId, payload) {
  const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to update product");
  }
  return data;
}

export async function deleteProduct(token, productId) {
  const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    throwApiError(data, "Failed to delete product");
  }
}

export async function uploadProductImage(token, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/admin/media/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to upload image");
  }
  return data;
}

export async function uploadProductImages(token, files) {
  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE_URL}/admin/media/upload-images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to upload images");
  }
  return data;
}

export async function importProductImageFromGoogleDrive(token, url) {
  const response = await fetch(`${API_BASE_URL}/admin/media/import-google-drive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to import image from Google Drive");
  }
  return data;
}

export async function fetchAdmins(token) {
  const response = await fetch(`${API_BASE_URL}/admin/admins`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to load admins");
  }
  return data;
}

export async function createAdmin(token, payload) {
  const response = await fetch(`${API_BASE_URL}/admin/admins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to create admin");
  }
  return data;
}

export async function updateAdmin(token, adminId, payload) {
  const response = await fetch(`${API_BASE_URL}/admin/admins/${adminId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to update admin");
  }
  return data;
}

export async function deactivateAdmin(token, adminId) {
  const response = await fetch(`${API_BASE_URL}/admin/admins/${adminId}/deactivate`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to deactivate admin");
  }
  return data;
}

export async function deleteAdmin(token, adminId) {
  const response = await fetch(`${API_BASE_URL}/admin/admins/${adminId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    throwApiError(data, "Failed to delete admin");
  }
}

export async function fetchAdminOrders(token, { q, status, paymentMethod, skip = 0, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status && status !== "all") params.set("status", status);
  if (paymentMethod && paymentMethod !== "all") params.set("payment_method", paymentMethod);
  params.set("skip", skip);
  params.set("limit", limit);

  const response = await fetch(`${API_BASE_URL}/admin/orders?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to load orders");
  }
  return data;
}

export async function updateAdminOrderStatus(token, orderId, status) {
  const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throwApiError(data, "Failed to update order status");
  }
  return data;
}

// ─── Store: User Auth ────────────────────────────────────────────────────────

export const USER_TOKEN_KEY = "ruhab_user_token";
export const USER_KEY = "ruhab_user";
export const GUEST_CART_KEY = "ruhab_guest_cart";

export async function registerUser({ name, email, password, phone }) {
  const response = await fetch(`${API_BASE_URL}/store/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, phone }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Registration failed");
  return data;
}

export async function loginUser({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/store/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Login failed");
  return data;
}

export async function fetchUserMe(token) {
  const response = await fetch(`${API_BASE_URL}/store/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Unauthorized");
  return data;
}

// ─── Store: Products ─────────────────────────────────────────────────────────

export async function fetchStoreProducts({ q, category, minPrice, maxPrice, inStock, skip = 0, limit = 24 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (minPrice != null) params.set("min_price", minPrice);
  if (maxPrice != null) params.set("max_price", maxPrice);
  if (inStock != null) params.set("in_stock", inStock);
  params.set("skip", skip);
  params.set("limit", limit);

  const response = await fetch(`${API_BASE_URL}/store/products?${params}`, { cache: "no-store" });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to load products");
  return data;
}

export async function fetchStoreProduct(productId) {
  const response = await fetch(`${API_BASE_URL}/store/products/${productId}`, { cache: "no-store" });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Product not found");
  return data;
}

export async function fetchStoreSuggestions(q, limit = 8) {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("limit", String(limit));

  const response = await fetch(`${API_BASE_URL}/store/products/autocomplete?${params}`, { cache: "no-store" });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to load suggestions");
  return Array.isArray(data) ? data : [];
}

// ─── Store: Cart ─────────────────────────────────────────────────────────────

export async function fetchCart(token) {
  const response = await fetch(`${API_BASE_URL}/store/cart`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to load cart");
  return data;
}

export async function addToCart(token, { product_id, quantity = 1, size, color }) {
  const response = await fetch(`${API_BASE_URL}/store/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ product_id, quantity, size, color }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to add to cart");
  return data;
}

export async function updateCartItem(token, productId, quantity) {
  const response = await fetch(`${API_BASE_URL}/store/cart/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ quantity }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to update cart");
  return data;
}

export async function removeFromCart(token, productId) {
  const response = await fetch(`${API_BASE_URL}/store/cart/${productId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to remove item");
  return data;
}

export async function clearCart(token) {
  const response = await fetch(`${API_BASE_URL}/store/cart`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to clear cart");
  return data;
}

function normalizeGuestCart(items) {
  const normalizedItems = (items || []).map((item) => ({
    ...item,
    quantity: Math.max(1, Number(item.quantity || 1)),
    subtotal: round2(Number(item.price || 0) * Math.max(1, Number(item.quantity || 1))),
  }));
  return {
    items: normalizedItems,
    total: round2(normalizedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)),
    item_count: normalizedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  };
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function readGuestCartItems() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCartItems(items) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function fetchGuestCart() {
  return normalizeGuestCart(readGuestCartItems());
}

export function addToGuestCart(product, { quantity = 1, size, color } = {}) {
  const items = readGuestCartItems();
  const index = items.findIndex(
    (item) =>
      item.product_id === product.id &&
      (item.size || null) === (size || null) &&
      (item.color || null) === (color || null)
  );

  const image_url = product.images?.[0]?.url || null;
  if (index >= 0) {
    items[index].quantity = Math.max(1, Number(items[index].quantity || 1) + Number(quantity || 1));
    items[index].subtotal = round2(items[index].quantity * Number(items[index].price || 0));
  } else {
    const item = {
      product_id: product.id,
      title: product.title,
      price: Number(product.price || 0),
      currency: product.currency || "INR",
      image_url,
      size: size || null,
      color: color || null,
      quantity: Math.max(1, Number(quantity || 1)),
      subtotal: round2(Math.max(1, Number(quantity || 1)) * Number(product.price || 0)),
    };
    items.push(item);
  }

  writeGuestCartItems(items);
  return normalizeGuestCart(items);
}

export function updateGuestCartItem(productId, quantity) {
  const items = readGuestCartItems();
  const nextQty = Number(quantity || 0);
  const nextItems = nextQty <= 0
    ? items.filter((item) => item.product_id !== productId)
    : items.map((item) => {
        if (item.product_id !== productId) return item;
        const updatedQty = Math.max(1, nextQty);
        return {
          ...item,
          quantity: updatedQty,
          subtotal: round2(updatedQty * Number(item.price || 0)),
        };
      });
  writeGuestCartItems(nextItems);
  return normalizeGuestCart(nextItems);
}

export function removeGuestCartItem(productId) {
  const items = readGuestCartItems().filter((item) => item.product_id !== productId);
  writeGuestCartItems(items);
  return normalizeGuestCart(items);
}

export function clearGuestCart() {
  writeGuestCartItems([]);
  return { items: [], total: 0, item_count: 0 };
}

// ─── Store: Orders ───────────────────────────────────────────────────────────

export async function placeOrder(token, payload) {
  const response = await fetch(`${API_BASE_URL}/store/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to place order");
  return data;
}

export async function placeGuestOrder(payload) {
  const response = await fetch(`${API_BASE_URL}/store/orders/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to place guest order");
  return data;
}

export async function createRazorpayOrder(token, payload) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/store/orders/create-order`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to create payment order");
  return data;
}

export async function verifyRazorpayPayment(token, payload) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/store/orders/verify-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to verify payment");
  return data;
}

export async function fetchOrders(token) {
  const response = await fetch(`${API_BASE_URL}/store/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Failed to load orders");
  return data;
}

export async function fetchOrder(token, orderId) {
  const response = await fetch(`${API_BASE_URL}/store/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) throwApiError(data, "Order not found");
  return data;
}
