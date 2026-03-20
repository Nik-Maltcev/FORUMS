import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <nav className="border-b bg-background">
          <div className="mx-auto max-w-4xl px-6 md:px-10 flex gap-6 h-12 items-center">
            <a href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Проверка активности
            </a>
            <a href="/categorize" className="text-sm font-medium hover:text-primary transition-colors">
              Категоризация
            </a>
            <a href="/activity" className="text-sm font-medium hover:text-primary transition-colors">
              Целостность
            </a>
          </div>
        </nav>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
