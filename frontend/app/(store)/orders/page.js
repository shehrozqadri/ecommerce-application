"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchOrders } from "@/lib/api";
import { useUser } from "@/lib/userContext";
import BufferedImage from "@/components/BufferedImage";

const STATUS_COLOR = {
  pending: "store-status-pending",
  processing: "store-status-processing",
  shipped: "store-status-shipped",
  delivered: "store-status-delivered",
  cancelled: "store-status-cancelled",
};

function OrdersList() {
  const { token } = useUser();
  const searchParams = useSearchParams();
  const newOrderId = searchParams.get("new");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchOrders(token)
      .then(data => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (!token) return (
    <div className="store-empty">
      <span>📦</span>
      <p>Please <Link href="/login">sign in</Link> to view your orders.</p>
    </div>
  );

  if (loading) return <div className="store-loading-full"><div className="store-spinner" /></div>;

  return (
    <>
      {newOrderId && (
        <div className="store-alert store-alert-success store-order-success">
          <span>🎉</span> Your order has been placed successfully! Order ID: <strong>{newOrderId}</strong>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="store-empty">
          <span>📦</span>
          <p>You haven't placed any orders yet.</p>
          <Link href="/" className="store-btn-primary" style={{marginTop: "1.5rem"}}>Start Shopping</Link>
        </div>
      ) : (
        <div className="store-orders-list">
          {orders.map(order => (
            <div key={order.id} className={`store-order-card${order.id === newOrderId ? " store-order-new" : ""}`}>
              <div className="store-order-header">
                <div>
                  <p className="store-order-id">Order #{order.id.slice(-8).toUpperCase()}</p>
                  <p className="store-order-date">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="store-order-header-right">
                  <span className={`store-status-badge ${STATUS_COLOR[order.status] || ""}`}>{order.status}</span>
                  <p className="store-order-total">₹ {order.total.toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="store-order-items">
                {order.items.map((item, i) => (
                  <div key={i} className="store-order-item">
                    {item.image_url && (
                      <BufferedImage
                        src={item.image_url}
                        alt={item.title}
                        wrapperClassName="store-order-item-thumb"
                        className="store-order-item-image"
                      />
                    )}
                    <div>
                      <p className="store-order-item-title">{item.title}</p>
                      <p className="store-order-item-meta">
                        Qty {item.quantity}{item.size ? ` · ${item.size}` : ""}
                        {item.color ? ` · ${item.color}` : ""}
                      </p>
                    </div>
                    <p className="store-order-item-price">₹ {item.subtotal.toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>

              <div className="store-order-footer">
                <div className="store-order-addr">
                  <span>📍</span>
                  <span>{order.shipping_address.address_line1}, {order.shipping_address.city}, {order.shipping_address.state} — {order.shipping_address.pincode}</span>
                </div>
                <span className="store-order-payment">{order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <div className="store-page">
      <h1 className="store-page-title">My Orders</h1>
      <Suspense fallback={<div className="store-loading-full"><div className="store-spinner" /></div>}>
        <OrdersList />
      </Suspense>
    </div>
  );
}
