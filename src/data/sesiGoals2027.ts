import { TotvsStudentRow } from '../types/totvs';

export interface UnitGoal2027 {
  id: string;
  shortName: string;
  totvsUnitName: string;
  metaUnidade2027: number;
  gratuidadeRemanescente: number;
  pagasRenovacoes: number;
  pagasNovatos2027: number;
  novasVagasGratuidade2027: number;
  metaGeral: number;
  observacoes: string;
}

/**
 * Metas oficiais 2027 extraídas fielmente da planilha:
 * "REDE SESI EDUCAÇÃO DE PERNAMBUCO - MATRÍCULAS 2027"
 */
export const SESI_PE_GOALS_2027: UnitGoal2027[] = [
  {
    id: 'araripina',
    shortName: 'ARARIPINA',
    totvsUnitName: 'SESI ARARIPINA',
    metaUnidade2027: 471,
    gratuidadeRemanescente: 111,
    pagasRenovacoes: 197,
    pagasNovatos2027: 83,
    novasVagasGratuidade2027: 80,
    metaGeral: 471,
    observacoes: '',
  },
  {
    id: 'belo-jardim',
    shortName: 'BELO JARDIM',
    totvsUnitName: 'SESI BELO JARDIM',
    metaUnidade2027: 1000,
    gratuidadeRemanescente: 62,
    pagasRenovacoes: 478,
    pagasNovatos2027: 415,
    novasVagasGratuidade2027: 45,
    metaGeral: 1000,
    observacoes: '',
  },
  {
    id: 'cabo',
    shortName: 'CABO',
    totvsUnitName: 'SESI CABO DE SANTO AGOSTINHO',
    metaUnidade2027: 943,
    gratuidadeRemanescente: 159,
    pagasRenovacoes: 556,
    pagasNovatos2027: 148,
    novasVagasGratuidade2027: 80,
    metaGeral: 943,
    observacoes: '',
  },
  {
    id: 'camaragibe',
    shortName: 'CAMARAGIBE',
    totvsUnitName: 'SESI CAMARAGIBE',
    metaUnidade2027: 360,
    gratuidadeRemanescente: 60,
    pagasRenovacoes: 229,
    pagasNovatos2027: 41,
    novasVagasGratuidade2027: 30,
    metaGeral: 360,
    observacoes: '',
  },
  {
    id: 'caruaru',
    shortName: 'CARUARU',
    totvsUnitName: 'SESI CARUARU',
    metaUnidade2027: 960,
    gratuidadeRemanescente: 132,
    pagasRenovacoes: 575,
    pagasNovatos2027: 208,
    novasVagasGratuidade2027: 45,
    metaGeral: 960,
    observacoes: '',
  },
  {
    id: 'escada',
    shortName: 'ESCADA',
    totvsUnitName: 'SESI ESCADA',
    metaUnidade2027: 506,
    gratuidadeRemanescente: 69,
    pagasRenovacoes: 312,
    pagasNovatos2027: 90,
    novasVagasGratuidade2027: 35,
    metaGeral: 506,
    observacoes: '',
  },
  {
    id: 'goiana',
    shortName: 'GOIANA',
    totvsUnitName: 'SESI GOIANA',
    metaUnidade2027: 734,
    gratuidadeRemanescente: 138,
    pagasRenovacoes: 335,
    pagasNovatos2027: 141,
    novasVagasGratuidade2027: 120,
    metaGeral: 734,
    observacoes: '',
  },
  {
    id: 'ibura',
    shortName: 'IBURA',
    totvsUnitName: 'SESI IBURA',
    metaUnidade2027: 940,
    gratuidadeRemanescente: 88,
    pagasRenovacoes: 538,
    pagasNovatos2027: 269,
    novasVagasGratuidade2027: 45,
    metaGeral: 940,
    observacoes: '',
  },
  {
    id: 'moreno',
    shortName: 'MORENO',
    totvsUnitName: 'SESI MORENO',
    metaUnidade2027: 606,
    gratuidadeRemanescente: 110,
    pagasRenovacoes: 342,
    pagasNovatos2027: 84,
    novasVagasGratuidade2027: 70,
    metaGeral: 606,
    observacoes: '',
  },
  {
    id: 'paulista',
    shortName: 'PAULISTA',
    totvsUnitName: 'SESI PAULISTA',
    metaUnidade2027: 1200,
    gratuidadeRemanescente: 80,
    pagasRenovacoes: 880,
    pagasNovatos2027: 200,
    novasVagasGratuidade2027: 40,
    metaGeral: 1200,
    observacoes: '',
  },
  {
    id: 'petrolina',
    shortName: 'PETROLINA',
    totvsUnitName: 'SESI PETROLINA',
    metaUnidade2027: 900,
    gratuidadeRemanescente: 120,
    pagasRenovacoes: 489,
    pagasNovatos2027: 251,
    novasVagasGratuidade2027: 40,
    metaGeral: 900,
    observacoes: '',
  },
  {
    id: 'vasco-da-gama',
    shortName: 'VASCO DA GAMA',
    totvsUnitName: 'SESI VASCO DA GAMA',
    metaUnidade2027: 737,
    gratuidadeRemanescente: 199,
    pagasRenovacoes: 372,
    pagasNovatos2027: 71,
    novasVagasGratuidade2027: 95,
    metaGeral: 737,
    observacoes: '',
  },
];

