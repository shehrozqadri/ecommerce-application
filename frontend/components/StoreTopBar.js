"use client";
import Link from "next/link";
import { useUser } from "@/lib/userContext";

export default function StoreTopBar() {
  const { user, cartCount } = useUser();

  return (
    <header className="store-navbar">
      <div className="store-nav-inner">
        <Link href="/" className="store-nav-logo">Ruhab Studio</Link>

        <div className="store-nav-actions">
          <Link href={user ? "/orders" : "/login"} className="store-icon-btn" aria-label="My Account">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20a8 8 0 0 1 16 0" />
            </svg>
          </Link>

          <Link href="/wishlist" className="store-icon-btn" aria-label="Wishlist">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 21s-6.7-4.35-9.1-8.15C1.2 10.17 2.33 6.5 5.85 5.8A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 6.15-2.2c3.52.7 4.65 4.37 2.95 7.05C18.7 16.65 12 21 12 21z" />
            </svg>
          </Link>

          <Link href="/cart" className="store-icon-btn store-cart-btn" aria-label="Cart">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {cartCount > 0 && <span className="store-cart-badge">{cartCount}</span>}
          </Link>

          {!user && (
            <div className="store-nav-auth">
              <Link href="/register" className="store-btn-primary store-btn-sm">Join</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
