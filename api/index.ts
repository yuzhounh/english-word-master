/**
 * Vercel serverless entry — imports the bundled Express app.
 * Run `npm run build` to generate handler.cjs from createApp.ts.
 */
// @ts-expect-error bundled CJS output from esbuild
import handler from "./handler.cjs";

const app = (handler as { default?: typeof handler }).default ?? handler;
export default app;
