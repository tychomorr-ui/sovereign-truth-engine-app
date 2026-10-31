import type { User } from "../drizzle/schema";

export type AuthenticationState =
  | "UNAUTHENTICATED"
  | "SOVEREIGN_AUTHENTICATED"
  | "BETA_SESSION"
  | "OWNER_AUTHENTICATED"
  | "ADMIN_AUTHENTICATED";

export function resolveAuthenticationState(input: {
  user: Pick<User, "role" | "loginMethod"> | null;
  betaSession?: boolean;
  ownerAuthenticated?: boolean;
}): AuthenticationState {
  if (!input.user) return input.betaSession ? "BETA_SESSION" : "UNAUTHENTICATED";
  if (input.ownerAuthenticated) return "OWNER_AUTHENTICATED";
  if (input.user.role === "admin") return "ADMIN_AUTHENTICATED";
  return "SOVEREIGN_AUTHENTICATED";
}

export function hasPrivilegedAuthentication(state: AuthenticationState): boolean {
  return state === "OWNER_AUTHENTICATED" || state === "ADMIN_AUTHENTICATED";
}
