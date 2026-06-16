import crypto from "crypto";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import mysql from "mysql2/promise.js";
import { fileURLToPath } from "url";
import {
  AGENT_REGISTRY,
  BUSINESS_AGENT_IDS,
  ROUTABLE_AGENT_IDS,
  normalizeAgentId,
  selectAgentByRuleV2 as selectAgentByRuleV2Core
} from "./agentRouter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(serverRoot, ".env") });
dotenv.config({ path: path.join(serverRoot, ".env.local"), override: true });

const app = express();
app.set("trust proxy", 1);

function safeIdentifier(value, fallback) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_]+$/.test(text) ? text : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function createAsyncLimiter(maxConcurrent) {
  if (!Number.isFinite(maxConcurrent) || maxConcurrent <= 0) {
    return {
      run: async (task) => task(),
      activeCount: () => 0,
      pendingCount: () => 0
    };
  }

  let active = 0;
  const queue = [];

  const drain = () => {
    while (active < maxConcurrent && queue.length) {
      const next = queue.shift();
      active += 1;
      next.resolve(() => {
        active = Math.max(0, active - 1);
        drain();
      });
    }
  };

  return {
    async run(task) {
      const release =
        active < maxConcurrent
          ? (() => {
              active += 1;
              return () => {
                active = Math.max(0, active - 1);
                drain();
              };
            })()
          : await new Promise((resolve) => {
              queue.push({ resolve });
            });

      try {
        return await task();
      } finally {
        release();
      }
    },
    activeCount: () => active,
    pendingCount: () => queue.length
  };
}

const config = {
  port: Number(process.env.PORT || 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  authServer: (process.env.OAUTH_AUTH_SERVER || "").replace(/\/$/, ""),
  clientId: process.env.OAUTH_CLIENT_ID || "",
  clientSecret: process.env.OAUTH_CLIENT_SECRET || "",
  redirectUri: process.env.OAUTH_REDIRECT_URI || "",
  scope: process.env.OAUTH_SCOPE || "cas_get_userInfo",
  userinfoEndpoint:
    process.env.OAUTH_USERINFO_ENDPOINT ||
    `${(process.env.OAUTH_AUTH_SERVER || "").replace(/\/$/, "")}/profile`,
  sessionSecret: process.env.SESSION_SECRET || "please-change-session-secret",
  mysqlHost: process.env.MYSQL_HOST || "",
  mysqlPort: Number(process.env.MYSQL_PORT || 3306),
  mysqlUser: process.env.MYSQL_USER || "",
  mysqlPassword: process.env.MYSQL_PASSWORD || "",
  mysqlDatabase: process.env.MYSQL_DATABASE || "",
  mysqlUserTable: safeIdentifier(process.env.MYSQL_USER_TABLE, "user_info"),
  mysqlUserIdColumn: safeIdentifier(process.env.MYSQL_USER_ID_COLUMN, "user_id"),
  loginCounterTable: safeIdentifier(process.env.LOGIN_COUNTER_TABLE, "portal_login_counter"),
  llmPlannerEnabled: (process.env.LLM_PLANNER_ENABLED || "false").toLowerCase() === "true",
  llmPlannerBaseUrl: (process.env.LLM_PLANNER_BASE_URL || "").replace(/\/$/, ""),
  llmPlannerApiKey: process.env.LLM_PLANNER_API_KEY || "",
  llmPlannerModel: process.env.LLM_PLANNER_MODEL || "MiniMax-M2.5",
  difyBaseUrl: (process.env.DIFY_BASE_URL || "").replace(/\/$/, ""),
  difyChatUrl: (process.env.DIFY_CHAT_URL || "").replace(/\/$/, ""),
  difyApiKey: process.env.DIFY_API_KEY || "",
  difyJiaowuBaseUrl: (process.env.DIFY_JIAOWU_BASE_URL || "").replace(/\/$/, ""),
  difyRenshiBaseUrl: (process.env.DIFY_RENSHI_BASE_URL || "").replace(/\/$/, ""),
  difyLibraryBaseUrl: (process.env.DIFY_LIBRARY_BASE_URL || "").replace(/\/$/, ""),
  difyNongxiaoxinBaseUrl: (process.env.DIFY_NONGXIAOXIN_BASE_URL || "").replace(/\/$/, ""),
  difyXgBaseUrl: (process.env.DIFY_XG_BASE_URL || process.env.DIFY_NONGXIAOXIN_BASE_URL || "").replace(/\/$/, ""),
  difyDataBaseUrl: (process.env.DIFY_DATA_BASE_URL || "").replace(/\/$/, ""),
  difyServiceBaseUrl: (process.env.DIFY_SERVICE_BASE_URL || "").replace(/\/$/, ""),
  difyJiaowuApiKey: process.env.DIFY_JIAOWU_API_KEY || "",
  difyRenshiApiKey: process.env.DIFY_RENSHI_API_KEY || "",
  difyLibraryApiKey: process.env.DIFY_LIBRARY_API_KEY || "",
  difyNongxiaoxinApiKey: process.env.DIFY_NONGXIAOXIN_API_KEY || "",
  difyXgApiKey: process.env.DIFY_XG_API_KEY || process.env.DIFY_NONGXIAOXIN_API_KEY || "",
  difyDataApiKey: process.env.DIFY_DATA_API_KEY || "",
  difyServiceApiKey: process.env.DIFY_SERVICE_API_KEY || "",
  difyJiaowuChatUrl: (process.env.DIFY_JIAOWU_CHAT_URL || "").replace(/\/$/, ""),
  difyRenshiChatUrl: (process.env.DIFY_RENSHI_CHAT_URL || "").replace(/\/$/, ""),
  difyLibraryChatUrl: (process.env.DIFY_LIBRARY_CHAT_URL || "").replace(/\/$/, ""),
  difyNongxiaoxinChatUrl: (process.env.DIFY_NONGXIAOXIN_CHAT_URL || "").replace(/\/$/, ""),
  difyXgChatUrl: (process.env.DIFY_XG_CHAT_URL || process.env.DIFY_NONGXIAOXIN_CHAT_URL || "").replace(/\/$/, ""),
  difyDataChatUrl: (process.env.DIFY_DATA_CHAT_URL || "").replace(/\/$/, ""),
  difyDataWorkflowUrl: (process.env.DIFY_DATA_WORKFLOW_URL || "").replace(/\/$/, ""),
  difyDataWorkflowInputKey: process.env.DIFY_DATA_WORKFLOW_INPUT_KEY || "query",
  difyDataAppId: process.env.DIFY_DATA_APP_ID || "14f802c8-df92-496a-a5b0-1b2bfc6dffa1",
  difyServiceChatUrl: (process.env.DIFY_SERVICE_CHAT_URL || "").replace(/\/$/, ""),
  serviceNavigatorBaseUrl: (process.env.SERVICE_NAVIGATOR_BASE_URL || "").replace(/\/$/, ""),
  serviceNavigatorTimeoutMs: Number(process.env.SERVICE_NAVIGATOR_TIMEOUT_MS || 30000),
  serviceNavigatorEnabled: (process.env.SERVICE_NAVIGATOR_ENABLED || "true").toLowerCase() !== "false",
  difyConnectTimeoutMs: Number(process.env.DIFY_CONNECT_TIMEOUT_MS || Number(process.env.DIFY_CONNECT_TIMEOUT || 15) * 1000),
  difyReadTimeoutMs: Number(process.env.DIFY_READ_TIMEOUT_MS || Number(process.env.DIFY_READ_TIMEOUT || 600) * 1000),
  difyMaxConcurrent: positiveInteger(process.env.DIFY_MAX_CONCURRENT, 10),
  llmReadTimeoutMs: Number(process.env.LLM_READ_TIMEOUT_MS || 120000),
  mysqlPoolSize: positiveInteger(process.env.MYSQL_POOL_SIZE, 10),
  sessionStore: String(process.env.SESSION_STORE || "").trim().toLowerCase(),
  bridgeAllowedOrigins: splitCsv(
    process.env.OAUTH_BRIDGE_ALLOWED_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173"
  ),
  adminUserIds: splitCsv(process.env.ADMIN_USER_IDS || "").map((item) => String(item).toLowerCase())
};
const cookieSecure = (process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
const bridgeStatePrefix = "oauth-bridge.";
const MySQLStore = MySQLStoreFactory(session);
const difyLimiter = createAsyncLimiter(config.difyMaxConcurrent);

function validateStartupConfig() {
  const errors = [];
  const warnings = [];
  const sessionSecret = String(config.sessionSecret || "").trim();
  if (!sessionSecret || sessionSecret === "please-change-session-secret") {
    errors.push("SESSION_SECRET must be configured in production.");
  }
  for (const [key, value] of [
    ["OAUTH_AUTH_SERVER", config.authServer],
    ["OAUTH_CLIENT_ID", config.clientId],
    ["OAUTH_CLIENT_SECRET", config.clientSecret],
    ["OAUTH_REDIRECT_URI", config.redirectUri],
    ["MYSQL_HOST", config.mysqlHost],
    ["MYSQL_USER", config.mysqlUser],
    ["MYSQL_DATABASE", config.mysqlDatabase]
  ]) {
    if (!String(value || "").trim()) errors.push(`${key} must be configured in production.`);
  }
  for (const [key, raw, safe] of [
    ["MYSQL_USER_TABLE", process.env.MYSQL_USER_TABLE, config.mysqlUserTable],
    ["MYSQL_USER_ID_COLUMN", process.env.MYSQL_USER_ID_COLUMN, config.mysqlUserIdColumn],
    ["LOGIN_COUNTER_TABLE", process.env.LOGIN_COUNTER_TABLE, config.loginCounterTable]
  ]) {
    if (raw && raw !== safe) warnings.push(`${key} is not a safe SQL identifier; using fallback "${safe}".`);
  }

  for (const warning of warnings) console.warn(`[WARN] ${warning}`);
  if (process.env.NODE_ENV === "production") {
    if (errors.length) throw new Error(`[config] ${errors.join(" ")}`);
  } else {
    for (const error of errors) console.warn(`[WARN] ${error}`);
  }
}
validateStartupConfig();

let mysqlPool = null;
if (config.mysqlHost && config.mysqlUser && config.mysqlDatabase) {
  mysqlPool = mysql.createPool({
    host: config.mysqlHost,
    port: config.mysqlPort,
    user: config.mysqlUser,
    password: config.mysqlPassword,
    database: config.mysqlDatabase,
    connectionLimit: config.mysqlPoolSize,
    charset: "utf8mb4",
    timezone: "+08:00"
  });
}

let sessionStore = null;
if (config.sessionStore === "mysql") {
  if (!mysqlPool) {
    console.warn("[session] SESSION_STORE=mysql requested, but MySQL is not configured; using memory store.");
  } else {
    sessionStore = new MySQLStore(
      {
        clearExpired: true,
        checkExpirationInterval: 15 * 60 * 1000,
        expiration: 1000 * 60 * 60 * 24 * 90,
        createDatabaseTable: true,
        endConnectionOnClose: false,
        schema: {
          tableName: "portal_sessions",
          columnNames: {
            session_id: "session_id",
            expires: "expires",
            data: "data"
          }
        }
      },
      mysqlPool
    );
    sessionStore
      .onReady()
      .then(() => console.log("[session] MySQL session store ready: portal_sessions"))
      .catch((error) => console.error("[session] MySQL session store failed:", error.message));
  }
}

ensureAnalyticsColumns().catch((error) => {
  console.warn("[mysql] analytics bootstrap failed:", error.message);
});

function formatAnnouncementDate(dateValue) {
  if (!dateValue) return "";
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isPreviewImageUrl(value) {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) return false;
  return /\.(png|jpe?g|gif|bmp|webp|svg)(\?.*)?$/i.test(text) || /\/file-preview(?:[?#]|$)/i.test(text);
}

function collectDifyImageUrls(value, urls = new Set()) {
  if (!value) return urls;

  if (typeof value === "string") {
    const normalized = value.replace(/\\\//g, "/");
    if (isPreviewImageUrl(normalized)) urls.add(normalized);
    return urls;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectDifyImageUrls(item, urls));
    return urls;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectDifyImageUrls(item, urls));
  }

  return urls;
}

function getDifyEventName(event) {
  return String(event?.event || event?.data?.event || "").trim();
}

function isDifyAnswerEvent(event) {
  const eventName = getDifyEventName(event);
  if (!eventName) return Boolean(event?.answer || event?.data?.answer);
  return ["message", "agent_message"].includes(eventName);
}

function extractDifyEventContent(event) {
  if (!isDifyAnswerEvent(event)) return "";
  const text = firstNonEmpty(event?.answer, event?.data?.answer);
  const imageMarkdown = [...collectDifyImageUrls(event)]
    .filter((url) => !text.includes(url))
    .map((url) => `![image](${url})`)
    .join("\n");

  return [text, imageMarkdown].filter(Boolean).join(text && imageMarkdown ? "\n" : "");
}

function stringifyWorkflowOutput(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyWorkflowOutput).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const preferred = firstNonEmpty(
      value.answer,
      value.text,
      value.output,
      value.result,
      value.response,
      value.content,
      value.markdown,
      value.data
    );
    if (preferred) return stringifyWorkflowOutput(preferred);
    const values = Object.values(value).map(stringifyWorkflowOutput).filter(Boolean);
    return values.join("\n");
  }
  return "";
}

function extractDifyWorkflowEventContent(event) {
  const eventName = getDifyEventName(event);
  if (["text_chunk", "agent_message", "message"].includes(eventName)) {
    return firstNonEmpty(event?.data?.text, event?.data?.answer, event?.answer, event?.text);
  }
  if (eventName === "workflow_finished") {
    return stringifyWorkflowOutput(event?.data?.outputs || event?.outputs);
  }
  return "";
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMessage(value) {
  return String(value || "").trim().slice(0, 4000);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: "请先登录后再使用智能体" });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: "请先登录后再访问后台" });
  }

  const user = getSessionUser(req);
  const userId = String(user.user_id || "").toLowerCase();
  if (!config.adminUserIds.length || !config.adminUserIds.includes(userId)) {
    return res.status(403).json({ success: false, message: "当前账号没有后台权限" });
  }

  return next();
}

function getCasUserId(user) {
  const fromTopLevel = firstNonEmpty(
    user?.user_id,
    user?.userId,
    user?.UserId,
    user?.USER_ID,
    user?.id,
    user?.Id,
    user?.ID,
    user?.uid,
    user?.UID,
    user?.account,
    user?.Account
  );
  if (fromTopLevel) return fromTopLevel;

  if (Array.isArray(user?.attributes)) {
    for (const entry of user.attributes) {
      if (!entry || typeof entry !== "object") continue;
      const fromAttributes = firstNonEmpty(
        entry.id,
        entry.Id,
        entry.ID,
        entry.user_id,
        entry.UserId,
        entry.USER_ID,
        entry.uid,
        entry.UID,
        entry.account,
        entry.Account
      );
      if (fromAttributes) return fromAttributes;
    }
  }

  return "";
}

function inferSchoolUserRole(user) {
  const id = getCasUserId(user);
  if (/^\d{7}$/.test(id)) return "teacher";
  if (/^\d{8}$/.test(id)) return "student";

  const raw = `${user?.role || ""} ${user?.identityType || ""} ${user?.groupName || ""} ${user?.GroupName || ""} ${user?.major || ""}`.toLowerCase();
  if (/teacher|faculty|staff|admin|教职工|教师|老师|行政/.test(raw)) return "teacher";
  return "student";
}
function getSessionUser(req) {
  const sessionUser = req.session?.user || {};
  return {
    user_id: getCasUserId(sessionUser) || "guest",
    name: sessionUser.name || sessionUser.Name || sessionUser.user_name || "访客",
    college: sessionUser.college || sessionUser.OrgName || "",
    major: sessionUser.major || sessionUser.Speciality || "",
    groupName: sessionUser.groupName || sessionUser.GroupName || "",
    role: inferSchoolUserRole(sessionUser)
  };
}

