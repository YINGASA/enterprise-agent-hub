export function isOpsTokenConfigured() {
  return Boolean(process.env["EAH_OPS_TOKEN"]?.trim());
}

export function validateOpsToken(request: Request) {
  const expected = process.env["EAH_OPS_TOKEN"]?.trim();
  if (!expected) return false;
  const token = request.headers.get("x-ops-token")?.trim();
  return token === expected;
}
