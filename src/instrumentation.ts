// Next.js instrumentation hook — runs once at server startup, before any
// route code loads. The OTel node SDK can't run on the edge runtime, so the
// real setup lives behind this guard.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
