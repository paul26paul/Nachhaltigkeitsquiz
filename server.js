import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Replicate from "replicate";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

if (!process.env.REPLICATE_API_KEY) {
  console.error("❌ REPLICATE_API_KEY nicht gesetzt.");
  process.exit(1);
}

const app = express();
const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✨ 1. / zuerst auf start.html zeigen
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "start.html"));
});

// ✨ 2. Danach statische Dateien aktivieren
app.use(express.static(path.join(__dirname, "public")));

// 🔁 POST /replicate
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.post("/replicate", async (req, res) => {
  const { prompt, image } = req.body;

  if (!image || !prompt) {
    return res.status(400).json({ error: "Fehlende Daten (Prompt oder Bild)" });
  }

  if (!image.startsWith("http")) {
    return res.status(400).json({ error: "Bild muss eine URL sein (z. B. Cloudinary-Link)" });
  }

  try {
    console.log("📥 Anfrage erhalten mit Prompt:", prompt);

    const predictionVersion = "black-forest-labs/flux-kontext-pro"; // dein Modell

    let prediction = await replicate.predictions.create({
      version: predictionVersion,
      input: {
        prompt,
        input_image: image,
        aspect_ratio: "match_input_image",
        output_format: "jpg",
        safety_tolerance: 2,
      },
    });

    console.log("🧠 Prediction gestartet:", prediction.id);

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      prediction = await replicate.predictions.get(prediction.id);
      console.log("⏳ Status:", prediction.status);
    }

    if (!prediction.output) {
      console.error("❌ Kein Output erhalten:", prediction.output);
      return res.status(500).json({ error: "Bildgenerierung lieferte kein Ergebnis." });
    }

    const finalImage = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    console.log("✅ Ergebnis-URL:", finalImage);
    res.json({ output: finalImage });
  } catch (err) {
    console.error("❌ Fehler bei Replicate-Aufruf:", err);
    res.status(500).json({ error: "Fehler beim Aufruf von Replicate" });
  }
});

// Server starten
app.listen(3000, () => {
  console.log("✅ Server läuft auf http://localhost:3000");
});
