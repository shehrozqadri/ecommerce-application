"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { loginAdmin, TOKEN_KEY } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "admin@ruhabstudio.com",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginAdmin(formData);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-badge">Ruhab Studio • Admin</p>
        <h1>Welcome back</h1>
        <p className="auth-subtext">Sign in to manage products, pricing, and inventory.</p>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          <label>
            Email
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="off"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="off"
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
