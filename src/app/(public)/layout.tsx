import type { Metadata, Viewport } from 'next';
import { inter, kondolar } from '../../lib/fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default:  'CoffeeBay Lucky Cup — Try Your Luck',
    template: '%s | CoffeeBay Lucky Cup',
  },
  description:
    'Enter your CoffeeBay cup serial code for a chance to win amazing prizes. Every cup is a new adventure.',
  keywords: ['CoffeeBay', 'Lucky Cup', 'Competition', 'Win Prizes', 'Coffee'],
  robots: { index: false, follow: false }, // Campaign page — no indexing
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#231F20',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${kondolar.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
