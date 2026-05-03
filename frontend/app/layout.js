import "./globals.css";

export const metadata = {
  title: "Ruhab Studio",
  description: "Luxury ethnic wear — Ruhab Studio",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
