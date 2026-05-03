"use client";
import StorePage from "./(store)/page";
import { UserProvider } from "@/lib/userContext";
import StoreTopBar from "@/components/StoreTopBar";

export default function RootStorePage() {
	return (
		<UserProvider>
			<StoreTopBar />
			<main className="store-main">
				<StorePage />
			</main>
			<footer className="store-footer">
				<p>© 2026 Ruhab Studio · Crafted with care</p>
			</footer>
		</UserProvider>
	);
}
