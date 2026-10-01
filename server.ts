import express from 'express';
import { createServer as createViteServer } from 'vite';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { bin as cloudflaredBin, install as installCloudflared } from 'cloudflared';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

let publicTvTunnelBaseUrl: string | null = null;
let tunnelProcess: ChildProcess | null = null;
let tunnelPromise: Promise<string | null> | null = null;

async function ensurePublicTvTunnel(port: number): Promise<string | null> {
  if (publicTvTunnelBaseUrl) return `${publicTvTunnelBaseUrl}/?tv=1`;
  if (tunnelPromise) return tunnelPromise;

  tunnelPromise = (async () => {
    try {
      if (!fs.existsSync(cloudflaredBin)) {
        await installCloudflared(cloudflaredBin);
      }
      return await new Promise<string | null>((resolve) => {
        const proc = spawn(
          cloudflaredBin,
          ['tunnel', '--url', `http://127.0.0.1:${port}`, '--protocol', 'http2', '--no-autoupdate'],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        tunnelProcess = proc;

        let settled = false;
        const onData = (chunk: Buffer) => {
          const text = chunk.toString();
          const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (match) {
            publicTvTunnelBaseUrl = match[0];
          }
          if (publicTvTunnelBaseUrl && /Registered tunnel connection/i.test(text) && !settled) {
            settled = true;
            console.log(`Modo TV Public URL ready: ${publicTvTunnelBaseUrl}/?tv=1`);
            resolve(`${publicTvTunnelBaseUrl}/?tv=1`);
          }
        };

        proc.stdout?.on('data', onData);
        proc.stderr?.on('data', onData);

        proc.on('exit', () => {
          publicTvTunnelBaseUrl = null;
          tunnelProcess = null;
          tunnelPromise = null;
          if (!settled) {
            settled = true;
            resolve(null);
          }
        });

        setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(publicTvTunnelBaseUrl ? `${publicTvTunnelBaseUrl}/?tv=1` : null);
          }
        }, 12000);
      });
    } catch {
      tunnelPromise = null;
      return null;
    }
  })();

  return tunnelPromise;
}

const PORT = 3000;
const DEFAULT_TOTVS_URL = (
  process.env.TOTVS_BASE_URL ||
  'https://sge.pe.sesi.org.br/FrameHTML/rm/api/TOTVSCustomizacao/ConsultasSQL/ExecutaConsultaSQL'
)
  .split('?')[0]
  .trim();

interface StreamQueryResult {
  rows: Record<string, unknown>[];
  totalScanned: number;
  totalBytes: number;
  durationMs: number;
  periodCounts: Record<string, number>;
  requestedUrl: string;
  complete?: boolean;
}

const httpsKeepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 4,
  rejectUnauthorized: false,
});
const httpKeepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 4,
});

// Cache em memória por período para resposta instantânea após a 1ª leitura do stream de 268MB
const periodCache = new Map<string, StreamQueryResult>();
let activeSyncPromise: Promise<StreamQueryResult> | null = null;
let activeSyncPeriodo: string | null = null;

function cleanRow(raw: Record<string, unknown>, index: number): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmedKey = key.trim();
    const cleanedVal = typeof value === 'string' ? value.trim() : value;
    cleaned[trimmedKey] = cleanedVal;

    const normKey = trimmedKey
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[_\s-]+/g, ' ');
    if (
      normKey === 'MAX ALUNOS' ||
      normKey === 'MAXALUNOS' ||
      normKey === 'MAXIMO ALUNOS' ||
      normKey === 'QTMAXALUNOS' ||
      normKey === 'QTD MAX ALUNOS'
    ) {
      cleaned['MAX ALUNOS'] = cleanedVal;
    }
  }
  const ra = cleaned['RA'] ? String(cleaned['RA']) : `idx-${index}`;
  const per = cleaned['PERIODO'] ? String(cleaned['PERIODO']) : 'sem-periodo';
  cleaned._id = `row-${ra}-${per}-${index}`;
  return cleaned;
}

