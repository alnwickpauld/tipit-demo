export const poolTypes = ["FOH", "BOH", "HYBRID"] as const;

export type PoolType = (typeof poolTypes)[number];

export const poolTypeLabels: Record<PoolType, string> = {
  FOH: "Front of house",
  BOH: "Back of house",
  HYBRID: "Hybrid",
};

export function formatPoolType(value: PoolType) {
  return poolTypeLabels[value];
}
