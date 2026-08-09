import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beatrice · Cockpit de QA agéntico",
  description:
    "Beatrice convierte al QA humano en QA agéntico: dirige IA por cada fase del ciclo de calidad, con validación humana trazable en cada paso.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
