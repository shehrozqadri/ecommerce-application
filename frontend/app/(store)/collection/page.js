"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchStoreProducts, fetchStoreSuggestions } from "@/lib/api";
import { fetchWishlist, toggleWishlist } from "@/lib/wishlist";

function CollectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedColor, setSelectedColor] = useState("All");
  const [selectedSize, setSelectedSize] = useState("All");
  const [selectedCollection, setSelectedCollection] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [categories, setCategories] = useState(["All"]);
  const [colors, setColors] = useState(["All"]);
  const [sizes, setSizes] = useState(["All"]);
  const [collections, setCollections] = useState(["All"]);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const initialSearch = searchParams.get("search")?.trim() || "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, catalog] = await Promise.all([
        fetchStoreProducts({ q: initialSearch || undefined, limit: 100 }),
        fetchStoreProducts({ limit: 100 }),
      ]);
      setProducts(data);
      setAllProducts(catalog);

      // Extract unique categories
      const uniqueCats = ["All", ...new Set(data.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCats);

      // Extract unique colors (from colors array)
      const colorSet = new Set(["All"]);
      data.forEach(p => {
        if (p.colors && Array.isArray(p.colors)) {
          p.colors.forEach(color => colorSet.add(color));
        }
      });
      setColors(Array.from(colorSet));

      // Extract unique sizes (from sizes array)
      const sizeSet = new Set(["All"]);
      data.forEach(p => {
        if (p.sizes && Array.isArray(p.sizes)) {
          p.sizes.forEach(size => sizeSet.add(size));
        }
      });
      setSizes(Array.from(sizeSet));

      // Extract unique collection types (from tags)
      const collectionSet = new Set(["All"]);
      data.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) {
          p.tags.forEach(tag => collectionSet.add(tag));
        }
      });
      setCollections(Array.from(collectionSet));

      setSearchTerm(initialSearch);
      setSearchInput(initialSearch);
    } catch {
      setAllProducts([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [initialSearch]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const syncWishlist = () => {
      const ids = new Set(fetchWishlist().map((item) => item.id));
      setWishlistIds(ids);
    };
    syncWishlist();
    window.addEventListener("wishlist:changed", syncWishlist);
    return () => window.removeEventListener("wishlist:changed", syncWishlist);
  }, []);

  function handleToggleWishlist(product) {
    const nextItems = toggleWishlist(product);
    setWishlistIds(new Set(nextItems.map((item) => item.id)));
  }

  useEffect(() => {
    const term = searchInput.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }

    const local = [];

    const pushIfMatch = (value) => {
      if (!value) return;
      const text = String(value).trim();
      if (!text || !text.toLowerCase().includes(term.toLowerCase())) return;
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
        setSuggestions([...new Set([...remote, ...localUnique])].slice(0, 8));
      } catch {
        setSuggestions(localUnique);
      }
    }, 180);

    return () => clearTimeout(timeout);
  }, [searchInput, allProducts]);

  function submitSearch(value) {
    const term = (value || "").trim();
    setShowSuggestions(false);
    if (!term) {
      router.push("/collection");
      return;
    }
    router.push(`/collection?search=${encodeURIComponent(term)}`);
  }

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === "All" || p.category === selectedCategory;
    const matchColor = selectedColor === "All" || (p.colors && p.colors.includes(selectedColor));
    const matchSize = selectedSize === "All" || (p.sizes && p.sizes.includes(selectedSize));
    const matchCollection = selectedCollection === "All" || (p.tags && p.tags.includes(selectedCollection));
    const matchSearch = !searchTerm || 
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchColor && matchSize && matchCollection && matchSearch;
  });

  // Sort products
  let sorted = [...filteredProducts];
  if (sortBy === "price_asc") sorted.sort((a, b) => a.price - b.price);
  else if (sortBy === "price_desc") sorted.sort((a, b) => b.price - a.price);
  // newest is default

  return (
    <div className="collection-page">
      <div className="collection-container">
        {/* Filters Sidebar */}
        <aside className="collection-filters">
          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Color</label>
            <select
              value={selectedColor}
              onChange={e => setSelectedColor(e.target.value)}
              className="filter-select"
            >
              {colors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Size</label>
            <select
              value={selectedSize}
              onChange={e => setSelectedSize(e.target.value)}
              className="filter-select"
            >
              {sizes.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Collection Type</label>
            <select
              value={selectedCollection}
              onChange={e => setSelectedCollection(e.target.value)}
              className="filter-select"
            >
              {collections.map(coll => (
                <option key={coll} value={coll}>{coll}</option>
              ))}
            </select>
          </div>

          <button
            className="filter-reset-btn"
            onClick={() => {
              setSelectedCategory("All");
              setSelectedColor("All");
              setSelectedSize("All");
              setSelectedCollection("All");
            }}
          >
            Reset Filters
          </button>
        </aside>

        {/* Products Area */}
        <div className="collection-products">
          <div className="store-search-wrap collection-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search products…"
              value={searchInput}
              onChange={e => {
                const nextValue = e.target.value;
                setSearchInput(nextValue);
                setShowSuggestions(true);
                if (!nextValue.trim()) {
                  setSearchTerm("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                  router.replace("/collection");
                }
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

          <div className="collection-toolbar">
            <p className="collection-count">
              {sorted.length} {sorted.length === 1 ? "product" : "products"}
            </p>
            <select className="store-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
            </select>
          </div>

          {loading ? (
            <div className="store-loading">
              {[...Array(12)].map((_, i) => <div key={i} className="store-skeleton-card" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="store-empty">
              <span>🧵</span>
              <p>No products found with these filters.</p>
            </div>
          ) : (
            <div className="store-product-grid">
              {sorted.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isWishlisted={wishlistIds.has(p.id)}
                  onToggleWishlist={handleToggleWishlist}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "3rem" }}>Loading...</div>}>
      <CollectionContent />
    </Suspense>
  );
}

function ProductCard({ product, isWishlisted, onToggleWishlist }) {
  const image = product.images?.[0]?.url;
  const outOfStock = product.stock === 0;

  return (
    <Link href={`/products/${product.id}`} className="store-product-card">
      <div className="store-product-img-wrap">
        <button
          type="button"
          className={`store-wishlist-btn${isWishlisted ? " active" : ""}`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist(product);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-6.7-4.35-9.1-8.15C1.2 10.17 2.33 6.5 5.85 5.8A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 6.15-2.2c3.52.7 4.65 4.37 2.95 7.05C18.7 16.65 12 21 12 21z" />
          </svg>
        </button>

        {image ? (
          <img src={image} alt={product.title} className="store-product-img" />
        ) : (
          <div className="store-product-img-placeholder">
            <span>🧵</span>
          </div>
        )}
        {outOfStock && <div className="store-out-of-stock-badge">Out of Stock</div>}
      </div>
      <div className="store-product-info">
        {product.brand && <p className="store-product-brand">{product.brand}</p>}
        <h3 className="store-product-title">{product.title}</h3>
        <p className="store-product-category">{product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}</p>
        <p className="store-product-price">
          {product.currency === "INR" ? "₹" : product.currency} {product.price.toLocaleString("en-IN")}
        </p>
      </div>
    </Link>
  );
}
