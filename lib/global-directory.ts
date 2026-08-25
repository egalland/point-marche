export const GLOBAL_ROLE_OPTIONS = [
  { id: "chef-produit", label: "Chef de produit" },
  { id: "chef-marche", label: "Chef de marché" },
  { id: "analyste-tarif-referentiel", label: "Analyste tarif et référentiel" },
  { id: "manager-tarif", label: "Manager Tarif" },
  { id: "autre", label: "Autre rôle" },
] as const;

export type GlobalRole = typeof GLOBAL_ROLE_OPTIONS[number]["id"];

export type GlobalDirectoryUser = {
  id: string;
  name: string;
  email: string;
  jiraName: string;
  role: GlobalRole;
  marketIds: string[];
};

const automatedRoles = new Set<GlobalRole>(["chef-produit", "chef-marche", "analyste-tarif-referentiel"]);

export function isGlobalRole(value: string): value is GlobalRole {
  return GLOBAL_ROLE_OPTIONS.some((option) => option.id === value);
}

export function roleUsesAutomaticJira(role: GlobalRole) {
  return automatedRoles.has(role);
}

export function roleMailMode(role: GlobalRole): "to" | "cc" | "none" {
  if (role === "manager-tarif") return "cc";
  if (automatedRoles.has(role)) return "to";
  return "none";
}

export function roleLabel(role: GlobalRole) {
  return GLOBAL_ROLE_OPTIONS.find((option) => option.id === role)?.label ?? "Autre rôle";
}
