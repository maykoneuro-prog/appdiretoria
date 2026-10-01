import { TotvsStudentRow } from '../types/totvs';
import {
  UnitProgressMetrics,
  TurmaOccupancyEntry,
  SESI_PE_GOALS_2027,
  isRenovacaoPortalRow,
} from '../data/sesiGoals2027';

export type ReportFrequency = 'diario' | 'semanal' | 'quinzenal' | 'mensal';

export interface UnitEmailReportConfig {
  unitId: string;
  unitShortName: string;
  primaryEmail: string;
  ccEmails: string[];
  whatsappPhone: string;
  whatsappContactName?: string;
  enabled: boolean;
  frequency: ReportFrequency;
  sendTime: string;
  dayOfWeek: number; // 1 = Seg ... 5 = Sex
  includeTurmaOccupancy: boolean;
  includePortalStudentsNominal: boolean;
  includeReservadaStudentsNominal: boolean;
  lastSentAt?: string;
}

export interface NetworkEmailReportConfig {
  toEmails: string[];
  ccEmails: string[];
  whatsappPhone: string;
  whatsappContactName?: string;
  enabled: boolean;
  frequency: ReportFrequency;
  sendTime: string;
  dayOfWeek: number;
  includeUnitBreakdown: boolean;
  includeTurmaOccupancySummary: boolean;
  includePortalStudentsNominalAllUnits: boolean;
  lastSentAt?: string;
}

export interface EmailReportsState {
  units: Record<string, UnitEmailReportConfig>;
  network: NetworkEmailReportConfig;
}

export interface EmailDispatchLogEntry {
  id: string;
  timestamp: string;
  scope: 'unit' | 'network';
  unitId?: string;
  unitName?: string;
  to: string[];
  cc: string[];
  subject: string;
  mode: 'manual' | 'scheduled';
  deliveryMethod: 'gmail_api' | 'smtp' | 'recorded';
  senderEmail?: string;
  status: 'sent' | 'logged' | 'error';
  message: string;
}

