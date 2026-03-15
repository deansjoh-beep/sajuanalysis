import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    });
  });

  // API to read guidelines
  app.get("/api/guidelines", (req, res) => {
    try {
      const cwd = process.cwd();
      const sajuPath = path.resolve(cwd, "saju_guideline.txt");
      const consultingPath = path.resolve(cwd, "consulting_guideline.txt");
      const reportPath = path.resolve(cwd, "report_guideline.txt");

      console.log(`[Guidelines API] CWD: ${cwd}`);
      console.log(`[Guidelines API] __dirname: ${__dirname}`);
      console.log(`[Guidelines API] Attempting to read: ${sajuPath}`);

      const sajuContent = fs.existsSync(sajuPath) 
        ? fs.readFileSync(sajuPath, "utf-8") 
        : "Saju guideline not found.";
      
      const consultingContent = fs.existsSync(consultingPath)
        ? fs.readFileSync(consultingPath, "utf-8")
        : "Consulting guideline not found.";

      const reportContent = fs.existsSync(reportPath)
        ? fs.readFileSync(reportPath, "utf-8")
        : "Report guideline not found.";

      console.log(`[Guidelines API] Read success. Saju length: ${sajuContent.length}`);

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.json({
        saju: sajuContent,
        consulting: consultingContent,
        report: reportContent
      });
    } catch (error) {
      console.error("[Guidelines API] Error:", error);
      res.status(500).json({ 
        error: "Failed to read guidelines server-side",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, "utf-8");
        // Inject API Key into the HTML so the frontend can access it even if build-time injection failed
        const apiKeyScript = `<script>window.GEMINI_API_KEY = "${process.env.GEMINI_API_KEY || ''}";</script>`;
        html = html.replace("<head>", `<head>${apiKeyScript}`);
        res.send(html);
      } else {
        res.status(404).send("Not Found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);
  });
}

startServer();
