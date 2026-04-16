import { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

/**
 * SLACountdown — live countdown timer that updates every second
 * Shows hours:minutes:seconds remaining, changes color as deadline approaches
 */
export default function SLACountdown({ deadline, breached, resolved, size = 'md' }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState('ok'); // ok | warning | critical | breached

  useEffect(() => {
    if (!deadline || resolved) return;

    const calculate = () => {
      const now = new Date();
      const end = new Date(deadline);
      const secs = differenceInSeconds(end, now);

      if (secs <= 0 || breached) {
        setTimeLeft(null);
        setStatus('breached');
        return;
      }

      setTimeLeft(secs);
      if (secs <= 3600) setStatus('critical');        // under 1 hour
      else if (secs <= 4 * 3600) setStatus('warning'); // under 4 hours
      else setStatus('ok');
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [deadline, breached, resolved]);

  if (resolved) {
    return (
      <span className="sla-countdown sla-countdown--ok" style={size === 'sm' ? { fontSize: 10 } : {}}>
        ✅ Resolved
      </span>
    );
  }

  if (status === 'breached' || timeLeft === null) {
    return (
      <span className="sla-countdown sla-countdown--critical" style={size === 'sm' ? { fontSize: 10 } : {}}>
        🚨 SLA Breached
      </span>
    );
  }

  // Format time
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const display = hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const classMap = {
    ok: 'sla-countdown--ok',
    warning: 'sla-countdown--warning',
    critical: 'sla-countdown--critical',
  };

  const icons = { ok: '⏱', warning: '⚠️', critical: '🔥' };

  return (
    <span className={`sla-countdown ${classMap[status]}`} style={size === 'sm' ? { fontSize: 10, padding: '2px 6px' } : {}}>
      {icons[status]} {display}
    </span>
  );
}
