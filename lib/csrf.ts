export function validateOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}
