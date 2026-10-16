// Mirrors the registration rules in src/app/api/auth/register/route.ts.
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must be 10-72 characters with at least one letter and one number.';
  }
  return null;
}
