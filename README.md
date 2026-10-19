# FHIR R4 Validate: GitHub Action

**Validate HL7 FHIR R4 JSON resources and Bundles in CI.** Every pull request that touches your FHIR examples, test
fixtures, profiles' sample instances or seed data gets checked against the FHIR R4 structure (and optionally a
profile), with errors shown inline on the changed files and a summary on the run.

It calls the [Anpheros FHIR API](https://developers.anpheros.com/guides/fhir?utm_source=github&utm_medium=readme&utm_content=fhir-validate-action)
`$validate` operation with a free sandbox key; your files are validated, not stored.

## Quick start in 2 minutes

1. [Get a free sandbox key](https://platform.anpheros.com/dashboard/?utm_source=github&utm_medium=readme&utm_content=fhir-validate-action) (`sk_test_…`) and save it as the repository secret `ANPHEROS_KEY`.
2. Add `.github/workflows/fhir.yml`:

```yaml
name: FHIR
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anpheros/fhir-validate-action@v1
        with:
          api-key: ${{ secrets.ANPHEROS_KEY }}
          paths: |
            fhir/examples
            test/fixtures/patient.json
```

## Inputs

| Input | Default | |
|---|---|---|
| `api-key` | required | Anpheros sandbox key (`sk_test_…`) |
| `paths` | `.` | files or directories, one per line; directories are searched for `*.json` |
| `profile` | | a StructureDefinition URL to check against as well |
| `fail-on-warning` | `false` | fail on warnings, not only errors |

Outputs: `resources`, `errors`, `warnings`.

JSON files that are not FHIR (no `resourceType`) are ignored. A Bundle's entries are validated one by one. Resource
types the validator does not support are reported as skipped, not as failures. The supported types are Patient,
Observation, Condition, MedicationStatement, MedicationAdministration, AllergyIntolerance, Immunization, Procedure,
DiagnosticReport, DocumentReference, Encounter, Appointment, EpisodeOfCare, CarePlan, CareTeam, Goal, ServiceRequest,
FamilyMemberHistory, QuestionnaireResponse, Consent, Provenance, Organization, Practitioner, PractitionerRole,
RelatedPerson and Basic.

## Example output

```
::error file=examples/observation-invalid.json::examples/observation-invalid.json (Observation) at valueQuantity.value: Value error, Decimal value string does not match spec regex.
### FHIR R4 validation
4 resources validated in 3 files: 1 errors, 0 warnings, 1 skipped (type not supported).
```

Try it on the files in [`examples/`](examples).

## Guides

[FHIR sandbox](https://developers.anpheros.com/guides/fhir-sandbox?utm_source=github&utm_medium=readme&utm_content=fhir-validate-action) ·
[FHIR code systems](https://developers.anpheros.com/guides/fhir-code-systems?utm_source=github&utm_medium=readme&utm_content=fhir-validate-action) ·
[Getting started](https://developers.anpheros.com/guides/getting-started?utm_source=github&utm_medium=readme&utm_content=fhir-validate-action)

For full IG conformance (terminology bindings, invariants of every profile) use the official HL7 validator as well;
this action is a fast structural check for every commit.

Apache-2.0 · [anpheros.com](https://anpheros.com/?utm_source=github&utm_medium=readme&utm_content=fhir-validate-action)