export type VeteranoRuleMode = 'efetivados' | 'efetivados_portal' | 'todos_veteranos';

export interface DailyEnrollmentEntry {
  isoDate: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  shortDate: string; // DD/MM
  total: number;
  pagasNovatos: number;
  pagasRenovacoes: number;
  gratuidadeRemanescente: number;
  novasGratuidade: number;
}

export interface TurmaOccupancyEntry {
  turmaKey: string; // `${unitId}::${turmaCode}`
  unitId: string;
  unitShortName: string;
  totvsUnitName: string;
  turmaCode: string;
  habilitacao: string;
  curso: string;
  turno: string;
  maxAlunosSql: number; // Coluna MAX ALUNOS vinda da consulta SQL do TOTVS RM
  matriculadosTotal: number; // Matriculado + Pré-Matriculado (contam na meta de matriculados)
  matriculadosNovatos: number;
  matriculadosVeteranos: number;
  matriculaReservada: number; // Veteranos com Matrícula Reservada (garantia de vaga até 31/12; compõem ocupação da sala, mas NÃO contam como matriculado)
  ocupacaoComReservada: number; // matriculadosTotal + matriculaReservada (Ocupação efetiva da sala)
  renovacaoPortal: number;
  reservadaInscricao: number;
  totalAtivosComPendentes: number; // Todos exceto Cancelado
}

export interface UnitProgressMetrics {
  goal: UnitGoal2027;
  // Realizado segundo a regra selecionada
  realGratuidadeRemanescente: number;
  realPagasRenovacoes: number;
  realPagasNovatos: number;
  realNovasGratuidade: number;
  realTotal: number;
  // Total de Matrículas Pagas (Veteranos + Novatos = 7.304 na rede)
  metaPagasTotal: number;
  realPagasTotal: number;
  pctPagasTotal: number;
  faltamPagasParaMeta: number;
  metaDiariaPagasAte31Dez: number;
  // Detalhamento extra de Veteranos (Remanescentes) para visibilidade completa
  vetEfetivadosTotal: number; // Matriculado + Pré Matriculado
  vetRenovacaoPortal: number; // Renovação via Portal
  vetReservada: number; // Matricula Reservada
  vetTodosAtivos: number; // Todos os Veteranos exceto Cancelado
  renovacaoPortalCount: number; // Todos com status Renovação via Portal
  inscricaoOnlineCount: number; // Todos com status Inscrição Online / Reservada
  // Percentuais de atingimento
  pctGeral: number;
  pctPagasNovatos: number;
  pctPagasRenovacoes: number;
  pctGratuidadeRem: number;
  pctNovasGratuidade: number;
  faltamParaMeta: number;
  // Produtividade Diária de Matrículas
  dailyProductivity: DailyEnrollmentEntry[];
  diasComMatricula: number;
  mediaPorDiaAtivo: number;
  picoDia: DailyEnrollmentEntry | null;
  ultimoDia: DailyEnrollmentEntry | null;
  metaDiariaAte31Dez: number;
  // Ocupação de Turmas da Unidade (comparando Matriculados + Matrícula Reservada vs MAX ALUNOS do SQL)
  turmas: TurmaOccupancyEntry[];
  turmasComMatriculadosCount: number;
  turmasMatriculaReservadaTotal: number;
  turmasOcupacaoComReservadaTotal: number;
  turmasMaxAlunosTotal: number;
  pctOcupacaoTurmas: number;
  leagueTier: {
    name: string;
    badgeText: string;
    colorClass: string;
    borderClass: string;
    barClass: string;
  };
}

