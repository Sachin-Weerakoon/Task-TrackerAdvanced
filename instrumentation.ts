export async function register() {
  // Next's runtime hook also covers the generated standalone server. Keep
  // validation out of build workers, which do not need runtime credentials.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { validateServerEnv } = await import("./lib/env");
    validateServerEnv();
  }
}
