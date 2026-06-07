interface LogoProps {
  readonly brandName: string;
  readonly brandSubtitle: string;
}

export const Logo = ({ brandName, brandSubtitle }: LogoProps) => (
  <a className="brand" href="#inicio" aria-label={`${brandName} ${brandSubtitle}`}>
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="#F4B21B" strokeWidth="3" />
        <circle cx="20" cy="20" r="6" fill="#F4B21B" />
        <path d="M20 4a16 16 0 0114.4 9" stroke="#061B3F" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
    <span className="brand-text">
      <strong>{brandName}</strong>
      <small>{brandSubtitle}</small>
    </span>
  </a>
);
