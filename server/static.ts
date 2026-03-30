import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static assets with long cache (hashed filenames)
  app.use(
    "/assets",
    express.static(path.resolve(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );

  // Serve images with a 7-day cache
  const imageExts = /\.(png|jpg|jpeg|webp|avif|gif|svg|ico)$/i;
  app.use((req, res, next) => {
    if (imageExts.test(req.path)) {
      res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    }
    next();
  });

  // Serve other static files with short cache
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      setHeaders(res, filePath) {
        // Never cache index.html so users always get fresh deploys
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
