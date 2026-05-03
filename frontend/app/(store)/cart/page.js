"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchCart,
  updateCartItem,
  removeFromCart,
  fetchGuestCart,
  updateGuestCartItem,
  removeGuestCartItem,
} from "@/lib/api";
import { useUser } from "@/lib/userContext";

export default function CartPage() {
  const { token, setCartCount } = useUser();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadCart() {
    if (!token) {
      const guestCart = fetchGuestCart();
      setCart(guestCart);
      setCartCount(guestCart.item_count);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchCart(token);
      setCart(data);
      setCartCount(data.item_count);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCart(); }, [token]);

  async function handleQty(productId, newQty) {
    try {
      const data = token
        ? await updateCartItem(token, productId, newQty)
        : updateGuestCartItem(productId, newQty);
      setCart(data);
      setCartCount(data.item_count);
    } catch {}
  }

  async function handleRemove(productId) {
    try {
      const data = token ? await removeFromCart(token, productId) : removeGuestCartItem(productId);
      setCart(data);
      setCartCount(data.item_count);
    } catch {}
  }

  if (loading) return <div className="store-page store-loading-full"><div className="store-spinner" /></div>;

  if (!cart || cart.items.length === 0) return (
    <div className="store-page store-empty">
      <span>🛒</span>
      <p>Your cart is empty.</p>
      <Link href="/" className="store-btn-primary" style={{marginTop: "1.5rem"}}>Continue Shopping</Link>
    </div>
  );

  return (
    <div className="store-page">
      <div className="store-cart-page">
        <h1 className="store-page-title">Your Cart <span className="store-page-count">{cart.item_count} items</span></h1>
        {!token && (
          <p className="muted-text" style={{ marginTop: "-1.2rem", marginBottom: "1.4rem" }}>
            Guest cart: checkout is available without login.
          </p>
        )}

        <div className="store-cart-layout">
          <div className="store-cart-items">
            {cart.items.map((item, i) => (
              <div key={i} className="store-cart-item">
                <div className="store-cart-item-img">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.title} />
                    : <div className="store-product-img-placeholder sm"><span>🧵</span></div>
                  }
                </div>
                <div className="store-cart-item-info">
                  <Link href={`/products/${item.product_id}`} className="store-cart-item-title">{item.title}</Link>
                  <div className="store-cart-item-meta">
                    {item.size && <span>Size: {item.size}</span>}
                    {item.color && <span>Colour: {item.color}</span>}
                  </div>
                  <p className="store-cart-item-price">
                    {item.currency === "INR" ? "₹" : item.currency} {item.price.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="store-cart-item-actions">
                  <div className="store-qty-ctrl sm">
                    <button onClick={() => handleQty(item.product_id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => handleQty(item.product_id, item.quantity + 1)}>+</button>
                  </div>
                  <p className="store-cart-subtotal">
                    ₹ {item.subtotal.toLocaleString("en-IN")}
                  </p>
                  <button className="store-cart-remove" onClick={() => handleRemove(item.product_id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="store-cart-summary">
            <h2>Order Summary</h2>
            <div className="store-summary-row">
              <span>Subtotal ({cart.item_count} items)</span>
              <span>₹ {cart.total.toLocaleString("en-IN")}</span>
            </div>
            <div className="store-summary-row">
              <span>Shipping</span>
              <span className="store-free-tag">FREE</span>
            </div>
            <div className="store-summary-divider" />
            <div className="store-summary-row store-summary-total">
              <span>Total</span>
              <span>₹ {cart.total.toLocaleString("en-IN")}</span>
            </div>
            <Link href="/checkout" className="store-btn-primary store-btn-lg store-btn-full" style={{marginTop: "1.5rem", display: "block", textAlign: "center"}}>
              Proceed to Checkout
            </Link>
            <Link href="/" className="store-btn-ghost store-btn-full" style={{marginTop: "0.75rem", display: "block", textAlign: "center"}}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
