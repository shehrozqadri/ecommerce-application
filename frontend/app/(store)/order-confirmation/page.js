"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchOrder } from "@/lib/api";
import { useUser } from "@/lib/userContext";
import BufferedImage from "@/components/BufferedImage";

function OrderConfirmationContent() {
  const { token } = useUser();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("No order found");
      setLoading(false);
      return;
    }

    if (token) {
      // Fetch from server if user is logged in
      fetchOrder(token, orderId)
        .then(data => {
          setOrder(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || "Failed to load order");
          setLoading(false);
        });
    } else {
      // For guest, we'll get order data from sessionStorage (set in checkout)
      const cachedOrder = sessionStorage.getItem(`order_${orderId}`);
      if (cachedOrder) {
        setOrder(JSON.parse(cachedOrder));
        sessionStorage.removeItem(`order_${orderId}`);
      }
      setLoading(false);
    }
  }, [orderId, token]);

  if (loading) {
    return <div className="store-loading-full"><div className="store-spinner" /></div>;
  }

  if (error || !order) {
    return (
      <div className="store-page store-empty">
        <span>❌</span>
        <p>{error || "Order not found"}</p>
        <Link href="/" className="store-btn-primary" style={{ marginTop: "1.5rem" }}>Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="store-page order-confirmation-page">
      <div className="order-confirmation-card">
        <div className="order-confirmation-header">
          <div className="order-confirmation-icon">✅</div>
          <h1>Order Confirmed!</h1>
          <p className="order-confirmation-subtext">Thank you for your purchase</p>
        </div>

        <div className="order-confirmation-content">
          {/* Order Number */}
          <div className="order-confirmation-section">
            <h3>Order Number</h3>
            <p className="order-confirmation-value"># {order.id.slice(-12).toUpperCase()}</p>
          </div>

          {/* Products */}
          <div className="order-confirmation-section">
            <h3>Products</h3>
            <div className="order-confirmation-items">
              {order.items.map((item, idx) => (
                <div key={idx} className="order-confirmation-item">
                  {item.image_url && (
                    <BufferedImage
                      src={item.image_url}
                      alt={item.title}
                      wrapperClassName="order-confirmation-item-thumb"
                      className="order-confirmation-item-image"
                    />
                  )}
                  <div className="order-confirmation-item-details">
                    <p className="order-confirmation-item-title">{item.title}</p>
                    <p className="order-confirmation-item-meta">
                      Quantity: {item.quantity}
                      {item.size ? ` • Size: ${item.size}` : ""}
                      {item.color ? ` • Color: ${item.color}` : ""}
                    </p>
                    <p className="order-confirmation-item-price">
                      ₹ {(item.subtotal || item.quantity * 1000).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="order-confirmation-section">
            <h3>Shipping Address</h3>
            <div className="order-confirmation-address">
              <p><strong>{order.shipping_address.full_name}</strong></p>
              <p>{order.shipping_address.address_line1}</p>
              {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
              <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.pincode}</p>
              <p>{order.shipping_address.country}</p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="order-confirmation-section">
            <h3>Contact Details</h3>
            <div className="order-confirmation-contact">
              <p>
                <strong>Phone:</strong> {order.shipping_address.phone}
              </p>
              <p>
                <strong>Email:</strong> {order.customer_email}
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="order-confirmation-section">
            <h3>Order Summary</h3>
            <div className="order-confirmation-summary">
              <div className="order-confirmation-summary-row">
                <span>Subtotal:</span>
                <span>₹ {Math.round(order.total * 0.95).toLocaleString("en-IN")}</span>
              </div>
              <div className="order-confirmation-summary-row">
                <span>Shipping:</span>
                <span>₹ 0</span>
              </div>
              <div className="order-confirmation-summary-row order-confirmation-total">
                <span>Total:</span>
                <span>₹ {Math.round(order.total).toLocaleString("en-IN")}</span>
              </div>
              <div className="order-confirmation-summary-row">
                <span>Payment Method:</span>
                <span>{order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}</span>
              </div>
            </div>
          </div>

          {/* Notes if any */}
          {order.notes && (
            <div className="order-confirmation-section">
              <h3>Special Instructions</h3>
              <p className="order-confirmation-notes">{order.notes}</p>
            </div>
          )}
        </div>

        <div className="order-confirmation-actions">
          <Link href="/collection" className="store-btn-primary">Continue Shopping</Link>
          {token && <Link href="/orders" className="store-btn-secondary">View My Orders</Link>}
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="store-loading-full"><div className="store-spinner" /></div>}>
      <OrderConfirmationContent />
    </Suspense>
  );
}
