export function LoadingStatus({ label, value, max = 100 }: { label: string; value?: number; max?: number }) {
  return <div className="loading-status" role="status" aria-live="polite"><span>{label}</span><progress aria-label={label} value={value} max={max}/></div>;
}
