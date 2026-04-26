/**
 * V3 hook location for `useAuth`.
 *
 * The implementation lives in `@/contexts/AuthContext` (which also exports
 * the `<AuthProvider>`). Re-exporting here lets components import from
 * `@/hooks/useAuth` per the V3 layout while preserving every existing
 * import site and avoiding a duplicate provider.
 */
export { useAuth } from "@/contexts/AuthContext";
