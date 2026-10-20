import { t, type Health } from '@kebun/shared';
import { Badge } from './ui';

export function PhaseBadge({ phase }: { phase: string }) {
  const tone = phase === 'ready' ? 'gold' : phase === 'fruiting' ? 'good' : phase === 'flowering' ? 'bloom' : 'neutral';
  return <Badge tone={tone}>{t('phase.' + phase)}</Badge>;
}

export function HealthBadge({ health }: { health: Health }) {
  const tone = health === 'healthy' ? 'good' : health === 'watch' ? 'warn' : health === 'sick' ? 'bad' : 'neutral';
  return <Badge tone={tone}>{t('health.' + health)}</Badge>;
}
