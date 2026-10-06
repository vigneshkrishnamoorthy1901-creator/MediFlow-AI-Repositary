const express = require("express");
const multer = require("multer");
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const supportedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif"
    ];
    if (!supportedTypes.includes(file.mimetype)) {
      return callback(new Error("Upload a PDF, JPEG, PNG, WebP, HEIC, or HEIF file."));
    }
    callback(null, true);
  }
});

// Free AI: Google Gemini free tier. Get a key at https://aistudio.google.com/apikey
const KEY = () => process.env.GEMINI_API_KEY || "";
const MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

const FILE_PROMPT = `Read this prescription document directly. Identify only medicines that are visibly written in it.
Return ONLY JSON: {"medicines":[{"name":"","dosage":"","frequency":"","duration":""}]}
- name: medicine name only
- dosage: strength/amount e.g. "500 mg", "5 ml"
- frequency: e.g. "1-0-1", "Twice daily", "After food"
- duration: e.g. "5 days"
Use "" if a detail is unclear. Never guess or invent a medicine. Return an empty medicines array if none can be read.
`;

router.post("/parse-file", (req, res) => {
  upload.single("prescription")(req, res, async (uploadError) => {
    if (uploadError) {
      const tooLarge = uploadError.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : 400).json({
        message: tooLarge
          ? "The file is too large. Choose a file smaller than 15 MB."
          : uploadError.message
      });
    }
    if (!req.file) return res.status(400).json({ message: "Please choose a prescription image or PDF." });
    if (!KEY()) {
      return res.status(503).json({ message: "Gemini API key is not configured on the backend." });
    }

    try {
      const models = [...new Set([MODEL(), "gemini-flash-latest", "gemini-3.8-flash", "gemini-3.5-flash"])];
      let data;
      let response;
      for (const model of models) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: FILE_PROMPT },
                  {
                    inline_data: {
                      mime_type: req.file.mimetype,
                      data: req.file.buffer.toString("base64")
                    }
                  }
                ]
              }],
              generationConfig: { responseMimeType: "application/json", temperature: 0 }
            })
          }
        );
        data = await response.json();
        if (response.ok || (response.status !== 503 && response.status !== 404)) break;
        console.warn(`Gemini model ${model} unavailable (${response.status}); trying another model.`);
      }
      if (!response.ok) {
        const message = data.error?.message || "Gemini could not read the prescription.";
        console.error(`Gemini file analysis failed (${response.status}):`, message);
        return res.status(502).json({ message: `Gemini could not read the file: ${message}` });
      }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) return res.status(502).json({ message: "Gemini returned no readable prescription details. Try a clearer image." });
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.medicines)) {
        return res.status(502).json({ message: "Gemini returned an invalid medicine list. Please try again." });
      }
      return res.json({ source: "ai", medicines: parsed.medicines });
    } catch (error) {
      console.error("Gemini file analysis error:", error.message);
      return res.status(502).json({ message: "Could not analyse the prescription with Gemini. Please try again." });
    }
  });
});

module.exports = router;