async function upsertPortalUser(userRaw) {
  if (!mysqlPool) return { ok: false, reason: "mysql_not_configured" };

  const normalized = normalizeCasUser(userRaw || {});
  const userId = normalized.user_id || getCasUserId(userRaw);
  if (!userId || userId === "guest") return { ok: false, reason: "missing_user_id" };

  try {
    await mysqlPool.query(
      `INSERT INTO portal_users
       (user_id, user_name, user_role, college, major, class_name, gender, group_name, email, phone, raw_json, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         user_name = VALUES(user_name),
         user_role = VALUES(user_role),
         college = VALUES(college),
         major = VALUES(major),
         class_name = VALUES(class_name),
         gender = VALUES(gender),
         group_name = VALUES(group_name),
         email = VALUES(email),
         phone = VALUES(phone),
         raw_json = VALUES(raw_json),
         last_seen_at = NOW()`,
      [
        userId,
        normalized.name || userRaw?.name || userRaw?.Name || "",
        normalized.role || inferSchoolUserRole(userRaw),
        normalized.college || userRaw?.college || userRaw?.OrgName || "",
        normalized.major || userRaw?.major || userRaw?.Speciality || "",
        normalized.class || userRaw?.class || userRaw?.Clazz || "",
        normalized.gender || userRaw?.gender || userRaw?.Gender || "",
        normalized.groupName || userRaw?.groupName || userRaw?.GroupName || "",
        normalized.email || userRaw?.email || userRaw?.Email || "",
        normalized.phone || userRaw?.phone || userRaw?.Phone || userRaw?.ContactTel || "",
        jsonOrNull(userRaw)
      ]
    );
    return { ok: true, user_id: userId };
  } catch (error) {
    console.warn("[portal-users] upsert failed:", error.message);
    return { ok: false, reason: error.message };
  }
}

function normalizeRankType(value) {
  return value === "teacher" ? "teacher" : "student";
}

function normalizePeriod(value) {
  if (value === "month" || value === "all") return value;
  return "week";
}

function normalizeRankingMetric(value) {
  return value === "total_tokens" ? "total_tokens" : "effective_runs";
}

function maskDisplayName(value) {
  const name = String(value || "").trim();
  if (!name) return "匿名用户";
  if (name.length === 1) return `${name}*`;
  if (name.length === 2) return `${name.slice(0, 1)}*`;
  return `${name.slice(0, 1)}*${name.slice(-1)}`;
}

function getUserRankType(user) {
  return inferSchoolUserRole(user);
}

