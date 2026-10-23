// Simulated current time for the benchmark: October 23, 2026 08:30:00 UTC
export const SIMULATED_NOW = new Date('2026-10-23T08:30:00Z').getTime();

export function getCountdown(targetIso: string | null): { text: string; isUrgent: boolean; isWarning: boolean; isPassed: boolean } {
  if (!targetIso) return { text: 'No deadline', isUrgent: false, isWarning: false, isPassed: false };

  const target = new Date(targetIso).getTime();
  const diffMs = target - SIMULATED_NOW;

  if (diffMs <= 0) {
    return { text: 'Overdue', isUrgent: true, isWarning: false, isPassed: true };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (days > 0) {
    const text = `${days}d ${remHours}h left`;
    return {
      text,
      isUrgent: days <= 2,
      isWarning: days > 2 && days <= 5,
      isPassed: false,
    };
  }

  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return {
    text: `${hours}h ${mins}m left`,
    isUrgent: true,
    isWarning: false,
    isPassed: false,
  };
}

export function formatNiceDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}
