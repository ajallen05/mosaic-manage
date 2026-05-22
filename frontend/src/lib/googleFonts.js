export const GOOGLE_FONTS = [
  { name: 'Inter', weights: ['400', '700'] },
  { name: 'Roboto', weights: ['400', '700'] },
  { name: 'Open Sans', weights: ['400', '700'] },
  { name: 'Lato', weights: ['400', '700'] },
  { name: 'Montserrat', weights: ['400', '600', '700', '900'] },
  { name: 'Poppins', weights: ['400', '600', '700'] },
  { name: 'Raleway', weights: ['400', '700'] },
  { name: 'Nunito', weights: ['400', '700'] },
  { name: 'Source Sans 3', weights: ['400', '700'] },
  { name: 'PT Sans', weights: ['400', '700'] },
  { name: 'Ubuntu', weights: ['400', '700'] },
  { name: 'Noto Sans', weights: ['400', '700'] },
  { name: 'Josefin Sans', weights: ['400', '700'] },
  { name: 'Oswald', weights: ['400', '700'] },
  { name: 'Bebas Neue', weights: ['400'] },
  { name: 'Anton', weights: ['400'] },
  { name: 'Playfair Display', weights: ['400', '700'] },
  { name: 'Merriweather', weights: ['400', '700'] },
  { name: 'Dancing Script', weights: ['400', '700'] },
  { name: 'Pacifico', weights: ['400'] },
];

const loaded = new Set();
const FONT_WEIGHT_MAP = Object.fromEntries(GOOGLE_FONTS.map(f => [f.name, f.weights]));

export async function loadGoogleFont(name) {
  if (loaded.has(name)) return;
  const id = `gfont-${name.replace(/\s+/g, '-')}`;
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    const family = name.replace(/ /g, '+');
    const weights = FONT_WEIGHT_MAP[name] || ['400', '700'];
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@${weights.join(';')}&display=swap`;
    document.head.appendChild(link);
  }
  try {
    await document.fonts.load(`400 16px "${name}"`);
  } catch {
    // continue even if font check fails
  }
  loaded.add(name);
}
