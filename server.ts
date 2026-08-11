import { createApp } from "./api/index";

const PORT = 3000;

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  const app = createApp({ production: isProduction });

  if (!isProduction) {
    // Lazy-load Vite dev server so production bundles never include it
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Server startup error:", err);
});
