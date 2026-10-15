export function usesLocalBackend() {
  return process.env.ACADEMY_BACKEND_MODE === "local";
}
