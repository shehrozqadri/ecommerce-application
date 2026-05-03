export const WISHLIST_KEY = "ruhab_wishlist";

function readWishlistItems() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWishlistItems(items) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("wishlist:changed"));
}

function toWishlistItem(product) {
  return {
    id: product.id,
    title: product.title,
    brand: product.brand || null,
    category: product.category || null,
    subcategory: product.subcategory || null,
    price: Number(product.price || 0),
    currency: product.currency || "INR",
    stock: Number(product.stock || 0),
    image_url: product.images?.[0]?.url || null,
    added_at: new Date().toISOString(),
  };
}

export function fetchWishlist() {
  return readWishlistItems();
}

export function isWishlisted(productId) {
  return readWishlistItems().some((item) => item.id === productId);
}

export function toggleWishlist(product) {
  const items = readWishlistItems();
  const index = items.findIndex((item) => item.id === product.id);
  if (index >= 0) {
    items.splice(index, 1);
  } else {
    items.unshift(toWishlistItem(product));
  }
  writeWishlistItems(items);
  return items;
}

export function removeFromWishlist(productId) {
  const items = readWishlistItems().filter((item) => item.id !== productId);
  writeWishlistItems(items);
  return items;
}
