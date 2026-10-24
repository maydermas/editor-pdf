import site from '../site.config.json';

// Todos los datos editables están en site.config.json (raíz del proyecto).
export const BRAND = {
  name: site.name,
  supportEmail: site.supportEmail,
  maxUploadMB: site.maxUploadMB,
};

export const ADSENSE = site.adsense;
