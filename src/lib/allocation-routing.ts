import type { AllocationRecipientType, AllocationRuleScope, TipSelectionType } from "@prisma/client";

import { prisma } from "./prisma";

type AllocationRuleCandidate = {
  id: string;
  venueId: string;
  departmentId: string | null;
  serviceAreaId: string | null;
  scope: AllocationRuleScope;
  selectionType: TipSelectionType | null;
  priority: number;
  createdAt: Date;
  lines: Array<{
    id: string;
    recipientType: AllocationRecipientType;
    staffMemberId: string | null;
    poolId: string | null;
    percentageBps: number;
    sortOrder: number;
  }>;
};

type AllocationRuleContext = {
  venueId: string;
  departmentId?: string | null;
  serviceAreaId?: string | null;
  occurredAt: Date;
  guestSelectionType: TipSelectionType;
};

export async function resolveAllocationRuleForTip(context: AllocationRuleContext) {
  const candidates = await prisma.allocationRule.findMany({
    where: {
      venueId: context.venueId,
      isActive: true,
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: context.occurredAt } }],
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: context.occurredAt } }] }],
    },
    include: {
      lines: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  const matched = candidates
    .filter((candidate) => matchesContext(candidate, context))
    .sort(compareCandidates);

  return matched[0] ?? null;
}

function matchesContext(rule: AllocationRuleCandidate, context: AllocationRuleContext) {
  if (rule.selectionType && rule.selectionType !== context.guestSelectionType) {
    return false;
  }

  if (rule.scope === "SERVICE_AREA") {
    return !!context.serviceAreaId && rule.serviceAreaId === context.serviceAreaId;
  }

  if (rule.scope === "DEPARTMENT") {
    return !!context.departmentId && rule.departmentId === context.departmentId;
  }

  return !rule.serviceAreaId && !rule.departmentId;
}

function compareCandidates(left: AllocationRuleCandidate, right: AllocationRuleCandidate) {
  const scoreDifference = specificityScore(right) - specificityScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
}

function specificityScore(rule: AllocationRuleCandidate) {
  const scopeScore =
    rule.scope === "SERVICE_AREA" ? 300 : rule.scope === "DEPARTMENT" ? 200 : 100;
  const selectionScore = rule.selectionType ? 20 : 0;

  return scopeScore + selectionScore;
}
