export type IntegrationProviderCode =
  | "ORACLE_SIMPHONY"
  | "AMEEGO"
  | "PLANET"
  | "SAGE"
  | "OTHER";

export type IntegrationContext = {
  customerId: string;
  venueId?: string;
  departmentId?: string;
  payrollPeriodId?: string;
};

export type ImportedHoursWorkedRecord = {
  externalRecordRef: string;
  workDate: Date;
  shiftStartsAt?: Date;
  shiftEndsAt?: Date;
  staffExternalRef?: string;
  departmentExternalRef?: string;
  venueExternalRef?: string;
  hoursWorked: number;
  rawPayload?: unknown;
};

export type ImportedServiceChargeRecord = {
  externalRecordRef: string;
  businessDate: Date;
  venueExternalRef?: string;
  departmentExternalRef?: string;
  serviceAreaExternalRef?: string;
  serviceChargeAmount: number;
  cardTipAmount?: number;
  grossSalesAmount?: number;
  currency: string;
  rawPayload?: unknown;
};

export type PayrollExportLinePayload = {
  staffMemberId: string;
  externalEmployeeRef?: string;
  grossTipsAmount: number;
  hoursWorked?: number;
  serviceChargeAmount?: number;
  netPayableAmount?: number;
  currency: string;
  linePayload?: unknown;
};

export type PayrollExportBatchPayload = {
  payrollPeriodId?: string;
  venueId?: string;
  fileName?: string;
  notes?: string;
  lines: PayrollExportLinePayload[];
  rawPayload?: unknown;
};

export interface HoursWorkedImporter {
  readonly provider: IntegrationProviderCode;
  importHoursWorked(context: IntegrationContext): Promise<ImportedHoursWorkedRecord[]>;
}

export interface ServiceChargeImporter {
  readonly provider: IntegrationProviderCode;
  importServiceChargeData(context: IntegrationContext): Promise<ImportedServiceChargeRecord[]>;
}

export interface PayrollExporter {
  readonly provider: IntegrationProviderCode;
  buildPayrollExport(context: IntegrationContext): Promise<PayrollExportBatchPayload>;
}

export interface IntegrationModule {
  readonly provider: IntegrationProviderCode;
  hoursWorkedImporter?: HoursWorkedImporter;
  serviceChargeImporter?: ServiceChargeImporter;
  payrollExporter?: PayrollExporter;
}

export class IntegrationRegistry {
  constructor(private readonly modules: IntegrationModule[] = []) {}

  register(module: IntegrationModule) {
    this.modules.push(module);
  }

  get(provider: IntegrationProviderCode) {
    return this.modules.find((module) => module.provider === provider) ?? null;
  }
}

export const integrationRegistry = new IntegrationRegistry();
