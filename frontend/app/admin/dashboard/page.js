"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createAdmin,
  createProduct,
  deactivateAdmin,
  deleteAdmin,
  deleteProduct,
  fetchAdmins,
  fetchAdminOrders,
  fetchMe,
  fetchProducts,
  importProductImageFromGoogleDrive,
  TOKEN_KEY,
  uploadProductImages,
  updateAdmin,
  updateAdminOrderStatus,
  updateProduct,
} from "@/lib/api";

const emptyForm = {
  title: "",
  description: "",
  price: "",
  currency: "INR",
  category: "",
  subcategory: "",
  brand: "",
  stock: "0",
  imageItems: [],
  sizes: "",
  colors: "",
  tags: "",
  is_active: true,
};

const emptyAdminForm = {
  name: "",
  email: "",
  password: "",
  role: "admin",
  is_active: true,
};

function normalizeImageItem(image) {
  if (!image) return null;

  if (typeof image === "string") {
    return {
      url: image,
      public_id: "",
      width: null,
      height: null,
      format: null,
    };
  }

  if (typeof image === "object" && image.url) {
    return {
      url: image.url,
      public_id: image.public_id || "",
      width: image.width ?? null,
      height: image.height ?? null,
      format: image.format ?? null,
    };
  }

  return null;
}

function transformFormToPayload(form) {
  return {
    title: form.title,
    description: form.description,
    price: Number(form.price),
    currency: form.currency,
    category: form.category,
    subcategory: form.subcategory || null,
    brand: form.brand || null,
    stock: Number(form.stock),
    images: form.imageItems.map((image) => ({
      url: image.url,
      public_id: image.public_id || "",
      width: image.width,
      height: image.height,
      format: image.format,
    })),
    sizes: form.sizes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    colors: form.colors
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    tags: form.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    is_active: form.is_active,
  };
}

function transformProductToForm(product) {
  const normalizedImages = (product.images || [])
    .map((image) => normalizeImageItem(image))
    .filter(Boolean);

  return {
    title: product.title || "",
    description: product.description || "",
    price: String(product.price ?? ""),
    currency: product.currency || "INR",
    category: product.category || "",
    subcategory: product.subcategory || "",
    brand: product.brand || "",
    stock: String(product.stock ?? 0),
    imageItems: normalizedImages,
    sizes: (product.sizes || []).join(", "),
    colors: (product.colors || []).join(", "),
    tags: (product.tags || []).join(", "),
    is_active: Boolean(product.is_active),
  };
}

