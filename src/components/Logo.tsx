import { BRAND } from '../config';

export function Logo() {
  return (
    <span className="logo">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path d="M10 7h8l5 5v13H10z" fill="#fff" />
        <path d="M18 7v5h5" fill="var(--primary-soft)" />
        <path d="M13 20l6-6 2 2-6 6h-2z" fill="var(--primary)" />
      </svg>
      <span className="logo-text">{BRAND.name}</span>
    </span>
  );
}