function runSingleStreamAttempt(options: {
  fullUrl: string;
  targetPeriodo: string;
  finalUser: string;
  finalPass: string;
  cookies?: string;
}): Promise<StreamQueryResult & { complete: boolean; cookies: string }> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const { fullUrl, targetPeriodo, finalUser, finalPass, cookies } = options;
    const parsedUrl = new URL(fullUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? httpsKeepAliveAgent : httpKeepAliveAgent;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Connection: 'keep-alive',
    };

    if (finalUser && finalPass) {
      const token = Buffer.from(`${finalUser}:${finalPass}`, 'utf-8').toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    }
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const req = client.get(
      fullUrl,
      {
        agent,
        headers,
        timeout: 120000,
        rejectUnauthorized: false,
        highWaterMark: 32 * 1024 * 1024,
      } as https.RequestOptions,
      (res) => {
        res.socket?.setNoDelay(true);
        const setCookieList = res.headers['set-cookie'];
        const responseCookies = Array.isArray(setCookieList)
          ? setCookieList.map((c) => c.split(';')[0]).join('; ')
          : cookies || '';

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          let errBody = '';
          res.on('data', (c) => {
            if (errBody.length < 1000) errBody += c.toString('utf8');
          });
          res.on('end', () => {
            reject(
              new Error(
                res.statusCode === 401
                  ? 'Autenticação recusada pelo TOTVS RM (HTTP 401). Verifique TOTVS_USER e TOTVS_PASSWORD.'
                  : `TOTVS RM retornou HTTP ${res.statusCode}: ${errBody.slice(0, 300)}`
              )
            );
          });
          return;
        }

        let stream: NodeJS.ReadableStream = res;
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          stream = res.pipe(
            zlib.createGunzip({ finishFlush: zlib.constants.Z_SYNC_FLUSH })
          );
        } else if (encoding === 'deflate') {
          stream = res.pipe(
            zlib.createInflate({ finishFlush: zlib.constants.Z_SYNC_FLUSH })
          );
        }

        const rawChunks: Buffer[] = [];
        let totalBytes = 0;
        let finalized = false;

        stream.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          rawChunks.push(chunk);
        });

        const finalize = (err?: Error) => {
          if (finalized) return;
          finalized = true;

          let totalScanned = 0;
          let buffer = '';
          let depth = 0;
          let inString = false;
          let escape = false;
          let objStart = -1;
          const matchedRows: Record<string, unknown>[] = [];
          const periodCounts: Record<string, number> = {};

          for (const chunk of rawChunks) {
            const str = chunk.toString('utf8');
            const baseOffset = buffer.length;
            buffer += str;

            for (let i = baseOffset; i < buffer.length; i++) {
              const ch = buffer[i];
              if (escape) {
                escape = false;
                continue;
              }
              if (ch === '\\' && inString) {
                escape = true;
                continue;
              }
              if (ch === '"') {
                inString = !inString;
                continue;
              }
              if (inString) continue;

              if (ch === '{') {
                if (depth === 1) objStart = i;
                depth++;
              } else if (ch === '}') {
                depth--;
                if (depth === 1 && objStart !== -1) {
                  const objStr = buffer.slice(objStart, i + 1);
                  objStart = -1;
                  totalScanned++;
                  if (targetPeriodo === 'TODOS' || objStr.includes(`"${targetPeriodo}"`)) {
                    try {
                      const row = JSON.parse(objStr) as Record<string, unknown>;
                      const rowPer = String(row['PERIODO'] ?? '').trim();
                      periodCounts[rowPer] = (periodCounts[rowPer] || 0) + 1;

                      if (targetPeriodo === 'TODOS' || rowPer === targetPeriodo) {
                        if (matchedRows.length < 25000) {
                          matchedRows.push(cleanRow(row, matchedRows.length));
                        }
                      }
                    } catch {
                      // Ignora objeto malformado isolado
                    }
                  }
                }
              }
            }

            if (objStart === -1) {
              buffer = '';
            } else if (objStart > 0) {
              buffer = buffer.slice(objStart);
              objStart = 0;
            }
          }

          rawChunks.length = 0;

          if (matchedRows.length === 0 && err) {
            reject(err);
            return;
          }

          const contentLen = Number(res.headers['content-length'] || 0);
          const isComplete =
            Boolean(res.complete) && (contentLen === 0 || totalBytes >= contentLen);

          resolve({
            rows: matchedRows,
            totalScanned,
            totalBytes,
            durationMs: Date.now() - t0,
            periodCounts,
            requestedUrl: fullUrl,
            complete: isComplete,
            cookies: responseCookies,
          });
        };

        stream.on('end', () => finalize());
        stream.on('close', () => finalize());
        res.on('close', () => finalize());
        stream.on('error', (err) => finalize(err));
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Tempo limite de 120s excedido ao baixar stream do TOTVS RM.'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

