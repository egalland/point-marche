export function jiraImportCountError(expected: { tickets?: unknown; participants?: unknown }, actual: { tickets: number; participants: number }) {
  for (const key of ["tickets", "participants"] as const) {
    const count = expected[key];
    // Older portable clients did not send these counts.
    if (count === undefined) continue;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) return "Les totaux attendus de l’import sont invalides.";
    if (count !== actual[key]) return `Import incomplet : ${actual[key]} ${key} reçus sur ${count}. Le registre précédent est conservé.`;
  }
  return "";
}
