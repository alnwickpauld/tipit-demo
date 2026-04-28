export type PoolDistributionStaffInput = {
  staffMemberId: string;
  employeeName: string;
  hoursWorked: number;
};

export type PoolDistributionInput = {
  poolTotal: number;
  staff: PoolDistributionStaffInput[];
};

export type PoolDistributionAllocation = {
  staffMemberId: string;
  employeeName: string;
  hoursWorked: number;
  allocationAmount: number;
};

export type PoolDistributionResult = {
  poolTotal: number;
  totalHoursWorked: number;
  perHourRate: number;
  allocations: PoolDistributionAllocation[];
};

export class PoolDistributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoolDistributionError";
  }
}

function amountToCents(amount: number) {
  return Math.round(amount * 100);
}

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function normalizeHours(hoursWorked: number) {
  return Number(hoursWorked.toFixed(4));
}

export class PoolDistributionService {
  calculateDistribution(input: PoolDistributionInput): PoolDistributionResult {
    if (!Number.isFinite(input.poolTotal) || input.poolTotal < 0) {
      throw new PoolDistributionError("Pool total must be a valid positive amount or zero");
    }

    const duplicateIds = new Set<string>();
    for (const staff of input.staff) {
      if (!Number.isFinite(staff.hoursWorked) || staff.hoursWorked < 0) {
        throw new PoolDistributionError("Hours worked must be a valid positive number or zero");
      }

      if (duplicateIds.has(staff.staffMemberId)) {
        throw new PoolDistributionError("Staff members can only appear once in a pool distribution");
      }

      duplicateIds.add(staff.staffMemberId);
    }

    const sortedStaff = input.staff
      .map((staff) => ({
        ...staff,
        hoursWorked: normalizeHours(staff.hoursWorked),
      }))
      .sort((left, right) => {
        const nameSort = left.employeeName.localeCompare(right.employeeName);
        if (nameSort !== 0) {
          return nameSort;
        }

        return left.staffMemberId.localeCompare(right.staffMemberId);
      });

    const totalHoursWorked = Number(
      sortedStaff.reduce((sum, staff) => sum + staff.hoursWorked, 0).toFixed(4),
    );

    if (totalHoursWorked <= 0 || sortedStaff.length === 0) {
      return {
        poolTotal: Number(input.poolTotal.toFixed(2)),
        totalHoursWorked,
        perHourRate: 0,
        allocations: sortedStaff.map((staff) => ({
          staffMemberId: staff.staffMemberId,
          employeeName: staff.employeeName,
          hoursWorked: staff.hoursWorked,
          allocationAmount: 0,
        })),
      };
    }

    const totalCents = amountToCents(input.poolTotal);
    const perHourRate = Number((input.poolTotal / totalHoursWorked).toFixed(4));

    const provisional = sortedStaff.map((staff) => {
      const rawCents = (totalCents * staff.hoursWorked) / totalHoursWorked;
      const floorCents = Math.floor(rawCents);

      return {
        staff,
        floorCents,
        remainder: rawCents - floorCents,
      };
    });

    let remainingCents =
      totalCents - provisional.reduce((sum, entry) => sum + entry.floorCents, 0);

    const extraCentRecipients = provisional
      .slice()
      .sort((left, right) => {
        if (right.remainder !== left.remainder) {
          return right.remainder - left.remainder;
        }

        const hourSort = right.staff.hoursWorked - left.staff.hoursWorked;
        if (hourSort !== 0) {
          return hourSort;
        }

        const nameSort = left.staff.employeeName.localeCompare(right.staff.employeeName);
        if (nameSort !== 0) {
          return nameSort;
        }

        return left.staff.staffMemberId.localeCompare(right.staff.staffMemberId);
      })
      .map((entry) => entry.staff.staffMemberId);

    const allocations = provisional.map((entry) => {
      let cents = entry.floorCents;
      if (remainingCents > 0 && extraCentRecipients.includes(entry.staff.staffMemberId)) {
        const bonusIndex = extraCentRecipients.indexOf(entry.staff.staffMemberId);
        if (bonusIndex > -1 && bonusIndex < remainingCents) {
          cents += 1;
        }
      }

      return {
        staffMemberId: entry.staff.staffMemberId,
        employeeName: entry.staff.employeeName,
        hoursWorked: entry.staff.hoursWorked,
        allocationAmount: centsToAmount(cents),
      };
    });

    return {
      poolTotal: Number(input.poolTotal.toFixed(2)),
      totalHoursWorked,
      perHourRate,
      allocations,
    };
  }
}
