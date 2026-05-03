"use client";
import { UserProvider } from "@/lib/userContext";
import StoreTopBar from "@/components/StoreTopBar";

export default function StoreLayout({ children }) {
  return (
    <UserProvider>
      <StoreTopBar />
      <main className="store-main">{children}</main>
      <footer className="store-footer">
        <p>© 2026 Ruhab Studio · Crafted with care</p>
      </footer>
    </UserProvider>
  );
}
