import type { Express, Request, Response } from "express";
import {
  adventurePromptToPexelsQuery,
  fetchPexelsPhotoUrl,
  resolvePexelsApiKey,
} from "../../pexels";

function pexelsConfigMessage(): string {
  return (
    "Scene images use the Pexels API. Set PEXELS_API_KEY in your environment (.env). " +
    "Get a key at https://www.pexels.com/api/"
  );
}

export function registerImageRoutes(app: Express): void {
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!resolvePexelsApiKey()) {
        return res.status(503).json({ error: pexelsConfigMessage() });
      }

      const { prompt } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const query = adventurePromptToPexelsQuery(prompt);
      const imageUrl = await fetchPexelsPhotoUrl(query, { orientation: "landscape" });

      if (!imageUrl) {
        return res.status(502).json({
          error:
            "Could not find a matching photo. Try continuing the story and the scene may update.",
        });
      }

      res.json({
        url: imageUrl,
        b64_json: null,
      });
    } catch (error) {
      console.error("Error fetching scene image from Pexels:", error);
      res.status(500).json({ error: "Failed to load scene image" });
    }
  });
}
