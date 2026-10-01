import type { BuildingType } from "@/lib/engine";

export type CompanyTask =
  | "production"
  | "sales"
  | "research"
  | "staff"
  | "finance"
  | "construction";
export function taskForBuilding(type: BuildingType): CompanyTask {
  if (type === "factory" || type === "warehouse") return "production";
  if (type === "store") return "sales";
  if (type === "rnd" || type === "lab") return "research";
  if (type === "office") return "finance";
  return "staff";
}
/** Construction comes first: building the city is the favourite activity. */
export const COMPANY_TASKS: { id: CompanyTask; label: string; icon: string }[] =
  [
    { id: "construction", label: "건설", icon: "🏗️" },
    { id: "production", label: "생산", icon: "🏭" },
    { id: "sales", label: "판매", icon: "🏬" },
    { id: "research", label: "연구", icon: "🔬" },
    { id: "staff", label: "직원", icon: "👥" },
    { id: "finance", label: "재무", icon: "💰" },
  ];

/** Which workspace task a turn mission's button should open. */
export function taskForMission(id: string): CompanyTask {
  switch (id) {
    case "first-building":
    case "city-growth":
    case "upgrade":
    case "building-combo":
      return "construction";
    case "workplace":
      return "staff";
    case "quality":
      return "research";
    case "healthy-debt":
      return "finance";
    case "first-sale":
      return "sales";
    default:
      return "production";
  }
}
