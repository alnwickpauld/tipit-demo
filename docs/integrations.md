# Tipit Integration Extension Points

This backend is prepared for future integration work, but it does not call any external systems yet.

## Core extension points

Integration logic should stay behind the contracts in:

- `src/server/integrations/contracts.ts`

Those interfaces separate provider-specific import/export logic from the Tipit core domain services.

## Planned provider mapping

### Oracle Simphony

Likely fit:

- venue and department external references
- imported service charge and card tip data
- optional service-area mapping for counters, tables, or bill folders

Primary future contracts:

- `ServiceChargeImporter`

### Ameego

Likely fit:

- staff and department external references
- imported hours worked
- shift and staffing alignment

Primary future contracts:

- `HoursWorkedImporter`

### Planet

Likely fit:

- imported card and service charge settlement data
- payment and service charge reconciliation support

Primary future contracts:

- `ServiceChargeImporter`

### Sage

Likely fit:

- payroll export generation
- export batch delivery and tracking

Primary future contracts:

- `PayrollExporter`

## Integration-ready schema additions

### Core entities

The following entities now support generic external references:

- `Venue.externalSystemRef`
- `Venue.externalSystemProvider`
- `Department.externalSystemRef`
- `Department.externalSystemProvider`
- `StaffMember.externalSystemRef`
- `StaffMember.externalSystemProvider`
- `PayrollPeriod.externalSystemRef`
- `PayrollPeriod.externalSystemProvider`

These fields are intentionally provider-agnostic so multiple future systems can be supported without reshaping the domain model.

### Imported hours worked

`ImportedHoursWorked` is the canonical landing table for imported scheduling/timekeeping data.

Suggested future usage:

- import provider rows
- match external staff/department/venue refs to Tipit entities
- store original payloads
- leave downstream payroll logic independent of provider-specific APIs

### Imported card/service charge data

`ImportedServiceCharge` is the canonical landing table for imported service charge and card-tip source data.

Suggested future usage:

- ingest POS or payment-provider daily summaries
- reconcile service charge amounts to venues/departments/service areas
- preserve raw provider payloads for audit and support

### Payroll export batches

`PayrollExportBatch` and `PayrollExportLine` are the canonical export-side models.

Suggested future usage:

- build a stable internal payroll export snapshot
- transform that snapshot into Sage or another payroll payload
- track provider batch references and retry/failure status without mutating source payroll results

## Recommended future implementation flow

1. Add a provider-specific module implementing one or more contracts.
2. Register that module in an application bootstrap layer.
3. Create import/export jobs that call the registered integration module.
4. Persist imported/exported data into the integration-ready tables.
5. Keep Tipit payroll, allocation, and tipping flows reading from Tipit-owned models, not directly from provider SDKs.

## Important guardrail

Provider SDK usage, authentication, polling, webhook handling, and retry policies should stay outside customer-admin domain services. Domain services should operate on normalized Tipit records only.
