export function PulseRing({ score, label, size = 'large' }: { score: number; label: string; size?: 'large' | 'small' }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (score / 100);
  return (
    <div className={`pulse-ring ${size}`}>
      <svg viewBox="0 0 120 120" role="img" aria-label={`Financial Pulse ${score} out of 100, ${label}`}>
        <circle className="ring-track" cx="60" cy="60" r={radius} />
        <circle className="ring-value" cx="60" cy="60" r={radius} strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <div><strong>{score}</strong><span>/100</span><small>{label}</small></div>
    </div>
  );
}