export function extractMaxAlunos(row: TotvsStudentRow): number {
  const direct =
    row['MAX ALUNOS'] ??
    row['MAX_ALUNOS'] ??
    row['MAXALUNOS'] ??
    row['MAXIMO ALUNOS'] ??
    row['QTMAXALUNOS'];
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
    const num = Number(String(direct).replace(',', '.').trim());
    if (!Number.isNaN(num) && num > 0) return Math.round(num);
  }
  for (const [k, v] of Object.entries(row)) {
    const norm = k
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[_\s-]+/g, ' ')
      .trim();
    if (
      norm === 'MAX ALUNOS' ||
      norm === 'MAXALUNOS' ||
      norm === 'MAXIMO ALUNOS' ||
      norm === 'QTMAXALUNOS' ||
      norm === 'QTD MAX ALUNOS'
    ) {
      const num = Number(String(v ?? '').replace(',', '.').trim());
      if (!Number.isNaN(num) && num > 0) return Math.round(num);
    }
  }
  return 0;
}

function parseEnrollmentDate(raw: unknown): {
  isoDate: string;
  displayDate: string;
  shortDate: string;
} {
  const str = String(raw ?? '').trim();
  if (!str) {
    return {
      isoDate: 'Sem Data',
      displayDate: 'Sem data informada',
      shortDate: 'S/D',
    };
  }

  // Formato DD/MM/YYYY (ex: 14/11/2026 ou 14/11/2026 08:30:00)
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      displayDate: `${dd}/${mm}/${yyyy}`,
      shortDate: `${dd}/${mm}`,
    };
  }

  // Formato ISO YYYY-MM-DD (ex: 2026-11-14T00:00:00)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return {
      isoDate: `${yyyy}-${mm}-${dd}`,
      displayDate: `${dd}/${mm}/${yyyy}`,
      shortDate: `${dd}/${mm}`,
    };
  }

  return {
    isoDate: str,
    displayDate: str,
    shortDate: str.slice(0, 5),
  };
}

