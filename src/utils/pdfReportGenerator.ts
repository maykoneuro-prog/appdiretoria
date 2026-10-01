import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TotvsStudentRow } from '../types/totvs';
import { UnitProgressMetrics, TurmaOccupancyEntry } from '../data/sesiGoals2027';
import {
  UnitEmailReportConfig,
  NetworkEmailReportConfig,
  getPortalStudentsForUnit,
  getReservadaStudentsForUnit,
  normalizeWhatsappPhone,
} from './emailReportBuilder';

export interface GeneratedPdfBundle {
  filename: string;
  blob: Blob;
  base64: string;
  file: File;
  save: () => void;
}

function fmtNum(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function addPageFooters(doc: jsPDF, reportTitle: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${reportTitle} · Rede SESI Educação de Pernambuco (Matrículas 2027)`,
      14,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 8, {
      align: 'right',
    });
  }
}

export function buildUnitPdfBundle(params: {
  unit: UnitProgressMetrics;
  rows: TotvsStudentRow[];
  turmaCapacities: Record<string, number>;
  config: UnitEmailReportConfig;
  autoPrint?: boolean;
}): GeneratedPdfBundle {
  const { unit, rows, turmaCapacities, config, autoPrint = false } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
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
  const totalResTurmas = activeTurmas.reduce((acc, t) => acc + t.matriculaReservada, 0);
  const totalOcupacaoSala = activeTurmas.reduce((acc, t) => acc + t.ocupacaoComReservada, 0);
  const totalMaxAlunos = activeTurmas.reduce((acc, t) => acc + getCap(t), 0);
  const pctOcupacaoSala =
    totalMaxAlunos > 0 ? (totalOcupacaoSala / totalMaxAlunos) * 100 : 0;
  const saldoVagasSala = totalMaxAlunos > 0 ? totalMaxAlunos - totalOcupacaoSala : 0;

  // Header Banner
  doc.setFillColor(0, 119, 182);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SESI PERNAMBUCO · PAINEL ESTRATÉGICO DE MATRÍCULAS 2027', 14, 9);

  doc.setFontSize(15);
  doc.text(`Relatório da Unidade — Escola SESI ${unit.goal.shortName}`, 14, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Gerado em ${nowStr} · Unidade TOTVS: ${unit.goal.totvsUnitName}`,
    14,
    23.5
  );

  let cursorY = 35;

  // Section 1 Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DESEMPENHO DE METAS E MATRÍCULAS EFETIVADAS (2027)', 14, cursorY);
  cursorY += 4;

  // KPI Summary Table
  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        'META GERAL 2027',
        'META ESCALA PAGAS',
        'RENOVAÇÃO VIA PORTAL',
        'MATRÍCULA RESERVADA (VET.)',
      ],
    ],
    body: [
      [
        `${fmtNum(unit.realTotal)} / ${fmtNum(unit.goal.metaGeral)} (${(unit.pctGeral ?? 0).toFixed(1)}%)\nFaltam: ${fmtNum(unit.faltamParaMeta)}`,
        `${fmtNum(unit.realPagasTotal)} / ${fmtNum(unit.metaPagasTotal)} (${(unit.pctPagasTotal ?? 0).toFixed(1)}%)\nRitmo: ${(unit.metaDiariaPagasAte31Dez ?? 0).toFixed(1)}/dia`,
        `${fmtNum(portalStudents.length)} aluno(s)\nPara contato da secretaria`,
        `${fmtNum(unit.vetReservada)} veterano(s) até 31/12\nInscr. Online: ${fmtNum(unit.inscricaoOnlineCount)}`,
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      fontStyle: 'bold',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [240, 249, 255],
      textColor: [3, 105, 161],
      fontSize: 8,
      fontStyle: 'bold',
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // Category Breakdown Table
  autoTable(doc, {
    startY: cursorY,
    head: [['Categoria da Meta', 'Matriculados + Pré', 'Meta 2027', '% Atingido', 'Saldo Restante']],
    body: [
      [
        'Pagas — Renovações (Veteranos)',
        fmtNum(unit.realPagasRenovacoes),
        fmtNum(unit.goal.pagasRenovacoes),
        `${(unit.pctPagasRenovacoes ?? 0).toFixed(1)}%`,
        fmtNum(Math.max(0, unit.goal.pagasRenovacoes - unit.realPagasRenovacoes)),
      ],
      [
        'Pagas — Novas Matrículas (Novatos)',
        fmtNum(unit.realPagasNovatos),
        fmtNum(unit.goal.pagasNovatos2027),
        `${(unit.pctPagasNovatos ?? 0).toFixed(1)}%`,
        fmtNum(Math.max(0, unit.goal.pagasNovatos2027 - unit.realPagasNovatos)),
      ],
      [
        'Gratuidade Remanescente (Veteranos)',
        fmtNum(unit.realGratuidadeRemanescente),
        fmtNum(unit.goal.gratuidadeRemanescente),
        `${(unit.pctGratuidadeRem ?? 0).toFixed(1)}%`,
        fmtNum(Math.max(0, unit.goal.gratuidadeRemanescente - unit.realGratuidadeRemanescente)),
      ],
      [
        'Novas Gratuidades 2027 (Novatos)',
        fmtNum(unit.realNovasGratuidade),
        fmtNum(unit.goal.novasVagasGratuidade2027),
        `${(unit.pctNovasGratuidade ?? 0).toFixed(1)}%`,
        fmtNum(Math.max(0, unit.goal.novasVagasGratuidade2027 - unit.realNovasGratuidade)),
      ],
    ],
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Section 2: Mapa de Ocupação de Turmas
  if (config.includeTurmaOccupancy) {
    if (cursorY > 245) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `2. OCUPAÇÃO DE TURMAS (${totalTurmas} turmas · Ocupação Sala: ${fmtNum(totalOcupacaoSala)}/${fmtNum(totalMaxAlunos)} — ${pctOcupacaoSala.toFixed(1)}%)`,
      14,
      cursorY
    );
    cursorY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    const noteLines = doc.splitTextToSize(
      `Nota sobre Matrícula Reservada: Os ${fmtNum(totalResTurmas)} alunos veteranos com status Matrícula Reservada têm vaga garantida por lei até 31/12 e compõem a Ocupação da Sala (${fmtNum(totalOcupacaoSala)}), mas não contam como matriculados oficiais até renovarem. Saldo na unidade: ${
        saldoVagasSala >= 0
          ? `${fmtNum(saldoVagasSala)} vagas livres`
          : `${fmtNum(Math.abs(saldoVagasSala))} acima da capacidade`
      }.`,
      pageWidth - 28
    );
    doc.text(noteLines, 14, cursorY);
    cursorY += noteLines.length * 4 + 2;

    autoTable(doc, {
      startY: cursorY,
      head: [
        [
          'Turma',
          'Série / Habilitação',
          'Turno',
          'Matr.+Pré',
          'Reservada',
          'Ocup. Sala',
          'MAX ALUNOS',
          'Saldo Vagas',
          '% Ocup.',
        ],
      ],
      body:
        activeTurmas.length > 0
          ? activeTurmas.map((t) => {
              const cap = getCap(t);
              const pct = cap > 0 ? (t.ocupacaoComReservada / cap) * 100 : 0;
              const saldo = cap > 0 ? cap - t.ocupacaoComReservada : null;
              return [
                t.turmaCode,
                t.habilitacao || t.curso || '—',
                t.turno || '—',
                String(t.matriculadosTotal),
                String(t.matriculaReservada),
                String(t.ocupacaoComReservada),
                cap > 0 ? String(cap) : '—',
                saldo === null
                  ? '—'
                  : saldo >= 0
                  ? `${saldo} livres`
                  : `+${Math.abs(saldo)} exc.`,
                cap > 0 ? `${pct.toFixed(1)}%` : '—',
              ];
            })
          : [['—', 'Nenhuma turma mapeada', '—', '0', '0', '0', '—', '—', '—']],
      theme: 'grid',
      styles: { fontSize: 7.8, cellPadding: 2 },
      headStyles: { fillColor: [0, 159, 227], textColor: [255, 255, 255], fontSize: 7.8 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Section 3: Lista Nominal de Renovação via Portal
  if (config.includePortalStudentsNominal) {
    if (cursorY > 240) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(91, 33, 182);
    doc.text(
      `3. RELAÇÃO NOMINAL — ALUNOS EM "RENOVAÇÃO VIA PORTAL" (${portalStudents.length} ALUNO(S) PARA CONTATO)`,
      14,
      cursorY
    );
    cursorY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(76, 29, 149);
    doc.text(
      'Ação da Secretaria Escolar: Alunos abaixo iniciaram a Renovação via Portal e aguardam contato para efetivação da matrícula.',
      14,
      cursorY
    );
    cursorY += 3.5;

    autoTable(doc, {
      startY: cursorY,
      head: [['RA', 'Nome do Aluno (Contato Secretaria)', 'Série / Ano', 'Turma', 'Turno', 'Data']],
      body:
        portalStudents.length > 0
          ? portalStudents.map((st) => [
              String(st['RA'] ?? '-'),
              String(st['ALUNO'] ?? '-'),
              String(st['SERIE/ANO'] ?? '-'),
              String(st['TURMA'] ?? '-'),
              String(st['TURNO'] ?? st['NOMETURNO'] ?? '-'),
              String(st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-'),
            ])
          : [['—', 'Nenhum aluno pendente em Renovação via Portal nesta unidade.', '—', '—', '—', '—']],
      theme: 'striped',
      styles: { fontSize: 7.8, cellPadding: 2 },
      headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 22 },
        1: { fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Section 4: Opcional — Alunos com Matrícula Reservada
  if (config.includeReservadaStudentsNominal && reservadaStudents.length > 0) {
    if (cursorY > 240) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(146, 64, 14);
    doc.text(
      `4. RELAÇÃO NOMINAL — VETERANOS COM MATRÍCULA RESERVADA (${reservadaStudents.length} ALUNOS)`,
      14,
      cursorY
    );
    cursorY += 3.5;

    autoTable(doc, {
      startY: cursorY,
      head: [['RA', 'Nome do Aluno', 'Série / Ano', 'Turma', 'Turno']],
      body: reservadaStudents.map((st) => [
        String(st['RA'] ?? '-'),
        String(st['ALUNO'] ?? '-'),
        String(st['SERIE/ANO'] ?? '-'),
        String(st['TURMA'] ?? '-'),
        String(st['TURNO'] ?? st['NOMETURNO'] ?? '-'),
      ]),
      theme: 'striped',
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontSize: 7.8 },
      margin: { left: 14, right: 14 },
    });
  }

  addPageFooters(doc, `Relatório SESI ${unit.goal.shortName}`);

  if (autoPrint) {
    doc.autoPrint();
  }

  const filename = `Relatorio_SESI_${unit.goal.shortName}_2027.pdf`;
  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');
  const file = new File([blob], filename, { type: 'application/pdf' });

  return {
    filename,
    blob,
    base64: dataUri,
    file,
    save: () => doc.save(filename),
  };
}

export function generateAndSaveUnitPdf(params: {
  unit: UnitProgressMetrics;
  rows: TotvsStudentRow[];
  turmaCapacities: Record<string, number>;
  config: UnitEmailReportConfig;
  autoPrint?: boolean;
}): string {
  const bundle = buildUnitPdfBundle(params);
  bundle.save();
  return bundle.filename;
}

export function buildNetworkPdfBundle(params: {
  units: UnitProgressMetrics[];
  totals: {
    metaGeral: number;
    metaPagasTotal: number;
    realTotal: number;
    realPagasTotal: number;
    renovacaoPortalTotal: number;
    inscricaoOnlineTotal: number;
    pctGeral: number;
    pctPagasTotal: number;
    faltamParaMeta: number;
    faltamPagasParaMeta: number;
  };
  rows: TotvsStudentRow[];
  turmaCapacities: Record<string, number>;
  config: NetworkEmailReportConfig;
  autoPrint?: boolean;
}): GeneratedPdfBundle {
  const { units, totals, rows, turmaCapacities, config, autoPrint = false } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const nowStr = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const getCap = (t: TurmaOccupancyEntry) =>
    turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0;

  let networkResTurmas = 0;
  let networkOcupacaoSala = 0;
  let networkMaxAlunos = 0;

  const unitSummaries = units.map((u) => {
    const activeTurmas = u.turmas.filter((t) => t.ocupacaoComReservada > 0 || getCap(t) > 0);
    const tCount = activeTurmas.length;
    const res = activeTurmas.reduce((acc, t) => acc + t.matriculaReservada, 0);
    const ocup = activeTurmas.reduce((acc, t) => acc + t.ocupacaoComReservada, 0);
    const cap = activeTurmas.reduce((acc, t) => acc + getCap(t), 0);
    const pctOcup = cap > 0 ? (ocup / cap) * 100 : 0;

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

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(125, 211, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    'RELATÓRIO EXECUTIVO DA REDE SESI PERNAMBUCO · CAMPANHA DE MATRÍCULAS 2027',
    14,
    8.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(
    'Principais Insights da Rede: Metas, Ocupação de Sala (c/ Reservada) e Renovação via Portal',
    14,
    16
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Consolidado das 12 Unidades Escolares SESI-PE · Gerado em ${nowStr}`, 14, 22);

  let cursorY = 32;

  // Section 1: Big Insights
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. PRINCIPAIS INSIGHTS ESTRATÉGICOS DA REDE SESI-PE', 14, cursorY);
  cursorY += 3.5;

  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        'MATRICULADOS + PRÉ (META GERAL)',
        'OCUPAÇÃO DE SALA (REDE)',
        'MATRÍCULA RESERVADA (VETERANOS)',
        'RENOVAÇÃO VIA PORTAL + INSCRIÇÃO',
      ],
    ],
    body: [
      [
        `${fmtNum(totals.realTotal)} / ${fmtNum(totals.metaGeral)} (${(totals.pctGeral ?? 0).toFixed(1)}%)\nFaltam: ${fmtNum(totals.faltamParaMeta)}`,
        `${fmtNum(networkOcupacaoSala)} / ${fmtNum(networkMaxAlunos)} (${networkPctOcupacao.toFixed(1)}%)\nSaldo: ${fmtNum(networkSaldoVagas)} vagas livres`,
        `${fmtNum(networkResTurmas)} veteranos\nCompõem sala até 31/12 (não contam matr.)`,
        `${fmtNum(totalPortalNominal)} em Renovação via Portal\n+ ${fmtNum(totalInscricaoOnline)} em Inscrição Online`,
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, fontStyle: 'bold', textColor: [15, 23, 42] },
    headStyles: { fillColor: [240, 249, 255], textColor: [3, 105, 161], fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Section 2: Quadro Consolidado por Escola
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '2. CONSOLIDADO POR UNIDADE ESCOLAR (METAS, OCUPAÇÃO DE TURMAS E PENDENTES)',
    14,
    cursorY
  );
  cursorY += 3.5;

  autoTable(doc, {
    startY: cursorY,
    head: [
      [
        'Unidade SESI',
        'Matr. + Pré',
        'Meta Geral',
        '% Meta',
        'Turmas',
        'Matr. Reservada',
        'Ocup. Sala / Cap.',
        '% Ocup. Sala',
        'Renov. Portal',
        'Inscr. Online',
      ],
    ],
    body: unitSummaries.map(({ unit: u, tCount, res, ocup, cap, pctOcup, portalStudents }) => {
      const saldo = cap > 0 ? cap - ocup : null;
      return [
        `SESI ${u.goal.shortName}`,
        fmtNum(u.realTotal),
        fmtNum(u.goal.metaGeral),
        `${(u.pctGeral ?? 0).toFixed(1)}%`,
        String(tCount),
        fmtNum(res),
        `${fmtNum(ocup)} / ${cap > 0 ? fmtNum(cap) : '—'}`,
        cap > 0
          ? `${pctOcup.toFixed(1)}% (${saldo !== null && saldo >= 0 ? `${saldo} liv.` : `${Math.abs(saldo ?? 0)} exc.`})`
          : '—',
        String(portalStudents.length),
        String(u.inscricaoOnlineCount ?? 0),
      ];
    }),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [0, 159, 227], textColor: [255, 255, 255], fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right' },
      8: { halign: 'right', fontStyle: 'bold' },
      9: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Section 3: Nominal Portal Students across all units
  if (config.includePortalStudentsNominalAllUnits) {
    const allPortalRows: string[][] = [];
    for (const item of unitSummaries) {
      for (const st of item.portalStudents) {
        allPortalRows.push([
          `SESI ${item.unit.goal.shortName}`,
          String(st['RA'] ?? '-'),
          String(st['ALUNO'] ?? '-'),
          String(st['SERIE/ANO'] ?? '-'),
          String(st['TURMA'] ?? '-'),
          String(st['TURNO'] ?? st['NOMETURNO'] ?? '-'),
          String(st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-'),
        ]);
      }
    }

    if (cursorY > 170) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(91, 33, 182);
    doc.text(
      `3. RELAÇÃO NOMINAL POR ESCOLA — ALUNOS EM "RENOVAÇÃO VIA PORTAL" (${totalPortalNominal} ALUNOS PARA CONTATO DAS SECRETARIAS)`,
      14,
      cursorY
    );
    cursorY += 3.5;

    autoTable(doc, {
      startY: cursorY,
      head: [
        [
          'Unidade Escolar',
          'RA',
          'Nome do Aluno (Contato Secretaria)',
          'Série / Ano',
          'Turma',
          'Turno',
          'Data',
        ],
      ],
      body:
        allPortalRows.length > 0
          ? allPortalRows
          : [['—', '—', 'Nenhum aluno pendente em Renovação via Portal na rede.', '—', '—', '—', '—']],
      theme: 'striped',
      styles: { fontSize: 7.8, cellPadding: 2 },
      headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { fontStyle: 'bold', cellWidth: 24 },
        2: { fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  addPageFooters(doc, 'Relatório Consolidado da Rede SESI-PE');

  if (autoPrint) {
    doc.autoPrint();
  }

  const filename = 'Relatorio_Executivo_Rede_SESI_PE_2027.pdf';
  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');
  const file = new File([blob], filename, { type: 'application/pdf' });

  return {
    filename,
    blob,
    base64: dataUri,
    file,
    save: () => doc.save(filename),
  };
}

export function generateAndSaveNetworkPdf(params: {
  units: UnitProgressMetrics[];
  totals: {
    metaGeral: number;
    metaPagasTotal: number;
    realTotal: number;
    realPagasTotal: number;
    renovacaoPortalTotal: number;
    inscricaoOnlineTotal: number;
    pctGeral: number;
    pctPagasTotal: number;
    faltamParaMeta: number;
    faltamPagasParaMeta: number;
  };
  rows: TotvsStudentRow[];
  turmaCapacities: Record<string, number>;
  config: NetworkEmailReportConfig;
  autoPrint?: boolean;
}): string {
  const bundle = buildNetworkPdfBundle(params);
  bundle.save();
  return bundle.filename;
}

export async function sendPdfReportViaWhatsapp(params: {
  bundle: GeneratedPdfBundle;
  html: string;
  phoneRaw: string | undefined | null;
  reportTitle: string;
}): Promise<{ pdfUrl: string; filename: string }> {
  const { bundle, html, phoneRaw, reportTitle } = params;

  // 1. Baixa o próprio arquivo PDF de impressão no computador/celular do usuário
  bundle.save();

  // 2. Salva o mesmo PDF no servidor para gerar o link direto de abertura/download do PDF no WhatsApp
  let pdfUrl = `${window.location.origin}/api/reports/pdf/${encodeURIComponent(bundle.filename)}`;
  try {
    const res = await fetch('/api/reports/share-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: bundle.filename,
        pdfBase64: bundle.base64,
        html,
      }),
    });
    const data = await res.json();
    if (data?.ok && data.pdfPath) {
      pdfUrl = `${window.location.origin}${data.pdfPath}`;
    }
  } catch {
    // fallback para URL padrão caso offline
  }

  const nowStr = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  // 3. Mensagem enxuta contendo o link direto para o MESMO relatório PDF de impressão
  const message = [
    `📄 *${reportTitle} (Relatório Oficial de Impressão — PDF)*`,
    `Gerado em: ${nowStr}`,
    ``,
    `🖨️ *Clique no link abaixo para abrir / baixar o Relatório em PDF (mesmo relatório de impressão):*`,
    pdfUrl,
  ].join('\n');

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(pdfUrl);
    }
  } catch {
    // ignore
  }

  const cleanPhone = normalizeWhatsappPhone(phoneRaw);
  const encoded = encodeURIComponent(message);
  const waUrl =
    cleanPhone.length >= 10
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;

  const a = document.createElement('a');
  a.href = waUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return { pdfUrl, filename: bundle.filename };
}
