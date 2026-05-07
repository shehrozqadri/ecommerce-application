"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser } from "@/lib/api";
import { useUser } from "@/lib/userContext";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useUser();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginUser(form);
      signIn(data.access_token, data.user);
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="store-auth-page">
      <div className="store-auth-card">
        <Link href="/" className="store-auth-logo">Ruhab Studio</Link>
        <h1 className="store-auth-title">Welcome</h1>
        <p className="store-auth-sub">Sign in to continue shopping</p>

        {error && <div className="store-alert store-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="store-auth-form">
          <div className="store-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="store-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="store-btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="store-auth-switch">
          Don't have an account? <Link href="/register">Create one</Link>
        </p>
        <p className="store-auth-switch" style={{marginTop: "0.5rem"}}>
          <Link href="/admin/login" style={{fontSize: "0.75rem", opacity: 0.5}}>Admin login →</Link>
        </p>
      </div>
    </div>
  );
}
