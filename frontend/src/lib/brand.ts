// Working name. In Peru "separar" a court means to book it. Change it here (and in index.html).
export const BRAND = "Separa";

// Where someone who wants their business on the platform writes to the team. Set when the app is built
// (VITE_CONTACT_WHATSAPP, VITE_CONTACT_EMAIL); read when asked so a test can change them.
export const contactWhatsapp = () => (import.meta.env.VITE_CONTACT_WHATSAPP as string | undefined) ?? "";
export const contactEmail = () => (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ?? "";
