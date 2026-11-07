import {
  Inter,
  Montserrat,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Outfit,
  Fraunces,
  Figtree,
} from 'next/font/google';
import localFont from 'next/font/local';

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
  preload: true,
});

export const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800'],
});

export const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['600', '700', '800', '900'],
});

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
  weight: ['600', '700', '800'],
});

export const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
  weight: ['500', '600', '700', '800', '900'],
});

// Warm rounded editorial serif closely matching Recoleta (SOFT=100, WONK=0)
export const recoleta = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-recoleta',
  weight: 'variable',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const recoletaStyle = {
  fontVariationSettings: "'SOFT' 100, 'WONK' 0",
} as const;

// Clean geometric-humanist sans closely matching Averta for descriptions & UI copy
export const averta = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-averta',
  weight: ['400', '500', '600', '700', '800'],
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
