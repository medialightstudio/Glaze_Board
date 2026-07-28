import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Glaze Board",
	description: "Glass shop management",
	manifest: "/manifest.webmanifest",
	appleWebApp: { capable: true, title: "Glaze Board" },
};

export const viewport: Viewport = {
	themeColor: "#1c1917",
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<link rel="apple-touch-icon" href="/icons/icon-192.png" />
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<PwaRegister />
				{children}
			</body>
		</html>
	);
}
