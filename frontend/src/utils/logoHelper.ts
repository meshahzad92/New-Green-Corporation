// Utility to resolve company logos dynamically in both development and production

// Dynamic logo loading using Vite's glob import
const logoModules = import.meta.glob('../logos/*.{png,jpg,jpeg,svg,webp}', { eager: true });

export const resolveCompanyLogo = (logo?: string | null, companyName?: string | null): string | null => {
  // 1. If logo is a Data URL, external URL, or absolute path, return it directly
  if (logo && (logo.startsWith('data:') || logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('/'))) {
    return logo;
  }

  // 2. If logo is a filename matching bundled static logos (e.g. Bayer.png, nayaSawera.jpg)
  if (logo) {
    const cleanLogo = logo.toLowerCase().trim();
    const entry = Object.entries(logoModules).find(([path]) => {
      const fileName = path.split('/').pop()?.toLowerCase();
      return fileName === cleanLogo || path.toLowerCase().endsWith('/' + cleanLogo);
    });
    if (entry) return (entry[1] as any).default;
  }

  // 3. Fallback to matching by company name in bundled logos
  if (companyName) {
    const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const entry = Object.entries(logoModules).find(([path]) => {
      const fileName = path.split('/').pop()?.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      return fileName === cleanName || cleanName.includes(fileName || '') || (fileName && fileName.includes(cleanName));
    });
    if (entry) return (entry[1] as any).default;
  }

  // 4. Fallback check for static public logos if filename was given
  if (logo && !logo.includes('/')) {
    return `/logos/${logo}`;
  }

  return null;
};
