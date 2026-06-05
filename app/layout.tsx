import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stratum — Engine-as-a-Service",
  description: "Multi-tenant workflow engine showcase dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#080c14] text-slate-200 antialiased overflow-hidden h-screen">
        {children}
      </body>
    </html>
  );
}
