/** The Rubys gem mark. */
export function RubyMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M10 7h12l5.5 6.2L16 26.5 4.5 13.2z" fill="var(--color-ruby-600)" />
      <path d="M10 7h12l5.5 6.2h-23z" fill="var(--color-ruby-500)" />
      <path
        d="M4.5 13.2h23M10 7l3.2 6.2L16 26.5l2.8-13.3L22 7M13.2 13.2 16 7l2.8 6.2"
        fill="none"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}
