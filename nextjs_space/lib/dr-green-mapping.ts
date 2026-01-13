/**
 * Map form medical condition values to Dr Green API enum values
 * Form now uses Dr Green's exact values, only need to map extras
 */
function mapMedicalConditionsForDrGreen(conditions: string[]): string[] {
  // Only map the few extras that aren't in Dr Green's enum
  const extrasToOther: Record<string, string> = {
    asthma: "other_medical_condition",
    glaucoma: "other_medical_condition",
    lupus: "other_medical_condition",
  };

  return conditions.map((c) => extrasToOther[c] || c); // Most pass through unchanged
}
