import type { Confidence } from '../lib/types';

export function AnomalyBadge({ score, confidence }: { score: number; confidence: Confidence }) {
  const tone = confidence === 'LOW' ? 'baseline' : score >= 80 ? 'critical' : score >= 60 ? 'warning' : 'normal';
  return <span className={`anomaly-badge ${tone}`}><b>{score}</b><span>/100 · {confidence}</span></span>;
}
