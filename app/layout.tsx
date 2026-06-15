import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

/* ============================================================================
 * BROWSER TAB CUSTOMISATION
 * ----------------------------------------------------------------------------
 * Edit the three values below to change what shows in the browser tab.
 *
 *  tabTitle  – the text shown on the browser tab.
 *  tabIcon   – the little image (favicon) shown on the browser tab.
 *              1. Drop your image into the /public folder
 *                 (a square PNG, e.g. 512x512, looks best).
 *              2. Set tabIcon to "/your-file-name.png".
 *  tabDesc   – description used by search engines and link previews.
 * ========================================================================== */
const tabTitle = "ʙʟᴀᴢᴇxʏᴢ.ᴄᴏᴍ";
const tabIcon = "/tab-icon.svg";
const tabDesc = "Bio, as well as Photography and Code Portfolios";
/* ========================================================================== */

export const metadata: Metadata = {
  title: tabTitle,
  description: tabDesc,
  icons: {
    icon: tabIcon,
    shortcut: tabIcon,
    apple: tabIcon,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmMono.variable}>
      <body>{children}</body>
    </html>
  );
}
