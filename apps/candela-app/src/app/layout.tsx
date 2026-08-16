import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import logoJpeg from '@candela/shared/assets/logo.jpeg';
import { Providers } from './providers';
import './globals.css';

const logoSrc = typeof logoJpeg === 'string' ? logoJpeg : logoJpeg.src;

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kandela',
  description: 'Kandela — A Measure of Light, A Measure of Progress',
  icons: { icon: logoSrc },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kandela Therapy',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className={`${poppins.className} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
