import "./globals.css";
import ConditionalBottomNav from "./components/ConditionalBottomNav";
import PwaRegister from "./components/PwaRegister";
import AppAlertHost from "./components/AppAlertHost";
import NotificationToastHost from "./components/NotificationToastHost";

export const metadata = {
  title: "يسلمو - توصيل الطلبات",
  description: "نوصلك كل ما تحتاجه من متاجرك المفضلة إلى باب منزلك بسرعة وأمان",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "يسلمو",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icons/favicon-32x32.png",
  },
};

export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning>
        <PwaRegister />
        <AppAlertHost />
        <NotificationToastHost />
        {children}
        <ConditionalBottomNav />
      </body>
    </html>
  );
}
