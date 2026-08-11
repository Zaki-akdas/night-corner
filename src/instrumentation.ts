/**
 * Edge-runtime instrumentation — no-op. The Node.js logic lives in
 * `instrumentation.node.ts`, which Next.js uses automatically for the Node
 * server runtime.
 */
export async function register() {
  // no-op for edge runtime
}
