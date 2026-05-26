"use client";

import type { LucideIcon } from "lucide-react";

export function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "statusLine ok" : "statusLine"}>
      <i />
      {label}
    </span>
  );
}

export function Metric({
  icon: Icon,
  label,
  value,
  ok
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="metricTile">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={ok ? "dot ok" : "dot"} />
    </div>
  );
}

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "statusPill ok" : "statusPill"}>
      <i />
      {label}
    </span>
  );
}
