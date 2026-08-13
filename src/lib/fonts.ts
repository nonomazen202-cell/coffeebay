import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
  preload: true,
});

export const kondolar = localFont({
  src: [
    {
      path: '../../public/fonts/kondolar-regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/kondolar-italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../public/fonts/kondolar-bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/kondolar-black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-kondolar',
});
