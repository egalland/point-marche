"use client";

import { useState } from "react";
import { isIsoDate } from "@/lib/iso-week";

export function SafeDateInput({ value, onCommit, min = "2020-01-01", max = "2200-12-31" }: {
  value: string;
  onCommit: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const [state, setState] = useState({ source: value, draft: value });
  const draft = state.source === value ? state.draft : value;
  const valid = (next: string) => isIsoDate(next) && next >= min && next <= max;
  return <input type="date" value={draft} min={min} max={max}
    onChange={(event) => {
      const next = event.target.value;
      setState({ source: value, draft: next });
      if (valid(next)) onCommit(next);
    }}
    onBlur={() => { if (!valid(draft)) setState({ source: value, draft: value }); }}/>
}
