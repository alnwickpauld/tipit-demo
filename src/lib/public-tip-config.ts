import type { TippingMode } from "@prisma/client";

export type DepartmentTippingConfig = {
  qrTippingEnabled: boolean;
  teamTippingEnabled: boolean;
  individualTippingEnabled: boolean;
  shiftSelectorEnabled: boolean;
};

export type ServiceAreaTippingConfig = {
  tippingMode: TippingMode;
  teamTippingEnabled: boolean;
  individualTippingEnabled: boolean;
};

export type ResolvedServiceAreaTippingConfig = {
  enabled: boolean;
  effectiveTippingMode: TippingMode;
  showTeamOption: boolean;
  individualAllowed: boolean;
};

export function resolveServiceAreaTippingConfig(
  departmentConfig: DepartmentTippingConfig,
  serviceAreaConfig: ServiceAreaTippingConfig,
): ResolvedServiceAreaTippingConfig {
  if (!departmentConfig.qrTippingEnabled) {
    return {
      enabled: false,
      effectiveTippingMode: "TEAM_ONLY",
      showTeamOption: false,
      individualAllowed: false,
    };
  }

  const allowTeam = departmentConfig.teamTippingEnabled && serviceAreaConfig.teamTippingEnabled;
  const allowIndividual =
    departmentConfig.individualTippingEnabled && serviceAreaConfig.individualTippingEnabled;

  switch (serviceAreaConfig.tippingMode) {
    case "TEAM_ONLY":
      return {
        enabled: allowTeam,
        effectiveTippingMode: "TEAM_ONLY",
        showTeamOption: false,
        individualAllowed: false,
      };
    case "INDIVIDUAL_ONLY":
      if (allowIndividual) {
        return {
          enabled: true,
          effectiveTippingMode: "INDIVIDUAL_ONLY",
          showTeamOption: false,
          individualAllowed: true,
        };
      }

      if (allowTeam) {
        return {
          enabled: true,
          effectiveTippingMode: "TEAM_ONLY",
          showTeamOption: false,
          individualAllowed: false,
        };
      }

      return {
        enabled: false,
        effectiveTippingMode: "INDIVIDUAL_ONLY",
        showTeamOption: false,
        individualAllowed: false,
      };
    case "TEAM_OR_INDIVIDUAL":
      if (allowTeam && allowIndividual) {
        return {
          enabled: true,
          effectiveTippingMode: "TEAM_OR_INDIVIDUAL",
          showTeamOption: true,
          individualAllowed: true,
        };
      }

      if (allowIndividual) {
        return {
          enabled: true,
          effectiveTippingMode: "INDIVIDUAL_ONLY",
          showTeamOption: false,
          individualAllowed: true,
        };
      }

      if (allowTeam) {
        return {
          enabled: true,
          effectiveTippingMode: "TEAM_ONLY",
          showTeamOption: false,
          individualAllowed: false,
        };
      }

      return {
        enabled: false,
        effectiveTippingMode: "TEAM_OR_INDIVIDUAL",
        showTeamOption: false,
        individualAllowed: false,
      };
    case "SHIFT_SELECTOR":
      if (allowIndividual && departmentConfig.shiftSelectorEnabled) {
        return {
          enabled: true,
          effectiveTippingMode: "SHIFT_SELECTOR",
          showTeamOption: allowTeam,
          individualAllowed: true,
        };
      }

      if (allowIndividual) {
        return {
          enabled: true,
          effectiveTippingMode: "INDIVIDUAL_ONLY",
          showTeamOption: false,
          individualAllowed: true,
        };
      }

      if (allowTeam) {
        return {
          enabled: true,
          effectiveTippingMode: "TEAM_ONLY",
          showTeamOption: false,
          individualAllowed: false,
        };
      }

      return {
        enabled: false,
        effectiveTippingMode: "SHIFT_SELECTOR",
        showTeamOption: false,
        individualAllowed: false,
      };
  }
}