function getRemainingCampaignDays(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // 31 de Dezembro
  const diffMs = end.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

export function isRenovacaoPortalRow(row: TotvsStudentRow): boolean {
  const situacao = String(row['SITUACAO MATRICULA'] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  const forma1 = String(row['FORMAINGRESSO'] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  const forma2 = String(row['FORMA INGRESSO'] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  return (
    situacao.includes('PORTAL') ||
    forma1.includes('PORTAL') ||
    forma2.includes('PORTAL')
  );
}

export function isInscricaoOnlineRow(row: TotvsStudentRow): boolean {
  const situacao = String(row['SITUACAO MATRICULA'] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  const forma1 = String(row['FORMAINGRESSO'] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  const forma2 = String(row['FORMA INGRESSO'] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  return (
    situacao.includes('INSCRICAO') ||
    situacao.includes('ONLINE') ||
    situacao.includes('ON-LINE') ||
    situacao.includes('RESERVADA') ||
    forma1.includes('INSCRICAO') ||
    forma1.includes('ONLINE') ||
    forma2.includes('INSCRICAO') ||
    forma2.includes('ONLINE')
  );
}

function isMatriculadoOrPre(situacao: string): boolean {
  const norm = situacao
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  return norm === 'MATRICULADO' || norm === 'PRE MATRICULADO' || norm === 'PRE-MATRICULADO';
}

function isGratuidadeRow(row: TotvsStudentRow): boolean {
  const nomePlano = String(row['NOME'] ?? '').toUpperCase();
  const codPlano = String(row['CODPLANOPGTO'] ?? '').toUpperCase();
  return (
    nomePlano.includes('GRATUIDADE') ||
    codPlano.includes('GRAT') ||
    codPlano.endsWith('GR')
  );
}

function getLeagueTier(pct: number) {
  if (pct >= 80) {
    return {
      name: 'Escola Diamante',
      badgeText: '★★★ ESCOLA DIAMANTE',
      colorClass: 'text-sky-700',
      borderClass: 'border-sky-300',
      barClass: 'from-sky-500 to-emerald-500',
    };
  }
  if (pct >= 50) {
    return {
      name: 'Escola Ouro',
      badgeText: '★★☆ ESCOLA OURO',
      colorClass: 'text-emerald-700',
      borderClass: 'border-emerald-300',
      barClass: 'from-emerald-500 to-teal-500',
    };
  }
  if (pct >= 25) {
    return {
      name: 'Escola Prata',
      badgeText: '★★☆ ESCOLA PRATA',
      colorClass: 'text-amber-700',
      borderClass: 'border-amber-300',
      barClass: 'from-amber-400 to-orange-500',
    };
  }
  return {
    name: 'Em Jornada Escolar',
    badgeText: '★☆☆ EM JORNADA',
    colorClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    barClass: 'from-blue-500 to-sky-400',
  };
}

export function computeNetworkMetrics2027(
  rows: TotvsStudentRow[],
  goals: UnitGoal2027[],
  veteranoMode: VeteranoRuleMode = 'efetivados'
): {
  units: UnitProgressMetrics[];
  totals: {
    metaGeral: number;
    metaGratuidadeRemanescente: number;
    metaPagasRenovacoes: number;
    metaPagasNovatos2027: number;
    metaNovasGratuidade2027: number;
    metaPagasTotal: number;
    realTotal: number;
    realGratuidadeRemanescente: number;
    realPagasRenovacoes: number;
    realPagasNovatos: number;
    realNovasGratuidade: number;
    realPagasTotal: number;
    vetEfetivadosTotal: number;
    vetRenovacaoPortal: number;
    vetReservada: number;
    vetTodosAtivos: number;
    renovacaoPortalTotal: number;
    inscricaoOnlineTotal: number;
    pctGeral: number;
    pctPagasTotal: number;
    pctPagasNovatos: number;
    pctPagasRenovacoes: number;
    pctGratuidadeRem: number;
    pctNovasGratuidade: number;
    faltamParaMeta: number;
    faltamPagasParaMeta: number;
    dailyProductivity: DailyEnrollmentEntry[];
    diasComMatricula: number;
    mediaPorDiaAtivo: number;
    picoDia: DailyEnrollmentEntry | null;
    ultimoDia: DailyEnrollmentEntry | null;
    metaDiariaAte31Dez: number;
    metaDiariaPagasAte31Dez: number;
  };
} {
  // Filtra apenas os registros do Período 2027
  const rows2027 = rows.filter((r) => String(r['PERIODO'] ?? '').trim() === '2027');
  const remainingDays = getRemainingCampaignDays();
  const networkDailyMap = new Map<string, DailyEnrollmentEntry>();

  const unitMetrics: UnitProgressMetrics[] = goals.map((goal) => {
    const unitRows = rows2027.filter((r) => {
      const u = String(r['UNIDADE'] ?? '').trim().toUpperCase();
      return (
        u === goal.totvsUnitName.toUpperCase() ||
        u.includes(goal.shortName.toUpperCase())
      );
    });

    let realGratuidadeRemanescente = 0;
    let realPagasRenovacoes = 0;
    let realPagasNovatos = 0;
    let realNovasGratuidade = 0;

    let vetEfetivadosTotal = 0;
    let vetRenovacaoPortal = 0;
    let vetReservada = 0;
    let vetTodosAtivos = 0;
    let renovacaoPortalCount = 0;
    let inscricaoOnlineCount = 0;

    const unitDailyMap = new Map<string, DailyEnrollmentEntry>();
    const unitTurmaMap = new Map<string, TurmaOccupancyEntry>();

    const recordDaily = (
      category: 'pagasNovatos' | 'pagasRenovacoes' | 'gratuidadeRemanescente' | 'novasGratuidade',
      row: TotvsStudentRow
    ) => {
      const rawDate = row['DT MATRICULA'] || row['DT ALTERACAO'] || '';
      const parsed = parseEnrollmentDate(rawDate);

      let uEntry = unitDailyMap.get(parsed.isoDate);
      if (!uEntry) {
        uEntry = {
          isoDate: parsed.isoDate,
          displayDate: parsed.displayDate,
          shortDate: parsed.shortDate,
          total: 0,
          pagasNovatos: 0,
          pagasRenovacoes: 0,
          gratuidadeRemanescente: 0,
          novasGratuidade: 0,
        };
        unitDailyMap.set(parsed.isoDate, uEntry);
      }
      uEntry.total += 1;
      uEntry[category] += 1;

      let nEntry = networkDailyMap.get(parsed.isoDate);
      if (!nEntry) {
        nEntry = {
          isoDate: parsed.isoDate,
          displayDate: parsed.displayDate,
          shortDate: parsed.shortDate,
          total: 0,
          pagasNovatos: 0,
          pagasRenovacoes: 0,
          gratuidadeRemanescente: 0,
          novasGratuidade: 0,
        };
        networkDailyMap.set(parsed.isoDate, nEntry);
      }
      nEntry.total += 1;
      nEntry[category] += 1;
    };

    for (const row of unitRows) {
      const tipo = String(row['TIPO MATRICULA'] ?? '').trim().toUpperCase();
      const situacao = String(row['SITUACAO MATRICULA'] ?? '').trim();
      const isCancelado = situacao.toUpperCase().includes('CANCELAD');
      const isEfetivado = isMatriculadoOrPre(situacao);
      const isPortal = situacao.toUpperCase().includes('PORTAL');
      const isReservada = situacao.toUpperCase().includes('RESERVADA');
      const isGrat = isGratuidadeRow(row);

      if (!isCancelado) {
        const rawTurma = String(row['TURMA'] ?? '').trim() || 'SEM TURMA';
        const turmaUpper = rawTurma.toUpperCase();
        const rowMaxAlunos = extractMaxAlunos(row);
        let tEntry = unitTurmaMap.get(turmaUpper);
        if (!tEntry) {
          tEntry = {
            turmaKey: `${goal.id}::${turmaUpper}`,
            unitId: goal.id,
            unitShortName: goal.shortName,
            totvsUnitName: goal.totvsUnitName,
            turmaCode: rawTurma,
            habilitacao: String(row['HABILITACAO GRADE'] ?? '').trim(),
            curso: String(row['NOME CURSO'] ?? '').trim(),
            turno: String(row['NOMETURNO'] ?? row['TURNO'] ?? '').trim(),
            maxAlunosSql: rowMaxAlunos,
            matriculadosTotal: 0,
            matriculadosNovatos: 0,
            matriculadosVeteranos: 0,
            matriculaReservada: 0,
            ocupacaoComReservada: 0,
            renovacaoPortal: 0,
            reservadaInscricao: 0,
            totalAtivosComPendentes: 0,
          };
          unitTurmaMap.set(turmaUpper, tEntry);
        } else {
          if (rowMaxAlunos > tEntry.maxAlunosSql) {
            tEntry.maxAlunosSql = rowMaxAlunos;
          }
          if (!tEntry.habilitacao && row['HABILITACAO GRADE']) {
            tEntry.habilitacao = String(row['HABILITACAO GRADE']).trim();
          }
          if (!tEntry.curso && row['NOME CURSO']) {
            tEntry.curso = String(row['NOME CURSO']).trim();
          }
          if (!tEntry.turno && (row['NOMETURNO'] || row['TURNO'])) {
            tEntry.turno = String(row['NOMETURNO'] ?? row['TURNO']).trim();
          }
        }

        tEntry.totalAtivosComPendentes += 1;
        if (isEfetivado) {
          tEntry.matriculadosTotal += 1;
          tEntry.ocupacaoComReservada += 1;
          if (tipo === 'VETERANO') {
            tEntry.matriculadosVeteranos += 1;
          } else {
            tEntry.matriculadosNovatos += 1;
          }
        } else if (isReservada) {
          // Matrícula Reservada: compõe a ocupação da sala (vaga garantida até 31/12), mas NÃO conta como matriculado
          tEntry.matriculaReservada += 1;
          tEntry.ocupacaoComReservada += 1;
        } else if (isRenovacaoPortalRow(row)) {
          tEntry.renovacaoPortal += 1;
        } else {
          tEntry.reservadaInscricao += 1;
        }
      }

      if (!isCancelado && !isEfetivado) {
        if (isRenovacaoPortalRow(row)) {
          renovacaoPortalCount++;
        } else if (isInscricaoOnlineRow(row)) {
          inscricaoOnlineCount++;
        }
      }

      // Regra explícita do usuário para NOVATO:
      // "eu considero pagas novato se o tipo de matricula for novato e a situação de matricula estiver matriculado ou pré matriculado"
      // Inclui também registros Matriculado / Pré-Matriculado onde TIPO MATRICULA veio em branco no TOTVS (ingressantes via Indicação/Inscrição Online)
      if (tipo !== 'VETERANO' && isEfetivado) {
        if (isGrat) {
          realNovasGratuidade++;
          recordDaily('novasGratuidade', row);
        } else {
          realPagasNovatos++;
          recordDaily('pagasNovatos', row);
        }
      }

      // Regra para REMANESCENTE (VETERANO):
      // Apenas Matriculado ou Pré Matriculado contam como matriculados.
      // Matrícula Reservada e Renovação via Portal NÃO contam como matriculado.
      if (tipo === 'VETERANO' && !isCancelado) {
        vetTodosAtivos++;
        if (isEfetivado) vetEfetivadosTotal++;
        else if (isPortal) vetRenovacaoPortal++;
        else if (isReservada) vetReservada++;

        if (isEfetivado) {
          if (isGrat) {
            realGratuidadeRemanescente++;
            recordDaily('gratuidadeRemanescente', row);
          } else {
            realPagasRenovacoes++;
            recordDaily('pagasRenovacoes', row);
          }
        }
      }
    }

    // Total de alunos efetivados (Matriculado + Pré-Matriculado = ~1.040 na rede)
    const realTotal =
      realGratuidadeRemanescente +
      realPagasRenovacoes +
      realPagasNovatos +
      realNovasGratuidade;

    // Meta da Escala de Matrículas Pagas (Veteranos + Novatos = 7.304 na rede)
    // Contabilizando no realizado todos os alunos Matriculados + Pré-Matriculados
    const metaPagasTotal = goal.pagasRenovacoes + goal.pagasNovatos2027;
    const realPagasTotal = realTotal;
    const pctPagasTotal =
      metaPagasTotal > 0 ? (realTotal / metaPagasTotal) * 100 : 0;
    const faltamPagasParaMeta = Math.max(0, metaPagasTotal - realTotal);
    const metaDiariaPagasAte31Dez = faltamPagasParaMeta / remainingDays;

    const pctGeral =
      goal.metaGeral > 0 ? (realTotal / goal.metaGeral) * 100 : 0;
    const pctPagasNovatos =
      goal.pagasNovatos2027 > 0
        ? (realPagasNovatos / goal.pagasNovatos2027) * 100
        : 0;
    const pctPagasRenovacoes =
      goal.pagasRenovacoes > 0
        ? (realPagasRenovacoes / goal.pagasRenovacoes) * 100
        : 0;
    const pctGratuidadeRem =
      goal.gratuidadeRemanescente > 0
        ? (realGratuidadeRemanescente / goal.gratuidadeRemanescente) * 100
        : 0;
    const pctNovasGratuidade =
      goal.novasVagasGratuidade2027 > 0
        ? (realNovasGratuidade / goal.novasVagasGratuidade2027) * 100
        : 0;

    const dailyProductivity = Array.from(unitDailyMap.values()).sort((a, b) =>
      a.isoDate.localeCompare(b.isoDate)
    );
    const diasComMatricula = dailyProductivity.length;
    const mediaPorDiaAtivo =
      diasComMatricula > 0 ? realTotal / diasComMatricula : 0;
    const picoDia =
      dailyProductivity.length > 0
        ? dailyProductivity.reduce((best, cur) =>
            cur.total > best.total ? cur : best
          )
        : null;
    const ultimoDia =
      dailyProductivity.length > 0
        ? dailyProductivity[dailyProductivity.length - 1]
        : null;
    const faltamParaMeta = Math.max(0, goal.metaGeral - realTotal);
    const metaDiariaAte31Dez = faltamParaMeta / remainingDays;
    const turmas = Array.from(unitTurmaMap.values()).sort((a, b) =>
      a.turmaCode.localeCompare(b.turmaCode, 'pt-BR', { numeric: true })
    );
    const turmasComOcupacao = turmas.filter((t) => t.ocupacaoComReservada > 0);
    const turmasComMatriculadosCount = turmasComOcupacao.length;
    const turmasMatriculaReservadaTotal = turmasComOcupacao.reduce(
      (acc, t) => acc + t.matriculaReservada,
      0
    );
    const turmasOcupacaoComReservadaTotal = turmasComOcupacao.reduce(
      (acc, t) => acc + t.ocupacaoComReservada,
      0
    );
    const turmasMaxAlunosTotal = turmasComOcupacao.reduce(
      (acc, t) => acc + t.maxAlunosSql,
      0
    );
    const pctOcupacaoTurmas =
      turmasMaxAlunosTotal > 0
        ? (turmasOcupacaoComReservadaTotal / turmasMaxAlunosTotal) * 100
        : 0;

    return {
      goal,
      realGratuidadeRemanescente,
      realPagasRenovacoes,
      realPagasNovatos,
      realNovasGratuidade,
      realTotal,
      metaPagasTotal,
      realPagasTotal,
      pctPagasTotal,
      faltamPagasParaMeta,
      metaDiariaPagasAte31Dez,
      vetEfetivadosTotal,
      vetRenovacaoPortal,
      vetReservada,
      vetTodosAtivos,
      renovacaoPortalCount,
      inscricaoOnlineCount,
      pctGeral,
      pctPagasNovatos,
      pctPagasRenovacoes,
      pctGratuidadeRem,
      pctNovasGratuidade,
      faltamParaMeta,
      dailyProductivity,
      diasComMatricula,
      mediaPorDiaAtivo,
      picoDia,
      ultimoDia,
      metaDiariaAte31Dez,
      turmas,
      turmasComMatriculadosCount,
      turmasMatriculaReservadaTotal,
      turmasOcupacaoComReservadaTotal,
      turmasMaxAlunosTotal,
      pctOcupacaoTurmas,
      leagueTier: getLeagueTier(pctGeral),
    };
  });

  const networkDailyProductivity = Array.from(networkDailyMap.values()).sort(
    (a, b) => a.isoDate.localeCompare(b.isoDate)
  );

  const totals = unitMetrics.reduce(
    (acc, u) => {
      acc.metaGeral += u.goal.metaGeral;
      acc.metaGratuidadeRemanescente += u.goal.gratuidadeRemanescente;
      acc.metaPagasRenovacoes += u.goal.pagasRenovacoes;
      acc.metaPagasNovatos2027 += u.goal.pagasNovatos2027;
      acc.metaNovasGratuidade2027 += u.goal.novasVagasGratuidade2027;
      acc.metaPagasTotal += u.metaPagasTotal;

      acc.realTotal += u.realTotal;
      acc.realGratuidadeRemanescente += u.realGratuidadeRemanescente;
      acc.realPagasRenovacoes += u.realPagasRenovacoes;
      acc.realPagasNovatos += u.realPagasNovatos;
      acc.realNovasGratuidade += u.realNovasGratuidade;
      acc.realPagasTotal += u.realPagasTotal;

      acc.vetEfetivadosTotal += u.vetEfetivadosTotal;
      acc.vetRenovacaoPortal += u.vetRenovacaoPortal;
      acc.vetReservada += u.vetReservada;
      acc.vetTodosAtivos += u.vetTodosAtivos;
      acc.renovacaoPortalTotal += u.renovacaoPortalCount;
      acc.inscricaoOnlineTotal += u.inscricaoOnlineCount;
      return acc;
    },
    {
      metaGeral: 0,
      metaGratuidadeRemanescente: 0,
      metaPagasRenovacoes: 0,
      metaPagasNovatos2027: 0,
      metaNovasGratuidade2027: 0,
      metaPagasTotal: 0,
      realTotal: 0,
      realGratuidadeRemanescente: 0,
      realPagasRenovacoes: 0,
      realPagasNovatos: 0,
      realNovasGratuidade: 0,
      realPagasTotal: 0,
      vetEfetivadosTotal: 0,
      vetRenovacaoPortal: 0,
      vetReservada: 0,
      vetTodosAtivos: 0,
      renovacaoPortalTotal: 0,
      inscricaoOnlineTotal: 0,
      pctGeral: 0,
      pctPagasTotal: 0,
      pctPagasNovatos: 0,
      pctPagasRenovacoes: 0,
      pctGratuidadeRem: 0,
      pctNovasGratuidade: 0,
      faltamParaMeta: 0,
      faltamPagasParaMeta: 0,
      dailyProductivity: networkDailyProductivity,
      diasComMatricula: networkDailyProductivity.length,
      mediaPorDiaAtivo: 0,
      picoDia: null as DailyEnrollmentEntry | null,
      ultimoDia: null as DailyEnrollmentEntry | null,
      metaDiariaAte31Dez: 0,
      metaDiariaPagasAte31Dez: 0,
    }
  );

  totals.pctGeral =
    totals.metaGeral > 0 ? (totals.realTotal / totals.metaGeral) * 100 : 0;
  totals.pctPagasTotal =
    totals.metaPagasTotal > 0
      ? (totals.realPagasTotal / totals.metaPagasTotal) * 100
      : 0;
  totals.pctPagasNovatos =
    totals.metaPagasNovatos2027 > 0
      ? (totals.realPagasNovatos / totals.metaPagasNovatos2027) * 100
      : 0;
  totals.pctPagasRenovacoes =
    totals.metaPagasRenovacoes > 0
      ? (totals.realPagasRenovacoes / totals.metaPagasRenovacoes) * 100
      : 0;
  totals.pctGratuidadeRem =
    totals.metaGratuidadeRemanescente > 0
      ? (totals.realGratuidadeRemanescente / totals.metaGratuidadeRemanescente) * 100
      : 0;
  totals.pctNovasGratuidade =
    totals.metaNovasGratuidade2027 > 0
      ? (totals.realNovasGratuidade / totals.metaNovasGratuidade2027) * 100
      : 0;
  totals.faltamParaMeta = Math.max(0, totals.metaGeral - totals.realTotal);
  totals.faltamPagasParaMeta = Math.max(
    0,
    totals.metaPagasTotal - totals.realPagasTotal
  );
  totals.mediaPorDiaAtivo =
    totals.diasComMatricula > 0 ? totals.realTotal / totals.diasComMatricula : 0;
  totals.picoDia =
    networkDailyProductivity.length > 0
      ? networkDailyProductivity.reduce((best, cur) =>
          cur.total > best.total ? cur : best
        )
      : null;
  totals.ultimoDia =
    networkDailyProductivity.length > 0
      ? networkDailyProductivity[networkDailyProductivity.length - 1]
      : null;
  totals.metaDiariaAte31Dez = totals.faltamParaMeta / remainingDays;
  totals.metaDiariaPagasAte31Dez = totals.faltamPagasParaMeta / remainingDays;

  return { units: unitMetrics, totals };
}