function getPeriodStart(period) {
  if (period === "all") return null;
  const date = new Date();
  const days = period === "month" ? 30 : 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeInteger(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function queryOrFallback(sql, params = [], fallback = []) {
  if (!mysqlPool) return fallback;
  try {
    const [rows] = await mysqlPool.query(sql, params);
    return Array.isArray(rows) ? rows : fallback;
  } catch (error) {
    console.warn("[mysql] query fallback:", error.message);
    return fallback;
  }
}

async function executeOrFallback(sql, params = []) {
  if (!mysqlPool) return { ok: false, reason: "mysql_not_configured" };
  try {
    const [result] = await mysqlPool.query(sql, params);
    return { ok: true, result };
  } catch (error) {
    console.warn("[mysql] execute failed:", error.message);
    return { ok: false, reason: error.message };
  }
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "";
}

function hashForAnalytics(value) {
  const text = String(value || "").trim();
  return text ? crypto.createHash("sha256").update(text).digest("hex") : null;
}

function adminRangeToSql(value) {
  const range = String(value || "today").toLowerCase();
  if (range === "7d") return { range, where: ">= DATE_SUB(NOW(), INTERVAL 7 DAY)" };
  if (range === "30d") return { range, where: ">= DATE_SUB(NOW(), INTERVAL 30 DAY)" };
  return { range: "today", where: ">= CURDATE()" };
}

function normalizeQuestionForTop(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[，。！？；、,.!?;:：]+$/g, "")
    .trim()
    .slice(0, 500);
}

function parseResponseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function recordVisitEvent(req, user, pagePath = "") {
  if (!mysqlPool || !user) return;
  const normalized = {
    user_id: getCasUserId(user) || user.user_id || user.id || "guest",
    name: user.name || user.Name || user.user_name || "",
    college: user.college || user.OrgName || "",
    role: inferSchoolUserRole(user)
  };

  try {
    await mysqlPool.query(
      `INSERT INTO portal_visit_events
       (user_id, user_name, user_role, college, path, ip_hash, user_agent, visited_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        String(normalized.user_id),
        normalized.name,
        normalized.role,
        normalized.college,
        String(pagePath || req.path || "").slice(0, 255),
        hashForAnalytics(getClientIp(req)),
        String(req.headers["user-agent"] || "").slice(0, 500)
      ]
    );
  } catch (error) {
    console.warn("[visit] record failed:", error.message);
  }
}

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(12).toString("hex")}`;
}

function jsonOrNull(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function normalizeUsageValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

function normalizeUsage(usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const promptTokens = normalizeUsageValue(
    source.prompt_tokens ?? source.input_tokens ?? source.promptTokens
  );
  const completionTokens = normalizeUsageValue(
    source.completion_tokens ?? source.output_tokens ?? source.completionTokens
  );
  const totalTokens = normalizeUsageValue(
    source.total_tokens ?? source.totalTokens ?? promptTokens + completionTokens
  );

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens
  };
}

function usageFromEvent(event) {
  if (!event || typeof event !== "object") return normalizeUsage();
  return normalizeUsage(
    event?.metadata?.usage ||
      event?.data?.metadata?.usage ||
      event?.usage ||
      event?.data?.usage
  );
}

function mergeUsage(base, next) {
  const left = normalizeUsage(base);
  const right = normalizeUsage(next);
  if (!right.total_tokens && !right.prompt_tokens && !right.completion_tokens) return left;
  return right;
}

function sumUsage(...items) {
  return items.reduce(
    (total, item) => {
      const usage = normalizeUsage(item);
      return {
        prompt_tokens: total.prompt_tokens + usage.prompt_tokens,
        completion_tokens: total.completion_tokens + usage.completion_tokens,
        total_tokens: total.total_tokens + usage.total_tokens
      };
    },
    normalizeUsage()
  );
}

async function ensureAnalyticsColumns() {
  if (!mysqlPool) return;
  try {
    await mysqlPool.query(
      `CREATE TABLE IF NOT EXISTS portal_visit_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id VARCHAR(128) NOT NULL,
        user_name VARCHAR(255) DEFAULT NULL,
        user_role VARCHAR(64) DEFAULT NULL,
        college VARCHAR(255) DEFAULT NULL,
        path VARCHAR(255) DEFAULT NULL,
        ip_hash CHAR(64) DEFAULT NULL,
        user_agent VARCHAR(500) DEFAULT NULL,
        visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_visit_user_time (user_id, visited_at),
        KEY idx_visit_time (visited_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  } catch (error) {
    console.warn("[mysql] ensure visit events table failed:", error.message);
  }

  const columns = [
    ["portal_usage_counter", "prompt_token_count", "BIGINT UNSIGNED NOT NULL DEFAULT 0", "total_tool_call_count"],
    ["portal_usage_counter", "completion_token_count", "BIGINT UNSIGNED NOT NULL DEFAULT 0", "prompt_token_count"],
    ["portal_usage_counter", "total_token_count", "BIGINT UNSIGNED NOT NULL DEFAULT 0", "completion_token_count"],
    ["portal_agent_daily_stats", "prompt_token_count", "BIGINT UNSIGNED NOT NULL DEFAULT 0", "total_tool_call_count"],
    ["portal_agent_daily_stats", "completion_token_count", "BIGINT UNSIGNED NOT NULL DEFAULT 0", "prompt_token_count"],
    ["portal_agent_daily_stats", "total_token_count", "BIGINT UNSIGNED NOT NULL DEFAULT 0", "completion_token_count"]
  ];

  for (const [tableName, columnName, columnDefinition, afterColumn] of columns) {
    try {
      const [rows] = await mysqlPool.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?`,
        [tableName, columnName]
      );
      if (Number(rows?.[0]?.count || 0) > 0) continue;

      await mysqlPool.query(
        `ALTER TABLE \`${tableName}\`
         ADD COLUMN \`${columnName}\` ${columnDefinition} AFTER \`${afterColumn}\``
      );
    } catch (error) {
      if (error?.code === "ER_DUP_FIELDNAME") continue;
      console.warn("[mysql] ensure analytics columns failed:", error.message);
    }
  }
}

function getIntentLabel(agent) {
  const mapping = {
    jiaowu: "academic_affairs",
    library: "library_resource",
    xg: "student_affairs",
    data: "campus_data",
    service: "campus_service",
    general: "general_chat"
  };
  return mapping[agent?.id] || "campus_super_agent";
}

function getToolDescriptor(agent) {
  return {
    toolId: agent.toolId || `dify-${agent.id}`,
    toolName: agent.toolName || `call_dify_${agent.id}`,
    displayName: agent.name || agent.id,
    provider: agent.provider || "dify",
    category: getIntentLabel(agent),
    endpointUrl: agent.chatUrl || "",
    requestMode: agent.requestMode || "streaming"
  };
}

async function recordAgentStep({ runId, sessionId, index, type, name, title, content, input, output, status = "success", errorMessage, latencyMs, startedAt, finishedAt }) {
  if (!mysqlPool) return { ok: false, reason: "mysql_not_configured" };
  try {
    await mysqlPool.query(
      `INSERT INTO portal_agent_run_steps
       (step_id, run_id, session_id, step_index, step_type, step_name, title, content, input_json, output_json, status, error_message, latency_ms, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId("step"),
        runId,
        sessionId,
        index,
        type,
        name,
        title || null,
        content || null,
        jsonOrNull(input),
        jsonOrNull(output),
        status,
        errorMessage || null,
        latencyMs || null,
        startedAt ? new Date(startedAt) : null,
        finishedAt ? new Date(finishedAt) : null
      ]
    );
    return { ok: true };
  } catch (error) {
    console.warn("[agent/step] failed:", error.message);
    return { ok: false, reason: error.message };
  }
}

async function upsertAgentTool(agent) {
  if (!mysqlPool) return { ok: false, reason: "mysql_not_configured" };
  const tool = getToolDescriptor(agent);
  try {
    await mysqlPool.query(
      `INSERT INTO portal_agent_tools
       (tool_id, tool_name, display_name, provider, category, description, endpoint_url, request_mode, config_json, is_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         provider = VALUES(provider),
         category = VALUES(category),
         endpoint_url = VALUES(endpoint_url),
         request_mode = VALUES(request_mode),
         config_json = VALUES(config_json),
         is_enabled = 1`,
      [
        tool.toolId,
        tool.toolName,
        tool.displayName,
        tool.provider,
        tool.category,
        "A Dify capability called by the code-built campus super agent.",
        tool.endpointUrl,
        tool.requestMode,
        jsonOrNull({ source: "server_env", agent_id: agent.id })
      ]
    );
    return { ok: true, tool };
  } catch (error) {
    console.warn("[agent/tool] failed:", error.message);
    return { ok: false, tool, reason: error.message };
  }
}

async function createAgentRun({ sessionId, runId, user, message }) {
  if (!mysqlPool) return { ok: false, reason: "mysql_not_configured" };
  const userId = String(user.user_id || "guest");
  const rankType = getUserRankType(user);
  try {
    await mysqlPool.query(
      `INSERT INTO portal_agent_sessions
       (session_id, user_id, user_name, user_role, college, major, title, first_message_at, last_message_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         user_name = VALUES(user_name),
         user_role = VALUES(user_role),
         college = VALUES(college),
         major = VALUES(major),
         title = COALESCE(title, VALUES(title)),
         last_message_at = NOW(),
         status = 'active'`,
      [sessionId, userId, user.name || "", rankType, user.college || "", user.major || "", message.slice(0, 80)]
    );

    await mysqlPool.query(
      `INSERT INTO portal_agent_runs
       (run_id, session_id, user_id, user_name, user_role, college, major, question, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', NOW())`,
      [runId, sessionId, userId, user.name || "", rankType, user.college || "", user.major || "", message]
    );

    await mysqlPool.query(
      `INSERT INTO portal_agent_messages
       (message_id, session_id, run_id, user_id, role, content, content_type, meta_json)
       VALUES (?, ?, ?, ?, 'user', ?, 'text', ?)`,
      [newId("msg"), sessionId, runId, userId, message, jsonOrNull({ source: "portal_chat_input" })]
    );

    return { ok: true };
  } catch (error) {
    console.warn("[agent/run] create failed:", error.message);
    return { ok: false, reason: error.message };
  }
}

async function recordAgentToolCall({
  callId,
  runId,
  sessionId,
  agent,
  request,
  responseText,
  responseConversationId,
  responseJson,
  usage,
  status,
  errorMessage,
  latencyMs,
  startedAt,
  finishedAt
}) {
  if (!mysqlPool) return { ok: false, reason: "mysql_not_configured" };
  const tool = getToolDescriptor(agent);
  const normalizedUsage = normalizeUsage(usage);
  try {
    await mysqlPool.query(
      `INSERT INTO portal_agent_tool_calls
       (call_id, run_id, session_id, tool_id, tool_name, provider, request_json, response_json, response_text, status, error_message, latency_ms, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        callId,
        runId,
        sessionId,
        tool.toolId,
        tool.toolName,
        tool.provider,
        jsonOrNull(request),
        jsonOrNull({
          answer_length: String(responseText || "").length,
          conversation_id: responseConversationId || "",
          usage: normalizedUsage,
          ...(responseJson && typeof responseJson === "object" ? responseJson : {})
        }),
        responseText || "",
        status,
        errorMessage || null,
        latencyMs || null,
        startedAt ? new Date(startedAt) : null,
        finishedAt ? new Date(finishedAt) : null
      ]
    );
    return { ok: true };
  } catch (error) {
    console.warn("[agent/tool-call] failed:", error.message);
    return { ok: false, reason: error.message };
  }
}

async function finishAgentRun({
  sessionId,
  runId,
  user,
  agent,
  answer,
  status,
  errorMessage,
  latencyMs,
  toolCallCount = 1,
  usage
}) {
  if (!mysqlPool) return { logged: false, counted: false, reason: "mysql_not_configured" };
  const userId = String(user.user_id || "guest");
  const rankType = getUserRankType(user);
  const success = status === "success" && Boolean(String(answer || "").trim());
  const effective = success ? 1 : 0;
  const errorCount = success ? 0 : 1;
  const successCount = success ? 1 : 0;
  const intentLabel = getIntentLabel(agent);
  const tool = getToolDescriptor(agent);
  const tokenUsage = success ? normalizeUsage(usage) : normalizeUsage();

  try {
    await mysqlPool.query(
      `UPDATE portal_agent_runs
       SET final_answer = ?, intent_label = ?, planner_type = ?, planner_model = ?, status = ?, is_effective = ?, error_message = ?, latency_ms = ?, finished_at = NOW()
       WHERE run_id = ?`,
      [
        answer || "",
        intentLabel,
        agent.planner || "rule",
        agent.planner === "llm" ? config.llmPlannerModel : null,
        success ? "success" : "error",
        effective,
        success ? null : errorMessage || "empty_answer",
        latencyMs || null,
        runId
      ]
    );

    if (answer) {
      await mysqlPool.query(
        `INSERT INTO portal_agent_messages
         (message_id, session_id, run_id, user_id, role, content, content_type, meta_json)
         VALUES (?, ?, ?, ?, 'assistant', ?, 'text', ?)`,
        [newId("msg"), sessionId, runId, userId, answer, jsonOrNull({ tool_name: tool.toolName, intent_label: intentLabel })]
      );
    }

    await mysqlPool.query(
      `UPDATE portal_agent_sessions
       SET last_message_at = NOW(), status = 'active'
       WHERE session_id = ?`,
      [sessionId]
    );

    await mysqlPool.query(
      `INSERT INTO portal_usage_counter
       (user_id, user_name, user_role, college, major, total_run_count, success_run_count, error_run_count, effective_run_count, total_tool_call_count, prompt_token_count, completion_token_count, total_token_count, top_intent_label, top_tool_name, last_run_id, last_run_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         user_name = VALUES(user_name),
         user_role = VALUES(user_role),
         college = VALUES(college),
         major = VALUES(major),
         total_run_count = total_run_count + 1,
         success_run_count = success_run_count + VALUES(success_run_count),
         error_run_count = error_run_count + VALUES(error_run_count),
         effective_run_count = effective_run_count + VALUES(effective_run_count),
         total_tool_call_count = total_tool_call_count + VALUES(total_tool_call_count),
         prompt_token_count = prompt_token_count + VALUES(prompt_token_count),
         completion_token_count = completion_token_count + VALUES(completion_token_count),
         total_token_count = total_token_count + VALUES(total_token_count),
         top_intent_label = VALUES(top_intent_label),
         top_tool_name = VALUES(top_tool_name),
         last_run_id = VALUES(last_run_id),
         last_run_at = NOW()`,
      [
        userId,
        user.name || "",
        rankType,
        user.college || "",
        user.major || "",
        successCount,
        errorCount,
        effective,
        toolCallCount,
        tokenUsage.prompt_tokens,
        tokenUsage.completion_tokens,
        tokenUsage.total_tokens,
        intentLabel,
        tool.toolName,
        runId
      ]
    );

    await mysqlPool.query(
      `INSERT INTO portal_agent_daily_stats
       (stat_date, user_id, user_name, user_role, college, major, total_run_count, success_run_count, error_run_count, effective_run_count, total_tool_call_count, prompt_token_count, completion_token_count, total_token_count)
       VALUES (CURDATE(), ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_name = VALUES(user_name),
         user_role = VALUES(user_role),
         college = VALUES(college),
         major = VALUES(major),
         total_run_count = total_run_count + 1,
         success_run_count = success_run_count + VALUES(success_run_count),
         error_run_count = error_run_count + VALUES(error_run_count),
         effective_run_count = effective_run_count + VALUES(effective_run_count),
         total_tool_call_count = total_tool_call_count + VALUES(total_tool_call_count),
         prompt_token_count = prompt_token_count + VALUES(prompt_token_count),
         completion_token_count = completion_token_count + VALUES(completion_token_count),
         total_token_count = total_token_count + VALUES(total_token_count)`,
      [
        userId,
        user.name || "",
        rankType,
        user.college || "",
        user.major || "",
        successCount,
        errorCount,
        effective,
        toolCallCount,
        tokenUsage.prompt_tokens,
        tokenUsage.completion_tokens,
        tokenUsage.total_tokens
      ]
    );

    return { logged: true, counted: Boolean(effective) };
  } catch (error) {
    console.warn("[agent/run] finish failed:", error.message);
    return { logged: false, counted: false, reason: error.message };
  }
}
function buildAgent(agentId) {
  const normalizedAgentId = normalizeAgentId(agentId, "jiaowu");
  const registry = AGENT_REGISTRY[normalizedAgentId] || AGENT_REGISTRY.jiaowu;

  if (normalizedAgentId === "general") {
    return {
      ...registry,
      id: "general",
      name: "农芯智 AI",
      toolId: "minimax-general-chat",
      toolName: "minimax_general_chat",
      provider: "minimax",
      requestMode: "chat_completion",
      apiKey: config.llmPlannerApiKey,
      chatUrl: config.llmPlannerBaseUrl ? `${config.llmPlannerBaseUrl}/chat/completions` : ""
    };
  }

  if (normalizedAgentId === "library") {
    return {
      ...registry,
      id: "library",
      name: "AI 馆员",
      toolName: "call_dify_library",
      apiKey: config.difyLibraryApiKey || config.difyApiKey,
      chatUrl: resolveDifyChatUrl(config.difyLibraryChatUrl, config.difyLibraryBaseUrl)
    };
  }

  if (normalizedAgentId === "xg") {
    return {
      ...registry,
      id: "xg",
      name: "学工智能体",
      toolName: "call_dify_xg",
      apiKey: config.difyXgApiKey || config.difyApiKey,
      chatUrl: resolveDifyChatUrl(config.difyXgChatUrl, config.difyXgBaseUrl)
    };
  }

  if (normalizedAgentId === "data") {
    return {
      ...registry,
      id: "data",
      name: "AI问数",
      toolName: "call_dify_data",
      requestMode: "workflow",
      appId: config.difyDataAppId,
      apiKey: config.difyDataApiKey || config.difyApiKey,
      chatUrl: resolveDifyWorkflowUrl(config.difyDataWorkflowUrl || config.difyDataChatUrl, config.difyDataBaseUrl),
      workflowInputKey: config.difyDataWorkflowInputKey
    };
  }

  if (normalizedAgentId === "service") {
    return {
      ...registry,
      id: "service",
      name: "AI办事",
      toolName: "call_dify_service",
      apiKey: config.difyServiceApiKey || config.difyApiKey,
      chatUrl: resolveDifyChatUrl(config.difyServiceChatUrl, config.difyServiceBaseUrl)
    };
  }

  return {
    ...registry,
    id: "jiaowu",
    name: "教务智能体",
    toolName: "call_dify_jiaowu",
    apiKey: config.difyJiaowuApiKey || config.difyApiKey,
    chatUrl: resolveDifyChatUrl(config.difyJiaowuChatUrl, config.difyJiaowuBaseUrl)
  };
}

function hydrateRoute(route, planner = route?.planner || "rule") {
  const idsFromRoute = Array.isArray(route?.agentIds)
    ? route.agentIds
    : Array.isArray(route?.agents)
      ? route.agents.map((item) => item?.id)
      : [route?.agentId || route?.agent?.id || "general"];
  const agentIds = [...new Set(idsFromRoute.map((id) => normalizeAgentId(id)).filter((id) => ROUTABLE_AGENT_IDS.includes(id)))];
  const finalAgentIds = agentIds.length ? agentIds : ["general"];
  const agents = finalAgentIds.map((id) => ({
    ...buildAgent(id),
    planner,
    reason: route?.reason || ""
  }));
  const clarification = route?.clarification_question || route?.clarificationQuestion || route?.message || "";
  return {
    ...route,
    strategy: route?.strategy || "single_agent",
    agent: agents[0],
    agentId: finalAgentIds[0],
    agents,
    agentIds: finalAgentIds,
    planner,
    confidence: Number.isFinite(Number(route?.confidence)) ? Number(route.confidence) : 0,
    reason: route?.reason || "",
    matchedKeywords: route?.matchedKeywords || {},
    candidates: Array.isArray(route?.candidates) ? route.candidates : [],
    clarification_question: clarification,
    message: clarification
  };
}

function publicRoute(route) {
  return {
    strategy: route?.strategy || "single_agent",
    agentId: route?.agentId || "",
    agentIds: Array.isArray(route?.agentIds) ? route.agentIds : [],
    selected_agent: route?.agentId || "",
    selected_agents: Array.isArray(route?.agentIds) ? route.agentIds : [],
    agents: Array.isArray(route?.agents)
      ? route.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          type: agent.type || AGENT_REGISTRY[agent.id]?.type || "",
          provider: agent.provider || AGENT_REGISTRY[agent.id]?.provider || "",
          toolName: agent.toolName || ""
        }))
      : [],
    confidence: Number(route?.confidence || 0),
    reason: route?.reason || "",
    matchedKeywords: route?.matchedKeywords || {},
    candidates: route?.candidates || [],
    planner: route?.planner || "rule",
    clarification_question: route?.clarification_question || ""
  };
}

function routeLogOutput(route) {
  const safeRoute = publicRoute(route);
  return {
    strategy: safeRoute.strategy,
    selected_agents: safeRoute.selected_agents,
    selected_agent: safeRoute.selected_agent,
    confidence: safeRoute.confidence,
    reason: safeRoute.reason,
    matched_keywords: safeRoute.matchedKeywords,
    candidates: safeRoute.candidates,
    planner: safeRoute.planner
  };
}

function selectAgentByRuleV2(message, context = {}) {
  return hydrateRoute(selectAgentByRuleV2Core(message, context), "rule");
}

function selectAgentByRule(message) {
  return selectAgentByRuleV2(message).agent;
}

function extractPlannerJson(content) {
  const text = String(content || "").replace(/```json|```/g, "").trim();
  const direct = parseMaybeJson(text);
  if (direct && typeof direct === "object") return direct;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const sliced = text.slice(first, last + 1);
    const parsed = parseMaybeJson(sliced);
    if (parsed && typeof parsed === "object") return parsed;
  }
  return null;
}

function clampConfidence(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

function routeFromPlannerDecision(decision) {
  const rawStrategy = String(decision?.strategy || "").trim();
  let strategy = rawStrategy === "multi_intent_clarify" ? "multi_agent_parallel" : rawStrategy;
  if (!["single_agent", "multi_agent_parallel", "clarify", "fallback"].includes(strategy)) {
    strategy = "fallback";
  }

  const rawAgents = Array.isArray(decision?.agents)
    ? decision.agents
    : [decision?.agent || decision?.agentId].filter(Boolean);
  let agentIds = [...new Set(rawAgents.map((id) => normalizeAgentId(id)).filter((id) => ROUTABLE_AGENT_IDS.includes(id)))];
  const confidence = clampConfidence(decision?.confidence, 0.5);
  const clarificationQuestion = String(decision?.clarification_question || "").trim();

  if (confidence < 0.65 || strategy === "clarify") {
    return hydrateRoute(
      {
        strategy: "clarify",
        agentIds: ["general"],
        confidence,
        reason: decision?.reason || "LLM Router 判断用户意图不明确。",
        planner: "llm",
        clarification_question:
          clarificationQuestion || "我还需要确认一下：你想咨询教务、图书馆、学工业务，还是让我按普通问题帮你处理？"
      },
      "llm"
    );
  }

  if (strategy === "multi_agent_parallel") {
    agentIds = agentIds.filter((id) => BUSINESS_AGENT_IDS.includes(id));
    if (agentIds.length < 2) {
      strategy = "single_agent";
    }
  }

  if (strategy === "fallback" || !agentIds.length) {
    agentIds = ["general"];
    strategy = "single_agent";
  }

  if (strategy === "single_agent" && agentIds.length > 1) {
    agentIds = [agentIds[0]];
  }

  return hydrateRoute(
    {
      strategy,
      agentIds,
      confidence,
      reason: decision?.reason || "LLM Router selected route.",
      planner: "llm",
      clarification_question: clarificationQuestion
    },
    "llm"
  );
}

async function callLlmRouter(message) {
  const capabilityText = ROUTABLE_AGENT_IDS.map((id) => {
    const agent = AGENT_REGISTRY[id];
    return `- ${agent.id}：${agent.description}`;
  }).join("\n");

  const response = await fetch(`${config.llmPlannerBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llmPlannerApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.llmPlannerModel,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "你是“农芯智 AI”的智能路由器。农芯智是校园 AI 门户的总入口和总控智能体，不是普通子智能体。",
            "",
            "可选能力：",
            capabilityText,
            "",
            "判断原则：",
            "1. 如果用户是在写作、润色、总结、翻译、代码解释，即使内容中出现“教务/图书馆/学工”等词，也优先 general。",
            "2. 如果用户询问学校业务流程、办理入口、政策、查询、申请、预约，优先对应业务智能体。",
            "3. 如果用户问题同时包含多个业务事项，返回 strategy = \"multi_agent_parallel\"，agents 填多个业务智能体。",
            "4. 如果用户意图不明确，返回 strategy = \"clarify\"。",
            "5. 不要编造学校内部数据。",
            "6. 只返回 JSON，不要 Markdown，不要解释。",
            "",
            "JSON 格式：",
            "{\"strategy\":\"single_agent | multi_agent_parallel | clarify | fallback\",\"agents\":[\"general\"],\"confidence\":0.0,\"reason\":\"简短原因\",\"clarification_question\":\"\"}"
          ].join("\n")
        },
        {
          role: "user",
          content: normalizeMessage(message)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`planner status ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const decision = extractPlannerJson(content);
  if (!decision) {
    throw new Error("planner returned non-json content");
  }
  return routeFromPlannerDecision(decision);
}

async function selectAgent(message, context = {}) {
  let previousAgentId = normalizeAgentId(context.previousAgentId, "");
  if (!previousAgentId && context.sessionId) {
    previousAgentId = await getLatestSessionAgent({ sessionId: context.sessionId });
  }

  const routeContext = { ...context, previousAgentId };
  const ruleRoute = selectAgentByRuleV2(message, routeContext);
  const confidentRule =
    (ruleRoute.strategy === "single_agent" && ruleRoute.confidence >= 0.85) ||
    ruleRoute.strategy === "context_followup" ||
    ruleRoute.strategy === "multi_agent_parallel";
  if (confidentRule) return ruleRoute;

  if (!config.llmPlannerEnabled || !config.llmPlannerBaseUrl || !config.llmPlannerApiKey) {
    return ruleRoute;
  }

  try {
    return await callLlmRouter(message);
  } catch (error) {
    console.warn("[chat/planner] fallback to rule planner:", error.message);
    if (ruleRoute.strategy === "clarify" || ruleRoute.confidence < 0.45) {
      return hydrateRoute(
        {
          strategy: "single_agent",
          agentIds: ["general"],
          confidence: 0.65,
          reason: "LLM Router failed and rule planner was uncertain; fallback to general.",
          planner: "rule"
        },
        "rule"
      );
    }
    return hydrateRoute(
      {
        ...ruleRoute,
        reason: `${ruleRoute.reason || "Rule planner selected route."} LLM Router failed; fallback to rule planner.`
      },
      "rule"
    );
  }
}

function agentIdFromToolName(toolName) {
  const text = String(toolName || "");
  if (text.includes("jiaowu")) return "jiaowu";
  if (text.includes("library")) return "library";
  if (text.includes("xg") || text.includes("nongxiaoxin")) return "xg";
  if (text.includes("data")) return "data";
  if (text.includes("service")) return "service";
  return "";
}

async function getLatestSessionAgent({ sessionId }) {
  if (!mysqlPool || !sessionId) return "";
  try {
    const [rows] = await mysqlPool.query(
      `SELECT c.tool_name
       FROM portal_agent_tool_calls c
       LEFT JOIN portal_agent_runs r ON r.run_id = c.run_id
       WHERE c.session_id = ?
         AND c.status = 'success'
          AND c.tool_name IN ('call_dify_jiaowu', 'call_dify_library', 'call_dify_xg', 'call_dify_nongxiaoxin', 'call_dify_data', 'call_dify_service')
         AND (r.status IS NULL OR r.status = 'success')
       ORDER BY COALESCE(c.finished_at, c.created_at) DESC, c.id DESC
       LIMIT 1`,
      [sessionId]
    );
    const fromTool = agentIdFromToolName(rows?.[0]?.tool_name);
    if (fromTool) return fromTool;
  } catch (error) {
    console.warn("[agent/session] failed to load latest tool agent:", error.message);
  }

  try {
    const [rows] = await mysqlPool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(output_json, '$.selected_agent')) AS selected_agent
       FROM portal_agent_run_steps
       WHERE session_id = ?
         AND step_type = 'planner'
         AND status = 'success'
         AND JSON_EXTRACT(output_json, '$.selected_agent') IS NOT NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [sessionId]
    );
    const agentId = normalizeAgentId(rows?.[0]?.selected_agent, "");
    return BUSINESS_AGENT_IDS.includes(agentId) ? agentId : "";
  } catch (error) {
    console.warn("[agent/session] failed to load latest planner agent:", error.message);
    return "";
  }
}

async function getLatestDifyConversationId({ sessionId, agent }) {
  if (!mysqlPool || !sessionId || !agent?.toolName) return "";
  try {
    const [rows] = await mysqlPool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(response_json, '$.conversation_id')) AS conversation_id
       FROM portal_agent_tool_calls
       WHERE session_id = ?
         AND tool_name = ?
         AND provider = 'dify'
         AND status = 'success'
         AND JSON_UNQUOTE(JSON_EXTRACT(response_json, '$.conversation_id')) IS NOT NULL
         AND JSON_UNQUOTE(JSON_EXTRACT(response_json, '$.conversation_id')) <> ''
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [sessionId, agent.toolName]
    );
    return String(rows?.[0]?.conversation_id || "").trim();
  } catch (error) {
    console.warn("[agent/session] failed to load dify conversation:", error.message);
    return "";
  }
}
function writeSse(res, payload) {
  if (res.locals?.sse?.closed || res.destroyed || res.writableEnded) return false;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  res.flush?.();
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitAnswerForStreaming(content) {
  const text = String(content || "");
  if (!text) return [];
  const chunks = [];
  let buffer = "";

  for (const char of text) {
    buffer += char;
    const shouldFlush =
      buffer.length >= 36 ||
      (buffer.length >= 14 && /[。！？；;.!?\n]$/.test(buffer)) ||
      (buffer.length >= 22 && /[,，、]\s*$/.test(buffer));
    if (shouldFlush) {
      chunks.push(buffer);
      buffer = "";
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}

async function writeAnswerChunks(res, payload, content, { paced = false } = {}) {
  const chunks = splitAnswerForStreaming(content);
  for (const chunk of chunks) {
    const ok = writeSse(res, { ...payload, content: chunk });
    if (!ok) return false;
    if (paced) await sleep(18);
  }
  return true;
}

function mockAgentAnswer(message, agent) {
  return [
    `${agent.name}已收到你的问题：“${message}”。`,
    "当前服务器还没有配置 Dify API Key，所以这里先返回本地模拟结果。",
    "配置好 DIFY_*_BASE_URL 和对应的 DIFY_*_API_KEY 后，这个入口会自动转为真实智能体流式回答。"
  ].join("\n");
}

function resolveDifyChatUrl(chatUrl, baseUrl) {
  const directUrl = (chatUrl || "").replace(/\/$/, "");
  if (directUrl) return directUrl;

  const resolvedBaseUrl = (baseUrl || config.difyBaseUrl || "").replace(/\/$/, "");
  if (!resolvedBaseUrl) return config.difyChatUrl;
  return `${resolvedBaseUrl}/v1/chat-messages`;
}

function resolveDifyWorkflowUrl(workflowUrl, baseUrl) {
  const directUrl = (workflowUrl || "").replace(/\/$/, "");
  if (directUrl) return directUrl;

  const resolvedBaseUrl = (baseUrl || config.difyBaseUrl || "").replace(/\/$/, "");
  if (!resolvedBaseUrl) return "";
  return `${resolvedBaseUrl}/v1/workflows/run`;
}

async function streamDifyWorkflowAnswer({ res, message, user, agent, inputs = {}, emitChunks = true }) {
  if (!agent.chatUrl || !agent.apiKey) {
    const answer = mockAgentAnswer(message, agent);
    if (emitChunks && res) {
      await writeAnswerChunks(
        res,
        {
          type: "answer_chunk",
          tool_name: agent.toolName
        },
        answer,
        { paced: true }
      );
    }
    return { answer, conversation_id: "", usage: normalizeUsage(), response_json: {} };
  }

  return difyLimiter.run(async () => {
    if (res?.locals?.sse?.closed || res?.destroyed || res?.writableEnded) {
      throw new Error("client_closed_before_dify_workflow_request");
    }

    const controller = new AbortController();
    const readTimer = setTimeout(() => controller.abort(), config.difyReadTimeoutMs);
    let connectTimer = null;

    const clearConnectTimer = () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
    };

    try {
      const workflowInputs = inputs && typeof inputs === "object" && !Array.isArray(inputs) ? { ...inputs } : {};
      const inputKey = String(agent.workflowInputKey || "query").trim();
      if (inputKey && workflowInputs[inputKey] == null) {
        workflowInputs[inputKey] = normalizeMessage(message);
      }

      clearConnectTimer();
      connectTimer = setTimeout(() => controller.abort(), config.difyConnectTimeoutMs);
      const response = await fetch(agent.chatUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${agent.apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({
          inputs: workflowInputs,
          response_mode: "streaming",
          user: String(user.user_id || "guest")
        })
      });
      clearConnectTimer();

      if (!response.ok || !response.body) {
        const detail = await response.text();
        throw new Error(`Dify workflow request failed: ${response.status} ${detail}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let answer = "";
      let latestUsage = normalizeUsage();
      let latestEvent = null;
      let streamedWorkflowText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;

          const raw = dataLine.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          const event = parseMaybeJson(raw);
          if (!event || typeof event !== "object") continue;

          latestEvent = event;
          latestUsage = mergeUsage(latestUsage, usageFromEvent(event));
          const content = extractDifyWorkflowEventContent(event);
          if (typeof content === "string" && content) {
            const eventName = getDifyEventName(event);
            let emitContent = content;
            if (eventName === "workflow_finished" && streamedWorkflowText.trim()) {
              const streamed = streamedWorkflowText.trim();
              const finished = content.trim();
              if (finished === streamed) {
                emitContent = "";
              } else if (finished.startsWith(streamed)) {
                emitContent = finished.slice(streamed.length);
              }
            }
            if (eventName !== "workflow_finished") {
              streamedWorkflowText += emitContent;
            }
            answer += emitContent;
            if (emitChunks && res) {
              await writeAnswerChunks(
                res,
                {
                  type: "answer_chunk",
                  tool_name: agent.toolName,
                  conversation_id: ""
                },
                emitContent,
                { paced: eventName === "workflow_finished" }
              );
            }
          }
        }
      }

      return {
        answer: answer.trim() || "智能体已完成处理，但没有返回文本内容。",
        conversation_id: "",
        usage: latestUsage,
        response_json: latestEvent && typeof latestEvent === "object" ? latestEvent : {}
      };
    } finally {
      clearConnectTimer();
      clearTimeout(readTimer);
    }
  });
}

async function streamDifyAnswer({ res, message, conversationId, user, agent, files = [], inputs = {}, emitChunks = true }) {
  if (agent.requestMode === "workflow") {
    return streamDifyWorkflowAnswer({ res, message, user, agent, inputs, emitChunks });
  }

  if (!agent.chatUrl || !agent.apiKey) {
    const answer = mockAgentAnswer(message, agent);
    if (emitChunks && res) {
      await writeAnswerChunks(
        res,
        {
          type: "answer_chunk",
          tool_name: agent.toolName
        },
        answer,
        { paced: true }
      );
    }
    return { answer, conversation_id: "", usage: normalizeUsage(), response_json: {} };
  }

  return difyLimiter.run(async () => {
    if (res?.locals?.sse?.closed || res?.destroyed || res?.writableEnded) {
      throw new Error("client_closed_before_dify_request");
    }

    const controller = new AbortController();
    const readTimer = setTimeout(() => controller.abort(), config.difyReadTimeoutMs);
    let connectTimer = null;

    const clearConnectTimer = () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
    };

    try {
      const requestDify = async (activeConversationId) => {
        clearConnectTimer();
        connectTimer = setTimeout(() => controller.abort(), config.difyConnectTimeoutMs);
        try {
          const response = await fetch(agent.chatUrl, {
            method: "POST",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${agent.apiKey}`,
              "Content-Type": "application/json",
              Accept: "text/event-stream"
            },
            body: JSON.stringify({
              inputs: inputs && typeof inputs === "object" && !Array.isArray(inputs) ? inputs : {},
              query: message,
              response_mode: "streaming",
              conversation_id: activeConversationId || "",
              user: String(user.user_id || "guest"),
              files: Array.isArray(files) ? files : []
            })
          });
          clearConnectTimer();
          return response;
        } catch (error) {
          clearConnectTimer();
          throw error;
        }
      };

    let activeConversationId = conversationId || "";
    let response = await requestDify(activeConversationId);

    if (!response.ok || !response.body) {
      const detail = await response.text();
      const shouldRetryWithoutConversation =
        Boolean(activeConversationId) &&
        response.status === 404 &&
        /Conversation Not Exists|not_found/i.test(detail);

      if (!shouldRetryWithoutConversation) {
        throw new Error(`Dify request failed: ${response.status} ${detail}`);
      }

      console.warn(`[chat/dify] stale conversation_id for ${agent.id}; retrying without conversation_id`);
      activeConversationId = "";
      response = await requestDify("");
    }

    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw new Error(`Dify request failed: ${response.status} ${detail}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let answer = "";
    let latestConversationId = activeConversationId || "";
    let latestUsage = normalizeUsage();
    let latestEvent = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const dataLine = chunk
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;

        const raw = dataLine.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;

        const event = parseMaybeJson(raw);
        if (!event || typeof event !== "object") continue;

        latestEvent = event;
        latestUsage = mergeUsage(latestUsage, usageFromEvent(event));
        if (event.conversation_id) latestConversationId = event.conversation_id;
        const content = extractDifyEventContent(event);
        if (typeof content === "string" && content) {
          answer += content;
          if (emitChunks && res) {
            await writeAnswerChunks(
              res,
              {
                type: "answer_chunk",
                tool_name: agent.toolName,
                conversation_id: latestConversationId
              },
              content,
              { paced: content.length >= 80 }
            );
          }
        }
      }
    }

    return {
      answer: answer.trim() || "智能体已完成处理，但没有返回文本内容。",
      conversation_id: latestConversationId || "",
      usage: latestUsage,
      response_json: latestEvent && typeof latestEvent === "object" ? latestEvent : {}
    };
    } finally {
      clearConnectTimer();
      clearTimeout(readTimer);
    }
  });
}

function normalizeServiceNavigatorCards(cards) {
  return (Array.isArray(cards) ? cards : []).map((card) => {
    const item = card && typeof card === "object" ? card : {};
    return {
      id: String(item.id || item.serviceId || item.itemId || ""),
      title: String(item.title || item.name || "办事事项"),
      category: String(item.category || item.categoryName || ""),
      description: String(item.description || item.summary || item.content || ""),
      handlerCount: Number(item.handlerCount ?? item.handler_count ?? 0) || 0,
      targetRoles: Array.isArray(item.targetRoles) ? item.targetRoles : Array.isArray(item.target_roles) ? item.target_roles : [],
      entryUrl: String(item.entryUrl || item.entry_url || item.url || item.targetUrl || ""),
      department: String(item.department || item.departmentName || ""),
      contactPerson: String(item.contactPerson || item.contact_person || ""),
      contactPhone: String(item.contactPhone || item.contact_phone || ""),
      serviceTime: String(item.serviceTime || item.service_time || ""),
      basis: String(item.basis || ""),
      materials: Array.isArray(item.materials) ? item.materials : [],
      processSteps: Array.isArray(item.processSteps) ? item.processSteps : Array.isArray(item.process_steps) ? item.process_steps : [],
      notice: String(item.notice || item.notes || ""),
      assets: Array.isArray(item.assets) ? item.assets : [],
      lastVerifiedAt: String(item.lastVerifiedAt || item.last_verified_at || "")
    };
  });
}

function normalizeServiceNavigatorResult(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const answer = firstNonEmpty(data.message, data.answer, data.text, data.content);
  return {
    answer: answer || "AI办事已完成检索，但没有返回文本说明。",
    action: String(data.action || data.type || "recommend_service"),
    service_cards: normalizeServiceNavigatorCards(data.serviceCards || data.service_cards || data.cards),
    guide_suggestions: Array.isArray(data.guideSuggestions)
      ? data.guideSuggestions
      : Array.isArray(data.guide_suggestions)
        ? data.guide_suggestions
        : [],
    profile_update_candidates: Array.isArray(data.profileUpdateCandidates)
      ? data.profileUpdateCandidates
      : Array.isArray(data.profile_update_candidates)
        ? data.profile_update_candidates
        : [],
    raw: data
  };
}

async function callServiceNavigator({ message, user, sessionId, runId }) {
  if (!config.serviceNavigatorEnabled || !config.serviceNavigatorBaseUrl) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.serviceNavigatorTimeoutMs);
  try {
    const response = await fetch(`${config.serviceNavigatorBaseUrl}/assistant/message`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        userId: String(user.user_id || "guest"),
        message,
        portalSessionId: sessionId,
        portalRunId: runId
      })
    });

    const text = await response.text();
    const payload = text ? parseMaybeJson(text) : {};
    if (!response.ok) {
      throw new Error(`Service navigator request failed: ${response.status} ${text}`);
    }
    return normalizeServiceNavigatorResult(payload || {});
  } finally {
    clearTimeout(timer);
  }
}

async function streamGeneralAnswer({ res, message, user, agent }) {
  if (!agent.chatUrl || !agent.apiKey) {
    const answer = [
      "你好，我是农芯智 AI。",
      "",
      "我可以先回答通用问题。若你要咨询教务、图书馆或学工事务，请点击首页输入框下方对应的智能体按钮，这样会更准确。"
    ].join("\n");
    writeSse(res, { type: "answer_chunk", content: answer, tool_name: agent.toolName });
    return { answer, conversation_id: "", usage: normalizeUsage(), response_json: {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llmReadTimeoutMs);

  try {
    const response = await fetch(agent.chatUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${agent.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: config.llmPlannerModel,
        temperature: 0.6,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          {
            role: "system",
            content:
              "你是安徽农业大学 AI 门户的默认模型助手，名叫农芯智 AI。当前用户没有选择首页输入框下方的教务智能体、AI馆员、AI辅导员、AI问数或AI办事时，问题会由你直接回答。你适合处理问候、闲聊、写作润色、总结、翻译、代码解释、普通知识和开放性咨询。回答要自然、简洁、可靠。请统一使用紧凑的 Markdown 格式：短段落、必要时使用 `- ` 列表、链接使用 Markdown 链接；不要把多个事项用一长串破折号连接。遇到教务、图书馆、学工、数据查询、事项办理等校内业务问题时，可以给出通用层面的解释和提问建议，但要提醒用户点击对应智能体按钮获取更准确的业务答复。不要声称系统会自动转交给其他智能体。不要编造具体校内政策、课表、成绩、账号、借阅记录、数据库权限、办理结果或其他学校内部数据。"
          },
          {
            role: "user",
            content: normalizeMessage(message)
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`MiniMax request failed: ${response.status} ${detail}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (response.body && /text\/event-stream|stream/i.test(contentType)) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let answer = "";
      let latestUsage = normalizeUsage();
      let latestEvent = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;

          const raw = dataLine.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          const event = parseMaybeJson(raw);
          latestEvent = event && typeof event === "object" ? event : latestEvent;
          latestUsage = mergeUsage(latestUsage, usageFromEvent(event));
          const content =
            event?.choices?.[0]?.delta?.content ||
            event?.choices?.[0]?.message?.content ||
            event?.reply ||
            event?.output ||
            event?.text ||
            "";
          if (typeof content === "string" && content) {
            answer += content;
            writeSse(res, { type: "answer_chunk", content, tool_name: agent.toolName });
          }
        }
      }

      const finalAnswer = answer.trim() || "模型没有返回有效内容。";
      return {
        answer: finalAnswer,
        conversation_id: "",
        usage: latestUsage,
        response_json: latestEvent && typeof latestEvent === "object" ? latestEvent : {}
      };
    }

    const data = await response.json();
    const answer = String(data?.choices?.[0]?.message?.content || data?.reply || data?.output || "").trim();
    const finalAnswer = answer || "我在，但这次模型没有返回有效内容。你可以换一种说法再问我一次。";
    writeSse(res, { type: "answer_chunk", content: finalAnswer, tool_name: agent.toolName });
    return {
      answer: finalAnswer,
      conversation_id: "",
      usage: normalizeUsage(data?.usage),
      response_json: data && typeof data === "object" ? data : {}
    };
  } finally {
    clearTimeout(timer);
  }
}

async function streamGeneralAnswerV2({ res, message, user, agent }) {
  const fallbackAnswer = [
    "\u4f60\u597d\uff0c\u6211\u662f\u519c\u82af\u667a AI\u3002",
    "",
    "\u6211\u53ef\u4ee5\u5148\u56de\u7b54\u901a\u7528\u95ee\u9898\u3002\u82e5\u4f60\u8981\u54a8\u8be2\u6559\u52a1\u3001\u56fe\u4e66\u9986\u6216\u5b66\u5de5\u4e8b\u52a1\uff0c\u8bf7\u70b9\u51fb\u8f93\u5165\u6846\u4e0a\u65b9\u5bf9\u5e94\u7684\u667a\u80fd\u4f53\u6309\u94ae\uff0c\u8fd9\u6837\u4f1a\u66f4\u51c6\u786e\u3002"
  ].join("\n");

  if (!agent.chatUrl || !agent.apiKey) {
    writeSse(res, { type: "answer_chunk", content: fallbackAnswer, tool_name: agent.toolName });
    return { answer: fallbackAnswer, conversation_id: "", usage: normalizeUsage(), response_json: {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llmReadTimeoutMs);
  const systemPrompt = [
    "\u4f60\u662f\u5b89\u5fbd\u519c\u4e1a\u5927\u5b66 AI \u95e8\u6237\u7684\u9ed8\u8ba4\u6a21\u578b\u52a9\u624b\uff0c\u540d\u53eb\u519c\u82af\u667a AI\u3002",
    "\u5f53\u524d\u7528\u6237\u6ca1\u6709\u9009\u62e9\u6559\u52a1\u667a\u80fd\u4f53\u3001AI\u9986\u5458\u6216AI\u8f85\u5bfc\u5458\u65f6\uff0c\u95ee\u9898\u7531\u4f60\u76f4\u63a5\u56de\u7b54\u3002",
    "\u4f60\u9002\u5408\u5904\u7406\u95ee\u5019\u3001\u95f2\u804a\u3001\u5199\u4f5c\u6da6\u8272\u3001\u603b\u7ed3\u3001\u7ffb\u8bd1\u3001\u4ee3\u7801\u89e3\u91ca\u3001\u666e\u901a\u77e5\u8bc6\u548c\u5f00\u653e\u6027\u54a8\u8be2\u3002",
    "\u56de\u7b54\u4f7f\u7528\u7d27\u51d1 Markdown\uff1a\u77ed\u6bb5\u843d\uff0c\u5fc5\u8981\u65f6\u7528 `- ` \u5217\u8868\uff0c\u4e0d\u8981\u628a\u591a\u4e2a\u4e8b\u9879\u6324\u5728\u4e00\u884c\u3002",
    "\u9047\u5230\u6559\u52a1\u3001\u56fe\u4e66\u9986\u3001\u5b66\u5de5\u7b49\u6821\u5185\u4e1a\u52a1\u95ee\u9898\u65f6\uff0c\u53ef\u4ee5\u7ed9\u51fa\u901a\u7528\u5c42\u9762\u7684\u89e3\u91ca\u548c\u63d0\u95ee\u5efa\u8bae\uff0c\u4f46\u8981\u63d0\u9192\u7528\u6237\u70b9\u51fb\u5bf9\u5e94\u667a\u80fd\u4f53\u6309\u94ae\u83b7\u53d6\u66f4\u51c6\u786e\u7684\u4e1a\u52a1\u7b54\u590d\u3002",
    "\u4e0d\u8981\u7f16\u9020\u5177\u4f53\u6821\u5185\u653f\u7b56\u3001\u8bfe\u8868\u3001\u6210\u7ee9\u3001\u8d26\u53f7\u3001\u501f\u9605\u8bb0\u5f55\u3001\u6570\u636e\u5e93\u6743\u9650\u6216\u529e\u7406\u7ed3\u679c\u3002"
  ].join("\n");

  try {
    const response = await fetch(agent.chatUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${agent.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: config.llmPlannerModel,
        temperature: 0.6,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: normalizeMessage(message) }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`MiniMax request failed: ${response.status} ${detail}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (response.body && /text\/event-stream|stream/i.test(contentType)) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let answer = "";
      let latestUsage = normalizeUsage();
      let latestEvent = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;

          const raw = dataLine.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          const event = parseMaybeJson(raw);
          latestEvent = event && typeof event === "object" ? event : latestEvent;
          latestUsage = mergeUsage(latestUsage, usageFromEvent(event));
          const content =
            event?.choices?.[0]?.delta?.content ||
            event?.choices?.[0]?.message?.content ||
            event?.reply ||
            event?.output ||
            event?.text ||
            "";
          if (typeof content === "string" && content) {
            answer += content;
            writeSse(res, { type: "answer_chunk", content, tool_name: agent.toolName });
          }
        }
      }

      const finalAnswer =
        answer.trim() ||
        "\u9ed8\u8ba4\u6a21\u578b\u5df2\u6536\u5230\u8bf7\u6c42\uff0c\u4f46\u6ca1\u6709\u8fd4\u56de\u6709\u6548\u6587\u672c\u3002\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff0c\u6216\u9009\u62e9\u4e0a\u65b9\u6821\u5185\u667a\u80fd\u4f53\u3002";
      if (!answer.trim()) {
        writeSse(res, { type: "answer_chunk", content: finalAnswer, tool_name: agent.toolName });
      }
      return {
        answer: finalAnswer,
        conversation_id: "",
        usage: latestUsage,
        response_json: latestEvent && typeof latestEvent === "object" ? latestEvent : {}
      };
    }

    const data = await response.json();
    const answer = String(data?.choices?.[0]?.message?.content || data?.reply || data?.output || "").trim();
    const finalAnswer =
      answer ||
      "\u9ed8\u8ba4\u6a21\u578b\u5df2\u6536\u5230\u8bf7\u6c42\uff0c\u4f46\u6ca1\u6709\u8fd4\u56de\u6709\u6548\u6587\u672c\u3002\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff0c\u6216\u9009\u62e9\u4e0a\u65b9\u6821\u5185\u667a\u80fd\u4f53\u3002";
    writeSse(res, { type: "answer_chunk", content: finalAnswer, tool_name: agent.toolName });
    return {
      answer: finalAnswer,
      conversation_id: "",
      usage: normalizeUsage(data?.usage),
      response_json: data && typeof data === "object" ? data : {}
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildSupervisorFallbackAnswer(message, agentResults) {
  const successful = (agentResults || []).filter((item) => item.status === "success" && String(item.answer || "").trim());
  if (!successful.length) {
    return "我已尝试并行咨询相关业务智能体，但暂时没有拿到有效回复。你可以稍后再试，或把要办理的事项说得更具体一些。";
  }

  const sections = successful.map((item) => {
    return [`【${item.agentName || item.agentId}】`, String(item.answer || "").trim()].join("\n");
  });
  return [
    "我已帮你同时咨询相关业务智能体，整理如下：",
    "",
    ...sections.flatMap((section) => [section, ""]),
    "以上内容由农芯智 AI 汇总，具体办理口径以学校最新通知和业务系统为准。"
  ]
    .join("\n")
    .trim();
}

function buildSupervisorSummaryUserContent(message, agentResults) {
  const sections = (agentResults || []).map((item) => {
    const answer = item.status === "success" ? String(item.answer || "").trim() : `调用失败：${item.errorMessage || "未返回有效结果"}`;
    return [
      `子智能体：${item.agentName || item.agentId}`,
      `状态：${item.status}`,
      "回答：",
      answer.slice(0, 8000)
    ].join("\n");
  });
  return ["用户原问题：", normalizeMessage(message), "", "子智能体回答：", sections.join("\n\n---\n\n")].join("\n");
}

async function streamSupervisorSummary({ res, message, user, agent, agentResults }) {
  if (!agent.chatUrl || !agent.apiKey) {
    const answer = buildSupervisorFallbackAnswer(message, agentResults);
    writeSse(res, { type: "answer_chunk", content: answer, tool_name: agent.toolName });
    return { answer, conversation_id: "", usage: normalizeUsage(), response_json: {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llmReadTimeoutMs);

  try {
    const response = await fetch(agent.chatUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${agent.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: config.llmPlannerModel,
        temperature: 0.3,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          {
            role: "system",
            content:
              "你是农芯智 AI，校园 AI 门户的总入口和总控智能体。你会收到用户原问题和多个子智能体的回答。请把它们整合成一个清晰、自然、可执行的最终回答；按事项分段，保留各业务智能体给出的关键信息。不要编造学校内部数据；如果某个子智能体失败或信息不足，要明确说明。"
          },
          {
            role: "user",
            content: buildSupervisorSummaryUserContent(message, agentResults)
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`MiniMax summary failed: ${response.status} ${detail}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (response.body && /text\/event-stream|stream/i.test(contentType)) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let answer = "";
      let latestUsage = normalizeUsage();
      let latestEvent = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;

          const raw = dataLine.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          const event = parseMaybeJson(raw);
          latestEvent = event && typeof event === "object" ? event : latestEvent;
          latestUsage = mergeUsage(latestUsage, usageFromEvent(event));
          const content =
            event?.choices?.[0]?.delta?.content ||
            event?.choices?.[0]?.message?.content ||
            event?.reply ||
            event?.output ||
            event?.text ||
            "";
          if (typeof content === "string" && content) {
            answer += content;
            writeSse(res, { type: "answer_chunk", content, tool_name: agent.toolName });
          }
        }
      }

      return {
        answer: answer.trim() || buildSupervisorFallbackAnswer(message, agentResults),
        conversation_id: "",
        usage: latestUsage,
        response_json: latestEvent && typeof latestEvent === "object" ? latestEvent : {}
      };
    }

    const data = await response.json();
    const answer = String(data?.choices?.[0]?.message?.content || data?.reply || data?.output || "").trim();
    const finalAnswer = answer || buildSupervisorFallbackAnswer(message, agentResults);
    writeSse(res, { type: "answer_chunk", content: finalAnswer, tool_name: agent.toolName });
    return {
      answer: finalAnswer,
      conversation_id: "",
      usage: normalizeUsage(data?.usage),
      response_json: data && typeof data === "object" ? data : {}
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callBusinessAgentForParallel({
  res,
  message,
  sessionId,
  runId,
  user,
  agent,
  files,
  inputs,
  stepIndex
}) {
  const callId = newId("call");
  const startedAt = Date.now();

  await upsertAgentTool(agent);
  await recordAgentStep({
    runId,
    sessionId,
    index: stepIndex,
    type: "tool_call",
    name: agent.toolName,
    title: "并行调用外部能力",
    content: `Call ${agent.name} through the supervisor parallel tool layer.`,
    input: { query: message, tool_call_id: callId },
    startedAt
  });

  writeSse(res, {
    type: "tool_call",
    content: `正在并行调用 ${agent.name}。`,
    tool_name: agent.toolName,
    data: { query: message, call_id: callId, agent: agent.id }
  });

  let difyConversationId = "";
  try {
    difyConversationId = await getLatestDifyConversationId({ sessionId, agent });
    const result = await streamDifyAnswer({
      res: null,
      message,
      conversationId: difyConversationId,
      user,
      agent,
      files,
      inputs,
      emitChunks: false
    });
    const latencyMs = Date.now() - startedAt;
    const hasAnswer = Boolean(String(result.answer || "").trim());
    const status = hasAnswer ? "success" : "error";
    const errorMessage = hasAnswer ? "" : "empty_answer";

    await recordAgentToolCall({
      callId,
      runId,
      sessionId,
      agent,
      request: { query: message, conversation_id: difyConversationId, portal_session_id: sessionId },
      responseText: result.answer,
      responseConversationId: result.conversation_id,
      responseJson: result.response_json,
      usage: result.usage,
      status,
      errorMessage,
      latencyMs,
      startedAt,
      finishedAt: Date.now()
    });
    await recordAgentStep({
      runId,
      sessionId,
      index: stepIndex + 1,
      type: "tool_result",
      name: `${agent.toolName}_result`,
      title: "并行工具返回",
      content: hasAnswer ? "Tool returned a non-empty answer." : "Tool returned an empty answer.",
      output: { answer_length: String(result.answer || "").length, agent_id: agent.id },
      status,
      errorMessage,
      latencyMs,
      startedAt,
      finishedAt: Date.now()
    });

    writeSse(res, {
      type: "tool_result",
      content: `${agent.name} 处理完成。`,
      tool_name: agent.toolName,
      data: { agent: agent.id, status }
    });

    return {
      callId,
      agentId: agent.id,
      agentName: agent.name,
      toolName: agent.toolName,
      answer: result.answer,
      conversation_id: result.conversation_id,
      usage: result.usage,
      response_json: result.response_json,
      status,
      errorMessage,
      latencyMs
    };
  } catch (error) {
    const status = error.name === "AbortError" ? "timeout" : "error";
    const latencyMs = Date.now() - startedAt;
    await recordAgentToolCall({
      callId,
      runId,
      sessionId,
      agent,
      request: { query: message, conversation_id: difyConversationId, portal_session_id: sessionId },
      responseText: "",
      status,
      errorMessage: error.message,
      latencyMs,
      startedAt,
      finishedAt: Date.now()
    });
    await recordAgentStep({
      runId,
      sessionId,
      index: stepIndex + 1,
      type: "tool_result",
      name: `${agent.toolName}_result`,
      title: "并行工具返回",
      content: error.message,
      output: { answer_length: 0, agent_id: agent.id },
      status: "error",
      errorMessage: error.message,
      latencyMs,
      startedAt,
      finishedAt: Date.now()
    });

    writeSse(res, {
      type: "tool_result",
      content: `${agent.name} 暂时没有返回有效结果。`,
      tool_name: agent.toolName,
      data: { agent: agent.id, status }
    });

    return {
      callId,
      agentId: agent.id,
      agentName: agent.name,
      toolName: agent.toolName,
      answer: "",
      conversation_id: "",
      usage: normalizeUsage(),
      response_json: {},
      status,
      errorMessage: error.message,
      latencyMs
    };
  }
}

function encodeOAuthBridgeState(returnTo) {
  const payload = {
    nonce: crypto.randomBytes(16).toString("hex"),
    returnTo
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${bridgeStatePrefix}${encoded}`;
}

function decodeOAuthBridgeState(state) {
  if (typeof state !== "string" || !state.startsWith(bridgeStatePrefix)) return null;

  try {
    const raw = state.slice(bridgeStatePrefix.length);
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!payload || typeof payload.returnTo !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

function isAllowedBridgeReturnUrl(value) {
  try {
    const url = new URL(value);
    return config.bridgeAllowedOrigins.includes(url.origin) && url.pathname === "/callback";
  } catch {
    return false;
  }
}

function getBridgeReturnTo(req) {
  if (req.query.bridge !== "local") return "";

  const returnTo = typeof req.query.return_to === "string" ? req.query.return_to : "";
  if (!isAllowedBridgeReturnUrl(returnTo)) return "";
  return returnTo;
}

function appendOAuthCallbackQuery(targetUrl, query) {
  for (const key of ["code", "state", "error", "error_description"]) {
    const value = query[key];
    if (Array.isArray(value)) {
      for (const item of value) targetUrl.searchParams.append(key, item);
    } else if (typeof value === "string") {
      targetUrl.searchParams.set(key, value);
    }
  }
}

function parseCasTokenPayload(rawText) {
  const asJson = parseMaybeJson(rawText);
  if (asJson && typeof asJson === "object") {
    return {
      accessToken: asJson.access_token || "",
      expiresIn: asJson.expires_in || null,
      tokenType: asJson.token_type || "bearer"
    };
  }
  const query = new URLSearchParams(rawText);
  return {
    accessToken: query.get("access_token") || "",
    expiresIn: query.get("expires_in"),
    tokenType: query.get("token_type") || "bearer"
  };
}

function parseUserInfoText(rawText) {
  const asJson = parseMaybeJson(rawText);
  if (asJson && typeof asJson === "object") return asJson;

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const sliced = rawText.slice(firstBrace, lastBrace + 1);
    const slicedJson = parseMaybeJson(sliced);
    if (slicedJson && typeof slicedJson === "object") return slicedJson;
  }
  return {};
}

function normalizeCasUser(userRaw) {
  const userId = getCasUserId(userRaw);
  const base = {
    user_id: userId,
    id: userId,
    name: "",
    college: "",
    major: "",
    class: "",
    gender: "",
    groupName: "",
    email: "",
    phone: "",
    role: inferSchoolUserRole(userRaw)
  };

  if (!Array.isArray(userRaw?.attributes)) return base;

  for (const entry of userRaw.attributes) {
    if (!entry || typeof entry !== "object") continue;
    for (const [k, v] of Object.entries(entry)) {
      if (typeof v !== "string" || !v.trim()) continue;
      if (k === "Name") base.name = v;
      if (k === "OrgName") base.college = v;
      if (k === "Speciality") base.major = v;
      if (k === "Clazz") base.class = v;
      if (k === "Gender") base.gender = v;
      if (k === "GroupName") base.groupName = v;
      if (k === "Email") base.email = v;
      if (k === "Phone" || k === "ContactTel") base.phone = v;
    }
  }
  base.role = inferSchoolUserRole(base);
  return base;
}

async function tryIncreaseLoginCounter(userId) {
  if (!mysqlPool || !userId) {
    return { checked: false, incremented: false, reason: "mysql_not_configured" };
  }

  const userTable = `\`${config.mysqlUserTable}\``;
  const userIdColumn = `\`${config.mysqlUserIdColumn}\``;
  const counterTable = `\`${config.loginCounterTable}\``;

  try {
    const [rows] = await mysqlPool.query(
      `SELECT 1 FROM ${userTable} WHERE ${userIdColumn} = ? LIMIT 1`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return { checked: true, incremented: false, reason: "user_not_found" };
    }

    await mysqlPool.query(
      `CREATE TABLE IF NOT EXISTS ${counterTable} (
        user_id VARCHAR(64) PRIMARY KEY,
        login_count INT NOT NULL DEFAULT 0,
        last_login DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    await mysqlPool.query(
      `INSERT INTO ${counterTable} (user_id, login_count, last_login, updated_at)
       VALUES (?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         login_count = login_count + 1,
         last_login = NOW(),
         updated_at = NOW()`,
      [String(userId)]
    );

    return { checked: true, incremented: true, reason: "ok" };
  } catch (error) {
    return { checked: true, incremented: false, reason: error.message };
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === config.frontendOrigin || config.bridgeAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(
  session({
    name: "ahau.sid",
    secret: config.sessionSecret,
    ...(sessionStore ? { store: sessionStore } : {}),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 90,
      secure: cookieSecure,
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/session", async (req, res) => {
  const user = req.session?.user || null;
  if (user) {
    await upsertPortalUser(user);
    await recordVisitEvent(req, user, req.query?.path || req.headers.referer || "/");
  }
  res.json({
    authenticated: Boolean(user),
    user
  });
});

app.get("/api/announcements", async (_req, res) => {
  if (!mysqlPool) {
    return res.json({ announcements: [] });
  }

  try {
    const [rows] = await mysqlPool.query(
      `SELECT id, title, category, publish_time, created_at, is_top
       FROM announcements
       WHERE status = 'published'
       ORDER BY is_top DESC, COALESCE(publish_time, created_at) DESC, id DESC
       LIMIT 10`
    );

    const announcements = Array.isArray(rows)
      ? rows.map((row) => ({
          id: row.id,
          title: row.title || "",
          category: row.category || "公告",
          date: formatAnnouncementDate(row.publish_time || row.created_at),
          isTop: Boolean(Number(row.is_top))
        }))
      : [];

    res.json({ announcements });
  } catch (error) {
    console.error("[announcements] failed to load:", error.message);
    res.status(500).json({ announcements: [], message: "Failed to load announcements" });
  }
});

app.get("/api/chat/history", requireLogin, async (req, res) => {
  if (!mysqlPool) {
    return res.json({ success: true, data: { sessionList: [] } });
  }

  const user = getSessionUser(req);
  const userId = String(user.user_id || "guest");

  try {
    const [rows] = await mysqlPool.query(
      `SELECT
         session_id AS sessionId,
         COALESCE(NULLIF(title, ''), CONVERT(0xE696B0E5AFB9E8AF9D USING utf8mb4)) AS sessionTitle,
         created_at AS createTime,
         updated_at AS updateTime,
         last_message_at AS lastMessageAt,
         DATE_FORMAT(COALESCE(last_message_at, updated_at, created_at), '%Y-%m-%d %H:%i:%s') AS displayTime
       FROM portal_agent_sessions
       WHERE user_id = ?
       ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC
       LIMIT 30`,
      [userId]
    );

    res.json({ success: true, data: { sessionList: rows || [] } });
  } catch (error) {
    console.error("[chat/history] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to load chat history" });
  }
});

app.get("/api/chat/history/detail", requireLogin, async (req, res) => {
  if (!mysqlPool) {
    return res.json({ success: false, message: "MySQL is not configured" });
  }

  const user = getSessionUser(req);
  const userId = String(user.user_id || "guest");
  const sessionId = normalizeMessage(req.query?.sessionId || req.query?.session_id).slice(0, 96);
  if (!sessionId) {
    return res.status(400).json({ success: false, message: "Missing sessionId" });
  }

  try {
    const [sessions] = await mysqlPool.query(
      `SELECT session_id AS sessionId, COALESCE(NULLIF(title, ''), CONVERT(0xE58E86E58FB2E4BC9AE8AF9D USING utf8mb4)) AS sessionTitle
       FROM portal_agent_sessions
       WHERE session_id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );

    if (!sessions?.length) {
      return res.status(404).json({ success: false, message: "History session not found" });
    }

    const [messages] = await mysqlPool.query(
      `SELECT role, content, created_at AS createTime,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS displayTime
       FROM portal_agent_messages
       WHERE session_id = ?
         AND role IN ('user', 'assistant')
       ORDER BY created_at ASC, id ASC
       LIMIT 200`,
      [sessionId]
    );

    res.json({
      success: true,
      data: {
        sessionId,
        sessionTitle: sessions[0].sessionTitle,
        chatList: (messages || []).map((item) => ({
          type: item.role,
          content: item.content || "",
          createTime: item.createTime,
          displayTime: item.displayTime || ""
        }))
      }
    });
  } catch (error) {
    console.error("[chat/history/detail] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to load chat history detail" });
  }
});

app.delete("/api/chat/history/:sessionId", requireLogin, async (req, res) => {
  if (!mysqlPool) {
    return res.status(503).json({ success: false, message: "MySQL is not configured" });
  }

  const user = getSessionUser(req);
  const userId = String(user.user_id || "guest");
  const sessionId = normalizeMessage(req.params?.sessionId || "").slice(0, 96);
  if (!sessionId) {
    return res.status(400).json({ success: false, message: "Missing sessionId" });
  }

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [sessions] = await connection.query(
      `SELECT session_id AS sessionId
       FROM portal_agent_sessions
       WHERE session_id = ? AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );
    if (!sessions?.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "History session not found" });
    }

    await connection.query(`DELETE FROM portal_agent_run_steps WHERE session_id = ?`, [sessionId]);
    await connection.query(`DELETE FROM portal_agent_tool_calls WHERE session_id = ?`, [sessionId]);
    await connection.query(`DELETE FROM portal_agent_messages WHERE session_id = ?`, [sessionId]);
    await connection.query(`DELETE FROM portal_agent_runs WHERE session_id = ?`, [sessionId]);
    await connection.query(`DELETE FROM portal_agent_sessions WHERE session_id = ? AND user_id = ?`, [sessionId, userId]);
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error("[chat/history/delete] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete chat history" });
  } finally {
    connection.release();
  }
});

app.delete("/api/chat/history", requireLogin, async (req, res) => {
  if (!mysqlPool) {
    return res.status(503).json({ success: false, message: "MySQL is not configured" });
  }

  const user = getSessionUser(req);
  const userId = String(user.user_id || "guest");
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM portal_agent_run_steps
       WHERE session_id IN (SELECT session_id FROM portal_agent_sessions WHERE user_id = ?)`,
      [userId]
    );
    await connection.query(
      `DELETE FROM portal_agent_tool_calls
       WHERE session_id IN (SELECT session_id FROM portal_agent_sessions WHERE user_id = ?)`,
      [userId]
    );
    await connection.query(
      `DELETE FROM portal_agent_messages
       WHERE session_id IN (SELECT session_id FROM portal_agent_sessions WHERE user_id = ?)`,
      [userId]
    );
    await connection.query(
      `DELETE FROM portal_agent_runs
       WHERE session_id IN (SELECT session_id FROM portal_agent_sessions WHERE user_id = ?)`,
      [userId]
    );
    await connection.query(`DELETE FROM portal_agent_sessions WHERE user_id = ?`, [userId]);
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error("[chat/history/clear] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to clear chat history" });
  } finally {
    connection.release();
  }
});

app.post("/api/chat/stream", requireLogin, async (req, res) => {
  const message = normalizeMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ message: "Missing required field: message" });
  }

  const requestFiles = Array.isArray(req.body?.files) ? req.body.files : [];
  const requestInputs =
    req.body?.inputs && typeof req.body.inputs === "object" && !Array.isArray(req.body.inputs)
      ? req.body.inputs
      : {};
  const user = getSessionUser(req);
  const sessionId =
    normalizeMessage(req.body?.session_id || req.body?.portal_session_id).slice(0, 96) ||
    newId("sess");
  const runId = newId("run");
  const startedAt = Date.now();
  let route = null;
  let agent = null;
  let toolCallId = null;
  let toolStartedAt = 0;
  let heartbeatTimer = null;
  res.locals.sse = { closed: false };
  const markClosed = () => {
    res.locals.sse.closed = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };
  const safeEnd = () => {
    markClosed();
    if (!res.destroyed && !res.writableEnded) res.end();
  };
  req.on("close", () => {
    if (!req.complete) markClosed();
  });
  res.on("close", () => {
    if (!res.writableEnded) markClosed();
  });

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  heartbeatTimer = setInterval(() => {
    if (res.locals.sse.closed || res.destroyed || res.writableEnded) {
      markClosed();
      return;
    }
    try {
      res.write(": ping\n\n");
      res.flush?.();
    } catch (err) {
      markClosed();
    }
  }, 15000);

  try {
    await createAgentRun({ sessionId, runId, user, message });
    await recordAgentStep({
      runId,
      sessionId,
      index: 1,
      type: "thought",
      name: "understand_question",
      title: "理解问题",
      content: "Read the user question and prepare the code-built super-agent route.",
      input: { message }
    });

    writeSse(res, {
      type: "thought",
      content: "正在理解你的问题，并由超级智能体选择合适的能力。",
      conversation_id: sessionId,
      run_id: runId
    });

    const plannerStartedAt = Date.now();
    const requestedAgentId = normalizeAgentId(
      req.body?.agent_id || req.body?.agentId || req.body?.selected_agent_id || req.body?.selectedAgentId,
      ""
    );
    const forcedAgentId = BUSINESS_AGENT_IDS.includes(requestedAgentId) ? requestedAgentId : "";
    route = forcedAgentId
      ? hydrateRoute(
          {
            strategy: "single_agent",
            agentIds: [forcedAgentId],
            confidence: 1,
            reason: "User selected a campus agent from the homepage.",
            planner: "manual"
          },
          "manual"
        )
      : hydrateRoute(
          {
            strategy: "single_agent",
            agentIds: ["general"],
            confidence: 1,
            reason: "No homepage campus agent was selected; use the default model.",
            planner: "default"
          },
          "default"
        );
    agent =
      route.strategy === "multi_agent_parallel"
        ? { ...buildAgent("general"), planner: route.planner, reason: route.reason }
        : route.agent;
    await recordAgentStep({
      runId,
      sessionId,
      index: 2,
      type: "planner",
      name: "route_capability",
      title: "能力路由",
      content: route.reason || "Route by super-agent planner.",
      input: { message, requested_agent_id: forcedAgentId || "" },
      output: routeLogOutput(route),
      latencyMs: Date.now() - plannerStartedAt,
      startedAt: plannerStartedAt,
      finishedAt: Date.now()
    });

    if (route.strategy !== "multi_agent_parallel") {
      await upsertAgentTool(agent);
    }

    const selectedAgentNames = (route.agents || []).map((item) => item.name).join("、") || agent.name;
    writeSse(res, {
      type: "planner",
      content:
        route.strategy === "multi_agent_parallel"
          ? `超级智能体将并行调用 ${selectedAgentNames}，再由农芯智统一汇总。`
          : `超级智能体已选择 ${agent.name} 能力。${route.planner === "llm" && route.reason ? `原因：${route.reason}` : ""}`,
      tool_name: agent.toolName,
      data: publicRoute(route)
    });

    if (route.strategy === "clarify") {
      const clarification =
        route.clarification_question || route.message || "我还需要确认一下：你想咨询教务、图书馆、学工业务，还是让我按普通问题帮你处理？";
      writeSse(res, {
        type: "answer_chunk",
        content: clarification,
        tool_name: agent.toolName
      });

      await recordAgentStep({
        runId,
        sessionId,
        index: 3,
        type: "model_answer",
        name: "route_clarification",
        title: "路由澄清",
        content: "Route is unclear; returned clarification without calling MiniMax or Dify.",
        output: { answer_length: clarification.length, route: publicRoute(route) },
        status: "success",
        latencyMs: Date.now() - plannerStartedAt,
        startedAt: plannerStartedAt,
        finishedAt: Date.now()
      });

      const logResult = await finishAgentRun({
        sessionId,
        runId,
        user,
        agent,
        answer: clarification,
        status: "success",
        latencyMs: Date.now() - startedAt,
        toolCallCount: 0,
        usage: normalizeUsage()
      });

      writeSse(res, {
        type: "final",
        content: "已返回澄清问题。",
        answer: clarification,
        portal_session_id: sessionId,
        run_id: runId,
        dify_conversation_id: "",
        counted: Boolean(logResult.counted),
        route: publicRoute(route),
        tool_events: []
      });
      safeEnd();
      return;
    }

    if (route.strategy === "multi_agent_parallel") {
      const businessAgents = (route.agents || []).filter((item) => BUSINESS_AGENT_IDS.includes(item.id));
      const agentResults = await Promise.all(
        businessAgents.map((selectedAgent, index) =>
          callBusinessAgentForParallel({
            res,
            message,
            sessionId,
            runId,
            user,
            agent: selectedAgent,
            files: requestFiles,
            inputs: requestInputs,
            stepIndex: 3 + index * 2
          })
        )
      );

      const summaryAgent = { ...buildAgent("general"), planner: route.planner, reason: route.reason };
      agent = summaryAgent;
      await upsertAgentTool(summaryAgent);

      writeSse(res, {
        type: "model_call",
        content: "相关业务智能体已返回，正在由农芯智 AI 汇总最终回答。",
        tool_name: summaryAgent.toolName,
        data: { model: config.llmPlannerModel, source_agents: businessAgents.map((item) => item.id) }
      });

      const modelStartedAt = Date.now();
      let summaryResult;
      try {
        summaryResult = await streamSupervisorSummary({
          res,
          message,
          user,
          agent: summaryAgent,
          agentResults
        });
      } catch (summaryError) {
        console.warn("[chat/supervisor-summary] fallback:", summaryError.message);
        const fallbackAnswer = buildSupervisorFallbackAnswer(message, agentResults);
        writeSse(res, { type: "answer_chunk", content: fallbackAnswer, tool_name: summaryAgent.toolName });
        summaryResult = {
          answer: fallbackAnswer,
          conversation_id: "",
          usage: normalizeUsage(),
          response_json: { fallback_reason: summaryError.message }
        };
      }

      const latencyMs = Date.now() - startedAt;
      const modelLatencyMs = Date.now() - modelStartedAt;
      const hasAnswer = Boolean(String(summaryResult.answer || "").trim());
      const totalUsage = sumUsage(summaryResult.usage, ...agentResults.map((item) => item.usage));

      await recordAgentStep({
        runId,
        sessionId,
        index: 3 + businessAgents.length * 2,
        type: "model_answer",
        name: summaryAgent.toolName,
        title: "农芯智汇总回复",
        content: hasAnswer ? "Supervisor returned a non-empty summary." : "Supervisor returned an empty summary.",
        input: { query: message, model: config.llmPlannerModel, source_agents: businessAgents.map((item) => item.id) },
        output: { answer_length: String(summaryResult.answer || "").length, route: publicRoute(route) },
        status: hasAnswer ? "success" : "error",
        errorMessage: hasAnswer ? "" : "empty_answer",
        latencyMs: modelLatencyMs,
        startedAt: modelStartedAt,
        finishedAt: Date.now()
      });

      const logResult = await finishAgentRun({
        sessionId,
        runId,
        user,
        agent: summaryAgent,
        answer: summaryResult.answer,
        status: hasAnswer ? "success" : "error",
        errorMessage: hasAnswer ? "" : "empty_answer",
        latencyMs,
        toolCallCount: businessAgents.length,
        usage: totalUsage
      });

      const difyConversationIds = Object.fromEntries(
        agentResults.map((item) => [item.agentId, item.conversation_id || ""])
      );
      writeSse(res, {
        type: "final",
        content: "已整理最终回答。",
        answer: summaryResult.answer,
        conversation_id: "",
        portal_session_id: sessionId,
        run_id: runId,
        dify_conversation_id: Object.values(difyConversationIds).find(Boolean) || "",
        dify_conversation_ids: difyConversationIds,
        counted: Boolean(logResult.counted),
        route: publicRoute(route),
        tool_events: agentResults.map((item) => ({
          call_id: item.callId,
          agent: item.agentId,
          tool_name: item.toolName,
          status: item.status,
          conversation_id: item.conversation_id || "",
          latency_ms: item.latencyMs || 0
        }))
      });
      safeEnd();
      return;
    }

    if (agent.id === "general") {
      writeSse(res, {
        type: "model_call",
        content: "正在由默认模型回复。",
        tool_name: agent.toolName,
        data: { model: config.llmPlannerModel }
      });

      const modelStartedAt = Date.now();
      const result = await streamGeneralAnswerV2({ res, message, user, agent });
      const latencyMs = Date.now() - startedAt;
      const modelLatencyMs = Date.now() - modelStartedAt;
      const hasAnswer = Boolean(String(result.answer || "").trim());

      await recordAgentStep({
        runId,
        sessionId,
        index: 3,
        type: "model_answer",
        name: agent.toolName,
        title: "默认模型回复",
        content: hasAnswer ? "Model returned a non-empty answer." : "Model returned an empty answer.",
        input: { query: message, model: config.llmPlannerModel },
        output: { answer_length: String(result.answer || "").length },
        status: hasAnswer ? "success" : "error",
        errorMessage: hasAnswer ? "" : "empty_answer",
        latencyMs: modelLatencyMs,
        startedAt: modelStartedAt,
        finishedAt: Date.now()
      });

      const logResult = await finishAgentRun({
        sessionId,
        runId,
        user,
        agent,
        answer: result.answer,
        status: hasAnswer ? "success" : "error",
        errorMessage: hasAnswer ? "" : "empty_answer",
        latencyMs,
        toolCallCount: 0,
        usage: result.usage
      });

      writeSse(res, {
        type: "final",
        content: "已整理最终回答。",
        answer: result.answer,

        portal_session_id: sessionId,
        run_id: runId,
        dify_conversation_id: "",
        counted: Boolean(logResult.counted),
        route: publicRoute(route),
        tool_events: []
      });
      safeEnd();
      return;
    }
    toolCallId = newId("call");
    toolStartedAt = Date.now();
    await recordAgentStep({
      runId,
      sessionId,
      index: 3,
      type: "tool_call",
      name: agent.toolName,
      title: "调用外部能力",
      content: `Call ${agent.name} through the super-agent tool layer.`,
      input: { query: message, tool_call_id: toolCallId },
      startedAt: toolStartedAt
    });

    writeSse(res, {
      type: "tool_call",
      content: `正在调用 ${agent.name}。`,
      tool_name: agent.toolName,
      data: { query: message, call_id: toolCallId }
    });

    if (agent.id === "service" && config.serviceNavigatorEnabled && config.serviceNavigatorBaseUrl) {
      const serviceAgent = {
        ...agent,
        toolId: "service-navigator-assistant",
        toolName: "call_service_navigator",
        provider: "ai-service-navigator",
        requestMode: "http_json",
        chatUrl: `${config.serviceNavigatorBaseUrl}/assistant/message`
      };
      await upsertAgentTool(serviceAgent);

      const result = await callServiceNavigator({ message, user, sessionId, runId });
      const latencyMs = Date.now() - startedAt;
      const toolLatencyMs = Date.now() - toolStartedAt;
      const hasAnswer = Boolean(String(result?.answer || "").trim());

      await recordAgentToolCall({
        callId: toolCallId,
        runId,
        sessionId,
        agent: serviceAgent,
        request: { query: message, portal_session_id: sessionId, user_id: String(user.user_id || "guest") },
        responseText: result?.answer || "",
        responseConversationId: "",
        responseJson: {
          action: result?.action || "",
          service_cards: result?.service_cards || [],
          guide_suggestions: result?.guide_suggestions || [],
          profile_update_candidates: result?.profile_update_candidates || []
        },
        usage: normalizeUsage(),
        status: hasAnswer ? "success" : "error",
        errorMessage: hasAnswer ? "" : "empty_answer",
        latencyMs: toolLatencyMs,
        startedAt: toolStartedAt,
        finishedAt: Date.now()
      });
      await recordAgentStep({
        runId,
        sessionId,
        index: 4,
        type: "tool_result",
        name: `${serviceAgent.toolName}_result`,
        title: "AI办事返回",
        content: hasAnswer ? "Service navigator returned a non-empty answer." : "Service navigator returned an empty answer.",
        output: {
          answer_length: String(result?.answer || "").length,
          card_count: (result?.service_cards || []).length
        },
        status: hasAnswer ? "success" : "error",
        errorMessage: hasAnswer ? "" : "empty_answer",
        latencyMs: toolLatencyMs,
        startedAt: toolStartedAt,
        finishedAt: Date.now()
      });

      if (hasAnswer) {
        writeSse(res, {
          type: "answer_chunk",
          content: result.answer,
          tool_name: serviceAgent.toolName
        });
      }

      writeSse(res, {
        type: "tool_result",
        content: "AI办事已返回可办理事项。",
        tool_name: serviceAgent.toolName,
        data: {
          action: result?.action || "",
          service_cards: result?.service_cards || [],
          guide_suggestions: result?.guide_suggestions || [],
          profile_update_candidates: result?.profile_update_candidates || []
        }
      });

      const logResult = await finishAgentRun({
        sessionId,
        runId,
        user,
        agent: serviceAgent,
        answer: result?.answer || "",
        status: hasAnswer ? "success" : "error",
        errorMessage: hasAnswer ? "" : "empty_answer",
        latencyMs,
        toolCallCount: 1,
        usage: normalizeUsage()
      });

      writeSse(res, {
        type: "final",
        content: "Service navigator response completed.",
        answer: result?.answer || "",
        conversation_id: "",
        portal_session_id: sessionId,
        run_id: runId,
        dify_conversation_id: "",
        counted: Boolean(logResult.counted),
        route: publicRoute(route),
        tool_events: [
          {
            call_id: toolCallId,
            agent: serviceAgent.id,
            tool_name: serviceAgent.toolName,
            status: hasAnswer ? "success" : "error",
            latency_ms: toolLatencyMs
          }
        ]
      });
      safeEnd();
      return;
    }

    const difyConversationId = await getLatestDifyConversationId({ sessionId, agent });
    const result = await streamDifyAnswer({
      res,
      message,
      conversationId: difyConversationId,
      user,
      agent,
      files: requestFiles,
      inputs: requestInputs
    });
    const latencyMs = Date.now() - startedAt;
    const toolLatencyMs = Date.now() - toolStartedAt;
    const hasAnswer = Boolean(String(result.answer || "").trim());

    await recordAgentToolCall({
      callId: toolCallId,
      runId,
      sessionId,
      agent,
      request: { query: message, conversation_id: difyConversationId, portal_session_id: sessionId },
      responseText: result.answer,
      responseConversationId: result.conversation_id,
      responseJson: result.response_json,
      usage: result.usage,
      status: hasAnswer ? "success" : "error",
      errorMessage: hasAnswer ? "" : "empty_answer",
      latencyMs: toolLatencyMs,
      startedAt: toolStartedAt,
      finishedAt: Date.now()
    });
    await recordAgentStep({
      runId,
      sessionId,
      index: 4,
      type: "tool_result",
      name: `${agent.toolName}_result`,
      title: "工具返回",
      content: hasAnswer ? "Tool returned a non-empty answer." : "Tool returned an empty answer.",
      output: { answer_length: String(result.answer || "").length },
      status: hasAnswer ? "success" : "error",
      errorMessage: hasAnswer ? "" : "empty_answer",
      latencyMs: toolLatencyMs,
      startedAt: toolStartedAt,
      finishedAt: Date.now()
    });

    const logResult = await finishAgentRun({
      sessionId,
      runId,
      user,
      agent,
      answer: result.answer,
      status: hasAnswer ? "success" : "error",
      errorMessage: hasAnswer ? "" : "empty_answer",
      latencyMs,
      toolCallCount: 1,
      usage: result.usage
    });

    writeSse(res, {
      type: "tool_result",
      content: `${agent.name} 处理完成。`,
      tool_name: agent.toolName
    });
    writeSse(res, {
      type: "final",
      content: "已整理最终回答。",
      answer: result.answer,
      conversation_id: result.conversation_id,
      portal_session_id: sessionId,
      run_id: runId,
      dify_conversation_id: result.conversation_id,
      counted: Boolean(logResult.counted),
      route: publicRoute(route),
      tool_events: []
    });
    safeEnd();
  } catch (error) {
    console.error("[chat/stream] failed:", error);
    const failedAgent = agent || { id: "super_agent", name: "超级智能体", toolName: "super_agent_runtime", planner: "runtime" };
    if (toolCallId) {
      await recordAgentToolCall({
        callId: toolCallId,
        runId,
        sessionId,
        agent: failedAgent,
        request: { query: message, portal_session_id: sessionId },
        responseText: "",
        status: error.name === "AbortError" ? "timeout" : "error",
        errorMessage: error.message,
        latencyMs: toolStartedAt ? Date.now() - toolStartedAt : null,
        startedAt: toolStartedAt || null,
        finishedAt: Date.now()
      });
    }
    await recordAgentStep({
      runId,
      sessionId,
      index: 99,
      type: "error",
      name: "runtime_error",
      title: "运行失败",
      content: error.message,
      status: "error",
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt,
      finishedAt: Date.now()
    });
    await finishAgentRun({
      sessionId,
      runId,
      user,
      agent: failedAgent,
      answer: "",
      status: "error",
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt,
      toolCallCount: toolCallId ? 1 : 0
    });
    writeSse(res, {
      type: "error",
      content: `超级智能体调用失败：${error.message}`,
      conversation_id: sessionId,
      run_id: runId
    });
    safeEnd();
  }
});
app.get("/api/rankings", async (req, res) => {
  const type = normalizeRankType(req.query.type);
  const period = normalizePeriod(req.query.period);
  const metric = normalizeRankingMetric(req.query.metric);
  const requestedLimit = normalizeInteger(req.query.limit, 15, 1, 100);
  const limit = Math.min(requestedLimit, 15);
  const user = getSessionUser(req);
  const userId = String(user.user_id || "guest");
  const periodStart = getPeriodStart(period);

  if (!mysqlPool) {
    return res.json({ type, period, metric, items: [], me: { rank: 0, score: 0 } });
  }

  try {
    let rows = [];
    let meScore = 0;
    let meHasRank = false;
    let greaterRows = [];
    const userRoleExpr = `COALESCE(
      u.user_role,
      CASE
        WHEN base.user_id REGEXP '^[0-9]{7}$' THEN 'teacher'
        WHEN base.user_id REGEXP '^[0-9]{8}$' THEN 'student'
        ELSE c.user_role
      END
    )`;
    const dailyUserRoleExpr = `COALESCE(
      MAX(u.user_role),
      CASE
        WHEN base.user_id REGEXP '^[0-9]{7}$' THEN 'teacher'
        WHEN base.user_id REGEXP '^[0-9]{8}$' THEN 'student'
        ELSE MAX(d.user_role)
      END
    )`;
    const counterScoreColumn = metric === "total_tokens" ? "COALESCE(c.total_token_count, 0)" : "COALESCE(c.effective_run_count, 0)";
    const dailyScoreColumn = metric === "total_tokens" ? "COALESCE(SUM(d.total_token_count), 0)" : "COALESCE(SUM(d.effective_run_count), 0)";
    const allUserBaseSql = `
      SELECT user_id FROM portal_users
      UNION
      SELECT user_id FROM portal_usage_counter
    `;
    const periodUserBaseSql = `
      SELECT user_id FROM portal_users
      UNION
      SELECT user_id FROM portal_usage_counter
      UNION
      SELECT user_id FROM portal_agent_daily_stats
    `;

    if (period === "all") {
      [rows] = await mysqlPool.query(
        `SELECT
           base.user_id,
           COALESCE(u.user_name, c.user_name) AS user_name,
           ${userRoleExpr} AS user_role,
           COALESCE(u.college, c.college) AS college,
           COALESCE(u.major, c.major) AS major,
           u.gender,
           ${counterScoreColumn} AS score,
           c.top_intent_label,
           c.top_tool_name
         FROM (${allUserBaseSql}) base
         LEFT JOIN portal_users u ON u.user_id = base.user_id
         LEFT JOIN portal_usage_counter c ON c.user_id = base.user_id
         WHERE ${userRoleExpr} = ? AND base.user_id <> 'guest'
         ORDER BY score DESC, COALESCE(c.last_run_at, u.last_seen_at, u.first_seen_at) ASC, base.user_id ASC
         LIMIT ?`,
        [type, limit]
      );
      const [meRows] = await mysqlPool.query(
        `SELECT ${counterScoreColumn} AS score
         FROM (${allUserBaseSql}) base
         LEFT JOIN portal_users u ON u.user_id = base.user_id
         LEFT JOIN portal_usage_counter c ON c.user_id = base.user_id
         WHERE base.user_id = ? AND base.user_id <> 'guest' AND ${userRoleExpr} = ?
         LIMIT 1`,
        [userId, type]
      );
      meHasRank = Boolean(meRows?.length);
      meScore = Number(meRows?.[0]?.score || 0);
      [greaterRows] = await mysqlPool.query(
        `SELECT COUNT(*) AS count
         FROM (${allUserBaseSql}) base
         LEFT JOIN portal_users u ON u.user_id = base.user_id
         LEFT JOIN portal_usage_counter c ON c.user_id = base.user_id
         WHERE ${userRoleExpr} = ? AND base.user_id <> 'guest' AND ${counterScoreColumn} > ?`,
        [type, meScore]
      );
    } else {
      [rows] = await mysqlPool.query(
        `SELECT
           base.user_id,
           COALESCE(MAX(u.user_name), MAX(d.user_name)) AS user_name,
           ${dailyUserRoleExpr} AS user_role,
           COALESCE(MAX(u.college), MAX(d.college)) AS college,
           COALESCE(MAX(u.major), MAX(d.major)) AS major,
           MAX(u.gender) AS gender,
           ${dailyScoreColumn} AS score,
           MAX(c.top_intent_label) AS top_intent_label,
           MAX(c.top_tool_name) AS top_tool_name
         FROM (${periodUserBaseSql}) base
         LEFT JOIN portal_users u ON u.user_id = base.user_id
         LEFT JOIN portal_agent_daily_stats d ON d.user_id = base.user_id AND d.stat_date >= ?
         LEFT JOIN portal_usage_counter c ON c.user_id = base.user_id
         WHERE base.user_id <> 'guest'
         GROUP BY base.user_id
         HAVING user_role = ?
         ORDER BY score DESC, COALESCE(MAX(d.updated_at), MAX(u.last_seen_at), MAX(u.first_seen_at)) ASC, base.user_id ASC
         LIMIT ?`,
        [periodStart, type, limit]
      );
      const [meRows] = await mysqlPool.query(
        `SELECT ${dailyScoreColumn} AS score
         FROM (${periodUserBaseSql}) base
         LEFT JOIN portal_users u ON u.user_id = base.user_id
         LEFT JOIN portal_agent_daily_stats d ON d.user_id = base.user_id AND d.stat_date >= ?
         LEFT JOIN portal_usage_counter c ON c.user_id = base.user_id
         WHERE base.user_id = ? AND base.user_id <> 'guest'
         GROUP BY base.user_id
         HAVING ${dailyUserRoleExpr} = ?`,
        [periodStart, userId, type]
      );
      meHasRank = Boolean(meRows?.length);
      meScore = Number(meRows?.[0]?.score || 0);
      [greaterRows] = await mysqlPool.query(
        `SELECT COUNT(*) AS count
         FROM (
           SELECT
             base.user_id,
             ${dailyUserRoleExpr} AS effective_user_role,
             ${dailyScoreColumn} AS score
           FROM (${periodUserBaseSql}) base
           LEFT JOIN portal_users u ON u.user_id = base.user_id
           LEFT JOIN portal_agent_daily_stats d ON d.user_id = base.user_id AND d.stat_date >= ?
           LEFT JOIN portal_usage_counter c ON c.user_id = base.user_id
           WHERE base.user_id <> 'guest'
           GROUP BY base.user_id
         ) ranked
         WHERE ranked.effective_user_role = ? AND ranked.score > ?`,
        [periodStart, type, meScore]
      );
    }

    const items = rows.map((row, index) => ({
      id: String(row.user_id),
      rank: index + 1,
      name: maskDisplayName(row.user_name || row.user_id),
      college: row.college || "学院/部门",
      major: row.major || (row.user_role === "teacher" ? "教师" : "专业"),
      gender: row.gender || "",
      userRole: row.user_role || type,
      count: Number(row.score || 0),
      commonUse: row.top_intent_label || row.top_tool_name || "超级智能体"
    }));

    res.json({
      type,
      period,
      metric,
      items,
      me: {
        rank: meHasRank ? Number(greaterRows?.[0]?.count || 0) + 1 : 0,
        score: meScore
      }
    });
  } catch (error) {
    console.error("[rankings] failed:", error.message);
    res.status(500).json({ type, period, metric, items: [], me: { rank: 0, score: 0 }, message: "Failed to load rankings" });
  }
});
app.get("/api/agents", async (_req, res) => {
  const rows = await queryOrFallback(
    `SELECT agent_id, name, status, detail, target_url
     FROM portal_agent_links
     WHERE is_active = 1
     ORDER BY sort_order ASC, id ASC`,
    [],
    []
  );

  res.json({
    agents: rows.map((row) => ({
      id: row.agent_id,
      name: row.name,
      status: row.status || "外部系统",
      detail: row.detail || "",
      targetUrl: row.target_url || ""
    }))
  });
});

app.get("/api/admin/session", requireAdmin, async (req, res) => {
  res.json({ success: true, user: getSessionUser(req), adminUserIdsConfigured: config.adminUserIds.length > 0 });
});

app.get("/api/admin/overview", requireAdmin, async (req, res) => {
  if (!mysqlPool) return res.status(503).json({ success: false, message: "MySQL is not configured" });
  const range = adminRangeToSql(req.query.range);
  try {
    const [[visitStats]] = await mysqlPool.query(
      `SELECT COUNT(*) AS visit_count, COUNT(DISTINCT user_id) AS active_user_count
       FROM portal_visit_events
       WHERE visited_at ${range.where}`
    );
    const [[runStats]] = await mysqlPool.query(
      `SELECT COUNT(*) AS question_count,
              SUM(status = 'success') AS success_count,
              SUM(status <> 'success') AS error_count,
              COALESCE(SUM(is_effective), 0) AS effective_count,
              COALESCE(SUM(latency_ms), 0) AS latency_total,
              COALESCE(AVG(latency_ms), 0) AS latency_avg
       FROM portal_agent_runs
       WHERE started_at ${range.where}`
    );
    const [[tokenStats]] = await mysqlPool.query(
      `SELECT COALESCE(SUM(total_token_count), 0) AS total_tokens,
              COALESCE(SUM(prompt_token_count), 0) AS prompt_tokens,
              COALESCE(SUM(completion_token_count), 0) AS completion_tokens,
              COALESCE(SUM(total_tool_call_count), 0) AS tool_calls
       FROM portal_agent_daily_stats
       WHERE stat_date ${range.range === "today" ? "= CURDATE()" : range.range === "7d" ? ">= DATE_SUB(CURDATE(), INTERVAL 7 DAY)" : ">= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"}`
    );
    const [agentRows] = await mysqlPool.query(
      `SELECT COALESCE(top_tool_name, top_intent_label, 'unknown') AS agent, COUNT(*) AS user_count
       FROM portal_usage_counter
       WHERE last_run_at ${range.where}
       GROUP BY agent
       ORDER BY user_count DESC
       LIMIT 8`
    );

    res.json({
      success: true,
      range: range.range,
      stats: {
        visits: Number(visitStats?.visit_count || 0),
        activeUsers: Number(visitStats?.active_user_count || 0),
        questions: Number(runStats?.question_count || 0),
        successRuns: Number(runStats?.success_count || 0),
        errorRuns: Number(runStats?.error_count || 0),
        effectiveRuns: Number(runStats?.effective_count || 0),
        totalTokens: Number(tokenStats?.total_tokens || 0),
        promptTokens: Number(tokenStats?.prompt_tokens || 0),
        completionTokens: Number(tokenStats?.completion_tokens || 0),
        toolCalls: Number(tokenStats?.tool_calls || 0),
        avgLatencyMs: Math.round(Number(runStats?.latency_avg || 0))
      },
      topAgents: agentRows || []
    });
  } catch (error) {
    console.error("[admin/overview] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to load admin overview" });
  }
});

app.get("/api/admin/visits", requireAdmin, async (req, res) => {
  if (!mysqlPool) return res.status(503).json({ success: false, message: "MySQL is not configured" });
  const range = adminRangeToSql(req.query.range);
  const limit = normalizeInteger(req.query.limit, 100, 1, 500);
  try {
    const [rows] = await mysqlPool.query(
      `SELECT user_id AS userId,
              COALESCE(MAX(user_name), user_id) AS userName,
              MAX(user_role) AS userRole,
              MAX(college) AS college,
              MIN(visited_at) AS firstVisitAt,
              MAX(visited_at) AS lastVisitAt,
              COUNT(*) AS visitCount,
              SUBSTRING_INDEX(GROUP_CONCAT(path ORDER BY visited_at DESC SEPARATOR '||'), '||', 1) AS lastPath
       FROM portal_visit_events
       WHERE visited_at ${range.where}
       GROUP BY user_id
       ORDER BY lastVisitAt DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ success: true, range: range.range, visits: rows || [] });
  } catch (error) {
    console.error("[admin/visits] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to load visits" });
  }
});

app.get("/api/admin/questions", requireAdmin, async (req, res) => {
  if (!mysqlPool) return res.status(503).json({ success: false, message: "MySQL is not configured" });
  const range = adminRangeToSql(req.query.range);
  const limit = normalizeInteger(req.query.limit, 100, 1, 500);
  const keyword = normalizeMessage(req.query.keyword || "").slice(0, 100);
  const status = normalizeMessage(req.query.status || "").slice(0, 32);
  const where = [`r.started_at ${range.where}`];
  const params = [];
  if (keyword) {
    where.push("r.question LIKE ?");
    params.push(`%${keyword}%`);
  }
  if (status) {
    where.push("r.status = ?");
    params.push(status);
  }
  params.push(limit);

  try {
    const [rows] = await mysqlPool.query(
      `SELECT r.run_id AS runId,
              r.session_id AS sessionId,
              r.user_id AS userId,
              r.user_name AS userName,
              r.user_role AS userRole,
              r.college,
              r.question,
              r.final_answer AS finalAnswer,
              r.status,
              r.intent_label AS intentLabel,
              r.planner_type AS plannerType,
              r.latency_ms AS latencyMs,
              r.error_message AS errorMessage,
              r.started_at AS startedAt,
              r.finished_at AS finishedAt,
              tc.tool_name AS toolName
       FROM portal_agent_runs r
       LEFT JOIN (
         SELECT run_id, MAX(tool_name) AS tool_name
         FROM portal_agent_tool_calls
         GROUP BY run_id
       ) tc ON tc.run_id = r.run_id
       WHERE ${where.join(" AND ")}
       ORDER BY r.started_at DESC
       LIMIT ?`,
      params
    );
    res.json({
      success: true,
      range: range.range,
      questions: (rows || []).map((row) => ({
        ...row,
        finalAnswer: String(row.finalAnswer || "").slice(0, 300)
      }))
    });
  } catch (error) {
    console.error("[admin/questions] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to load questions" });
  }
});

app.get("/api/admin/question-top", requireAdmin, async (req, res) => {
  if (!mysqlPool) return res.status(503).json({ success: false, message: "MySQL is not configured" });
  const range = adminRangeToSql(req.query.range);
  const limit = normalizeInteger(req.query.limit, 50, 1, 200);
  try {
    const [rows] = await mysqlPool.query(
      `SELECT question,
              COUNT(*) AS count,
              MAX(started_at) AS lastAskedAt,
              SUM(status = 'success') AS successCount,
              SUM(status <> 'success') AS errorCount
       FROM portal_agent_runs
       WHERE started_at ${range.where}
         AND question IS NOT NULL
         AND question <> ''
       GROUP BY question
       ORDER BY count DESC, lastAskedAt DESC
       LIMIT ?`,
      [Math.min(limit * 4, 500)]
    );
    const grouped = new Map();
    for (const row of rows || []) {
      const key = normalizeQuestionForTop(row.question);
      if (!key) continue;
      const current = grouped.get(key) || {
        question: key,
        count: 0,
        successCount: 0,
        errorCount: 0,
        lastAskedAt: row.lastAskedAt
      };
      current.count += Number(row.count || 0);
      current.successCount += Number(row.successCount || 0);
      current.errorCount += Number(row.errorCount || 0);
      if (new Date(row.lastAskedAt) > new Date(current.lastAskedAt)) current.lastAskedAt = row.lastAskedAt;
      grouped.set(key, current);
    }
    const items = Array.from(grouped.values())
      .sort((a, b) => b.count - a.count || new Date(b.lastAskedAt) - new Date(a.lastAskedAt))
      .slice(0, limit);
    res.json({ success: true, range: range.range, items });
  } catch (error) {
    console.error("[admin/question-top] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to load top questions" });
  }
});

app.get("/api/admin/session-detail", requireAdmin, async (req, res) => {
  if (!mysqlPool) return res.status(503).json({ success: false, message: "MySQL is not configured" });
  const sessionId = normalizeMessage(req.query.sessionId || req.query.session_id).slice(0, 96);
  if (!sessionId) return res.status(400).json({ success: false, message: "Missing sessionId" });
  try {
    const [sessions] = await mysqlPool.query(
      `SELECT session_id AS sessionId, user_id AS userId, user_name AS userName, user_role AS userRole,
              college, major, title, first_message_at AS firstMessageAt, last_message_at AS lastMessageAt
       FROM portal_agent_sessions
       WHERE session_id = ?
       LIMIT 1`,
      [sessionId]
    );
    const [messages] = await mysqlPool.query(
      `SELECT role, content, content_type AS contentType, created_at AS createdAt
       FROM portal_agent_messages
       WHERE session_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT 300`,
      [sessionId]
    );
    const [runs] = await mysqlPool.query(
      `SELECT run_id AS runId, question, status, intent_label AS intentLabel, planner_type AS plannerType,
              error_message AS errorMessage, latency_ms AS latencyMs, started_at AS startedAt, finished_at AS finishedAt
       FROM portal_agent_runs
       WHERE session_id = ?
       ORDER BY started_at DESC
       LIMIT 100`,
      [sessionId]
    );
    const [toolCalls] = await mysqlPool.query(
      `SELECT call_id AS callId, run_id AS runId, tool_name AS toolName, status, error_message AS errorMessage,
              latency_ms AS latencyMs, response_json AS responseJson, started_at AS startedAt, finished_at AS finishedAt
       FROM portal_agent_tool_calls
       WHERE session_id = ?
       ORDER BY started_at DESC
       LIMIT 100`,
      [sessionId]
    );
    const [steps] = await mysqlPool.query(
      `SELECT run_id AS runId, step_type AS stepType, step_name AS stepName, title, content, status,
              error_message AS errorMessage, latency_ms AS latencyMs, started_at AS startedAt, finished_at AS finishedAt
       FROM portal_agent_run_steps
       WHERE session_id = ?
       ORDER BY step_index ASC, started_at ASC
       LIMIT 200`,
      [sessionId]
    );
    res.json({
      success: true,
      session: sessions?.[0] || null,
      messages: messages || [],
      runs: runs || [],
      toolCalls: (toolCalls || []).map((item) => ({ ...item, responseJson: parseResponseJson(item.responseJson) })),
      steps: steps || []
    });
  } catch (error) {
    console.error("[admin/session-detail] failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to load session detail" });
  }
});

app.post("/api/feedback", async (req, res) => {
  const topic = normalizeMessage(req.body?.topic).slice(0, 64);
  const content = normalizeMessage(req.body?.content);
  if (!topic || !content) return res.status(400).json({ success: false, message: "Missing topic or content" });

  const user = getSessionUser(req);
  const result = await executeOrFallback(
    `INSERT INTO portal_feedback (user_id, user_name, topic, content, contact)
     VALUES (?, ?, ?, ?, ?)`,
    [user.user_id || null, user.name || null, topic, content, null]
  );

  if (!result.ok) return res.status(503).json({ success: false, message: result.reason });
  res.json({ success: true, id: result.result.insertId });
});

app.post("/api/join", async (req, res) => {
  const name = normalizeMessage(req.body?.name).slice(0, 128);
  const roleTitle = normalizeMessage(req.body?.role).slice(0, 128);
  const reason = normalizeMessage(req.body?.reason);

  const user = getSessionUser(req);
  const applicantName = name || user.name || user.user_id || "未登录用户";
  const selectedRole = roleTitle || "未选择方向";
  const result = await executeOrFallback(
    `INSERT INTO portal_join_requests (user_id, user_name, name, role_title, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [user.user_id || null, user.name || null, applicantName, selectedRole, reason || null]
  );

  if (!result.ok) return res.status(503).json({ success: false, message: result.reason });
  res.json({ success: true, id: result.result.insertId });
});

app.get("/api/auth/login", (req, res) => {
  if (req.query.bridge === "local" && !getBridgeReturnTo(req)) {
    return res.status(400).send("Invalid local OAuth bridge return URL");
  }

  const bridgeReturnTo = getBridgeReturnTo(req);
  const state = bridgeReturnTo ? encodeOAuthBridgeState(bridgeReturnTo) : crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const authorizeUrl = new URL(`${config.authServer}/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("scope", config.scope);
  authorizeUrl.searchParams.set("state", state);

  res.redirect(authorizeUrl.toString());
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("ahau.sid");
    res.json({ success: true });
  });
});

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function completeOAuthExchange(req, { code, state }) {
  if (!code) throw httpError(400, "Missing required field: code");
  const expectedState = req.session?.oauthState;
  if (expectedState && state && expectedState !== state) {
    throw httpError(400, "Invalid oauth state");
  }

  const tokenUrl = `${config.authServer}/accessToken`;
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("client_id", config.clientId);
  form.set("client_secret", config.clientSecret);
  form.set("redirect_uri", config.redirectUri);

  const tokenResp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form
  });
  if (!tokenResp.ok) {
    const detail = await tokenResp.text();
    throw httpError(502, `Token exchange failed: ${detail}`);
  }

  const tokenRawText = await tokenResp.text();
  const tokenData = parseCasTokenPayload(tokenRawText);
  const accessToken = tokenData.accessToken;
  if (!accessToken) {
    throw httpError(502, `Token response missing access_token: ${tokenRawText}`);
  }

  const userForm = new URLSearchParams();
  userForm.set("access_token", accessToken);
  let userResp = await fetch(config.userinfoEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: userForm
  });
  if (!userResp.ok) {
    const fallbackUrl = new URL(config.userinfoEndpoint);
    fallbackUrl.searchParams.set("access_token", accessToken);
    userResp = await fetch(fallbackUrl, { method: "GET" });
  }
  if (!userResp.ok) {
    const detail = await userResp.text();
    throw httpError(502, `User info request failed: ${detail}`);
  }

  const userRawText = await userResp.text();
  const userRaw = parseUserInfoText(userRawText);
  const normalized = normalizeCasUser(userRaw);
  const user = { ...userRaw, ...normalized };

  req.session.user = user;
  req.session.accessToken = accessToken;
  req.session.oauthState = undefined;

  const userStoreResult = await upsertPortalUser(user);
  const counterResult = await tryIncreaseLoginCounter(user.user_id || user.id);

  return {
    accessToken,
    user,
    userStoreResult,
    counterResult
  };
}

app.post("/api/auth/exchange", async (req, res) => {
  try {
    const result = await completeOAuthExchange(req, req.body || {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).send(error.status ? error.message : `OAuth flow error: ${error.message}`);
  }
});

app.get("/callback", async (req, res, next) => {
  const bridgeState = decodeOAuthBridgeState(req.query.state);
  if (!bridgeState && !req.query.code) return next();

  if (bridgeState && !isAllowedBridgeReturnUrl(bridgeState.returnTo)) {
    return res.status(400).send("OAuth bridge return URL is not allowed");
  }

  if (bridgeState) {
    const localCallbackUrl = new URL(bridgeState.returnTo);
    appendOAuthCallbackQuery(localCallbackUrl, req.query);
    return res.redirect(localCallbackUrl.toString());
  }

  try {
    await completeOAuthExchange(req, { code: req.query.code, state: req.query.state });
    return res.redirect("/");
  } catch (error) {
    return res.status(error.status || 500).send(error.status ? error.message : `OAuth callback error: ${error.message}`);
  }
});

const distDir = path.resolve(projectRoot, "dist");
if (fs.existsSync(distDir)) {
  const sendPortalIndex = (req, res) => {
    if (!req.session?.user) {
      return res.redirect("/api/auth/login");
    }
    return res.sendFile(path.join(distDir, "index.html"));
  };

  app.get(["/", "/index.html"], sendPortalIndex);
  app.use(express.static(distDir));
  app.get("/admin", (_req, res) => {
    res.sendFile(path.join(distDir, "admin.html"));
  });
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    sendPortalIndex(req, res);
  });
}

app.listen(config.port, () => {
  console.log(`OAuth proxy server listening on http://localhost:${config.port}`);
  console.log(
    `[runtime] session_store=${sessionStore ? "mysql" : "memory"} mysql_pool_size=${config.mysqlPoolSize} dify_max_concurrent=${config.difyMaxConcurrent}`
  );
});
