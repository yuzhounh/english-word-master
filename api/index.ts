/**
 * Vercel serverless entry — imports the bundled Express app.
 * Run `npm run build` to generate handler.cjs from createApp.ts.
 */
// @ts-ignore generated during the production build
import handler from "./handler.cjs";

const app = (handler as { default?: typeof handler }).default ?? handler;
export default app;
