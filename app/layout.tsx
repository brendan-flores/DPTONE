import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CartProvider } from '@/context/CartContext'
import { AuthProvider } from "@/context/AuthContext"
import ConditionalHeader from "@/components/ConditionalHeader"
import ClientLayout from "./ClientLayout"

export const metadata: Metadata = {
  title: "DPT ONE",
}

const inter = Inter({ subsets: ["latin"] })


export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#101828]`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <CartProvider>
              <ConditionalHeader />
              <ClientLayout>
                {children}
              </ClientLayout>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