async function streamTotvsQuery(options: {
  baseUrl: string;
  codcoligada: string;
  codsentenca: string;
  codsistema: string;
  parameters: string;
  periodo: string;
  username?: string;
  password?: string;
}): Promise<StreamQueryResult> {
  const {
    baseUrl,
    codcoligada,
    codsentenca,
    codsistema,
    parameters,
    periodo,
    username,
    password,
  } = options;

  const cleanBaseUrl = (baseUrl || DEFAULT_TOTVS_URL).split('?')[0].trim();
  const encodedSentenca = encodeURIComponent(codsentenca);
  const encodedParams = encodeURIComponent(parameters);
  const fullUrl = `${cleanBaseUrl}?codcoligada=${encodeURIComponent(codcoligada)}&codsentenca=${encodedSentenca}&codsistema=${encodeURIComponent(codsistema)}&PARAMETERS=${encodedParams}`;
  const targetPeriodo = periodo.trim();
  const finalUser = username || process.env.TOTVS_USER || '';
  const finalPass = password || process.env.TOTVS_PASSWORD || '';

  let bestAttempt = await runSingleStreamAttempt({
    fullUrl,
    targetPeriodo,
    finalUser,
    finalPass,
  });

  // Se a 1ª leitura sofreu corte do proxy volt-adc aos 30s antes de concluir 100% dos bytes,
  // fazemos nova leitura imediata reutilizando o socket keep-alive e os cookies de sessão ASP.NET
  for (let retry = 0; retry < 2 && !bestAttempt.complete; retry++) {
    try {
      const nextAttempt = await runSingleStreamAttempt({
        fullUrl,
        targetPeriodo,
        finalUser,
        finalPass,
        cookies: bestAttempt.cookies,
      });
      if (nextAttempt.complete || nextAttempt.rows.length >= bestAttempt.rows.length) {
        bestAttempt = nextAttempt;
      }
    } catch {
      // Mantém a melhor tentativa anterior
    }
  }

  const existing = getCachedPeriodo(targetPeriodo);
  let finalRows = bestAttempt.rows;
  if (!bestAttempt.complete && existing && existing.rows.length > bestAttempt.rows.length) {
    const byKey = new Map<string, Record<string, unknown>>();
    const turmaMaxMap = new Map<string, unknown>();

    for (const r of existing.rows) {
      const k = `${String(r['RA'] ?? '')}-${String(r['PERIODO'] ?? '')}-${String(r['TURMA'] ?? '')}`;
      byKey.set(k, r);
      const tKey = `${String(r['UNIDADE'] ?? '').trim()}::${String(r['TURMA'] ?? '').trim()}`;
      if (r['MAX ALUNOS']) turmaMaxMap.set(tKey, r['MAX ALUNOS']);
    }
    for (const r of bestAttempt.rows) {
      const k = `${String(r['RA'] ?? '')}-${String(r['PERIODO'] ?? '')}-${String(r['TURMA'] ?? '')}`;
      byKey.set(k, r);
      const tKey = `${String(r['UNIDADE'] ?? '').trim()}::${String(r['TURMA'] ?? '').trim()}`;
      if (r['MAX ALUNOS']) turmaMaxMap.set(tKey, r['MAX ALUNOS']);
    }
    finalRows = Array.from(byKey.values()).map((r, idx) => {
      const tKey = `${String(r['UNIDADE'] ?? '').trim()}::${String(r['TURMA'] ?? '').trim()}`;
      if (!r['MAX ALUNOS'] && turmaMaxMap.has(tKey)) {
        r['MAX ALUNOS'] = turmaMaxMap.get(tKey);
      }
      r._id = `row-${String(r['RA'] ?? idx)}-${String(r['PERIODO'] ?? '2027')}-${idx}`;
      return r;
    });
  }

  const result: StreamQueryResult = {
    rows: finalRows,
    totalScanned: Math.max(bestAttempt.totalScanned, existing?.totalScanned || 0),
    totalBytes: Math.max(bestAttempt.totalBytes, existing?.totalBytes || 0),
    durationMs: bestAttempt.durationMs,
    periodCounts:
      Object.keys(bestAttempt.periodCounts).length > 0
        ? bestAttempt.periodCounts
        : existing?.periodCounts || {},
    requestedUrl: fullUrl,
    complete: bestAttempt.complete || Boolean(existing?.complete),
  };

  if (finalRows.length > 0) {
    periodCache.set(targetPeriodo, result);
    const safePer = targetPeriodo.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      const serialized = JSON.stringify(result);
      fs.writeFileSync(`/tmp/totvs_cache_${safePer}.json`, serialized);
      const localCacheDir = path.join(process.cwd(), '.cache');
      if (!fs.existsSync(localCacheDir)) {
        fs.mkdirSync(localCacheDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(localCacheDir, `totvs_cache_${safePer}.json`),
        serialized
      );
    } catch {
      // Ignora falha de gravação em disco
    }
  }

  return result;
}