function formatRelativeDate(value) {
  if (!value) return "Unknown time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function paginateItems(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  return {
    pageItems: items.slice(startIndex, startIndex + pageSize),
    totalPages,
    safePage,
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [mounted, setMounted] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragOverUpload, setIsDragOverUpload] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState(null);
  const [googleDriveUrl, setGoogleDriveUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [adminError, setAdminError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [editingAdminId, setEditingAdminId] = useState("");
  const [adminFormData, setAdminFormData] = useState(emptyAdminForm);
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [productStockFilter, setProductStockFilter] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminRoleFilter, setAdminRoleFilter] = useState("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [adminPage, setAdminPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState("all");
  const [orderPage, setOrderPage] = useState(1);
  const [orderUpdatingId, setOrderUpdatingId] = useState("");
  const [orderError, setOrderError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { productId, title }
  const fileInputRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY) || "";
    setToken(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) return;

    async function hydrateDashboard() {
      setLoading(true);
      setError("");

      try {
        const adminData = await fetchMe(token);
        const requests = [fetchProducts(token), fetchAdminOrders(token)];
        if (adminData?.role === "super_admin") {
          requests.push(fetchAdmins(token));
        }

        const [productData, orderData, adminList = []] = await Promise.all(requests);
        setAdmin(adminData);
        setProducts(productData);
        setOrders(orderData);
        setAdmins(adminList);
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY);
        setError(err.message || "Session expired");
        router.replace("/admin/login");
      } finally {
        setLoading(false);
      }
    }

    hydrateDashboard();
  }, [token, router]);

  useEffect(() => {
    if (mounted && !token) {
      router.replace("/admin/login");
    }
  }, [mounted, token, router]);

  const totalInventory = useMemo(
    () => products.reduce((sum, item) => sum + (item.stock || 0), 0),
    [products]
  );

  const activeAdminsCount = useMemo(
    () => admins.filter((item) => item.is_active).length,
    [admins]
  );

  const inactiveProductsCount = useMemo(
    () => products.filter((item) => !item.is_active).length,
    [products]
  );

  const totalCatalogValue = useMemo(
    () => products.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.stock || 0)), 0),
    [products]
  );

  const recentActivity = useMemo(() => {
    const productEvents = products.map((item) => ({
      id: `product-${item.id}`,
      title: item.title,
      subtitle: `Product • ${item.is_active ? "Active" : "Inactive"}`,
      time: item.updated_at || item.created_at,
      type: "product",
    }));

    const adminEvents = admins.map((item) => ({
      id: `admin-${item.id}`,
      title: item.name,
      subtitle: `${item.role === "super_admin" ? "Super Admin" : "Admin"} • ${item.is_active ? "Active" : "Inactive"}`,
      time: item.updated_at || item.created_at,
      type: "admin",
    }));

    return [...productEvents, ...adminEvents]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }, [admins, products]);

  const filteredProducts = useMemo(() => {
    const searchQuery = normalizeSearchValue(productSearch);

    return products.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        [item.title, item.category, item.subcategory, item.brand, item.description]
          .filter(Boolean)
          .some((value) => normalizeSearchValue(value).includes(searchQuery));

      const matchesStatus =
        productStatusFilter === "all" ||
        (productStatusFilter === "active" && item.is_active) ||
        (productStatusFilter === "inactive" && !item.is_active);

      const stockValue = Number(item.stock || 0);
      const matchesStock =
        productStockFilter === "all" ||
        (productStockFilter === "in_stock" && stockValue > 0) ||
        (productStockFilter === "low_stock" && stockValue > 0 && stockValue < 5) ||
        (productStockFilter === "out_of_stock" && stockValue === 0);

      return matchesSearch && matchesStatus && matchesStock;
    });
  }, [productSearch, productStatusFilter, productStockFilter, products]);

  const productInsights = useMemo(() => {
    const lowStockCount = products.filter((item) => {
      const stock = Number(item.stock || 0);
      return stock > 0 && stock < 5;
    }).length;

    const outOfStockCount = products.filter((item) => Number(item.stock || 0) === 0).length;

    const activeProducts = products.filter((item) => item.is_active);
    const averagePrice =
      activeProducts.length > 0
        ? activeProducts.reduce((sum, item) => sum + Number(item.price || 0), 0) / activeProducts.length
        : 0;

    const categoryCounts = products.reduce((acc, item) => {
      const key = (item.category || "Uncategorized").trim();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      lowStockCount,
      outOfStockCount,
      averagePrice,
      topCategories,
    };
  }, [products]);

  const filteredAdmins = useMemo(() => {
    const searchQuery = normalizeSearchValue(adminSearch);

    return admins.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        [item.name, item.email, item.role]
          .filter(Boolean)
          .some((value) => normalizeSearchValue(value).includes(searchQuery));

      const matchesRole = adminRoleFilter === "all" || item.role === adminRoleFilter;
      const matchesStatus =
        adminStatusFilter === "all" ||
        (adminStatusFilter === "active" && item.is_active) ||
        (adminStatusFilter === "inactive" && !item.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [adminRoleFilter, adminSearch, adminStatusFilter, admins]);

  const filteredOrders = useMemo(() => {
    const searchQuery = normalizeSearchValue(orderSearch);

    return orders.filter((item) => {
      const orderId = String(item.id || "");
      const customerName = item.shipping_address?.full_name || "";
      const customerEmail = item.customer_email || "";
      const customerPhone = item.shipping_address?.phone || "";

      const matchesSearch =
        !searchQuery ||
        [orderId, customerName, customerEmail, customerPhone]
          .filter(Boolean)
          .some((value) => normalizeSearchValue(value).includes(searchQuery));

      const matchesStatus = orderStatusFilter === "all" || item.status === orderStatusFilter;
      const matchesPayment =
        orderPaymentFilter === "all" || item.payment_method === orderPaymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orderPaymentFilter, orderSearch, orderStatusFilter, orders]);

  const {
    pageItems: paginatedProducts,
    totalPages: productTotalPages,
    safePage: safeProductPage,
  } = useMemo(() => paginateItems(filteredProducts, productPage, 9), [filteredProducts, productPage]);

  const {
    pageItems: paginatedAdmins,
    totalPages: adminTotalPages,
    safePage: safeAdminPage,
  } = useMemo(() => paginateItems(filteredAdmins, adminPage, 6), [filteredAdmins, adminPage]);

  const {
    pageItems: paginatedOrders,
    totalPages: orderTotalPages,
    safePage: safeOrderPage,
  } = useMemo(() => paginateItems(filteredOrders, orderPage, 8), [filteredOrders, orderPage]);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId("");
  };

  const resetAdminForm = () => {
    setAdminFormData(emptyAdminForm);
    setEditingAdminId("");
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAdminFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setAdminFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = transformFormToPayload(formData);
      if (editingId) {
        const updated = await updateProduct(token, editingId, payload);
        setProducts((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
        setMessage("Product updated successfully.");
      } else {
        const created = await createProduct(token, payload);
        setProducts((prev) => [created, ...prev]);
        setMessage("Product created successfully.");
      }
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleImageFilesUpload = async (files) => {
    if (!files?.length || !token) return;

    setUploadingImage(true);
    setError("");
    setMessage("");

    try {
      const uploadedItems = await uploadProductImages(token, files);
      setFormData((prev) => ({
        ...prev,
        imageItems: [...prev.imageItems, ...uploadedItems],
      }));
      setMessage(`${uploadedItems.length} image(s) uploaded successfully.`);
    } catch (err) {
      setError(err.message || "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (event) => {
    const selectedFiles = event.target.files;
    await handleImageFilesUpload(selectedFiles);
    event.target.value = "";
  };

  const handleGoogleDriveImport = async () => {
    if (!googleDriveUrl.trim() || !token) return;

    setUploadingImage(true);
    setError("");
    setMessage("");

    try {
      const uploadedItem = await importProductImageFromGoogleDrive(token, googleDriveUrl.trim());
      setFormData((prev) => ({
        ...prev,
        imageItems: [...prev.imageItems, uploadedItem],
      }));
      setGoogleDriveUrl("");
      setMessage("Image imported from Google Drive successfully.");
    } catch (err) {
      setError(err.message || "Google Drive import failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadZoneDragOver = (event) => {
    event.preventDefault();
    setIsDragOverUpload(true);
  };

  const handleUploadZoneDragLeave = (event) => {
    event.preventDefault();
    setIsDragOverUpload(false);
  };

  const handleUploadZoneDrop = async (event) => {
    event.preventDefault();
    setIsDragOverUpload(false);
    const droppedFiles = event.dataTransfer?.files;
    await handleImageFilesUpload(droppedFiles);
  };

  const handleRemoveImage = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      imageItems: prev.imageItems.filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleSetPrimaryImage = (indexToPromote) => {
    setFormData((prev) => {
      if (indexToPromote <= 0 || indexToPromote >= prev.imageItems.length) return prev;

      const next = [...prev.imageItems];
      const [promoted] = next.splice(indexToPromote, 1);
      next.unshift(promoted);
      return {
        ...prev,
        imageItems: next,
      };
    });
  };

  const handleImageDragStart = (index) => {
    setDraggedImageIndex(index);
  };

  const handleImageDragOver = (event, index) => {
    event.preventDefault();
    setDragOverImageIndex(index);
  };

  const handleImageDrop = (targetIndex) => {
    setFormData((prev) => {
      if (
        draggedImageIndex === null ||
        draggedImageIndex === targetIndex ||
        draggedImageIndex < 0 ||
        targetIndex < 0
      ) {
        return prev;
      }

      const next = [...prev.imageItems];
      const [moved] = next.splice(draggedImageIndex, 1);
      next.splice(targetIndex, 0, moved);
      return {
        ...prev,
        imageItems: next,
      };
    });
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setFormData(transformProductToForm(product));
    setMessage("");
    setError("");
  };

  const handleAdminSave = async (event) => {
    event.preventDefault();
    if (!token) return;

    setAdminSaving(true);
    setAdminError("");
    setAdminMessage("");

    try {
      const payload = {
        name: adminFormData.name,
        email: adminFormData.email,
        role: adminFormData.role,
        is_active: adminFormData.is_active,
      };

      if (adminFormData.password) {
        payload.password = adminFormData.password;
      }

      if (editingAdminId) {
        const updated = await updateAdmin(token, editingAdminId, payload);
        setAdmins((prev) => prev.map((item) => (item.id === editingAdminId ? updated : item)));
        if (admin?.id === editingAdminId) {
          setAdmin((prev) => (prev ? { ...prev, ...updated } : prev));
        }
        setAdminMessage("Admin updated successfully.");
      } else {
        const created = await createAdmin(token, payload);
        setAdmins((prev) => [created, ...prev]);
        setAdminMessage("Admin created successfully.");
      }

      resetAdminForm();
    } catch (err) {
      setAdminError(err.message || "Failed to save admin");
    } finally {
      setAdminSaving(false);
    }
  };

  const handleAdminEdit = (item) => {
    setEditingAdminId(item.id);
    setAdminFormData({
      name: item.name,
      email: item.email,
      password: "",
      role: item.role,
      is_active: item.is_active,
    });
    setAdminError("");
    setAdminMessage("");
  };

  const handleAdminDeactivate = async (adminId) => {
    if (!token) return;

    setAdminError("");
    setAdminMessage("");

    try {
      const updated = await deactivateAdmin(token, adminId);
      setAdmins((prev) => prev.map((item) => (item.id === adminId ? updated : item)));
      if (admin?.id === adminId) {
        setAdmin((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      if (editingAdminId === adminId) {
        resetAdminForm();
      }
      setAdminMessage("Admin deactivated.");
    } catch (err) {
      setAdminError(err.message || "Failed to deactivate admin");
    }
  };

  const handleAdminDelete = async (adminId) => {
    if (!token) return;
    const confirmed = window.confirm("Delete this admin?");
    if (!confirmed) return;

    setAdminError("");
    setAdminMessage("");

    try {
      await deleteAdmin(token, adminId);
      setAdmins((prev) => prev.filter((item) => item.id !== adminId));
      if (editingAdminId === adminId) {
        resetAdminForm();
      }
      setAdminMessage("Admin deleted.");
    } catch (err) {
      setAdminError(err.message || "Failed to delete admin");
    }
  };

  const handleDelete = (productId) => {
    if (!token) return;
    const product = products.find((p) => p.id === productId);
    setDeleteConfirm({ productId, title: product?.title || "this product" });
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirm) return;
    const { productId } = deleteConfirm;
    setDeleteConfirm(null);
    setError("");
    setMessage("");

    try {
      await deleteProduct(token, productId);
      setProducts((prev) => prev.filter((item) => item.id !== productId));
      if (editingId === productId) resetForm();
      setMessage("Product deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete product");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    router.replace("/admin/login");
  };

  const handleNavigate = (tabName) => {
    setActiveTab(tabName);
    setIsMobileSidebarOpen(false);
  };

  const resetProductFilters = () => {
    setProductSearch("");
    setProductStatusFilter("all");
    setProductStockFilter("all");
    setProductPage(1);
  };

  const resetAdminFilters = () => {
    setAdminSearch("");
    setAdminRoleFilter("all");
    setAdminStatusFilter("all");
    setAdminPage(1);
  };

  const resetOrderFilters = () => {
    setOrderSearch("");
    setOrderStatusFilter("all");
    setOrderPaymentFilter("all");
    setOrderPage(1);
  };

  const handleOrderStatusChange = async (orderId, nextStatus) => {
    if (!token || !orderId || !nextStatus) return;

    setOrderUpdatingId(orderId);
    setOrderError("");
    setOrderMessage("");

    try {
      const updated = await updateAdminOrderStatus(token, orderId, nextStatus);
      setOrders((prev) => prev.map((item) => (item.id === orderId ? updated : item)));
      setOrderMessage(`Order ${orderId.slice(0, 8)} status updated to ${nextStatus}.`);
    } catch (err) {
      setOrderError(err.message || "Failed to update order status");
    } finally {
      setOrderUpdatingId("");
    }
  };

  const isSuperAdmin = admin?.role === "super_admin";

  if (!mounted || loading) {
    return <main className="page-loading">Loading admin dashboard...</main>;
  }

  return (
    <main className="admin-shell">
      <aside className={`admin-sidebar ${isMobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="admin-sidebar-top">
          <div className="sidebar-logo-block">
            <div className="sidebar-logo-mark">RS</div>
            <div>
              <p className="sidebar-logo-title">Ruhab Studio</p>
              <p className="sidebar-logo-subtitle">Premium Commerce Admin</p>
            </div>
          </div>
          <h1 className="sidebar-title">Control Center</h1>
          <p className="dashboard-subtext">
            Signed in as <strong>{admin?.name || admin?.email}</strong>
          </p>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-section-title">Operations</p>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => handleNavigate("overview")}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 13.5 12 5l8 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 11.5V19h10v-7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sidebar-nav-copy">
              <span className="sidebar-nav-label">Overview</span>
              <span className="sidebar-nav-subtitle">Snapshot, activity, quick insights</span>
            </span>
            <span className="sidebar-nav-count">{recentActivity.length}</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === "products" ? "active" : ""}`}
            onClick={() => handleNavigate("products")}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
                <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-nav-copy">
              <span className="sidebar-nav-label">Products</span>
              <span className="sidebar-nav-subtitle">Catalog, media, pricing, inventory</span>
            </span>
            <span className="sidebar-nav-count">{products.length}</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => handleNavigate("orders")}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M7 4h10l1 3h2v2h-1l-1 9H6L5 9H4V7h2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12h6M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-nav-copy">
              <span className="sidebar-nav-label">Orders</span>
              <span className="sidebar-nav-subtitle">Track and update customer order status</span>
            </span>
            <span className="sidebar-nav-count">{orders.length}</span>
          </button>
          {isSuperAdmin ? (
            <>
              <p className="sidebar-section-title">Access Control</p>
              <button
                type="button"
                className={`sidebar-nav-btn ${activeTab === "admins" ? "active" : ""}`}
                onClick={() => handleNavigate("admins")}
              >
                <span className="sidebar-nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12zm-6 7a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M18.5 8.5h4m-2-2v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="sidebar-nav-copy">
                  <span className="sidebar-nav-label">Admin Management</span>
                  <span className="sidebar-nav-subtitle">Roles, staff access, super admin control</span>
                </span>
                <span className="sidebar-nav-count">{activeAdminsCount}</span>
              </button>
            </>
          ) : null}
        </nav>

        <div className="sidebar-metrics">
          <div className="metric-card sidebar-metric-card">
            <span>Total Products</span>
            <strong>{products.length}</strong>
          </div>
          <div className="metric-card sidebar-metric-card">
            <span>Total Inventory</span>
            <strong>{totalInventory}</strong>
          </div>
          {isSuperAdmin ? (
            <div className="metric-card sidebar-metric-card">
              <span>Active Admins</span>
              <strong>{activeAdminsCount}</strong>
            </div>
          ) : null}
        </div>

        <button onClick={handleLogout} className="secondary-btn sidebar-logout-btn" type="button">
          Logout
        </button>
      </aside>

      <section className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <button
              type="button"
              className="mobile-sidebar-toggle"
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            >
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                </svg>
              </span>
              Menu
            </button>
            <h1>
              {activeTab === "admins"
                ? "Admin Management"
                : activeTab === "orders"
                  ? "Order Management"
                : activeTab === "products"
                  ? "Product Management"
                  : "Dashboard Overview"}
            </h1>
            <p className="dashboard-subtext">
              {activeTab === "overview"
                ? "Track your catalog health, team activity, and operational readiness from one place."
                : activeTab === "admins"
                ? "Manage access, roles, and operational control for your admin team."
                : activeTab === "orders"
                ? "Track incoming orders, verify payment mode, and update fulfillment status."
                : "Manage products, pricing, inventory, and merchandising assets."}
            </p>
          </div>
        </header>

        {activeTab === "overview" ? (
          <section className="overview-stack">
            <div className="overview-cards-grid">
              <article className="overview-card overview-card-highlight">
                <span className="overview-card-label">Catalog Value</span>
                <strong>₹{Math.round(totalCatalogValue).toLocaleString("en-IN")}</strong>
                <p className="muted-text">Estimated inventory value across all listed products.</p>
              </article>
              <article className="overview-card">
                <span className="overview-card-label">Active Products</span>
                <strong>{products.filter((item) => item.is_active).length}</strong>
                <p className="muted-text">Currently visible and ready for sale.</p>
              </article>
              <article className="overview-card">
                <span className="overview-card-label">Inactive Products</span>
                <strong>{inactiveProductsCount}</strong>
                <p className="muted-text">Draft, hidden, or paused catalog items.</p>
              </article>
              <article className="overview-card">
                <span className="overview-card-label">Admin Team</span>
                <strong>{activeAdminsCount || 1}</strong>
                <p className="muted-text">Active admin operators with dashboard access.</p>
              </article>
            </div>

            <section className="dashboard-grid overview-grid">
              <article className="panel">
                <div className="panel-header-row">
                  <div>
                    <h2>Quick Snapshot</h2>
                    <p className="muted-text">Fast operational stats for Ruhab Studio.</p>
                  </div>
                </div>

                <div className="snapshot-list">
                  <div className="snapshot-item">
                    <span>Products with images</span>
                    <strong>{products.filter((item) => (item.images || []).length > 0).length}</strong>
                  </div>
                  <div className="snapshot-item">
                    <span>Products without images</span>
                    <strong>{products.filter((item) => !(item.images || []).length).length}</strong>
                  </div>
                  <div className="snapshot-item">
                    <span>Low stock items (&lt; 5)</span>
                    <strong>{products.filter((item) => Number(item.stock || 0) < 5).length}</strong>
                  </div>
                  <div className="snapshot-item">
                    <span>Super admins</span>
                    <strong>{admins.filter((item) => item.role === "super_admin" && item.is_active).length || 1}</strong>
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header-row">
                  <div>
                    <h2>Recent Activity</h2>
                    <p className="muted-text">Latest product and admin changes.</p>
                  </div>
                </div>

                <div className="activity-list">
                  {recentActivity.length === 0 ? (
                    <p className="muted-text">No recent activity yet.</p>
                  ) : (
                    recentActivity.map((item) => (
                      <div className="activity-item" key={item.id}>
                        <span className={`activity-dot ${item.type}`}></span>
                        <div className="activity-copy">
                          <strong>{item.title}</strong>
                          <p>{item.subtitle}</p>
                        </div>
                        <span className="activity-time">{formatRelativeDate(item.time)}</span>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          </section>
        ) : null}

        {activeTab === "products" ? (
          <section className="dashboard-grid">
          <article className="panel">
          <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>
          <form onSubmit={handleSaveProduct} className="product-form">
            <div className="form-grid">
              <label>
                Title
                <input name="title" value={formData.title} onChange={handleFormChange} required />
              </label>
              <label>
                Category
                <input
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  required
                />
              </label>
              <label>
                Subcategory
                <input
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleFormChange}
                />
              </label>
              <label>
                Brand
                <input name="brand" value={formData.brand} onChange={handleFormChange} />
              </label>
              <label>
                Price
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  required
                />
              </label>
              <label>
                Currency
                <input
                  name="currency"
                  value={formData.currency}
                  onChange={handleFormChange}
                  maxLength={3}
                  required
                />
              </label>
              <label>
                Stock
                <input
                  type="number"
                  min="0"
                  name="stock"
                  value={formData.stock}
                  onChange={handleFormChange}
                  required
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleFormChange}
                />
                Product is active
              </label>
            </div>

            <label>
              Description
              <textarea
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleFormChange}
                required
              />
            </label>

            <div className="upload-row">
              <div
                className={`upload-dropzone ${isDragOverUpload ? "drag-over" : ""}`}
                onDragOver={handleUploadZoneDragOver}
                onDragLeave={handleUploadZoneDragLeave}
                onDrop={handleUploadZoneDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <p className="upload-dropzone-title">Drag & drop images here</p>
                <p className="muted-text">or click to browse from your computer</p>
              </div>

              <label className="file-upload-label">
                Upload Product Images
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
              </label>
              <span className="muted-text">
                {uploadingImage
                  ? "Uploading to Cloudinary..."
                  : "You can select multiple images in one go."}
              </span>

              <div className="google-drive-import-row">
                <label>
                  Import from Google Drive
                  <input
                    type="url"
                    placeholder="Paste Google Drive share link"
                    value={googleDriveUrl}
                    onChange={(event) => setGoogleDriveUrl(event.target.value)}
                    disabled={uploadingImage}
                  />
                </label>
                <button
                  type="button"
                  className="secondary-btn google-drive-import-btn"
                  onClick={handleGoogleDriveImport}
                  disabled={uploadingImage || !googleDriveUrl.trim()}
                >
                  Import Link
                </button>
              </div>
              <span className="muted-text">
                Paste a public Google Drive file link and it will be imported into Cloudinary.
              </span>

              {formData.imageItems.length > 0 ? (
                <div className="image-preview-grid">
                  {formData.imageItems.map((image, index) => (
                    <div
                      className={`image-preview-card ${draggedImageIndex === index ? "dragging" : ""} ${
                        dragOverImageIndex === index && draggedImageIndex !== index ? "drop-target" : ""
                      }`}
                      key={`${image.public_id || image.url}-${index}`}
                      draggable
                      onDragStart={() => handleImageDragStart(index)}
                      onDragOver={(event) => handleImageDragOver(event, index)}
                      onDrop={() => handleImageDrop(index)}
                      onDragEnd={handleImageDragEnd}
                    >
                      <div className="image-card-topbar">
                        <span className="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <circle cx="6" cy="5" r="1.4" />
                            <circle cx="6" cy="10" r="1.4" />
                            <circle cx="6" cy="15" r="1.4" />
                            <circle cx="14" cy="5" r="1.4" />
                            <circle cx="14" cy="10" r="1.4" />
                            <circle cx="14" cy="15" r="1.4" />
                          </svg>
                        </span>
                        {index === 0 ? <span className="primary-badge">Primary</span> : null}
                      </div>
                      <Image
                        src={image.url}
                        alt={`Product image ${index + 1}`}
                        className="image-preview"
                        width={160}
                        height={100}
                        unoptimized
                      />
                      <button
                        type="button"
                        className="secondary-btn image-action-btn"
                        onClick={() => handleSetPrimaryImage(index)}
                        disabled={index === 0}
                      >
                        {index === 0 ? "Primary Image" : "Set as Primary"}
                      </button>
                      <button
                        type="button"
                        className="danger-btn image-remove-btn"
                        onClick={() => handleRemoveImage(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {formData.imageItems.length > 1 ? (
                <span className="muted-text">Tip: drag thumbnails to reorder. First image is primary.</span>
              ) : null}
            </div>

            <div className="form-grid">
              <label>
                Sizes (comma separated)
                <input name="sizes" value={formData.sizes} onChange={handleFormChange} />
              </label>
              <label>
                Colors (comma separated)
                <input name="colors" value={formData.colors} onChange={handleFormChange} />
              </label>
              <label>
                Tags (comma separated)
                <input name="tags" value={formData.tags} onChange={handleFormChange} />
              </label>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}

            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Product" : "Create Product"}
              </button>
              {editingId ? (
                <button type="button" className="secondary-btn" onClick={resetForm}>
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
          </article>

          <article className="panel product-list-panel">
            <h2>Products</h2>
            <div className="list-toolbar">
              <input
                type="search"
                placeholder="Search products by title, category, brand..."
                value={productSearch}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setProductPage(1);
                }}
              />
              <select
                value={productStatusFilter}
                onChange={(event) => {
                  setProductStatusFilter(event.target.value);
                  setProductPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={productStockFilter}
                onChange={(event) => {
                  setProductStockFilter(event.target.value);
                  setProductPage(1);
                }}
              >
                <option value="all">All Stock</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
              <button type="button" className="secondary-btn toolbar-btn" onClick={resetProductFilters}>
                Reset
              </button>
            </div>
            <div className="list-summary-row">
              <p className="muted-text">
                Showing {paginatedProducts.length} of {filteredProducts.length} matching products
              </p>
            </div>
            <div className="products-list">
              {filteredProducts.length === 0 ? (
                <p className="muted-text">No products yet. Create your first one.</p>
              ) : (
                paginatedProducts.map((product) => (
                  <div className="product-item" key={product.id}>
                    <div className="product-item-main">
                      <div className="product-thumb-wrap">
                        {product.images?.[0]?.url ? (
                          <Image
                            src={product.images[0].url}
                            alt={product.title}
                            className="product-thumb"
                            width={72}
                            height={72}
                            unoptimized
                          />
                        ) : (
                          <div className="product-thumb-placeholder" aria-hidden="true">
                            🧵
                          </div>
                        )}
                      </div>
                      <div>
                        <h3>{product.title}</h3>
                        <p>
                          {product.category}
                          {product.subcategory ? ` • ${product.subcategory}` : ""}
                        </p>
                        <p>
                          ₹{product.price} • Stock: {product.stock}
                        </p>
                        <small>{product.is_active ? "Active" : "Inactive"}</small>
                      </div>
                    </div>
                    <div className="product-actions">
                      <button type="button" className="secondary-btn" onClick={() => handleEdit(product)}>
                        Edit
                      </button>
                      <button type="button" className="danger-btn" onClick={() => handleDelete(product.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {filteredProducts.length > 0 ? (
              <div className="pagination-row">
                <button
                  type="button"
                  className="secondary-btn toolbar-btn"
                  disabled={safeProductPage <= 1}
                  onClick={() => setProductPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <span className="muted-text">
                  Page {safeProductPage} of {productTotalPages}
                </span>
                <button
                  type="button"
                  className="secondary-btn toolbar-btn"
                  disabled={safeProductPage >= productTotalPages}
                  onClick={() => setProductPage((prev) => Math.min(productTotalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}

            <div className="product-insights">
              <div className="product-insights-header">
                <h3>Catalog Insights</h3>
                <p className="muted-text">Quick summary for planning and restocking.</p>
              </div>

              <div className="product-insights-grid">
                <div className="product-insight-card">
                  <span>Total inventory</span>
                  <strong>{totalInventory}</strong>
                </div>
                <div className="product-insight-card">
                  <span>Low stock (&lt; 5)</span>
                  <strong>{productInsights.lowStockCount}</strong>
                </div>
                <div className="product-insight-card">
                  <span>Out of stock</span>
                  <strong>{productInsights.outOfStockCount}</strong>
                </div>
                <div className="product-insight-card">
                  <span>Avg active price</span>
                  <strong>₹{Math.round(productInsights.averagePrice)}</strong>
                </div>
              </div>

              <div className="product-insight-categories">
                <span className="muted-text">Top categories:</span>
                {productInsights.topCategories.length > 0 ? (
                  <ul>
                    {productInsights.topCategories.map(([name, count]) => (
                      <li key={name}>
                        <span>{name}</span>
                        <strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-text">No categories yet.</p>
                )}
              </div>
            </div>
          </article>
          </section>
        ) : null}

        {activeTab === "orders" ? (
          <section className="dashboard-grid admin-grid">
            <article className="panel">
              <h2>Order Operations</h2>
              <div className="snapshot-list">
                <div className="snapshot-item">
                  <span>Total orders</span>
                  <strong>{orders.length}</strong>
                </div>
                <div className="snapshot-item">
                  <span>Pending</span>
                  <strong>{orders.filter((item) => item.status === "pending").length}</strong>
                </div>
                <div className="snapshot-item">
                  <span>Processing / Shipped</span>
                  <strong>
                    {
                      orders.filter((item) => item.status === "processing" || item.status === "shipped")
                        .length
                    }
                  </strong>
                </div>
                <div className="snapshot-item">
                  <span>Delivered</span>
                  <strong>{orders.filter((item) => item.status === "delivered").length}</strong>
                </div>
                <div className="snapshot-item">
                  <span>Cancelled</span>
                  <strong>{orders.filter((item) => item.status === "cancelled").length}</strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <h2>Orders</h2>

              <div className="list-toolbar">
                <input
                  type="search"
                  placeholder="Search by order id, customer, email, phone..."
                  value={orderSearch}
                  onChange={(event) => {
                    setOrderSearch(event.target.value);
                    setOrderPage(1);
                  }}
                />
                <select
                  value={orderStatusFilter}
                  onChange={(event) => {
                    setOrderStatusFilter(event.target.value);
                    setOrderPage(1);
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={orderPaymentFilter}
                  onChange={(event) => {
                    setOrderPaymentFilter(event.target.value);
                    setOrderPage(1);
                  }}
                >
                  <option value="all">All Payment</option>
                  <option value="cod">Cash on Delivery</option>
                  <option value="prepaid">Prepaid</option>
                </select>
                <button type="button" className="secondary-btn toolbar-btn" onClick={resetOrderFilters}>
                  Reset
                </button>
              </div>

              <div className="list-summary-row">
                <p className="muted-text">
                  Showing {paginatedOrders.length} of {filteredOrders.length} matching orders
                </p>
              </div>

              {orderError ? <p className="error-text">{orderError}</p> : null}
              {orderMessage ? <p className="success-text">{orderMessage}</p> : null}

              <div className="products-list admin-list">
                {filteredOrders.length === 0 ? (
                  <p className="muted-text">No orders found.</p>
                ) : (
                  paginatedOrders.map((item) => (
                    <div className="product-item admin-item" key={item.id}>
                      <div>
                        <h3>Order #{item.id.slice(-8).toUpperCase()}</h3>
                        <p>
                          {(item.shipping_address?.full_name || "Guest Customer")}
                          {item.shipping_address?.phone ? ` • ${item.shipping_address.phone}` : ""}
                        </p>
                        <p>
                          {item.customer_email}
                        </p>
                        <p>
                          ₹{Math.round(Number(item.total || 0)).toLocaleString("en-IN")} • {item.items?.length || 0} item(s)
                        </p>
                        <small>
                          {item.payment_method === "cod" ? "Cash on Delivery" : "Prepaid"} • {new Date(item.created_at).toLocaleDateString("en-IN")}
                        </small>

                        <div className="admin-order-details">
                          <div className="admin-order-line-items">
                            <strong>Products</strong>
                            <ul>
                              {(item.items || []).map((lineItem, idx) => (
                                <li key={`${lineItem.product_id}-${idx}`} className="admin-order-line">
                                  <Link
                                    href={`/products/${lineItem.product_id}`}
                                    className="admin-order-product-link"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {lineItem.title}
                                  </Link>
                                  <span>
                                    Qty {lineItem.quantity}
                                    {lineItem.size ? ` • Size ${lineItem.size}` : ""}
                                    {lineItem.color ? ` • ${lineItem.color}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="admin-order-meta">
                            <strong>Shipping</strong>
                            <p className="admin-order-address">
                              {item.shipping_address?.address_line1}
                              {item.shipping_address?.address_line2 ? `, ${item.shipping_address.address_line2}` : ""}, {item.shipping_address?.city}, {item.shipping_address?.state} - {item.shipping_address?.pincode}
                              {item.shipping_address?.country ? `, ${item.shipping_address.country}` : ""}
                            </p>
                            <p>
                              Contact: {item.shipping_address?.phone || "N/A"}
                              {item.customer_email ? ` • ${item.customer_email}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="product-actions admin-actions">
                        <span className={`order-status-badge status-${item.status}`}>{item.status}</span>
                        <select
                          value={item.status}
                          onChange={(event) => handleOrderStatusChange(item.id, event.target.value)}
                          disabled={orderUpdatingId === item.id}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {filteredOrders.length > 0 ? (
                <div className="pagination-row">
                  <button
                    type="button"
                    className="secondary-btn toolbar-btn"
                    disabled={safeOrderPage <= 1}
                    onClick={() => setOrderPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </button>
                  <span className="muted-text">
                    Page {safeOrderPage} of {orderTotalPages}
                  </span>
                  <button
                    type="button"
                    className="secondary-btn toolbar-btn"
                    disabled={safeOrderPage >= orderTotalPages}
                    onClick={() => setOrderPage((prev) => Math.min(orderTotalPages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}

        {isSuperAdmin && activeTab === "admins" ? (
          <section className="dashboard-grid admin-grid">
          <article className="panel">
            <h2>{editingAdminId ? "Edit Admin" : "Add Admin"}</h2>
            <form onSubmit={handleAdminSave} className="product-form">
              <div className="form-grid">
                <label>
                  Name
                  <input
                    name="name"
                    value={adminFormData.name}
                    onChange={handleAdminFormChange}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    value={adminFormData.email}
                    onChange={handleAdminFormChange}
                    required
                  />
                </label>
                <label>
                  Password {editingAdminId ? "(leave blank to keep current)" : ""}
                  <input
                    type="password"
                    name="password"
                    value={adminFormData.password}
                    onChange={handleAdminFormChange}
                    required={!editingAdminId}
                  />
                </label>
                <label>
                  Role
                  <select name="role" value={adminFormData.role} onChange={handleAdminFormChange}>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={adminFormData.is_active}
                    onChange={handleAdminFormChange}
                  />
                  Admin is active
                </label>
              </div>

              {adminError ? <p className="error-text">{adminError}</p> : null}
              {adminMessage ? <p className="success-text">{adminMessage}</p> : null}

              <div className="form-actions">
                <button type="submit" disabled={adminSaving}>
                  {adminSaving ? "Saving..." : editingAdminId ? "Update Admin" : "Create Admin"}
                </button>
                {editingAdminId ? (
                  <button type="button" className="secondary-btn" onClick={resetAdminForm}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>
          </article>

          <article className="panel">
            <h2>Admin Management</h2>
            <div className="list-toolbar">
              <input
                type="search"
                placeholder="Search admins by name, email, role..."
                value={adminSearch}
                onChange={(event) => {
                  setAdminSearch(event.target.value);
                  setAdminPage(1);
                }}
              />
              <select
                value={adminRoleFilter}
                onChange={(event) => {
                  setAdminRoleFilter(event.target.value);
                  setAdminPage(1);
                }}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <select
                value={adminStatusFilter}
                onChange={(event) => {
                  setAdminStatusFilter(event.target.value);
                  setAdminPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button type="button" className="secondary-btn toolbar-btn" onClick={resetAdminFilters}>
                Reset
              </button>
            </div>
            <div className="list-summary-row">
              <p className="muted-text">
                Showing {paginatedAdmins.length} of {filteredAdmins.length} matching admins
              </p>
            </div>
            <div className="products-list admin-list">
              {filteredAdmins.length === 0 ? (
                <p className="muted-text">No admins found.</p>
              ) : (
                paginatedAdmins.map((item) => (
                  <div className="product-item admin-item" key={item.id}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.email}</p>
                      <p>
                        {item.role === "super_admin" ? "Super Admin" : "Admin"} • {item.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div className="product-actions admin-actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleAdminEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleAdminDeactivate(item.id)}
                        disabled={!item.is_active || item.id === admin?.id}
                      >
                        Deactivate
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => handleAdminDelete(item.id)}
                        disabled={item.id === admin?.id}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {filteredAdmins.length > 0 ? (
              <div className="pagination-row">
                <button
                  type="button"
                  className="secondary-btn toolbar-btn"
                  disabled={safeAdminPage <= 1}
                  onClick={() => setAdminPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <span className="muted-text">
                  Page {safeAdminPage} of {adminTotalPages}
                </span>
                <button
                  type="button"
                  className="secondary-btn toolbar-btn"
                  disabled={safeAdminPage >= adminTotalPages}
                  onClick={() => setAdminPage((prev) => Math.min(adminTotalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </article>
          </section>
        ) : null}
      </section>

      {deleteConfirm ? (
        <div className="admin-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Product</h3>
            <p>Are you sure you want to delete <strong>&ldquo;{deleteConfirm.title}&rdquo;</strong>? This action cannot be undone.</p>
            <div className="admin-modal-actions">
              <button className="secondary-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="danger-btn" onClick={confirmDeleteProduct}>Yes, Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
