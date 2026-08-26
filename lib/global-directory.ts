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
  usercode: string;
  role: GlobalRole;
  marketIds: string[];
};

const jiraRoles = new Set<GlobalRole>(["chef-produit", "chef-marche"]);
const primaryMailRoles = new Set<GlobalRole>(["chef-produit", "chef-marche", "analyste-tarif-referentiel", "manager-tarif"]);

export function isGlobalRole(value: string): value is GlobalRole {
  return GLOBAL_ROLE_OPTIONS.some((option) => option.id === value);
}

export function roleUsesAutomaticJira(role: GlobalRole) {
  return jiraRoles.has(role);
}

export function roleMailMode(role: GlobalRole): "to" | "cc" | "none" {
  if (primaryMailRoles.has(role)) return "to";
  return "none";
}

export function roleLabel(role: GlobalRole) {
  return GLOBAL_ROLE_OPTIONS.find((option) => option.id === role)?.label ?? "Autre rôle";
}

export function buildMarketJql(users: GlobalDirectoryUser[], marketId: string) {
  const usercodes = Array.from(new Set(users
    .filter((user) => roleUsesAutomaticJira(user.role) && user.marketIds.includes(marketId) && /^[A-Z]\d{7}$/i.test(user.usercode))
    .map((user) => user.usercode.toUpperCase())))
    .sort();
  if (!usercodes.length) return "";
  return `project = "JSD-Distribution Matériaux Bois Panneaux"
AND "Groupes d'affectation" in (
    "JSD-GLOBAL [JSD-GLOBAL]",
    "JSD-GLOBAL-APPRO [JSD-GLOBAL-APPRO]",
    "JSD-GLOBAL-CODIF [JSD-GLOBAL-CODIF]",
    "JSD-GLOBAL-TARIF [JSD-GLOBAL-TARIF]"
)
AND statusCategory != Done
AND assignee in (${usercodes.join(", ")})`;
}