function fmtNum(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function isEfetivadoStatus(situacao: string): boolean {
  const s = situacao
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s === 'MATRICULADO' || s === 'PRE MATRICULADO';
}

export function createDefaultEmailReportsState(): EmailReportsState {
  const units: Record<string, UnitEmailReportConfig> = {};
  for (const g of SESI_PE_GOALS_2027) {
    units[g.id] = {
      unitId: g.id,
      unitShortName: g.shortName,
      primaryEmail: '',
      ccEmails: [],
      whatsappPhone: '',
      whatsappContactName: `Secretaria / Gestão SESI ${g.shortName}`,
      enabled: false,
      frequency: 'semanal',
      sendTime: '08:00',
      dayOfWeek: 1,
      includeTurmaOccupancy: true,
      includePortalStudentsNominal: true,
      includeReservadaStudentsNominal: false,
    };
  }

  return {
    units,
    network: {
      toEmails: [],
      ccEmails: [],
      whatsappPhone: '',
      whatsappContactName: 'Coordenação / Diretoria Rede SESI-PE',
      enabled: false,
      frequency: 'semanal',
      sendTime: '08:30',
      dayOfWeek: 1,
      includeUnitBreakdown: true,
      includeTurmaOccupancySummary: true,
      includePortalStudentsNominalAllUnits: true,
    },
  };
}

export function normalizeWhatsappPhone(raw: string | undefined | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    return `55${digits.slice(1)}`;
  }
  if (digits.length === 8 || digits.length === 9) {
    // Assume DDD 81 (Pernambuco) se digitado apenas o número local
    return `5581${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export function formatWhatsappPhoneDisplay(raw: string | undefined | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  let local = digits;
  if (local.startsWith('55') && (local.length === 12 || local.length === 13)) {
    local = local.slice(2);
  }
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return String(raw ?? '');
}

export function buildWhatsappShareUrl(phoneRaw: string | undefined | null, message: string): string {
  const cleanPhone = normalizeWhatsappPhone(phoneRaw);
  const maxUrlTextLen = 3500;
  const safeText =
    message.length > maxUrlTextLen
      ? `${message.slice(0, maxUrlTextLen)}\n\n...(Relatório completo copiado na área de transferência — basta colar com Ctrl+V)`
      : message;
  const encoded = encodeURIComponent(safeText);
  if (cleanPhone.length >= 10) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

export function parseEmailListInput(raw: string): string[] {
  return raw
    .split(/[,;\s\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 3 && e.includes('@'));
}

export function getPortalStudentsForUnit(
  rows: TotvsStudentRow[],
  totvsUnitName: string,
  shortName: string
): TotvsStudentRow[] {
  const targetUpper = totvsUnitName.toUpperCase();
  const shortUpper = shortName.toUpperCase();

  return rows.filter((r) => {
    const per = String(r['PERIODO'] ?? '').trim();
    if (per !== '2027') return false;
    const u = String(r['UNIDADE'] ?? '').trim().toUpperCase();
    const matchesUnit = u === targetUpper || u.includes(shortUpper);
    if (!matchesUnit) return false;

    const sit = String(r['SITUACAO MATRICULA'] ?? '').trim();
    const isCancelado = sit.toUpperCase().includes('CANCELAD');
    if (isCancelado || isEfetivadoStatus(sit)) return false;

    return isRenovacaoPortalRow(r);
  });
}

export function getReservadaStudentsForUnit(
  rows: TotvsStudentRow[],
  totvsUnitName: string,
  shortName: string
): TotvsStudentRow[] {
  const targetUpper = totvsUnitName.toUpperCase();
  const shortUpper = shortName.toUpperCase();

  return rows.filter((r) => {
    const per = String(r['PERIODO'] ?? '').trim();
    if (per !== '2027') return false;
    const u = String(r['UNIDADE'] ?? '').trim().toUpperCase();
    const matchesUnit = u === targetUpper || u.includes(shortUpper);
    if (!matchesUnit) return false;

    const sit = String(r['SITUACAO MATRICULA'] ?? '').trim().toUpperCase();
    if (sit.includes('CANCELAD') || isEfetivadoStatus(sit)) return false;

    return sit.includes('RESERVADA');
  });
}

export function buildUnitEmailReport(params: {
  unit: UnitProgressMetrics;
  rows: TotvsStudentRow[];
  turmaCapacities: Record<string, number>;
  config: UnitEmailReportConfig;
}): {
  subject: string;
  html: string;
  plainText: string;
  whatsappText: string;
  portalStudentsCount: number;
} {
  const { unit, rows, turmaCapacities, config } = params;
  const nowStr = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const portalStudents = getPortalStudentsForUnit(
    rows,
    unit.goal.totvsUnitName,
    unit.goal.shortName
  );
  const reservadaStudents = getReservadaStudentsForUnit(
    rows,
    unit.goal.totvsUnitName,
    unit.goal.shortName
  );

  const getCap = (t: TurmaOccupancyEntry) =>
    turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0;

  const activeTurmas = unit.turmas.filter((t) => t.ocupacaoComReservada > 0 || getCap(t) > 0);
  const totalTurmas = activeTurmas.length;
  const totalMatrTurmas = activeTurmas.reduce((acc, t) => acc + t.matriculadosTotal, 0);
  const totalResTurmas = activeTurmas.reduce((acc, t) => acc + t.matriculaReservada, 0);
  const totalOcupacaoSala = activeTurmas.reduce((acc, t) => acc + t.ocupacaoComReservada, 0);
  const totalMaxAlunos = activeTurmas.reduce((acc, t) => acc + getCap(t), 0);
  const pctOcupacaoSala =
    totalMaxAlunos > 0 ? (totalOcupacaoSala / totalMaxAlunos) * 100 : 0;
  const saldoVagasSala = totalMaxAlunos > 0 ? totalMaxAlunos - totalOcupacaoSala : 0;

  const subject = `[SESI-PE Matrículas 2027] Relatório da Unidade ${unit.goal.shortName} — ${unit.realTotal}/${unit.goal.metaGeral} Matriculados (${unit.pctGeral.toFixed(1)}%) | ${portalStudents.length} em Renovação via Portal`;

  const turmaRowsHtml = activeTurmas
    .map((t) => {
      const cap = getCap(t);
      const pct = cap > 0 ? (t.ocupacaoComReservada / cap) * 100 : 0;
      const saldo = cap > 0 ? cap - t.ocupacaoComReservada : null;
      const statusColor =
        pct > 100 ? '#dc2626' : pct >= 85 ? '#059669' : '#0284c7';
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:700;color:#0f172a;">${t.turmaCode}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">${t.habilitacao || t.curso || '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#475569;">${t.turno || '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#047857;background:#ecfdf5;">${t.matriculadosTotal}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#b45309;background:#fffbeb;">${t.matriculaReservada}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:800;color:#0369a1;background:#f0f9ff;">${t.ocupacaoComReservada}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0f172a;">${cap > 0 ? cap : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:${saldo !== null && saldo < 0 ? '#dc2626' : '#334155'};">${
        saldo === null ? '—' : saldo >= 0 ? `${saldo} livres` : `+${Math.abs(saldo)} exc.`
      }</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:800;color:${statusColor};">${
        cap > 0 ? `${pct.toFixed(1)}%` : '—'
      }</td>
        </tr>
      `;
    })
    .join('');

  const portalRowsHtml = portalStudents
    .map(
      (st, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:700;color:#334155;">${String(st['RA'] ?? '-')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;">${String(st['ALUNO'] ?? '-')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">${String(st['SERIE/ANO'] ?? '-')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#0369a1;font-weight:700;">${String(st['TURMA'] ?? '-')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#475569;">${String(st['TURNO'] ?? st['NOMETURNO'] ?? '-')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#6d28d9;font-weight:700;">${String(st['SITUACAO MATRICULA'] ?? '-')}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;">${String(st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-')}</td>
        </tr>
      `
    )
    .join('');

  const reservadaRowsHtml = config.includeReservadaStudentsNominal
    ? reservadaStudents
        .slice(0, 150)
        .map(
          (st, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fffbeb'};">
          <td style="padding:6px 10px;border-bottom:1px solid #fde68a;font-family:monospace;font-weight:700;color:#334155;">${String(st['RA'] ?? '-')}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fde68a;font-weight:700;color:#0f172a;">${String(st['ALUNO'] ?? '-')}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fde68a;color:#334155;">${String(st['SERIE/ANO'] ?? '-')}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fde68a;font-family:monospace;color:#92400e;font-weight:700;">${String(st['TURMA'] ?? '-')}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fde68a;color:#475569;">${String(st['TURNO'] ?? st['NOMETURNO'] ?? '-')}</td>
        </tr>
      `
        )
        .join('')
    : '';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:920px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0077b6 0%,#009fe3 100%);padding:24px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;opacity:0.9;">
        SESI Pernambuco · Painel Estratégico de Matrículas 2027
      </div>
      <h1 style="margin:6px 0 4px 0;font-size:22px;font-weight:800;">
        Relatório de Acompanhamento — Escola SESI ${unit.goal.shortName}
      </h1>
      <div style="font-size:12px;opacity:0.92;">
        Gerado em ${nowStr} · Unidade TOTVS: <strong>${unit.goal.totvsUnitName}</strong>
      </div>
    </div>

    <div style="padding:24px 28px;">
      <!-- KPI Summary Cards -->
      <h2 style="margin:0 0 12px 0;font-size:15px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
        1. Desempenho de Metas e Matrículas Efetivadas (2027)
      </h2>
      <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:20px;">
        <tr>
          <td style="width:25%;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#0369a1;">META GERAL 2027</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:2px;">${fmtNum(unit.realTotal)} <span style="font-size:13px;color:#64748b;font-weight:600;">/ ${fmtNum(unit.goal.metaGeral)}</span></div>
            <div style="font-size:11px;font-weight:700;color:#0284c7;margin-top:4px;">${(unit.pctGeral ?? 0).toFixed(1)}% atingido · Faltam ${fmtNum(unit.faltamParaMeta)}</div>
          </td>
          <td style="width:25%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#047857;">META ESCALA PAGAS</div>
            <div style="font-size:22px;font-weight:800;color:#065f46;margin-top:2px;">${fmtNum(unit.realPagasTotal)} <span style="font-size:13px;color:#047857;font-weight:600;">/ ${fmtNum(unit.metaPagasTotal)}</span></div>
            <div style="font-size:11px;font-weight:700;color:#059669;margin-top:4px;">${(unit.pctPagasTotal ?? 0).toFixed(1)}% · Ritmo: ${(unit.metaDiariaPagasAte31Dez ?? 0).toFixed(1)}/dia</div>
          </td>
          <td style="width:25%;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#6d28d9;">RENOVAÇÃO VIA PORTAL</div>
            <div style="font-size:22px;font-weight:800;color:#5b21b6;margin-top:2px;">${portalStudents.length}</div>
            <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-top:4px;">Aguardando contato da secretaria</div>
          </td>
          <td style="width:25%;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#b45309;">MATRÍCULA RESERVADA</div>
            <div style="font-size:22px;font-weight:800;color:#92400e;margin-top:2px;">${unit.vetReservada}</div>
            <div style="font-size:11px;font-weight:700;color:#d97706;margin-top:4px;">Vaga veterano até 31/12 · Inscr. Online: ${unit.inscricaoOnlineCount}</div>
          </td>
        </tr>
      </table>

      <!-- Detalhamento por Categoria de Meta -->
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;color:#334155;text-align:left;">
            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">Categoria da Meta</th>
            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">Matriculados + Pré</th>
            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">Meta 2027</th>
            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">% Atingido</th>
            <th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">Saldo Restante</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;">Pagas — Renovações (Veteranos)</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${unit.realPagasRenovacoes}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${unit.goal.pagasRenovacoes}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0284c7;">${unit.pctPagasRenovacoes.toFixed(1)}%</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${Math.max(0, unit.goal.pagasRenovacoes - unit.realPagasRenovacoes)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;">Pagas — Novas Matrículas (Novatos)</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${unit.realPagasNovatos}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${unit.goal.pagasNovatos2027}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0284c7;">${unit.pctPagasNovatos.toFixed(1)}%</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${Math.max(0, unit.goal.pagasNovatos2027 - unit.realPagasNovatos)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;">Gratuidade Remanescente (Veteranos)</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${unit.realGratuidadeRemanescente}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${unit.goal.gratuidadeRemanescente}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0284c7;">${unit.pctGratuidadeRem.toFixed(1)}%</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${Math.max(0, unit.goal.gratuidadeRemanescente - unit.realGratuidadeRemanescente)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;">Novas Gratuidades 2027 (Novatos)</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${unit.realNovasGratuidade}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${unit.goal.novasVagasGratuidade2027}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0284c7;">${unit.pctNovasGratuidade.toFixed(1)}%</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${Math.max(0, unit.goal.novasVagasGratuidade2027 - unit.realNovasGratuidade)}</td>
          </tr>
        </tbody>
      </table>

      ${
        config.includeTurmaOccupancy
          ? `
      <!-- Mapa de Ocupação de Sala -->
      <h2 style="margin:0 0 8px 0;font-size:15px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
        2. Ocupação de Turmas da Unidade (${totalTurmas} turmas · Ocupação Sala: ${totalOcupacaoSala}/${totalMaxAlunos} — ${pctOcupacaoSala.toFixed(1)}%)
      </h2>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:11px;color:#92400e;margin-bottom:12px;">
        <strong>Nota sobre Matrícula Reservada:</strong> Os ${totalResTurmas} alunos veteranos com status <strong>Matrícula Reservada</strong> têm vaga garantida por lei até 31/12 e compõem a <strong>Ocupação da Sala (${totalOcupacaoSala})</strong>, mas não contam como matriculados oficiais até efetivarem a renovação. Saldo líquido de vagas na unidade: <strong>${saldoVagasSala >= 0 ? `${saldoVagasSala} vagas disponíveis` : `${Math.abs(saldoVagasSala)} acima da capacidade`}</strong>.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:24px;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9;color:#334155;text-align:left;">
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;">Turma</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;">Série / Habilitação</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;">Turno</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Matr.+Pré</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Reservada</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Ocup. Sala</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">MAX ALUNOS</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Saldo Vagas</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">% Ocup.</th>
          </tr>
        </thead>
        <tbody>
          ${turmaRowsHtml || '<tr><td colspan="9" style="padding:12px;text-align:center;color:#64748b;">Nenhuma turma encontrada.</td></tr>'}
        </tbody>
      </table>
      `
          : ''
      }

      ${
        config.includePortalStudentsNominal
          ? `
      <!-- Relação Nominal de Alunos em Renovação via Portal para Contato da Secretaria -->
      <h2 style="margin:0 0 8px 0;font-size:15px;font-weight:800;color:#5b21b6;text-transform:uppercase;letter-spacing:0.5px;">
        3. Relação Nominal — Alunos em Renovação via Portal (${portalStudents.length} aluno(s) para Contato da Secretaria)
      </h2>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 12px;font-size:11px;color:#5b21b6;margin-bottom:12px;">
        <strong>Ação Necessária da Secretaria Escolar:</strong> Os alunos listados abaixo iniciaram a <strong>Renovação via Portal</strong> mas ainda não estão efetivados como Matriculados/Pré-Matriculados. Favor entrar em contato para conclusão documental/financeira.
      </div>
      ${
        portalStudents.length === 0
          ? `<div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#64748b;margin-bottom:20px;">Nenhum aluno pendente em Renovação via Portal nesta unidade no momento.</div>`
          : `
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:24px;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#ede9fe;color:#4c1d95;text-align:left;">
            <th style="padding:8px 10px;border-bottom:1px solid #ddd6fe;">RA</th>
            <th style="padding:8px 10px;border-bottom:1px solid #ddd6fe;">Nome do Aluno</th>
            <th style="padding:8px 10px;border-bottom:1px solid #ddd6fe;">Série / Ano</th>
            <th style="padding:8px 10px;border-bottom:1px solid #ddd6fe;">Turma</th>
            <th style="padding:8px 10px;border-bottom:1px solid #ddd6fe;">Turno</th>
            <th style="padding:8px 10px;border-bottom:1px solid #ddd6fe;">Situação</th>
            <th style="padding:8px 10px;border-bottom:1px solid #ddd6fe;">Data</th>
          </tr>
        </thead>
        <tbody>
          ${portalRowsHtml}
        </tbody>
      </table>
      `
      }
      `
          : ''
      }

      ${
        config.includeReservadaStudentsNominal && reservadaStudents.length > 0
          ? `
      <h2 style="margin:0 0 8px 0;font-size:14px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">
        4. Alunos Veteranos com Matrícula Reservada (${reservadaStudents.length} alunos — exibindo até 150)
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px;border:1px solid #fde68a;">
        <thead>
          <tr style="background:#fef3c7;color:#92400e;text-align:left;">
            <th style="padding:6px 10px;">RA</th>
            <th style="padding:6px 10px;">Nome do Aluno</th>
            <th style="padding:6px 10px;">Série / Ano</th>
            <th style="padding:6px 10px;">Turma</th>
            <th style="padding:6px 10px;">Turno</th>
          </tr>
        </thead>
        <tbody>
          ${reservadaRowsHtml}
        </tbody>
      </table>
      `
          : ''
      }
    </div>
  </div>
</body>
</html>
  `.trim();

  const portalTextLines = portalStudents
    .map(
      (st) =>
        `  - RA ${String(st['RA'] ?? '-')} | ${String(st['ALUNO'] ?? '-')} | ${String(st['SERIE/ANO'] ?? '-')} | Turma: ${String(st['TURMA'] ?? '-')} (${String(st['TURNO'] ?? '-')})`
    )
    .join('\n');

  const plainText = [
    `RELATÓRIO DE MATRÍCULAS 2027 — ESCOLA SESI ${unit.goal.shortName.toUpperCase()}`,
    `Gerado em: ${nowStr}`,
    ``,
    `1. RESUMO DE METAS E MATRÍCULAS:`,
    `- Matriculados + Pré-Matriculados: ${unit.realTotal} / ${unit.goal.metaGeral} (${unit.pctGeral.toFixed(1)}%) — Faltam ${unit.faltamParaMeta}`,
    `- Escala de Pagas: ${unit.realPagasTotal} / ${unit.metaPagasTotal} (${unit.pctPagasTotal.toFixed(1)}%)`,
    `- Pagas Veteranos: ${unit.realPagasRenovacoes}/${unit.goal.pagasRenovacoes} | Pagas Novatos: ${unit.realPagasNovatos}/${unit.goal.pagasNovatos2027}`,
    `- Gratuidade Remanescente: ${unit.realGratuidadeRemanescente}/${unit.goal.gratuidadeRemanescente} | Novas Gratuidades: ${unit.realNovasGratuidade}/${unit.goal.novasVagasGratuidade2027}`,
    ``,
    `2. OCUPAÇÃO DE SALA E PENDENTES:`,
    `- Turmas Mapeadas: ${totalTurmas}`,
    `- Matriculados + Pré em Turmas: ${totalMatrTurmas}`,
    `- Matrícula Reservada (Veteranos com vaga garantida até 31/12): ${totalResTurmas}`,
    `- Ocupação Real de Sala (Matriculados + Reservada): ${totalOcupacaoSala} / ${totalMaxAlunos} vagas (${pctOcupacaoSala.toFixed(1)}%)`,
    `- Em Renovação via Portal (Ação da Secretaria): ${portalStudents.length}`,
    `- Em Inscrição Online: ${unit.inscricaoOnlineCount}`,
    ``,
    `3. ALUNOS EM RENOVAÇÃO VIA PORTAL PARA CONTATO DA SECRETARIA (${portalStudents.length}):`,
    portalTextLines || '  (Nenhum aluno pendente em Renovação via Portal)',
  ].join('\n');

  const whatsappTurmasLines = config.includeTurmaOccupancy
    ? activeTurmas
        .map((t) => {
          const cap = getCap(t);
          const pct = cap > 0 ? `${((t.ocupacaoComReservada / cap) * 100).toFixed(0)}%` : '—';
          return `• *${t.turmaCode}* (${t.habilitacao || t.curso || '—'}): Matr. *${t.matriculadosTotal}* + Reservada *${t.matriculaReservada}* = Ocup. *${t.ocupacaoComReservada}/${cap > 0 ? cap : '—'}* (${pct})`;
        })
        .join('\n')
    : '';

  const whatsappPortalLines = config.includePortalStudentsNominal
    ? portalStudents
        .map(
          (st, i) =>
            `${i + 1}. *${String(st['ALUNO'] ?? '-')}* (RA: ${String(st['RA'] ?? '-')} | ${String(st['SERIE/ANO'] ?? '-')} | Turma: ${String(st['TURMA'] ?? '-')})`
        )
        .join('\n')
    : '';

  const whatsappText = [
    `*📊 RELATÓRIO MATRÍCULAS 2027 — ESCOLA SESI ${unit.goal.shortName.toUpperCase()}*`,
    `_Atualizado em ${nowStr}_`,
    ``,
    `*1. DESEMPENHO DE METAS E MATRÍCULAS:*`,
    `• *Matriculados + Pré (Meta Geral):* *${fmtNum(unit.realTotal)}* / ${fmtNum(unit.goal.metaGeral)} (*${unit.pctGeral.toFixed(1)}%* · Faltam ${fmtNum(unit.faltamParaMeta)})`,
    `• *Meta Escala Pagas:* *${fmtNum(unit.realPagasTotal)}* / ${fmtNum(unit.metaPagasTotal)} (*${unit.pctPagasTotal.toFixed(1)}%*)`,
    `• *Pagas Veteranos:* ${fmtNum(unit.realPagasRenovacoes)}/${fmtNum(unit.goal.pagasRenovacoes)} | *Pagas Novatos:* ${fmtNum(unit.realPagasNovatos)}/${fmtNum(unit.goal.pagasNovatos2027)}`,
    `• *Gratuidade Rem.:* ${fmtNum(unit.realGratuidadeRemanescente)}/${fmtNum(unit.goal.gratuidadeRemanescente)} | *Novas Grat.:* ${fmtNum(unit.realNovasGratuidade)}/${fmtNum(unit.goal.novasVagasGratuidade2027)}`,
    ``,
    `*2. OCUPAÇÃO DE SALA E PENDENTES:*`,
    `• *Turmas Ativas:* ${totalTurmas} turmas`,
    `• *Matrícula Reservada (Veteranos até 31/12):* *${fmtNum(totalResTurmas)}*`,
    `• *Ocupação Real de Sala (Matr. + Reservada):* *${fmtNum(totalOcupacaoSala)}* / ${fmtNum(totalMaxAlunos)} vagas (*${pctOcupacaoSala.toFixed(1)}%*)`,
    `• *Renovação via Portal (Ação Secretaria):* *${portalStudents.length}* aluno(s)`,
    `• *Inscrição Online:* ${unit.inscricaoOnlineCount}`,
    ...(config.includeTurmaOccupancy && whatsappTurmasLines
      ? [``, `*3. MAPA DE OCUPAÇÃO DE TURMAS:*`, whatsappTurmasLines]
      : []),
    ...(config.includePortalStudentsNominal
      ? [
          ``,
          `*${config.includeTurmaOccupancy ? '4' : '3'}. ALUNOS EM RENOVAÇÃO VIA PORTAL PARA CONTATO DA SECRETARIA (${portalStudents.length}):*`,
          whatsappPortalLines || '_Nenhum aluno pendente em Renovação via Portal no momento._',
        ]
      : []),
  ].join('\n');

  return {
    subject,
    html,
    plainText,
    whatsappText,
    portalStudentsCount: portalStudents.length,
  };
}

