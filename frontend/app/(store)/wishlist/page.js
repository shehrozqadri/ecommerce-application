"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWishlist, removeFromWishlist } from "@/lib/wishlist";

export default function WishlistPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const sync = () => setItems(fetchWishlist());
    sync();
    window.addEventListener("wishlist:changed", sync);
    return () => window.removeEventListener("wishlist:changed", sync);
  }, []);

  function handleRemove(productId) {
    setItems(removeFromWishlist(productId));
  }

  return (
    <section className="store-page" style={{ paddingTop: "2rem" }}>
      {items.length === 0 ? (
        <div className="store-empty" style={{ minHeight: "50vh" }}>
          <span>♡</span>
          <p>Your wishlist is empty for now.</p>
          <Link href="/collection" className="store-btn-primary" style={{ marginTop: "0.8rem" }}>
            Explore Collection
          </Link>
        </div>
      ) : (
        <>
          <h1 className="store-page-title">My Wishlist <span className="store-page-count">({items.length})</span></h1>
          <div className="store-product-grid">
            {items.map((item) => (
              <Link key={item.id} href={`/products/${item.id}`} className="store-product-card">
                <div className="store-product-img-wrap">
                  <button
                    type="button"
                    className="store-wishlist-btn active"
                    aria-label="Remove from wishlist"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21s-6.7-4.35-9.1-8.15C1.2 10.17 2.33 6.5 5.85 5.8A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 6.15-2.2c3.52.7 4.65 4.37 2.95 7.05C18.7 16.65 12 21 12 21z" />
                    </svg>
                  </button>

                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="store-product-img" />
                  ) : (
                    <div className="store-product-img-placeholder"><span>🧵</span></div>
                  )}
                  {item.stock === 0 && <div className="store-out-of-stock-badge">Out of Stock</div>}
                </div>

                <div className="store-product-info">
                  {item.brand && <p className="store-product-brand">{item.brand}</p>}
                  <h3 className="store-product-title">{item.title}</h3>
                  <p className="store-product-category">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ""}</p>
                  <p className="store-product-price">
                    {item.currency === "INR" ? "₹" : item.currency} {Number(item.price || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
