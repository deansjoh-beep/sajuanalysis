import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { runTaekilEngine, TaekilRequest } from "./src/utils/taekilEngine.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "1mb" }));

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

  app.post("/api/taekil/recommend", (req, res) => {
    try {
      const body = req.body as Partial<TaekilRequest>;
      const required = [
        "name",
        "gender",
        "birthDate",
        "birthTime",
        "isLunar",
        "category",
        "periodStart",
        "periodEnd"
      ] as const;

      const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
      if (missing.length > 0) {
        return res.status(400).json({
          error: "MISSING_FIELDS",
          message: `필수 입력값이 누락되었습니다: ${missing.join(", ")}`
        });
      }

      // 결혼 카테고리 시 배우자 정보 검증
      if (body.category === '결혼') {
        const spouseRequired = [
          "spouseName",
          "spouseGender",
          "spouseBirthDate",
          "spouseBirthTime",
          "spouseIsLunar"
        ] as const;
        const spouseMissing = spouseRequired.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
        if (spouseMissing.length > 0) {
          return res.status(400).json({
            error: "MISSING_SPOUSE_INFO",
            message: `결혼 택일을 위해 배우자 정보가 필요합니다: ${spouseMissing.join(", ")}`
          });
        }
      }

      if (body.category === '이사') {
        const movingRequired = [
          'moveCurrentAddress',
          'moveTargetAddress'
        ] as const;
        const movingMissing = movingRequired.filter((k) => body[k] === undefined || body[k] === null || body[k] === '');
        if (movingMissing.length > 0) {
          return res.status(400).json({
            error: 'MISSING_MOVING_INFO',
            message: `이사 택일을 위해 필수 정보가 필요합니다: ${movingMissing.join(', ')} (주소는 동 단위 입력 가능)`
          });
        }
      }

      const payload: TaekilRequest = {
        name: String(body.name),
        gender: body.gender as "M" | "F",
        birthDate: String(body.birthDate),
        birthTime: String(body.birthTime),
        isLunar: Boolean(body.isLunar),
        isLeap: Boolean(body.isLeap),
        unknownTime: Boolean(body.unknownTime),
        category: body.category as TaekilRequest["category"],
        periodStart: String(body.periodStart),
        periodEnd: String(body.periodEnd),
        // 결혼 카테고리용 배우자 정보
        spouseName: body.spouseName ? String(body.spouseName) : undefined,
        spouseGender: body.spouseGender ? (body.spouseGender as "M" | "F") : undefined,
        spouseBirthDate: body.spouseBirthDate ? String(body.spouseBirthDate) : undefined,
        spouseBirthTime: body.spouseBirthTime ? String(body.spouseBirthTime) : undefined,
        spouseIsLunar: body.spouseIsLunar !== undefined ? Boolean(body.spouseIsLunar) : undefined,
        spouseIsLeap: body.spouseIsLeap ? Boolean(body.spouseIsLeap) : undefined,
        spouseUnknownTime: body.spouseUnknownTime ? Boolean(body.spouseUnknownTime) : undefined,
        preferredWeekdays: Array.isArray(body.preferredWeekdays) ? body.preferredWeekdays.map((v) => Number(v)) : undefined,
        avoidDates: Array.isArray(body.avoidDates) ? body.avoidDates.map((v) => String(v)) : undefined,
        moveCurrentAddress: body.moveCurrentAddress ? String(body.moveCurrentAddress) : undefined,
        moveTargetAddress: body.moveTargetAddress ? String(body.moveTargetAddress) : undefined,
        moveFamilyBirthDates: Array.isArray(body.moveFamilyBirthDates) ? body.moveFamilyBirthDates.map((v) => String(v)) : undefined,
        movePriority: body.movePriority ? (body.movePriority as 'folklore' | 'saju' | 'balanced') : undefined,
        moveOnlyWeekend: body.moveOnlyWeekend !== undefined ? Boolean(body.moveOnlyWeekend) : undefined,
        categoryInputs: body.categoryInputs && typeof body.categoryInputs === 'object' ? (body.categoryInputs as Record<string, string>) : undefined,
        additionalInfo: body.additionalInfo ? String(body.additionalInfo) : undefined
      };

      const results = runTaekilEngine(payload);
      return res.json({
        meta: {
          timezone: "Asia/Seoul",
          category: payload.category,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          total: results.length
        },
        results
      });
    } catch (error: any) {
      return res.status(400).json({
        error: "TAEKIL_ENGINE_ERROR",
        message: error?.message || "택일 추천 처리 중 오류가 발생했습니다."
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
  });
}

startServer();