export function buildNetworkEmailReport(params: {
  units: UnitProgressMetrics[];
  totals: {
    metaGeral: number;
    metaPagasTotal: number;
    realTotal: number;
    realPagasTotal: number;
    realGratuidadeRemanescente: number;
    realPagasRenovacoes: number;
    realPagasNovatos: number;
    realNovasGratuidade: number;
    renovacaoPortalTotal: number;
    inscricaoOnlineTotal: number;
    pctGeral: number;
    pctPagasTotal: number;
    faltamParaMeta: number;
    faltamPagasParaMeta: number;
    metaDiariaAte31Dez: number;
    metaDiariaPagasAte31Dez: number;
  };
  rows: TotvsStudentRow[];
  turmaCapacities: Record<string, number>;
  config: NetworkEmailReportConfig;
}): {
  subject: string;
  html: string;
  plainText: string;
  whatsappText: string;
  totalPortalStudents: number;
} {
  const { units, totals, rows, turmaCapacities, config } = params;
  const nowStr = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const getCap = (t: TurmaOccupancyEntry) =>
    turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0;

  let networkTurmasCount = 0;
  let networkMatrTurmas = 0;
  let networkResTurmas = 0;
  let networkOcupacaoSala = 0;
  let networkMaxAlunos = 0;

  const unitSummaries = units.map((u) => {
    const activeTurmas = u.turmas.filter((t) => t.ocupacaoComReservada > 0 || getCap(t) > 0);
    const tCount = activeTurmas.length;
    const matr = activeTurmas.reduce((acc, t) => acc + t.matriculadosTotal, 0);
    const res = activeTurmas.reduce((acc, t) => acc + t.matriculaReservada, 0);
    const ocup = activeTurmas.reduce((acc, t) => acc + t.ocupacaoComReservada, 0);
    const cap = activeTurmas.reduce((acc, t) => acc + getCap(t), 0);
    const pctOcup = cap > 0 ? (ocup / cap) * 100 : 0;

    networkTurmasCount += tCount;
    networkMatrTurmas += matr;
    networkResTurmas += res;
    networkOcupacaoSala += ocup;
    networkMaxAlunos += cap;

    const portalStudents = getPortalStudentsForUnit(
      rows,
      u.goal.totvsUnitName,
      u.goal.shortName
    );

    return {
      unit: u,
      tCount,
      matr,
      res,
      ocup,
      cap,
      pctOcup,
      portalStudents,
    };
  });

  const networkPctOcupacao =
    networkMaxAlunos > 0 ? (networkOcupacaoSala / networkMaxAlunos) * 100 : 0;
  const networkSaldoVagas =
    networkMaxAlunos > 0 ? networkMaxAlunos - networkOcupacaoSala : 0;
  const totalPortalNominal = unitSummaries.reduce(
    (acc, item) => acc + item.portalStudents.length,
    0
  );

  const totalInscricaoOnline =
    typeof totals.inscricaoOnlineTotal === 'number'
      ? totals.inscricaoOnlineTotal
      : units.reduce((acc, u) => acc + (u.inscricaoOnlineCount || 0), 0);

  const subject = `[SESI-PE Rede 2027] Relatório Executivo Consolidado — ${fmtNum(totals.realTotal)}/${fmtNum(totals.metaGeral)} Matriculados (${(totals.pctGeral ?? 0).toFixed(1)}%) | Ocupação Sala ${networkPctOcupacao.toFixed(1)}% | ${totalPortalNominal} em Renovação Portal`;

  const unitBreakdownRowsHtml = unitSummaries
    .map(({ unit: u, tCount, res, ocup, cap, pctOcup, portalStudents }) => {
      const saldo = cap > 0 ? cap - ocup : null;
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:800;color:#0f172a;">SESI ${u.goal.shortName}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:800;color:#047857;background:#ecfdf5;">${fmtNum(u.realTotal)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;">${fmtNum(u.goal.metaGeral)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0284c7;">${(u.pctGeral ?? 0).toFixed(1)}%</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#475569;">${tCount}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#b45309;background:#fffbeb;">${fmtNum(res)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:800;color:#0369a1;background:#f0f9ff;">${fmtNum(ocup)} / ${cap > 0 ? fmtNum(cap) : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:${pctOcup > 100 ? '#dc2626' : '#0369a1'};">${cap > 0 ? `${pctOcup.toFixed(1)}% (${saldo !== null && saldo >= 0 ? `${saldo} liv.` : `${Math.abs(saldo ?? 0)} exc.`})` : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:800;color:#6d28d9;background:#f5f3ff;">${portalStudents.length}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f766e;font-weight:700;">${u.inscricaoOnlineCount ?? 0}</td>
        </tr>
      `;
    })
    .join('');

  const portalByUnitSectionsHtml = unitSummaries
    .filter((item) => item.portalStudents.length > 0)
    .map(
      ({ unit: u, portalStudents }) => `
      <div style="margin-bottom:18px;border:1px solid #ddd6fe;border-radius:10px;overflow:hidden;">
        <div style="background:#ede9fe;padding:8px 14px;font-size:12px;font-weight:800;color:#4c1d95;display:flex;justify-content:space-between;">
          <span>Escola SESI ${u.goal.shortName} — ${portalStudents.length} aluno(s) em Renovação via Portal para contato da secretaria</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f8fafc;color:#475569;text-align:left;">
              <th style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">RA</th>
              <th style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">Nome do Aluno</th>
              <th style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">Série / Ano</th>
              <th style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">Turma</th>
              <th style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">Turno</th>
              <th style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">Situação</th>
              <th style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">Data</th>
            </tr>
          </thead>
          <tbody>
            ${portalStudents
              .map(
                (st, idx) => `
              <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#faf5ff'};">
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:#334155;">${String(st['RA'] ?? '-')}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;color:#0f172a;">${String(st['ALUNO'] ?? '-')}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#334155;">${String(st['SERIE/ANO'] ?? '-')}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:#0369a1;">${String(st['TURMA'] ?? '-')}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#475569;">${String(st['TURNO'] ?? st['NOMETURNO'] ?? '-')}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#6d28d9;font-weight:700;">${String(st['SITUACAO MATRICULA'] ?? '-')}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;">${String(st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-')}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:980px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#0077b6 55%,#009fe3 100%);padding:26px 30px;color:#ffffff;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#7dd3fc;">
        Relatório Executivo da Rede SESI Pernambuco · Campanha de Matrículas 2027
      </div>
      <h1 style="margin:6px 0 4px 0;font-size:23px;font-weight:800;">
        Principais Insights da Rede: Metas, Ocupação de Sala e Pendentes no Portal
      </h1>
      <div style="font-size:12px;opacity:0.9;">
        Consolidado das 12 Unidades Escolares SESI-PE · Gerado em ${nowStr}
      </div>
    </div>

    <div style="padding:24px 30px;">
      <!-- Big Insights -->
      <h2 style="margin:0 0 12px 0;font-size:15px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
        1. Principais Insights Estratégicos da Rede SESI-PE
      </h2>
      <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:22px;">
        <tr>
          <td style="width:25%;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#047857;">MATRICULADOS + PRÉ (META GERAL)</div>
            <div style="font-size:21px;font-weight:800;color:#065f46;margin-top:2px;">${fmtNum(totals.realTotal)} <span style="font-size:12px;color:#047857;">/ ${fmtNum(totals.metaGeral)}</span></div>
            <div style="font-size:11px;font-weight:700;color:#059669;margin-top:4px;">${(totals.pctGeral ?? 0).toFixed(1)}% · Faltam ${fmtNum(totals.faltamParaMeta)}</div>
          </td>
          <td style="width:25%;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#0369a1;">OCUPAÇÃO DE SALA (REDE)</div>
            <div style="font-size:21px;font-weight:800;color:#0c4a6e;margin-top:2px;">${fmtNum(networkOcupacaoSala)} <span style="font-size:12px;color:#0369a1;">/ ${fmtNum(networkMaxAlunos)}</span></div>
            <div style="font-size:11px;font-weight:700;color:#0284c7;margin-top:4px;">${networkPctOcupacao.toFixed(1)}% ocup. (${fmtNum(networkSaldoVagas)} vagas livres)</div>
          </td>
          <td style="width:25%;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#b45309;">MATRÍCULA RESERVADA (VETERANOS)</div>
            <div style="font-size:21px;font-weight:800;color:#92400e;margin-top:2px;">${fmtNum(networkResTurmas)}</div>
            <div style="font-size:11px;font-weight:700;color:#d97706;margin-top:4px;">Compõem sala até 31/12 (não contam matr.)</div>
          </td>
          <td style="width:25%;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:#6d28d9;">RENOVAÇÃO VIA PORTAL + INSCR.</div>
            <div style="font-size:21px;font-weight:800;color:#5b21b6;margin-top:2px;">${fmtNum(totalPortalNominal)} <span style="font-size:12px;color:#6d28d9;">portal</span></div>
            <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-top:4px;">+ ${fmtNum(totalInscricaoOnline)} em Inscrição Online</div>
          </td>
        </tr>
      </table>

      <!-- Quadro Consolidado por Escola -->
      <h2 style="margin:0 0 10px 0;font-size:15px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
        2. Consolidado por Unidade Escolar (Metas, Ocupação de Turmas e Pendentes)
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:26px;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9;color:#334155;text-align:left;">
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;">Unidade</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Matr. + Pré</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Meta Geral</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">% Meta</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Turmas</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Matr. Reservada</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Ocup. Sala / Cap.</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">% Ocup. Sala</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Renov. Portal</th>
            <th style="padding:8px 10px;border-bottom:1px solid #cbd5e1;text-align:right;">Inscr. Online</th>
          </tr>
        </thead>
        <tbody>
          ${unitBreakdownRowsHtml}
        </tbody>
      </table>

      ${
        config.includePortalStudentsNominalAllUnits
          ? `
      <!-- Lista Nominal de Renovação via Portal para Contato das Secretarias -->
      <h2 style="margin:0 0 8px 0;font-size:15px;font-weight:800;color:#5b21b6;text-transform:uppercase;letter-spacing:0.5px;">
        3. Relação Nominal por Escola — Alunos em "Renovação via Portal" (${totalPortalNominal} aluno(s))
      </h2>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 12px;font-size:11px;color:#5b21b6;margin-bottom:14px;">
        <strong>Ação Direta das Secretarias:</strong> Lista nominal completa identificada por RA, Nome, Série e Turma para que a secretaria de cada unidade entre em contato imediato e converta a Renovação via Portal em Matrícula Efetivada.
      </div>
      ${
        portalByUnitSectionsHtml ||
        `<div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#64748b;">Nenhum aluno pendente com status de Renovação via Portal na rede.</div>`
      }
      `
          : ''
      }
    </div>
  </div>
</body>
</html>
  `.trim();

  const unitLinesText = unitSummaries
    .map(
      ({ unit: u, res, ocup, cap, pctOcup, portalStudents }) =>
        `- SESI ${u.goal.shortName}: Matriculados ${u.realTotal}/${u.goal.metaGeral} (${u.pctGeral.toFixed(1)}%) | Reservada: ${res} | Ocup. Sala: ${ocup}/${cap} (${pctOcup.toFixed(1)}%) | Renov. Portal: ${portalStudents.length} | Inscr. Online: ${u.inscricaoOnlineCount}`
    )
    .join('\n');

  const portalAllUnitsText = unitSummaries
    .filter((u) => u.portalStudents.length > 0)
    .map(
      ({ unit: u, portalStudents }) =>
        `\n[SESI ${u.goal.shortName} — ${portalStudents.length} aluno(s) em Renovação via Portal]:\n` +
        portalStudents
          .map(
            (st) =>
              `  * RA ${String(st['RA'] ?? '-')} - ${String(st['ALUNO'] ?? '-')} (${String(st['SERIE/ANO'] ?? '-')} · Turma ${String(st['TURMA'] ?? '-')})`
          )
          .join('\n')
    )
    .join('\n');

  const plainText = [
    `RELATÓRIO EXECUTIVO DE TODA A REDE SESI-PE — MATRÍCULAS 2027`,
    `Gerado em: ${nowStr}`,
    ``,
    `1. PRINCIPAIS INSIGHTS DA REDE:`,
    `- Matriculados + Pré-Matriculados: ${fmtNum(totals.realTotal)} / ${fmtNum(totals.metaGeral)} (${(totals.pctGeral ?? 0).toFixed(1)}%) — Faltam ${fmtNum(totals.faltamParaMeta)}`,
    `- Meta Escala Pagas: ${fmtNum(totals.realPagasTotal)} / ${fmtNum(totals.metaPagasTotal)} (${(totals.pctPagasTotal ?? 0).toFixed(1)}%)`,
    `- Ocupação de Turmas da Rede: ${networkTurmasCount} turmas | ${fmtNum(networkMatrTurmas)} Matriculados + ${fmtNum(networkResTurmas)} Matrículas Reservadas = ${fmtNum(networkOcupacaoSala)} lugares ocupados de ${fmtNum(networkMaxAlunos)} (${networkPctOcupacao.toFixed(1)}%)`,
    `- Pendentes para Conversão: ${totalPortalNominal} em Renovação via Portal | ${fmtNum(totalInscricaoOnline)} em Inscrição Online`,
    ``,
    `2. RESUMO POR UNIDADE ESCOLAR:`,
    unitLinesText,
    ``,
    `3. RELAÇÃO NOMINAL DE ALUNOS EM RENOVAÇÃO VIA PORTAL (PARA CONTATO DA SECRETARIA):`,
    portalAllUnitsText || '  (Nenhum aluno pendente em Renovação via Portal)',
  ].join('\n');

  const whatsappUnitLines = unitSummaries
    .map(
      ({ unit: u, res, ocup, cap, pctOcup, portalStudents }) =>
        `• *SESI ${u.goal.shortName}:* Matr. *${u.realTotal}/${u.goal.metaGeral}* (${u.pctGeral.toFixed(1)}%) | Res: ${res} | Sala: ${ocup}/${cap} (${pctOcup.toFixed(0)}%) | Portal: *${portalStudents.length}*`
    )
    .join('\n');

  const whatsappPortalNetwork = config.includePortalStudentsNominalAllUnits
    ? unitSummaries
        .filter((u) => u.portalStudents.length > 0)
        .map(
          ({ unit: u, portalStudents }) =>
            `\n*🏫 SESI ${u.goal.shortName} (${portalStudents.length} no Portal):*\n` +
            portalStudents
              .map(
                (st) =>
                  `  - *${String(st['ALUNO'] ?? '-')}* (RA ${String(st['RA'] ?? '-')} · ${String(st['SERIE/ANO'] ?? '-')} · T: ${String(st['TURMA'] ?? '-')})`
              )
              .join('\n')
        )
        .join('\n')
    : '';

  const whatsappText = [
    `*📊 RELATÓRIO EXECUTIVO REDE SESI-PE — MATRÍCULAS 2027*`,
    `_Consolidado das 12 Unidades Escolares · ${nowStr}_`,
    ``,
    `*1. PRINCIPAIS INSIGHTS DA REDE:*`,
    `• *Matriculados + Pré (Meta Geral):* *${fmtNum(totals.realTotal)}* / ${fmtNum(totals.metaGeral)} (*${(totals.pctGeral ?? 0).toFixed(1)}%* · Faltam ${fmtNum(totals.faltamParaMeta)})`,
    `• *Meta Escala Pagas:* *${fmtNum(totals.realPagasTotal)}* / ${fmtNum(totals.metaPagasTotal)} (*${(totals.pctPagasTotal ?? 0).toFixed(1)}%*)`,
    `• *Ocupação de Sala (Rede):* *${fmtNum(networkOcupacaoSala)}* / ${fmtNum(networkMaxAlunos)} vagas (*${networkPctOcupacao.toFixed(1)}%*) em ${networkTurmasCount} turmas`,
    `• *Matrícula Reservada (Veteranos até 31/12):* *${fmtNum(networkResTurmas)}*`,
    `• *Pendentes para Conversão:* *${fmtNum(totalPortalNominal)}* em Renovação via Portal | *${fmtNum(totalInscricaoOnline)}* em Inscrição Online`,
    ``,
    `*2. CONSOLIDADO POR ESCOLA SESI-PE:*`,
    whatsappUnitLines,
    ...(config.includePortalStudentsNominalAllUnits
      ? [
          ``,
          `*3. RELAÇÃO NOMINAL — RENOVAÇÃO VIA PORTAL POR ESCOLA (${totalPortalNominal}):*`,
          whatsappPortalNetwork || '_Nenhum aluno pendente em Renovação via Portal._',
        ]
      : []),
  ].join('\n');

  return {
    subject,
    html,
    plainText,
    whatsappText,
    totalPortalStudents: totalPortalNominal,
  };
}
