/**
 * Lazy loading entry point for DM tooling
 *
 * This dedicated entry point ensures Vite emits a separate chunk for DM-only code,
 * reducing the main bundle size by excluding DM tools until isDM is true.
 */
export { DMMenuContainer } from "./components/DMMenuContainer";
