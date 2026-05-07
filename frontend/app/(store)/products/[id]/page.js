"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { fetchStoreProduct, addToCart, addToGuestCart } from "@/lib/api";
import { useUser } from "@/lib/userContext";
import BufferedImage from "@/components/BufferedImage";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token, setCartCount } = useUser();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showCustomizationPopup, setShowCustomizationPopup] = useState(false);
  const [isInCart, setIsInCart] = useState(false);

  useEffect(() => {
    fetchStoreProduct(id)
      .then((p) => {
        setProduct(p);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  function handleColorSelect(color) {
    setSelectedColor(color);

    const normalized = String(color || "").trim().toLowerCase();
    if (normalized === "customizable" || normalized === "customisable") {
      setShowCustomizationPopup(true);
    }
  }

  async function handleAddToCart() {
    if (product.sizes?.length > 0 && !selectedSize) {
      setFeedback({ type: "error", msg: "Please select a size" });
      return;
    }
    setAdding(true);
    setFeedback(null);
    try {
      let cart;
      if (token) {
        try {
          cart = await addToCart(token, {
            product_id: product.id,
            quantity,
            size: selectedSize,
            color: selectedColor,
          });
        } catch (err) {
          if (!err?.isAuthError) {
            throw err;
          }
          cart = addToGuestCart(product, {
            quantity,
            size: selectedSize,
            color: selectedColor,
          });
        }
      } else {
        cart = addToGuestCart(product, {
          quantity,
          size: selectedSize,
          color: selectedColor,
        });
      }

      setCartCount(cart.item_count);
      setFeedback({ type: "success", msg: "Added to cart!" });
      setIsInCart(true);
    } catch (err) {
      setFeedback({ type: "error", msg: err.message });
    } finally {
      setAdding(false);
    }
  }

  function goToCart() {
    router.push("/cart");
  }

  if (loading)
    return (
      <div className="store-page store-loading-full">
        <div className="store-spinner" />
      </div>
    );

  if (!product)
    return (
      <div className="store-page store-empty">
        <span>😕</span>
        <p>Product not found.</p>
      </div>
    );

  const currencySymbol = product.currency === "INR" ? "₹" : product.currency;
  const maxQty = product.stock || 0;

  return (
    <div className="store-page">
      <Link href="/collection" className="store-back-link">
        ← Back to all products
      </Link>
      <div className="store-pdp">
        {/* Image Gallery */}
        <div className="store-pdp-gallery">
          <div className="store-pdp-main-img">
            {product.images?.[selectedImage]?.url ? (
              <BufferedImage
                src={product.images[selectedImage].url}
                alt={product.title}
                loading="eager"
              />
            ) : (
              <div className="store-product-img-placeholder large">
                <span>🧵</span>
              </div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="store-pdp-thumbnails">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  className={`store-pdp-thumb${selectedImage === i ? " active" : ""}`}
                  onClick={() => setSelectedImage(i)}
                >
                  <BufferedImage src={img.url} alt={`View ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="store-pdp-info">
          {product.brand && (
            <p className="store-product-brand">{product.brand}</p>
          )}
          <h1 className="store-pdp-title">{product.title}</h1>
          <p className="store-pdp-category">
            {product.category}
            {product.subcategory ? ` · ${product.subcategory}` : ""}
          </p>
          <p className="store-pdp-price">
            {currencySymbol} {product.price.toLocaleString("en-IN")}
          </p>
          {product.stock === 0 && (
            <div className="store-alert store-alert-warning">
              Currently out of stock
            </div>
          )}
          {product.stock > 0 && product.stock < 5 && (
            <div className="store-alert store-alert-warning">
              Only {product.stock} left in stock!
            </div>
          )}

          {/* Sizes */}
          {product.sizes?.length > 0 && (
            <div className="store-pdp-options">
              <p className="store-pdp-option-label">Size</p>
              <div className="store-size-grid">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    className={`store-size-btn${
                      selectedSize === s ? " active" : ""
                    }`}
                    onClick={() => setSelectedSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors */}
          {product.colors?.length > 0 && (
            <div className="store-pdp-options">
              <p className="store-pdp-option-label">Colour</p>
              <div className="store-color-grid">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    className={`store-color-chip${
                      selectedColor === c ? " active" : ""
                    }`}
                    title={c}
                    onClick={() => handleColorSelect(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="store-pdp-options">
            <p className="store-pdp-option-label">Quantity</p>
            <div className="store-qty-ctrl">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span>{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
              >
                +
              </button>
            </div>
            {quantity >= maxQty && maxQty > 0 && (
              <p className="store-qty-limit">
                Max {maxQty} available in stock
              </p>
            )}
          </div>

          {feedback && (
            <div
              className={`store-alert ${
                feedback.type === "success"
                  ? "store-alert-success"
                  : "store-alert-error"
              }`}
            >
              {feedback.msg}
            </div>
          )}

          {isInCart ? (
            <button
              className="store-btn-primary store-btn-lg store-btn-full"
              onClick={goToCart}
            >
              Go to Cart
            </button>
          ) : (
            <button
              className="store-btn-primary store-btn-lg store-btn-full"
              onClick={handleAddToCart}
              disabled={adding || product.stock === 0}
            >
              {adding
                ? "Adding…"
                : product.stock === 0
                  ? "Out of Stock"
                  : "Add to Cart"}
            </button>
          )}

          <div className="store-pdp-divider" />
          <div className="store-pdp-description">
            <h3>Description</h3>
            <p>{product.description}</p>
          </div>

          {product.tags?.length > 0 && (
            <div className="store-pdp-tags">
              {product.tags.map((t) => (
                <span key={t} className="store-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCustomizationPopup && (
        <div
          className="store-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Customization message"
        >
          <div className="store-modal-card">
            <h3>Customization Available</h3>
            <p>
              After placing your order, we will reach out to you via phone and
              WhatsApp for customization.
            </p>
            <button
              className="store-btn-primary"
              onClick={() => setShowCustomizationPopup(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