// Tenta restaurar cache de disco se existir, estiver completo (100% dos bytes) e possuir MAX ALUNOS
function getCachedPeriodo(periodo: string): StreamQueryResult | null {
  const key = periodo.trim();
  if (periodCache.has(key)) {
    const mem = periodCache.get(key)!;
    if (mem.rows.length > 0 && (mem.complete || mem.totalBytes >= 268000000)) {
      const hasMaxCol = mem.rows.slice(0, 10).some(
        (r) => r && ('MAX ALUNOS' in r || 'MAXALUNOS' in r || 'MAX_ALUNOS' in r)
      );
      if (hasMaxCol) return mem;
    }
    periodCache.delete(key);
  }
  const safePer = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  const candidatePaths = [
    `/tmp/totvs_cache_${safePer}.json`,
    path.join(process.cwd(), '.cache', `totvs_cache_${safePer}.json`),
  ];
  for (const diskPath of candidatePaths) {
    if (fs.existsSync(diskPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(diskPath, 'utf8')) as StreamQueryResult;
        if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) {
          continue;
        }
        // Ignora cache truncado (ex: corte aos 255MB em vez de ~268.7MB completos)
        if (!parsed.complete && (parsed.totalBytes || 0) < 268000000) {
          continue;
        }
        const hasMaxCol = parsed.rows.slice(0, 10).some(
          (r) =>
            r &&
            typeof r === 'object' &&
            ('MAX ALUNOS' in r || 'MAX_ALUNOS' in r || 'MAXALUNOS' in r)
        );
        if (!hasMaxCol) {
          continue;
        }
        for (const r of parsed.rows) {
          if (r && typeof r === 'object' && !('MAX ALUNOS' in r) && 'MAXALUNOS' in r) {
            r['MAX ALUNOS'] = r['MAXALUNOS'];
          }
        }
        periodCache.set(key, parsed);
        return parsed;
      } catch {
        // Tenta próximo caminho
      }
    }
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Status da configuração e do cache
  app.get('/api/totvs/config', (_req, res) => {
    const cached2027 = getCachedPeriodo('2027');
    res.json({
      baseUrl: DEFAULT_TOTVS_URL,
      hasEnvCredentials: Boolean(process.env.TOTVS_USER && process.env.TOTVS_PASSWORD),
      isSyncing: Boolean(activeSyncPromise),
      activeSyncPeriodo,
      cached2027Count: cached2027 ? cached2027.rows.length : null,
      totalScannedInSql: cached2027 ? cached2027.totalScanned : null,
      periodCounts: cached2027 ? cached2027.periodCounts : null,
    });
  });

  // Endpoint principal que lê a Consulta SQL do TOTVS RM via streaming e filtra pelo período
  app.post('/api/totvs/consulta', async (req, res) => {
    try {
      const {
        baseUrl = DEFAULT_TOTVS_URL,
        codcoligada = '2',
        codsentenca = 'SE42018_2 Produc',
        codsistema = 'S',
        parameters = 'CODCOLIGADA=2',
        periodo = '2027',
        forceRefresh = false,
        username,
        password,
      } = req.body || {};

      const targetPeriodo = String(periodo || '2027').trim();

      // Se já estiver em cache e não for forceRefresh, retorna imediatamente
      if (!forceRefresh && !username && !password) {
        const cached = getCachedPeriodo(targetPeriodo);
        if (cached && cached.rows.length > 0) {
          return res.json({
            ok: true,
            fromCache: true,
            requestedUrl: cached.requestedUrl,
            totalRows: cached.rows.length,
            totalScanned: cached.totalScanned,
            totalBytes: cached.totalBytes,
            durationMs: cached.durationMs,
            periodCounts: cached.periodCounts,
            Row: cached.rows,
          });
        }
      }

      // Se já houver um download em andamento para o mesmo período, aguarda ele
      if (activeSyncPromise && activeSyncPeriodo === targetPeriodo && !username) {
        const result = await activeSyncPromise;
        return res.json({
          ok: true,
          fromCache: false,
          requestedUrl: result.requestedUrl,
          totalRows: result.rows.length,
          totalScanned: result.totalScanned,
          totalBytes: result.totalBytes,
          durationMs: result.durationMs,
          periodCounts: result.periodCounts,
          Row: result.rows,
        });
      }

      activeSyncPeriodo = targetPeriodo;
      activeSyncPromise = streamTotvsQuery({
        baseUrl,
        codcoligada: String(codcoligada),
        codsentenca: String(codsentenca),
        codsistema: String(codsistema),
        parameters: String(parameters),
        periodo: targetPeriodo,
        username,
        password,
      });

      const result = await activeSyncPromise;
      activeSyncPromise = null;
      activeSyncPeriodo = null;

      return res.json({
        ok: true,
        fromCache: false,
        requestedUrl: result.requestedUrl,
        totalRows: result.rows.length,
        totalScanned: result.totalScanned,
        totalBytes: result.totalBytes,
        durationMs: result.durationMs,
        periodCounts: result.periodCounts,
        Row: result.rows,
      });
    } catch (error: unknown) {
      activeSyncPromise = null;
      activeSyncPeriodo = null;
      const errMessage =
        error instanceof Error ? error.message : 'Erro ao consultar endpoint TOTVS RM';
      return res.status(502).json({
        ok: false,
        message: errMessage,
      });
    }
  });

  const CACHE_DIR = path.join(process.cwd(), '.cache');
  const SHARED_PDFS_DIR = path.join(CACHE_DIR, 'shared_pdfs');
  const GOALS_CACHE_FILE = path.join(CACHE_DIR, 'goals_2027.json');
  const TURMA_CAP_CACHE_FILE = path.join(CACHE_DIR, 'turma_capacities_2027.json');
  const EMAIL_CONFIG_CACHE_FILE = path.join(CACHE_DIR, 'email_reports_config_2027.json');
  const EMAIL_LOGS_CACHE_FILE = path.join(CACHE_DIR, 'email_reports_logs_2027.json');
  const TEAM_BIRTHDAYS_CACHE_FILE = path.join(CACHE_DIR, 'team_birthdays_2027.json');
  const ACCESS_CONTROL_CACHE_FILE = path.join(CACHE_DIR, 'access_control_2027.json');

  const MASTER_ADMIN_EMAILS = ['maykon.euro@hotmail.com', 'paroquiabomsamaritano.iecb@gmail.com'];

  function readAccessControlRecords(): Array<{
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    status: 'pending' | 'approved' | 'rejected';
    role: 'viewer' | 'admin';
    createdAt: string;
    updatedAt: string;
  }> {
    try {
      if (fs.existsSync(ACCESS_CONTROL_CACHE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(ACCESS_CONTROL_CACHE_FILE, 'utf8'));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }

  function writeAccessControlRecords(records: unknown[]) {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(ACCESS_CONTROL_CACHE_FILE, JSON.stringify(records, null, 2), 'utf8');
  }

  // Consulta ou registra solicitação de acesso de um usuário autenticado via Google
  app.post('/api/access-control/check-or-request', (req, res) => {
    try {
      const { uid, email, displayName, photoURL } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(400).json({ ok: false, message: 'E-mail inválido.' });
      }
      const isMasterAdmin = MASTER_ADMIN_EMAILS.includes(cleanEmail);
      const records = readAccessControlRecords();
      const nowIso = new Date().toISOString();
      const existingIdx = records.findIndex(
        (r) => r.email.toLowerCase() === cleanEmail || (uid && r.uid === uid)
      );

      if (existingIdx >= 0) {
        const current = records[existingIdx];
        const updated = {
          ...current,
          uid: String(uid || current.uid || `user-${Date.now()}`).slice(0, 128),
          email: cleanEmail,
          displayName: String(displayName || current.displayName || cleanEmail).slice(0, 120),
          photoURL: String(photoURL ?? current.photoURL ?? '').slice(0, 500),
          status: isMasterAdmin ? ('approved' as const) : current.status,
          role: isMasterAdmin ? ('admin' as const) : current.role,
          updatedAt: nowIso,
        };
        records[existingIdx] = updated;
        writeAccessControlRecords(records);
        return res.json({ ok: true, userRecord: updated, allRecords: records });
      }

      const newRecord = {
        uid: String(uid || `user-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
        email: cleanEmail,
        displayName: String(displayName || cleanEmail.split('@')[0] || 'Usuário').slice(0, 120),
        photoURL: String(photoURL || '').slice(0, 500),
        status: isMasterAdmin ? ('approved' as const) : ('pending' as const),
        role: isMasterAdmin ? ('admin' as const) : ('viewer' as const),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      records.push(newRecord);
      writeAccessControlRecords(records);
      return res.json({ ok: true, userRecord: newRecord, allRecords: records });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao verificar permissão de acesso',
      });
    }
  });

  // Lista todas as solicitações e usuários para o Administrador (maykon.euro@hotmail.com)
  app.get('/api/access-control/list', (_req, res) => {
    try {
      const records = readAccessControlRecords();
      return res.json({ ok: true, records });
    } catch {
      return res.json({ ok: false, records: [] });
    }
  });

  // Aprova, recusa, pré-cadastra ou remove acesso de um usuário (ação do Administrador)
  app.post('/api/access-control/decide', (req, res) => {
    try {
      const { targetEmail, targetUid, status, role, displayName, deleteRecord } = req.body || {};
      const cleanEmail = String(targetEmail || '').trim().toLowerCase();
      const records = readAccessControlRecords();
      const nowIso = new Date().toISOString();

      if (deleteRecord) {
        const filtered = records.filter(
          (r) =>
            r.email.toLowerCase() !== cleanEmail &&
            (!targetUid || r.uid !== targetUid)
        );
        writeAccessControlRecords(filtered);
        return res.json({ ok: true, records: filtered });
      }

      const idx = records.findIndex(
        (r) =>
          (cleanEmail && r.email.toLowerCase() === cleanEmail) ||
          (targetUid && r.uid === targetUid)
      );

      if (idx >= 0) {
        records[idx] = {
          ...records[idx],
          status: status || records[idx].status,
          role: role || records[idx].role,
          updatedAt: nowIso,
        };
      } else if (cleanEmail) {
        records.push({
          uid: String(targetUid || `pre_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
          email: cleanEmail,
          displayName: String(displayName || cleanEmail.split('@')[0] || 'Convidado').slice(0, 120),
          photoURL: '',
          status: status || 'approved',
          role: role || 'viewer',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      writeAccessControlRecords(records);
      return res.json({ ok: true, records });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao atualizar aprovação de acesso',
      });
    }
  });

  // Endpoints para o Mural de Aniversariantes da Equipe (independente do SQL, salvo em disco e em public/data para Vercel)
  const PUBLIC_DATA_DIR = path.join(process.cwd(), 'public', 'data');
  const PUBLIC_BIRTHDAYS_FILE = path.join(PUBLIC_DATA_DIR, 'team_birthdays_2027.json');

  app.get('/api/team-birthdays', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const sourceFile = fs.existsSync(TEAM_BIRTHDAYS_CACHE_FILE)
        ? TEAM_BIRTHDAYS_CACHE_FILE
        : fs.existsSync(PUBLIC_BIRTHDAYS_FILE)
        ? PUBLIC_BIRTHDAYS_FILE
        : null;
      if (sourceFile) {
        const raw = fs.readFileSync(sourceFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return res.json({
            ok: true,
            members: Array.isArray(parsed.members) ? parsed.members : [],
            carouselSettings: parsed.carouselSettings || null,
          });
        }
      }
      return res.json({ ok: true, members: null, carouselSettings: null });
    } catch {
      return res.json({ ok: false, members: null, carouselSettings: null });
    }
  });

  app.post('/api/team-birthdays', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const { members, carouselSettings } = req.body || {};
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      if (!fs.existsSync(PUBLIC_DATA_DIR)) {
        fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
      }
      let existing: Record<string, unknown> = {};
      if (fs.existsSync(TEAM_BIRTHDAYS_CACHE_FILE)) {
        try {
          existing = JSON.parse(fs.readFileSync(TEAM_BIRTHDAYS_CACHE_FILE, 'utf8')) || {};
        } catch {
          existing = {};
        }
      }
      const nextPayload = {
        ...existing,
        ...(Array.isArray(members) ? { members } : {}),
        ...(carouselSettings && typeof carouselSettings === 'object' ? { carouselSettings } : {}),
        updatedAt: new Date().toISOString(),
      };
      const serialized = JSON.stringify(nextPayload, null, 2);
      fs.writeFileSync(TEAM_BIRTHDAYS_CACHE_FILE, serialized, 'utf8');
      fs.writeFileSync(PUBLIC_BIRTHDAYS_FILE, serialized, 'utf8');
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao salvar mural de aniversariantes',
      });
    }
  });

  // Retorna o link público direto do Modo TV (via túnel HTTPS sem senha/login e sem erro 404/403)
  app.get('/api/public-tv-url', async (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const url = await ensurePublicTvTunnel(PORT);
      return res.json({
        ok: Boolean(url),
        publicTvUrl: url,
      });
    } catch {
      return res.json({ ok: false, publicTvUrl: null });
    }
  });

  // Endpoint público para o Modo TV (sem dados pessoais/sensíveis de alunos: sem Nome, CPF ou RA)
  app.get('/api/tv-public-data', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    try {
      const cached2027 = getCachedPeriodo('2027');
      const rawRows = cached2027?.rows || [];
      const sanitizedRows = rawRows.map((r, idx) => ({
        _id: `tv-${idx}`,
        PERIODO: r['PERIODO'] ?? '2027',
        UNIDADE: r['UNIDADE'] ?? '',
        'SITUACAO MATRICULA': r['SITUACAO MATRICULA'] ?? '',
        'TIPO MATRICULA': r['TIPO MATRICULA'] ?? '',
        CODPLANOPGTO: r['CODPLANOPGTO'] ?? '',
        FORMAINGRESSO: r['FORMAINGRESSO'] ?? '',
        'FORMA INGRESSO': r['FORMA INGRESSO'] ?? '',
        TURMA: r['TURMA'] ?? '',
        CODTURMA: r['CODTURMA'] ?? '',
        'SERIE/ANO': r['SERIE/ANO'] ?? '',
        HABILITACAO: r['HABILITACAO'] ?? '',
        CURSO: r['CURSO'] ?? '',
        TURNO: r['TURNO'] ?? '',
        NOMETURNO: r['NOMETURNO'] ?? '',
        'MAX ALUNOS': r['MAX ALUNOS'] ?? '',
        'DT MATRICULA': r['DT MATRICULA'] ?? '',
        'DT ALTERACAO': r['DT ALTERACAO'] ?? '',
      }));

      let goals = null;
      if (fs.existsSync(GOALS_CACHE_FILE)) {
        try {
          goals = JSON.parse(fs.readFileSync(GOALS_CACHE_FILE, 'utf8'));
        } catch {
          goals = null;
        }
      }

      let capacities = {};
      if (fs.existsSync(TURMA_CAP_CACHE_FILE)) {
        try {
          capacities = JSON.parse(fs.readFileSync(TURMA_CAP_CACHE_FILE, 'utf8'));
        } catch {
          capacities = {};
        }
      }

      let birthdays = null;
      if (fs.existsSync(TEAM_BIRTHDAYS_CACHE_FILE)) {
        try {
          birthdays = JSON.parse(fs.readFileSync(TEAM_BIRTHDAYS_CACHE_FILE, 'utf8'));
        } catch {
          birthdays = null;
        }
      }

      return res.json({
        ok: true,
        totalRows: sanitizedRows.length,
        Row: sanitizedRows,
        goals,
        capacities,
        birthdays,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      return res.json({ ok: false, Row: [] });
    }
  });

  // Salva o PDF de impressão no servidor para gerar link direto de envio no WhatsApp
  app.post('/api/reports/share-pdf', (req, res) => {
    try {
      const { filename, pdfBase64, html } = req.body || {};
      if (!filename || !pdfBase64) {
        return res.status(400).json({ ok: false, message: 'PDF inválido.' });
      }
      if (!fs.existsSync(SHARED_PDFS_DIR)) {
        fs.mkdirSync(SHARED_PDFS_DIR, { recursive: true });
      }
      const safeName = String(filename)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.pdf$/i, '') + '.pdf';
      const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf[^,]*,/, '');
      const pdfBuffer = Buffer.from(cleanBase64, 'base64');
      fs.writeFileSync(path.join(SHARED_PDFS_DIR, safeName), pdfBuffer);

      if (html && typeof html === 'string') {
        const htmlName = safeName.replace(/\.pdf$/i, '.html');
        fs.writeFileSync(path.join(SHARED_PDFS_DIR, htmlName), html, 'utf8');
      }

      return res.json({
        ok: true,
        filename: safeName,
        pdfPath: `/api/reports/pdf/${encodeURIComponent(safeName)}`,
        viewPath: `/api/reports/view/${encodeURIComponent(safeName.replace(/\.pdf$/i, '.html'))}`,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao preparar link do PDF.',
      });
    }
  });

  // Serve o arquivo PDF de impressão diretamente (para abrir/baixar pelo link enviado no WhatsApp)
  app.get('/api/reports/pdf/:filename', (req, res) => {
    try {
      const safeName = String(req.params.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(SHARED_PDFS_DIR, safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Relatório em PDF não encontrado. Gere novamente no painel.');
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      return res.sendFile(filePath);
    } catch {
      return res.status(500).send('Erro ao abrir o relatório em PDF.');
    }
  });

  // Serve a versão de impressão no navegador com botão de impressão automática
  app.get('/api/reports/view/:filename', (req, res) => {
    try {
      const safeName = String(req.params.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(SHARED_PDFS_DIR, safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Relatório não encontrado.');
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.sendFile(filePath);
    } catch {
      return res.status(500).send('Erro ao abrir visualização de impressão.');
    }
  });

  app.get('/api/email-reports-config', (_req, res) => {
    try {
      const smtpUser = (process.env.SMTP_USER || 'tablet.diretoriaeducacao@gmail.com').trim();
      const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const smtpPass = (process.env.SMTP_PASS || 'Abc@1234').trim();
      const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);
      if (fs.existsSync(EMAIL_CONFIG_CACHE_FILE)) {
        const raw = fs.readFileSync(EMAIL_CONFIG_CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return res.json({ ok: true, config: parsed, smtpConfigured, smtpUser });
        }
      }
      return res.json({ ok: true, config: null, smtpConfigured, smtpUser });
    } catch {
      return res.json({
        ok: false,
        config: null,
        smtpConfigured: false,
        smtpUser: 'tablet.diretoriaeducacao@gmail.com',
      });
    }
  });

  app.post('/api/email-reports-config', (req, res) => {
    try {
      const { config } = req.body || {};
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ ok: false, message: 'Configuração de e-mail inválida.' });
      }
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(EMAIL_CONFIG_CACHE_FILE, JSON.stringify(config, null, 2), 'utf8');
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao salvar configuração de e-mails',
      });
    }
  });

  app.get('/api/email-reports-logs', (_req, res) => {
    try {
      if (fs.existsSync(EMAIL_LOGS_CACHE_FILE)) {
        const raw = fs.readFileSync(EMAIL_LOGS_CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return res.json({ ok: true, logs: parsed });
        }
      }
      return res.json({ ok: true, logs: [] });
    } catch {
      return res.json({ ok: false, logs: [] });
    }
  });

  app.post('/api/email-reports/send', async (req, res) => {
    try {
      const {
        scope = 'unit',
        unitId,
        unitName,
        to = [],
        cc = [],
        subject = 'Relatório SESI-PE Matrículas 2027',
        html = '',
        plainText = '',
        mode = 'manual',
        alreadySentViaGmailApi = false,
        gmailMessageId = '',
        senderEmail = 'tablet.diretoriaeducacao@gmail.com',
      } = req.body || {};

      const cleanTo = Array.isArray(to)
        ? to.map((e: unknown) => String(e ?? '').trim()).filter((e: string) => e.includes('@'))
        : [];
      const cleanCc = Array.isArray(cc)
        ? cc.map((e: unknown) => String(e ?? '').trim()).filter((e: string) => e.includes('@'))
        : [];

      if (cleanTo.length === 0) {
        return res.status(400).json({
          ok: false,
          message: 'Informe ao menos um e-mail destinatário válido antes de enviar.',
        });
      }

      const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
      const smtpPort = Number(process.env.SMTP_PORT || 587);
      const smtpUser = (process.env.SMTP_USER || 'tablet.diretoriaeducacao@gmail.com').trim();
      const smtpPass = (process.env.SMTP_PASS || 'Abc@1234').trim();
      const smtpFrom = (process.env.SMTP_FROM || smtpUser || 'tablet.diretoriaeducacao@gmail.com').trim();
      const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);

      let deliveryMethod: 'gmail_api' | 'smtp' | 'recorded' = 'recorded';
      let status: 'sent' | 'logged' | 'error' = 'logged';
      let statusMessage = '';
      let smtpErrorDetail: string | null = null;

      if (alreadySentViaGmailApi) {
        deliveryMethod = 'gmail_api';
        status = 'sent';
        statusMessage = `Enviado via Gmail (${senderEmail}) para ${cleanTo.join(', ')}${
          cleanCc.length > 0 ? ` (CC: ${cleanCc.join(', ')})` : ''
        }${gmailMessageId ? ` [ID: ${gmailMessageId}]` : ''}.`;
      } else if (smtpConfigured) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          await transporter.sendMail({
            from: `"SESI-PE Matrículas 2027" <${smtpFrom}>`,
            to: cleanTo.join(', '),
            cc: cleanCc.length > 0 ? cleanCc.join(', ') : undefined,
            subject,
            text: plainText,
            html,
          });

          deliveryMethod = 'smtp';
          status = 'sent';
          statusMessage = `Relatório disparado via Gmail SMTP (${smtpUser}) para ${cleanTo.join(', ')}${
            cleanCc.length > 0 ? ` (CC: ${cleanCc.join(', ')})` : ''
          }.`;
        } catch (smtpErr) {
          smtpErrorDetail =
            smtpErr instanceof Error ? smtpErr.message : 'Falha na autenticação SMTP do Gmail';
          deliveryMethod = 'recorded';
          status = 'logged';
          statusMessage = `Envio registrado para ${cleanTo.join(', ')}. Para disparo direto pelo Gmail (${smtpUser}), clique em "Conectar Conta Gmail" no topo do modal para autenticar via Google OAuth.`;
        }
      }

      const nowIso = new Date().toISOString();
      const logEntry = {
        id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: nowIso,
        scope,
        unitId,
        unitName,
        to: cleanTo,
        cc: cleanCc,
        subject,
        mode,
        deliveryMethod,
        senderEmail: alreadySentViaGmailApi ? senderEmail : smtpUser,
        status,
        message: statusMessage,
      };

      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }

      let existingLogs: unknown[] = [];
      if (fs.existsSync(EMAIL_LOGS_CACHE_FILE)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(EMAIL_LOGS_CACHE_FILE, 'utf8'));
          if (Array.isArray(parsed)) existingLogs = parsed;
        } catch {
          existingLogs = [];
        }
      }
      const nextLogs = [logEntry, ...existingLogs].slice(0, 100);
      fs.writeFileSync(EMAIL_LOGS_CACHE_FILE, JSON.stringify(nextLogs, null, 2), 'utf8');

      return res.json({
        ok: true,
        smtpConfigured,
        deliveryMethod,
        smtpErrorDetail,
        logEntry,
        logs: nextLogs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar envio do relatório.';
      return res.status(500).json({
        ok: false,
        message: msg,
      });
    }
  });

  app.get('/api/goals-2027', (_req, res) => {
    try {
      if (fs.existsSync(GOALS_CACHE_FILE)) {
        const raw = fs.readFileSync(GOALS_CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return res.json({ ok: true, goals: parsed });
        }
      }
      return res.json({ ok: true, goals: null });
    } catch {
      return res.json({ ok: false, goals: null });
    }
  });

  app.post('/api/goals-2027', (req, res) => {
    try {
      const { goals } = req.body || {};
      if (!Array.isArray(goals)) {
        return res.status(400).json({ ok: false, message: 'Formato de metas inválido.' });
      }
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(GOALS_CACHE_FILE, JSON.stringify(goals, null, 2), 'utf8');
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao salvar metas',
      });
    }
  });

  app.get('/api/turma-capacities-2027', (_req, res) => {
    try {
      if (fs.existsSync(TURMA_CAP_CACHE_FILE)) {
        const raw = fs.readFileSync(TURMA_CAP_CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return res.json({ ok: true, capacities: parsed });
        }
      }
      return res.json({ ok: true, capacities: {} });
    } catch {
      return res.json({ ok: false, capacities: {} });
    }
  });

  app.post('/api/turma-capacities-2027', (req, res) => {
    try {
      const { capacities } = req.body || {};
      if (!capacities || typeof capacities !== 'object') {
        return res.status(400).json({ ok: false, message: 'Formato de capacidades inválido.' });
      }
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(TURMA_CAP_CACHE_FILE, JSON.stringify(capacities, null, 2), 'utf8');
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erro ao salvar capacidades de turmas',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    setTimeout(() => {
      ensurePublicTvTunnel(PORT).catch(() => {});
    }, 2000);
    // Pré-carrega automaticamente o Período 2027 da API TOTVS se houver credenciais no ambiente
    if (process.env.TOTVS_USER && process.env.TOTVS_PASSWORD && !getCachedPeriodo('2027')) {
      console.log('Iniciando sincronização automática do Período 2027 no TOTVS RM...');
      activeSyncPeriodo = '2027';
      activeSyncPromise = streamTotvsQuery({
        baseUrl: DEFAULT_TOTVS_URL,
        codcoligada: '2',
        codsentenca: 'SE42018_2 Produc',
        codsistema: 'S',
        parameters: 'CODCOLIGADA=2',
        periodo: '2027',
      });
      activeSyncPromise
        .then((r) => {
          console.log(
            `Sincronização TOTVS 2027 concluída: ${r.rows.length} registros filtrados de ${r.totalScanned} totais (${(r.totalBytes / 1024 / 1024).toFixed(1)} MB) em ${r.durationMs}ms.`
          );
          activeSyncPromise = null;
          activeSyncPeriodo = null;
        })
        .catch((err) => {
          console.error('Falha no pré-carregamento TOTVS:', err.message);
          activeSyncPromise = null;
          activeSyncPeriodo = null;
        });
    }
  });
}

startServer();
