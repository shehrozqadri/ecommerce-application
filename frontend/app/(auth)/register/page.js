"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser, loginUser } from "@/lib/api";
import { useUser } from "@/lib/userContext";

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useUser();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await registerUser(form);
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
        <h1 className="store-auth-title">Create Account</h1>
        <p className="store-auth-sub">Join us for a luxurious shopping experience</p>

        {error && <div className="store-alert store-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="store-auth-form">
          <div className="store-field">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
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
              placeholder="At least 6 characters"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div className="store-field">
            <label>Phone <span className="store-optional">(optional)</span></label>
            <input
              type="tel"
              placeholder="+91 XXXXX XXXXX"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <button type="submit" className="store-btn-primary" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="store-auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
