// Durations are explicit so the contemplative pauses remain exact.
export const GOOSE_SEQUENCE = [
  { id: "dance", duration: 7000, text: "" },
  { id: "think", duration: 2500, text: "" },
  { id: "encore", duration: 6000, text: "" },
  { id: "freeze", duration: 10000, text: "" },
  { id: "question", duration: 5000, text: "qu'est ce que je fais ici" },
  { id: "dots", duration: 5000, text: "..." },
  { id: "bref", duration: 1500, text: "bref" },
  { id: "finale", duration: 5000, text: "" },
  { id: "away", duration: 800, text: "" },
] as const;

export function gooseStageAt(elapsed: number) {
  let end = 0;
  for (const stage of GOOSE_SEQUENCE) {
    end += stage.duration;
    if (elapsed < end) return stage;
  }
  return null;
}
