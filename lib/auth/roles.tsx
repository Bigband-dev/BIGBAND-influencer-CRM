export type UserRole = "owner" | "admin" | "member";

export function isAdmin(role?: string | null) {
  return role === "owner" || role === "admin";
}

export function isOwner(role?: string | null) {
  return role === "owner";
}