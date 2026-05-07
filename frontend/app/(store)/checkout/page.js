"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  clearGuestCart,
  createRazorpayOrder,
  fetchCart,
  fetchGuestCart,
  placeGuestOrder,
  placeOrder,
  verifyRazorpayPayment,
} from "@/lib/api";
import { useUser } from "@/lib/userContext";
import BufferedImage from "@/components/BufferedImage";

const EMPTY_ADDR = {
  full_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

const RUHAB_INSTAGRAM_URL =
  "https://www.instagram.com/ruhab_studio?igsh=MWxkMjRhOWJnNnh3aw%3D%3D&utm_source=qr";
const ONLINE_PAYMENT_DISABLED_MSG =
  "Online payments are disabled for the time being. Please use Cash on Delivery or Pay to Ruhab option.";
const PAY_TO_RUHAB_REDIRECT_MSG =
  "You are being redirected to the Ruhab Studios Instagram page, where you can DM us to place your order.";

export default function CheckoutPage() {
  const razorpayKeyId = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
  const { token, user, setCartCount } = useUser();
  const router = useRouter();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guestEmail, setGuestEmail] = useState("");
  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [payMethod, setPayMethod] = useState("cod");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [showPaymentDisabledModal, setShowPaymentDisabledModal] = useState(false);
  const [showPayToRuhabModal, setShowPayToRuhabModal] = useState(false);
  const redirectTimeoutRef = useRef(null);
  const redirectWindowRef = useRef(null);

  useEffect(() => {
    if (!token) {
      const guestCart = fetchGuestCart();
      setCart(guestCart);
      setCartCount(guestCart.item_count);
      setLoading(false);
      return;
    }
    fetchCart(token)
      .then((d) => {
        setCart(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    if (user?.name) setAddr((a) => ({ ...a, full_name: user.name }));
    if (user?.phone) setAddr((a) => ({ ...a, phone: user.phone || "" }));
    if (user?.email) setGuestEmail(user.email);
  }, [token]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }

      if (redirectWindowRef.current && !redirectWindowRef.current.closed) {
        redirectWindowRef.current.close();
      }
    };
  }, []);

  function buildCheckoutPayload() {
    return {
      customer_email: token ? user?.email || guestEmail || undefined : guestEmail,
      items: (cart?.items || []).map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        size: item.size || undefined,
        color: item.color || undefined,
      })),
      shipping_address: addr,
      notes: notes || undefined,
      amount: Math.max(100, Math.round(Number(cart?.total || 0) * 100)),
      currency: "INR",
    };
  }

  function finalizeSuccessfulOrder(order) {
    if (!token) {
      sessionStorage.setItem(`order_${order.id}`, JSON.stringify(order));
      clearGuestCart();
    }
    setCartCount(0);
    router.push(`/order-confirmation?id=${order.id}`);
  }

  function openPaymentDisabledModal() {
    setShowPaymentDisabledModal(true);
  }

  function startPayToRuhabRedirect() {
    if (typeof window !== "undefined") {
      redirectWindowRef.current = window.open("about:blank", "_blank", "noopener,noreferrer");
    }

    setPayMethod("pay_to_ruhab");
    setShowPayToRuhabModal(true);
    setPlacing(true);

    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current);
    }

    redirectTimeoutRef.current = window.setTimeout(() => {
      if (redirectWindowRef.current && !redirectWindowRef.current.closed) {
        redirectWindowRef.current.location.href = RUHAB_INSTAGRAM_URL;
      } else if (typeof window !== "undefined") {
        window.location.href = RUHAB_INSTAGRAM_URL;
      }

      setShowPayToRuhabModal(false);
      setPlacing(false);
      redirectTimeoutRef.current = null;
      redirectWindowRef.current = null;
    }, 3000);
  }

  async function startPrepaidCheckout() {
    if (!razorpayKeyId) {
      throw new Error("Razorpay key is missing. Add NEXT_PUBLIC_RAZORPAY_KEY_ID to the frontend environment.");
    }

    if (!razorpayReady || typeof window === "undefined" || !window.Razorpay) {
      throw new Error("Payment gateway is still loading. Please try again.");
    }

    const checkoutPayload = buildCheckoutPayload();
    const paymentOrder = await createRazorpayOrder(token, checkoutPayload);

    const normalizedContact = String(addr.phone || "").replace(/\D/g, "");
    const normalizedEmail = String(token ? user?.email || guestEmail : guestEmail || "").trim();
    const prefill = {
      name: addr.full_name?.trim() || undefined,
      email: /^\S+@\S+\.\S+$/.test(normalizedEmail) ? normalizedEmail : undefined,
      contact: /^\d{10,15}$/.test(normalizedContact) ? normalizedContact : undefined,
    };
    
    await new Promise((resolve, reject) => {
      const razorpay = new window.Razorpay({
        key: razorpayKeyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Ruhab Studio",
        description: "Secure online payment",
        order_id: paymentOrder.order_id,
        prefill,
        notes: {
          receipt: paymentOrder.receipt,
          customer: addr.full_name,
        },
        theme: {
          color: "#ff3f6c",
        },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            setError("Payment was cancelled.");
            reject(new Error("Payment cancelled"));
          },
        },
        handler: async (response) => {
          try {
            const result = await verifyRazorpayPayment(token, response);
            finalizeSuccessfulOrder(result.order);
            setPlacing(false);
            resolve(result.order);
          } catch (verifyError) {
            setPlacing(false);
            setError(verifyError.message || "Payment verification failed");
            reject(verifyError);
          }
        },
      });

      razorpay.on("payment.failed", (response) => {
        const details = [
          response?.error?.code,
          response?.error?.description,
          response?.error?.reason,
          response?.error?.source,
          response?.error?.step,
        ]
          .filter(Boolean)
          .join(" | ");
        const message =
          details || "Payment failed. Please try again.";
        console.error("Razorpay payment.failed", response?.error || response);
        setPlacing(false);
        setError(message);
        reject(new Error(message));
      });

      razorpay.open();
    });
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    setError("");
    if (!token && !guestEmail.trim()) {
      setError("Email is required for guest checkout");
      return;
    }

    setPlacing(true);

    try {
      if (payMethod === "pay_to_ruhab") {
        startPayToRuhabRedirect();
        return;
      }

      if (payMethod === "prepaid") {
        openPaymentDisabledModal();
        setPayMethod("cod");
        setPlacing(false);
        return;
      }

      const order = token
        ? await placeOrder(token, {
            shipping_address: addr,
            payment_method: payMethod,
            notes: notes || undefined,
          })
        : await placeGuestOrder({
            customer_email: guestEmail,
            items: (cart?.items || []).map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              size: item.size || undefined,
              color: item.color || undefined,
            })),
            shipping_address: addr,
            payment_method: payMethod,
            notes: notes || undefined,
          });
      finalizeSuccessfulOrder(order);
    } catch (err) {
      if (err?.message !== "Payment cancelled") {
        setError(err.message || "Unable to complete checkout");
      }
    } finally {
      if (payMethod !== "prepaid") {
        setPlacing(false);
      }
    }
  }

  if (loading)
    return (
      <div className="store-page store-loading-full">
        <div className="store-spinner" />
      </div>
    );

  if (!cart || cart.items.length === 0)
    return (
      <div className="store-page store-empty">
        <span>🛒</span>
        <p>
          Your cart is empty. <Link href="/">Continue shopping.</Link>
        </p>
      </div>
    );

  function field(label, key, type = "text", required = true, placeholder = "") {
    return (
      <div className="store-field">
        <label>
          {label}
          {required && <span className="store-required"> *</span>}
        </label>
        <input
          type={type}
          placeholder={placeholder}
          value={addr[key]}
          onChange={(e) => setAddr((a) => ({ ...a, [key]: e.target.value }))}
          required={required}
        />
      </div>
    );
  }

  return (
    <div className="store-page">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
        onError={() => setError("Failed to load the payment gateway. Please refresh and try again.")}
      />
      <div className="store-checkout-page">
        <h1 className="store-page-title">Checkout</h1>

        <form onSubmit={handlePlaceOrder} className="store-checkout-layout">
          <div className="store-checkout-form">
            <h2 className="store-section-subtitle">Shipping Address</h2>
            {!token && (
              <div className="store-field">
                <label>
                  Email <span className="store-required"> *</span>
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  required
                />
              </div>
            )}
            {field("Full Name", "full_name", "text", true, "Recipient's full name")}
            {field("Phone", "phone", "tel", true, "+91 XXXXX XXXXX")}
            {field("Address Line 1", "address_line1", "text", true, "Street, building, flat")}
            {field("Address Line 2", "address_line2", "text", false, "Landmark (optional)")}
            <div className="store-field-row">
              {field("City", "city", "text", true, "City")}
              {field("State", "state", "text", true, "State")}
            </div>
            <div className="store-field-row">
              {field("Pincode", "pincode", "text", true, "XXXXXX")}
              {field("Country", "country", "text", true, "Country")}
            </div>

            <h2 className="store-section-subtitle" style={{ marginTop: "2rem" }}>
              Payment
            </h2>
            <div className="store-payment-options">
              {[
                ["cod", "Cash on Delivery"],
                ["prepaid", "Online Payment"],
                ["pay_to_ruhab", "Pay to Ruhab"],
              ].map(([val, label]) => (
                <label
                  key={val}
                  className={`store-payment-option${
                    payMethod === val ? " active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={val}
                    checked={payMethod === val}
                    onChange={() => {
                      if (val === "prepaid") {
                        openPaymentDisabledModal();
                        setPayMethod("cod");
                        return;
                      }

                      if (val === "pay_to_ruhab") {
                        startPayToRuhabRedirect();
                        return;
                      }

                      setPayMethod(val);
                    }}
                  />
                  <span>{label}</span>
                  {val === "prepaid" && (
                    <span className="store-badge-new">Razorpay</span>
                  )}
                </label>
              ))}
            </div>

            <div className="store-field" style={{ marginTop: "1.5rem" }}>
              <label>
                Order Notes <span className="store-optional">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Any special instructions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="store-checkout-summary">
            <h2 className="store-section-subtitle">Order Summary</h2>
            <div className="store-checkout-items">
              {cart.items.map((item, i) => (
                <div key={i} className="store-checkout-item">
                  {item.image_url && (
                    <BufferedImage
                      src={item.image_url}
                      alt={item.title}
                      wrapperClassName="store-checkout-item-thumb"
                      className="store-checkout-item-image"
                    />
                  )}
                  <div>
                    <p className="store-checkout-item-title">{item.title}</p>
                    <p className="store-checkout-item-meta">
                      Qty {item.quantity}
                      {item.size ? ` · ${item.size}` : ""}
                      {item.color ? ` · ${item.color}` : ""}
                    </p>
                  </div>
                  <p className="store-checkout-item-price">
                    ₹ {item.subtotal.toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
            <div className="store-summary-divider" />
            <div className="store-summary-row store-summary-total">
              <span>Total</span>
              <span>₹ {cart.total.toLocaleString("en-IN")}</span>
            </div>

            {error && (
              <div
                className="store-alert store-alert-error"
                style={{ marginTop: "1rem" }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              className="store-btn-primary store-btn-lg store-btn-full"
              style={{ marginTop: "1.5rem" }}
              disabled={placing}
            >
              {placing
                ? payMethod === "prepaid"
                  ? "Processing Payment…"
                  : payMethod === "pay_to_ruhab"
                    ? "Redirecting…"
                    : "Placing Order…"
                : payMethod === "prepaid"
                  ? "Pay Now"
                  : payMethod === "pay_to_ruhab"
                    ? "Go to Instagram"
                    : "Place Order"}
            </button>
          </div>
        </form>
      </div>

      {showPaymentDisabledModal && (
        <div
          className="store-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Online payments disabled"
          onClick={() => setShowPaymentDisabledModal(false)}
        >
          <div className="store-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Online Payment Unavailable</h3>
            <p>{ONLINE_PAYMENT_DISABLED_MSG}</p>
            <button
              type="button"
              className="store-btn-primary"
              onClick={() => setShowPaymentDisabledModal(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showPayToRuhabModal && (
        <div
          className="store-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Redirecting to Instagram"
        >
          <div className="store-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Redirecting to Ruhab</h3>
            <p>{PAY_TO_RUHAB_REDIRECT_MSG}</p>
            <div className="store-loading-full" style={{ minHeight: "unset", paddingTop: "0.25rem" }}>
              <div className="store-buffer-ring" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
