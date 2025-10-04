// app/layout.js
import "./globals.css";

export const metadata = {
  applicationName: "취향캠톡",
  title: {
    default: "취향캠톡",
    template: "취향캠톡",
  },
  description: "base for all apps",
  keywords: ["cam","date","video","chat","call","live","stream","broadcast","webcam","online","meeting","conference","virtual","room","party","hangout","talk","social","connect","share","fun"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "취향캠톡",
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "취향캠톡",
    title: {
      default: "취향캠톡",
      template: "취향캠톡",
    },
    description: "base for all apps",
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}