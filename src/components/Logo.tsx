// Logo propio de Castigram: un altavoz/pregón sobre un tejado de pueblo.
// SVG hecho a medida, sin usar marcas de terceros.
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Castigram"
      fill="none"
    >
      <rect width="48" height="48" rx="12" fill="#af5a37" />
      {/* Tejado del pueblo */}
      <path d="M10 26 L24 15 L38 26 Z" fill="#f5e8dc" />
      {/* Megáfono / pregón */}
      <path
        d="M20 27 h8 l6 -4 v14 l-6 -4 h-8 z"
        fill="#f5e8dc"
        stroke="#603227"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Ondas de sonido */}
      <path d="M35 28 q3 3 0 6" stroke="#f5e8dc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
