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

  // Security: Block access to sensitive files and patterns
  app.use((req, res, next) => {
    const sensitivePatterns = [
      /wp-config\.php/i,
      /\.env/i,
      /\.git/i,
      /\.htaccess/i,
      /\.php$/i,
      /config\.php/i,
      /database\.php/i
    ];
    if (sensitivePatterns.some(pattern => pattern.test(req.path))) {
      console.warn(`[SECURITY] Blocked access attempt to sensitive path: ${req.path} from ${req.ip}`);
      return res.status(403).send("Forbidden: Access to this file is restricted.");
    }

    // Block common admin/login paths to prevent scanning
    const adminPaths = [
      /^\/login/i,
      /^\/admin/i,
      /^\/wp-admin/i,
      /^\/administrator/i,
      /^\/portal/i
    ];
    if (adminPaths.some(pattern => pattern.test(req.path))) {
      return res.status(404).send("Not Found"); // Return 404 to hide existence
    }

    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    });
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
  });
}

startServer();
