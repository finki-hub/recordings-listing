export const learnifyCalloutEnabled = true;

export const learnifyCoursePages = new Set([
  'courses/semester-1/strukturno-programiranje.md',
  'courses/semester-1/matematika-1.md',
  'courses/semester-3/algoritmi-i-podatochni-strukturi.md',
  'courses/semester-5/napredno-programiranje.md',
  'courses/semester-5/veb-programiranje.md',
  'courses/semester-5/bazi-na-podatoci.md',
  'courses/semester-5/voved-vo-naukata-za-podatoci.md',
  'courses/semester-3/verojatnost-i-statistika.md',
  'courses/semester-2/objektno-orientirano-programiranje.md',
  'courses/semester-4/operativni-sistemi.md',
  'courses/semester-4/veshtackha-inteligencija.md',
  'courses/semester-6/elektronska-i-mobilna-trgovija.md',
  'courses/semester-6/dizajn-na-interakcijata-chovek-kompjuter.md',
  'courses/semester-2/biznis-statistika.md',
  'courses/semester-6/softverski-kvalitet-i-testiranje.md',
]);

export function shouldShowLearnifyCallout(relativePath, enabled = learnifyCalloutEnabled) {
  if (!enabled || typeof relativePath !== 'string') return false;
  const normalizedPath = relativePath.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '');
  return learnifyCoursePages.has(normalizedPath);
}
