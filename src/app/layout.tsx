import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QA Console · DDAI",
  description: "Resultados de pruebas del QA Lab — The QAlliance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
