import { useState, useEffect } from 'react';
import { differenceInSeconds, formatDuration, intervalToDuration } from 'date-fns';

export default function CountdownTimer({ expiresAt, status }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (status !== 'PENDING') return;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [status]);

  if (status === 'COLLECTED') {
    return <span className="text-green-600 font-medium">Collected</span>;
  }
  if (status === 'EXPIRED') {
    return <span className="text-red-600 font-medium">Expired</span>;
  }

  const expiry = new Date(expiresAt);
  const secondsLeft = differenceInSeconds(expiry, now);

  if (secondsLeft <= 0) {
    return <span className="text-red-600 font-medium">Expired</span>;
  }

  const duration = intervalToDuration({ start: now, end: expiry });
  const text = formatDuration(
    { days: duration.days + (duration.months || 0) * 30, hours: duration.hours },
    { format: ['days', 'hours'] }
  );

  const daysLeft = secondsLeft / 86400;
  const color =
    daysLeft > 7 ? 'text-green-600' : daysLeft > 2 ? 'text-yellow-600' : 'text-red-600';

  return <span className={`font-medium ${color}`}>{text} left</span>;
}
