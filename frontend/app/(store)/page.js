"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchStoreProducts, fetchStoreSuggestions } from "@/lib/api";

export default function StorePage() {
  const router = useRouter();
  const [heroThumbs, setHeroThumbs] = useState([]);
  const [heroBg, setHeroBg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const getRandomProduct = useCallback((allProducts) => {
    if (!allProducts || allProducts.length === 0) return null;
    return allProducts[Math.floor(Math.random() * allProducts.length)];
  }, []);

  const getRandomThumbs = useCallback((allProducts) => {
    if (!allProducts || allProducts.length === 0) return [];
    const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStoreProducts({ limit: 100 });
      setAllProducts(data);
      setHeroThumbs(getRandomThumbs(data));
      setHeroBg(getRandomProduct(data));
    } catch {
      setAllProducts([]);
      setHeroThumbs([]);
      setHeroBg(null);
    } finally {
      setLoading(false);
    }
  }, [getRandomThumbs, getRandomProduct]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 4000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const term = searchInput.trim();
    if (term.length < 1) {
      setSuggestions([]);
      return;
    }

    const local = [];
    const pushIfMatch = (value) => {
      if (!value) return;
      const text = String(value).trim();
      if (!text) return;
      if (!text.toLowerCase().includes(term.toLowerCase())) return;
      local.push(text);
    };

    allProducts.forEach((p) => {
      pushIfMatch(p.title);
      pushIfMatch(p.brand);
      pushIfMatch(p.category);
      pushIfMatch(p.subcategory);
      (p.tags || []).forEach(pushIfMatch);
    });

    const localUnique = [...new Set(local)].slice(0, 8);
    setSuggestions(localUnique);

    const timeout = setTimeout(async () => {
      try {
        const remote = await fetchStoreSuggestions(term, 8);

        const combined = [...new Set([...remote, ...localUnique])].slice(0, 8);

        if (combined.length > 0) {
          setSuggestions(combined);
          return;
        }

        const fallbackProducts = await fetchStoreProducts({ q: term, limit: 8 });
        const fallbackTitles = [...new Set(fallbackProducts.map((p) => p.title).filter(Boolean))].slice(0, 8);
        setSuggestions(fallbackTitles);
      } catch {
        setSuggestions(localUnique);
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [searchInput, allProducts]);

  function submitSearch(value) {
    const term = (value || "").trim();
    if (!term) return;
    setShowSuggestions(false);
    router.push(`/collection?search=${encodeURIComponent(term)}`);
  }

  return (
    <div className="store-page">
      {/* Hero */}
      <section className="store-hero" style={heroBg?.images?.[0]?.url ? { backgroundImage: `url(${heroBg.images[0].url})` } : {}}>
        <div className="store-hero-content">
          <p className="store-hero-eyebrow">Ruhab Studio</p>
          <h1 className="store-hero-title">Timeless Elegance,<br />Modern Grace</h1>
          <p className="store-hero-sub">Handcrafted Kashmiri ethnic wear</p>

          <div className="store-search-wrap store-hero-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search products…"
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              onKeyDown={e => e.key === "Enter" && submitSearch(searchInput)}
              className="store-search-input"
            />

            {showSuggestions && suggestions.length > 0 && (
              <div className="store-search-suggest">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="store-search-suggest-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchInput(item);
                      submitSearch(item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="store-hero-thumbs">
            {(heroThumbs || []).map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="store-hero-thumb"
                aria-label={`View ${p.title}`}
              >
                {p.images?.[0]?.url ? (
                  <img src={p.images[0].url} alt={p.title} />
                ) : (
                  <div className="store-product-img-placeholder sm"><span>🧵</span></div>
                )}
              </Link>
            ))}
          </div>

          <Link href="/collection" className="store-browse-btn">
            Shop Now
          </Link>

          <div className="store-trust-row" aria-label="Store highlights">
            <div className="store-trust-item">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 8h8" />
                <path d="M1 12h6" />
                <path d="M1 16h4" />
                <path d="M9 6h8l4 4v7h-2" />
                <path d="M9 6v11h2" />
                <path d="M15 10l-2 3h2l-1 3 3-4h-2l1-2z" fill="currentColor" stroke="none" />
                <circle cx="9" cy="18" r="2" />
                <circle cx="18" cy="18" r="2" />
              </svg>
              <span>24-hour Dispatch</span>
            </div>

            <div className="store-trust-item">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 1 3.2 6.9" />
                <path d="M3 8v4h4" />
                <path d="M9 10l3-2 3 2v4l-3 2-3-2z" />
              </svg>
              <span>Easy Returns</span>
            </div>

            <div className="store-trust-item">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="7" y="2" width="10" height="20" rx="2.5" />
                <circle cx="12" cy="18" r="1" />
                <circle cx="12" cy="9" r="2.4" />
                <path d="M12 11.5v3" />
                <path d="M4.5 9.5c-.8 1.4-.8 3.6 0 5" />
                <path d="M19.5 9.5c.8 1.4.8 3.6 0 5" />
              </svg>
              <span>Instant In-Store Experience</span>
            </div>

            <div className="store-trust-item">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="6" width="14" height="10" rx="1.5" />
                <path d="M17 9h2a2 2 0 0 1 2 2v5h-4" />
                <path d="M6 6V4" />
                <path d="M10 6V4" />
                <path d="M7 16v2h8v-2" />
                <path d="M9 10h5" />
                <path d="M8 13h4" />
              </svg>
              <span>Custom Fitting</span>
            </div>
          </div>
        </div>
      </section>

      <div className="store-follow-wrap">
        <span className="store-follow-label">Follow us on:</span>
        <a
          href="https://www.instagram.com/ruhab_studio?igsh=MWxkMjRhOWJnNnh3aw%3D%3D&utm_source=qr"
          target="_blank"
          rel="noreferrer"
          aria-label="Visit Ruhab Studio on Instagram"
          className="store-insta-fab"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="6" ry="6" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <a
          href="https://www.facebook.com/share/1D9BUURrLM/?mibextid=wwXIfr"
          target="_blank"
          rel="noreferrer"
          aria-label="Visit Ruhab Studio on Facebook"
          className="store-facebook-fab"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.7-1.6h1.5V4.2c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.9v2.8H8.3V14h2.5v8h2.7z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
