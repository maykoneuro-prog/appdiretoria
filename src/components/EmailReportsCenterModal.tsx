import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  Users,
  Copy,
  Check,
  Download,
  X,
  FileText,
  UserCheck,
  Printer,
  FileSpreadsheet,
  Search,
  Layers,
  Mail,
  MessageCircle,
  Phone,
  Save,
  ExternalLink,
} from 'lucide-react';
import { TotvsStudentRow } from '../types/totvs';
import { UnitProgressMetrics } from '../data/sesiGoals2027';
import {
  EmailReportsState,
  createDefaultEmailReportsState,
  buildUnitEmailReport,
  buildNetworkEmailReport,
  getPortalStudentsForUnit,
  normalizeWhatsappPhone,
  formatWhatsappPhoneDisplay,
  buildWhatsappShareUrl,
} from '../utils/emailReportBuilder';
import {
  generateAndSaveUnitPdf,
  generateAndSaveNetworkPdf,
  buildUnitPdfBundle,
  buildNetworkPdfBundle,
  sendPdfReportViaWhatsapp,
} from '../utils/pdfReportGenerator';

const LOCAL_STORAGE_REPORTS_CONFIG_KEY = 'sesi_pe_reports_whatsapp_config_2027_v1';

function mergeLoadedConfig(
  base: EmailReportsState,
  incoming: Partial<EmailReportsState> | null | undefined
): EmailReportsState {
  if (!incoming || typeof incoming !== 'object') return base;
  const mergedUnits = { ...base.units };
  if (incoming.units && typeof incoming.units === 'object') {
    for (const key of Object.keys(mergedUnits)) {
      if (incoming.units[key]) {
        mergedUnits[key] = {
          ...mergedUnits[key],
          ...incoming.units[key],
          whatsappPhone: incoming.units[key].whatsappPhone ?? mergedUnits[key].whatsappPhone ?? '',
          whatsappContactName:
            incoming.units[key].whatsappContactName ?? mergedUnits[key].whatsappContactName ?? '',
        };
      }
    }
  }
  return {
    units: mergedUnits,
    network: {
      ...base.network,
      ...(incoming.network || {}),
      whatsappPhone: incoming.network?.whatsappPhone ?? base.network.whatsappPhone ?? '',
      whatsappContactName:
        incoming.network?.whatsappContactName ?? base.network.whatsappContactName ?? '',
    },
  };
}

interface EmailReportsCenterModalProps {
  isOpen: boolean;
  initialTab?: 'unit' | 'network' | 'whatsapp_directory' | 'history';
  initialUnitId?: string | null;
  onClose: () => void;
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
    vetReservada: number;
    pctGeral: number;
    pctPagasTotal: number;
    faltamParaMeta: number;
    faltamPagasParaMeta: number;
    metaDiariaAte31Dez: number;
    metaDiariaPagasAte31Dez: number;
  };
  rows: TotvsStudentRow[];
  turmaCapacities: Record<string, number>;
}

export const EmailReportsCenterModal: React.FC<EmailReportsCenterModalProps> = ({
  isOpen,
  initialTab = 'unit',
  initialUnitId,
  onClose,
  units,
  totals,
  rows,
  turmaCapacities,
}) => {
  const [activeTab, setActiveTab] = useState<'unit' | 'network' | 'whatsapp_directory'>(
    initialTab === 'network'
      ? 'network'
      : initialTab === 'whatsapp_directory'
      ? 'whatsapp_directory'
      : 'unit'
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    initialUnitId || (units[0]?.goal.id ?? 'ibura')
  );

  const [reportConfig, setReportConfig] = useState<EmailReportsState>(() => {
    const defaults = createDefaultEmailReportsState();
    try {
      const savedRaw = localStorage.getItem(LOCAL_STORAGE_REPORTS_CONFIG_KEY);
      if (savedRaw) {
        return mergeLoadedConfig(defaults, JSON.parse(savedRaw));
      }
    } catch {
      // ignore localStorage errors
    }
    return defaults;
  });

  const [unitViewMode, setUnitViewMode] = useState<'report_preview' | 'portal_list'>(
    'report_preview'
  );
  const [networkViewMode, setNetworkViewMode] = useState<'report_preview' | 'portal_list'>(
    'report_preview'
  );
  const [portalSearch, setPortalSearch] = useState('');
  const [copiedRichHtml, setCopiedRichHtml] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const unitIframeRef = useRef<HTMLIFrameElement | null>(null);
  const networkIframeRef = useRef<HTMLIFrameElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega configurações salvas no backend ao montar
  useEffect(() => {
    let cancelled = false;
    fetch('/api/email-reports-config')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.config) {
          setReportConfig((prev) => {
            const merged = mergeLoadedConfig(prev, data.config);
            try {
              localStorage.setItem(LOCAL_STORAGE_REPORTS_CONFIG_KEY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }
      })
      .catch(() => {
        // ignore offline errors
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialUnitId) {
      setSelectedUnitId(initialUnitId);
    }
  }, [initialUnitId]);

  useEffect(() => {
    if (initialTab === 'network') {
      setActiveTab('network');
    } else if (initialTab === 'whatsapp_directory') {
      setActiveTab('whatsapp_directory');
    } else if (initialTab === 'unit') {
      setActiveTab('unit');
    }
  }, [initialTab]);

  const persistConfigToServerAndStorage = async (
    nextConfig: EmailReportsState,
    showNotice?: string
  ) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_REPORTS_CONFIG_KEY, JSON.stringify(nextConfig));
    } catch {
      // ignore
    }
    setSavingContacts(true);
    try {
      await fetch('/api/email-reports-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextConfig }),
      });
      if (showNotice) {
        setFeedbackMessage(showNotice);
        setTimeout(() => setFeedbackMessage(null), 3500);
      }
    } catch {
      if (showNotice) {
        setFeedbackMessage(`${showNotice} (salvo neste navegador)`);
        setTimeout(() => setFeedbackMessage(null), 3500);
      }
    } finally {
      setSavingContacts(false);
    }
  };

  const selectedUnit = useMemo(
    () => units.find((u) => u.goal.id === selectedUnitId) || units[0],
    [units, selectedUnitId]
  );

  const currentUnitConfig = useMemo(() => {
    const id = selectedUnit?.goal.id || 'ibura';
    return (
      reportConfig.units[id] || {
        unitId: id,
        unitShortName: selectedUnit?.goal.shortName || '',
        primaryEmail: '',
        ccEmails: [],
        whatsappPhone: '',
        whatsappContactName: `Secretaria / Gestão SESI ${selectedUnit?.goal.shortName || ''}`,
        enabled: false,
        frequency: 'semanal',
        sendTime: '08:00',
        dayOfWeek: 1,
        includeTurmaOccupancy: true,
        includePortalStudentsNominal: true,
        includeReservadaStudentsNominal: false,
      }
    );
  }, [reportConfig.units, selectedUnit]);

  const unitPortalStudents = useMemo(() => {
    if (!selectedUnit) return [];
    return getPortalStudentsForUnit(
      rows,
      selectedUnit.goal.totvsUnitName,
      selectedUnit.goal.shortName
    );
  }, [rows, selectedUnit]);

  const filteredUnitPortalStudents = useMemo(() => {
    const q = portalSearch.trim().toLowerCase();
    if (!q) return unitPortalStudents;
    return unitPortalStudents.filter((st) => {
      const ra = String(st['RA'] ?? '').toLowerCase();
      const nome = String(st['ALUNO'] ?? '').toLowerCase();
      const serie = String(st['SERIE/ANO'] ?? '').toLowerCase();
      const turma = String(st['TURMA'] ?? '').toLowerCase();
      return ra.includes(q) || nome.includes(q) || serie.includes(q) || turma.includes(q);
    });
  }, [unitPortalStudents, portalSearch]);

  const networkPortalByUnit = useMemo(() => {
    const q = portalSearch.trim().toLowerCase();
    return units
      .map((u) => {
        const list = getPortalStudentsForUnit(rows, u.goal.totvsUnitName, u.goal.shortName).filter(
          (st) => {
            if (!q) return true;
            const ra = String(st['RA'] ?? '').toLowerCase();
            const nome = String(st['ALUNO'] ?? '').toLowerCase();
            const serie = String(st['SERIE/ANO'] ?? '').toLowerCase();
            const turma = String(st['TURMA'] ?? '').toLowerCase();
            const esc = u.goal.shortName.toLowerCase();
            return (
              ra.includes(q) ||
              nome.includes(q) ||
              serie.includes(q) ||
              turma.includes(q) ||
              esc.includes(q)
            );
          }
        );
        return { unit: u, students: list };
      })
      .filter((item) => item.students.length > 0);
  }, [units, rows, portalSearch]);

  const builtUnitReport = useMemo(() => {
    if (!selectedUnit) return null;
    return buildUnitEmailReport({
      unit: selectedUnit,
      rows,
      turmaCapacities,
      config: currentUnitConfig,
    });
  }, [selectedUnit, rows, turmaCapacities, currentUnitConfig]);

  const builtNetworkReport = useMemo(() => {
    return buildNetworkEmailReport({
      units,
      totals,
      rows,
      turmaCapacities,
      config: reportConfig.network,
    });
  }, [units, totals, rows, turmaCapacities, reportConfig.network]);

  const configuredUnitsCount = useMemo(() => {
    return units.filter(
      (u) => normalizeWhatsappPhone(reportConfig.units[u.goal.id]?.whatsappPhone).length >= 10
    ).length;
  }, [units, reportConfig.units]);

  if (!isOpen || !selectedUnit) return null;

  const updateUnitConfigById = (
    unitId: string,
    shortName: string,
    patch: Partial<typeof currentUnitConfig>
  ) => {
    setReportConfig((prev) => {
      const existing = prev.units[unitId] || {
        unitId,
        unitShortName: shortName,
        primaryEmail: '',
        ccEmails: [],
        whatsappPhone: '',
        whatsappContactName: `Secretaria / Gestão SESI ${shortName}`,
        enabled: false,
        frequency: 'semanal',
        sendTime: '08:00',
        dayOfWeek: 1,
        includeTurmaOccupancy: true,
        includePortalStudentsNominal: true,
        includeReservadaStudentsNominal: false,
      };
      const next: EmailReportsState = {
        ...prev,
        units: {
          ...prev.units,
          [unitId]: {
            ...existing,
            ...patch,
          },
        },
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_REPORTS_CONFIG_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const updateCurrentUnitConfig = (patch: Partial<typeof currentUnitConfig>) => {
    updateUnitConfigById(selectedUnit.goal.id, selectedUnit.goal.shortName, patch);
  };

  const updateNetworkConfig = (patch: Partial<typeof reportConfig.network>) => {
    setReportConfig((prev) => {
      const next: EmailReportsState = {
        ...prev,
        network: {
          ...prev.network,
          ...patch,
        },
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_REPORTS_CONFIG_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSendUnitWhatsapp = async (targetUnit: UnitProgressMetrics) => {
    const uCfg = reportConfig.units[targetUnit.goal.id] || currentUnitConfig;
    const report = buildUnitEmailReport({
      unit: targetUnit,
      rows,
      turmaCapacities,
      config: uCfg,
    });
    const pdfBundle = buildUnitPdfBundle({
      unit: targetUnit,
      rows,
      turmaCapacities,
      config: uCfg,
      autoPrint: false,
    });
    persistConfigToServerAndStorage(reportConfig);
    const { filename } = await sendPdfReportViaWhatsapp({
      bundle: pdfBundle,
      html: report.html,
      phoneRaw: uCfg.whatsappPhone,
      reportTitle: `Relatório da Unidade — Escola SESI ${targetUnit.goal.shortName}`,
    });
    const formattedPhone = formatWhatsappPhoneDisplay(uCfg.whatsappPhone);
    setFeedbackMessage(
      `PDF de impressão "${filename}" gerado! Abrindo WhatsApp${
        formattedPhone ? ` (${formattedPhone})` : ''
      } com o link direto do PDF e arquivo baixado para anexar.`
    );
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleSendNetworkWhatsapp = async () => {
    const pdfBundle = buildNetworkPdfBundle({
      units,
      totals,
      rows,
      turmaCapacities,
      config: reportConfig.network,
      autoPrint: false,
    });
    persistConfigToServerAndStorage(reportConfig);
    const { filename } = await sendPdfReportViaWhatsapp({
      bundle: pdfBundle,
      html: builtNetworkReport.html,
      phoneRaw: reportConfig.network.whatsappPhone,
      reportTitle: 'Relatório Executivo Consolidado — Rede SESI-PE 2027',
    });
    const formattedPhone = formatWhatsappPhoneDisplay(reportConfig.network.whatsappPhone);
    setFeedbackMessage(
      `PDF de impressão da Rede "${filename}" gerado! Abrindo WhatsApp${
        formattedPhone ? ` (${formattedPhone})` : ''
      } com o link direto do PDF e arquivo baixado para anexar.`
    );
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleDownloadHtmlReport = (filename: string, html: string) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedbackMessage(`Arquivo "${filename}" salvo com sucesso!`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleSaveAndPrintUnitPdf = () => {
    try {
      const filename = generateAndSaveUnitPdf({
        unit: selectedUnit,
        rows,
        turmaCapacities,
        config: currentUnitConfig,
        autoPrint: true,
      });
      try {
        unitIframeRef.current?.contentWindow?.focus();
        unitIframeRef.current?.contentWindow?.print();
      } catch {
        // Ignore if sandboxed iframe blocks native print dialog
      }
      setFeedbackMessage(
        `Relatório em PDF "${filename}" gerado e baixado com sucesso (pronto para impressão)!`
      );
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch {
      setFeedbackMessage('Não foi possível gerar o PDF da unidade.');
    }
  };

  const handleSaveAndPrintNetworkPdf = () => {
    try {
      const filename = generateAndSaveNetworkPdf({
        units,
        totals,
        rows,
        turmaCapacities,
        config: reportConfig.network,
        autoPrint: true,
      });
      try {
        networkIframeRef.current?.contentWindow?.focus();
        networkIframeRef.current?.contentWindow?.print();
      } catch {
        // Ignore if sandboxed iframe blocks native print dialog
      }
      setFeedbackMessage(
        `Relatório em PDF da Rede "${filename}" gerado e baixado com sucesso (pronto para impressão)!`
      );
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch {
      setFeedbackMessage('Não foi possível gerar o PDF consolidado da rede.');
    }
  };

  const handleCopyFormattedReport = async (html: string, plainText: string) => {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const htmlBlob = new Blob([html], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      setCopiedRichHtml(true);
      setFeedbackMessage(
        'Relatório formatado copiado! Você pode colar (Ctrl+V) no WhatsApp, Word, Teams ou onde preferir.'
      );
      setTimeout(() => {
        setCopiedRichHtml(false);
        setFeedbackMessage(null);
      }, 3500);
    } catch {
      setFeedbackMessage('Não foi possível copiar automaticamente.');
    }
  };

  const handleDownloadUnitCsv = () => {
    const csvCell = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push(
      [
        csvCell(`RELATORIO DA UNIDADE ESCOLA SESI ${selectedUnit.goal.shortName.toUpperCase()}`),
        csvCell(`Gerado em ${new Date().toLocaleString('pt-BR')}`),
      ].join(';')
    );
    lines.push('');

    lines.push(csvCell('1. RESUMO DE METAS E MATRICULAS 2027'));
    lines.push(
      ['Indicador', 'Realizado', 'Meta 2027', '% Atingido', 'Saldo Restante']
        .map(csvCell)
        .join(';')
    );
    lines.push(
      [
        'Matriculados + Pre-Matriculados (Meta Geral)',
        selectedUnit.realTotal,
        selectedUnit.goal.metaGeral,
        `${selectedUnit.pctGeral.toFixed(1)}%`,
        selectedUnit.faltamParaMeta,
      ]
        .map(csvCell)
        .join(';')
    );
    lines.push(
      [
        'Meta Escala Pagas',
        selectedUnit.realPagasTotal,
        selectedUnit.metaPagasTotal,
        `${selectedUnit.pctPagasTotal.toFixed(1)}%`,
        selectedUnit.faltamPagasParaMeta,
      ]
        .map(csvCell)
        .join(';')
    );
    lines.push(
      [
        'Pagas - Renovacoes (Veteranos)',
        selectedUnit.realPagasRenovacoes,
        selectedUnit.goal.pagasRenovacoes,
        `${selectedUnit.pctPagasRenovacoes.toFixed(1)}%`,
        Math.max(0, selectedUnit.goal.pagasRenovacoes - selectedUnit.realPagasRenovacoes),
      ]
        .map(csvCell)
        .join(';')
    );
    lines.push(
      [
        'Pagas - Novas Matriculas (Novatos)',
        selectedUnit.realPagasNovatos,
        selectedUnit.goal.pagasNovatos2027,
        `${selectedUnit.pctPagasNovatos.toFixed(1)}%`,
        Math.max(0, selectedUnit.goal.pagasNovatos2027 - selectedUnit.realPagasNovatos),
      ]
        .map(csvCell)
        .join(';')
    );
    lines.push(
      [
        'Gratuidade Remanescente (Veteranos)',
        selectedUnit.realGratuidadeRemanescente,
        selectedUnit.goal.gratuidadeRemanescente,
        `${selectedUnit.pctGratuidadeRem.toFixed(1)}%`,
        Math.max(
          0,
          selectedUnit.goal.gratuidadeRemanescente - selectedUnit.realGratuidadeRemanescente
        ),
      ]
        .map(csvCell)
        .join(';')
    );
    lines.push(
      [
        'Novas Gratuidades 2027 (Novatos)',
        selectedUnit.realNovasGratuidade,
        selectedUnit.goal.novasVagasGratuidade2027,
        `${selectedUnit.pctNovasGratuidade.toFixed(1)}%`,
        Math.max(0, selectedUnit.goal.novasVagasGratuidade2027 - selectedUnit.realNovasGratuidade),
      ]
        .map(csvCell)
        .join(';')
    );
    lines.push('');

    lines.push(csvCell('2. MAPA DE OCUPACAO DE TURMAS (COM MATRICULA RESERVADA)'));
    lines.push(
      [
        'Turma',
        'Serie / Habilitacao',
        'Turno',
        'Matriculados + Pre',
        'Matricula Reservada (Veteranos ate 31/12)',
        'Ocupacao da Sala (Matr + Reservada)',
        'MAX ALUNOS',
        'Saldo Vagas',
        '% Ocupacao',
      ]
        .map(csvCell)
        .join(';')
    );
    for (const t of selectedUnit.turmas) {
      const cap = turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0;
      if (t.ocupacaoComReservada === 0 && cap === 0) continue;
      const pct = cap > 0 ? `${((t.ocupacaoComReservada / cap) * 100).toFixed(1)}%` : '-';
      const saldo = cap > 0 ? cap - t.ocupacaoComReservada : '-';
      lines.push(
        [
          t.turmaCode,
          t.habilitacao || t.curso || '-',
          t.turno || '-',
          t.matriculadosTotal,
          t.matriculaReservada,
          t.ocupacaoComReservada,
          cap > 0 ? cap : '-',
          saldo,
          pct,
        ]
          .map(csvCell)
          .join(';')
      );
    }
    lines.push('');

    lines.push(
      csvCell(
        `3. ALUNOS EM RENOVACAO VIA PORTAL PARA CONTATO DA SECRETARIA (${unitPortalStudents.length})`
      )
    );
    lines.push(
      ['RA', 'Nome do Aluno', 'Serie / Ano', 'Turma', 'Turno', 'Situacao Matricula', 'Data']
        .map(csvCell)
        .join(';')
    );
    for (const st of unitPortalStudents) {
      lines.push(
        [
          st['RA'] ?? '-',
          st['ALUNO'] ?? '-',
          st['SERIE/ANO'] ?? '-',
          st['TURMA'] ?? '-',
          st['TURNO'] ?? st['NOMETURNO'] ?? '-',
          st['SITUACAO MATRICULA'] ?? '-',
          st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-',
        ]
          .map(csvCell)
          .join(';')
      );
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `Relatorio_SESI_${selectedUnit.goal.shortName}_2027.csv`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedbackMessage(`Planilha "${filename}" baixada com sucesso!`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleDownloadNetworkCsv = () => {
    const csvCell = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push(
      [
        csvCell('RELATORIO EXECUTIVO CONSOLIDADO DA REDE SESI-PE - MATRICULAS 2027'),
        csvCell(`Gerado em ${new Date().toLocaleString('pt-BR')}`),
      ].join(';')
    );
    lines.push('');

    lines.push(csvCell('1. CONSOLIDADO POR UNIDADE ESCOLAR (12 ESCOLAS)'));
    lines.push(
      [
        'Unidade SESI',
        'Matriculados + Pre',
        'Meta Geral 2027',
        '% Meta Geral',
        'Pagas Realizado',
        'Meta Pagas',
        '% Pagas',
        'Turmas Ativas',
        'Matricula Reservada (Veteranos)',
        'Ocupacao Sala (Matr + Reservada)',
        'Capacidade MAX ALUNOS',
        '% Ocupacao Sala',
        'Renovacao via Portal',
        'Inscricao Online',
      ]
        .map(csvCell)
        .join(';')
    );

    for (const u of units) {
      const activeTurmas = u.turmas.filter(
        (t) => t.ocupacaoComReservada > 0 || (turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0) > 0
      );
      const res = activeTurmas.reduce((acc, t) => acc + t.matriculaReservada, 0);
      const ocup = activeTurmas.reduce((acc, t) => acc + t.ocupacaoComReservada, 0);
      const cap = activeTurmas.reduce(
        (acc, t) => acc + (turmaCapacities[t.turmaKey] || t.maxAlunosSql || 0),
        0
      );
      const pctOcup = cap > 0 ? `${((ocup / cap) * 100).toFixed(1)}%` : '-';

      lines.push(
        [
          `SESI ${u.goal.shortName}`,
          u.realTotal,
          u.goal.metaGeral,
          `${u.pctGeral.toFixed(1)}%`,
          u.realPagasTotal,
          u.metaPagasTotal,
          `${u.pctPagasTotal.toFixed(1)}%`,
          activeTurmas.length,
          res,
          ocup,
          cap,
          pctOcup,
          u.renovacaoPortalCount,
          u.inscricaoOnlineCount,
        ]
          .map(csvCell)
          .join(';')
      );
    }
    lines.push('');

    lines.push(
      csvCell(
        `2. RELACAO NOMINAL DE TODOS OS ALUNOS EM RENOVACAO VIA PORTAL DA REDE (${builtNetworkReport.totalPortalStudents} ALUNOS)`
      )
    );
    lines.push(
      [
        'Unidade SESI',
        'RA',
        'Nome do Aluno',
        'Serie / Ano',
        'Turma',
        'Turno',
        'Situacao Matricula',
        'Data',
      ]
        .map(csvCell)
        .join(';')
    );

    for (const u of units) {
      const pList = getPortalStudentsForUnit(rows, u.goal.totvsUnitName, u.goal.shortName);
      for (const st of pList) {
        lines.push(
          [
            `SESI ${u.goal.shortName}`,
            st['RA'] ?? '-',
            st['ALUNO'] ?? '-',
            st['SERIE/ANO'] ?? '-',
            st['TURMA'] ?? '-',
            st['TURNO'] ?? st['NOMETURNO'] ?? '-',
            st['SITUACAO MATRICULA'] ?? '-',
            st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-',
          ]
            .map(csvCell)
            .join(';')
        );
      }
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = 'Relatorio_Rede_SESI_PE_2027.csv';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedbackMessage(`Planilha "${filename}" baixada com sucesso!`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const currentUnitFormattedPhone = formatWhatsappPhoneDisplay(currentUnitConfig.whatsappPhone);
  const networkFormattedPhone = formatWhatsappPhoneDisplay(reportConfig.network.whatsappPhone);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[93vh] flex flex-col rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] p-6 shadow-2xl space-y-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-extrabold text-[#009FE3] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Central de Relatórios — WhatsApp, PDF e Exportação (Unidades & Rede SESI-PE)
            </span>
            <h3 className="text-lg font-extrabold text-slate-900">
              Ocupação de Turmas (com Matrícula Reservada), Metas e Lista Nominal de Renovação via Portal
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('unit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                  activeTab === 'unit'
                    ? 'bg-[#009FE3] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Relatório por Unidade
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('network')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                  activeTab === 'network'
                    ? 'bg-[#009FE3] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Relatório da Rede ({builtNetworkReport.totalPortalStudents} no Portal)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp_directory')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                  activeTab === 'whatsapp_directory'
                    ? 'bg-[#25D366] text-white shadow-xs'
                    : 'text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Cadastrar WhatsApp das Unidades ({configuredUnitsCount}/12)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackMessage && (
          <div className="px-4 py-2.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              {feedbackMessage}
            </span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ABA 1: RELATÓRIO POR UNIDADE */}
        {activeTab === 'unit' && builtUnitReport && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Coluna Esquerda: Seleção da Unidade, WhatsApp da Unidade, Seções e Botões */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                      Selecionar Unidade Escolar SESI-PE
                    </label>
                    <select
                      value={selectedUnit.goal.id}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-extrabold text-slate-900 bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-[#009FE3]"
                    >
                      {units.map((u) => {
                        const hasWa =
                          normalizeWhatsappPhone(reportConfig.units[u.goal.id]?.whatsappPhone)
                            .length >= 10;
                        return (
                          <option key={u.goal.id} value={u.goal.id}>
                            Escola SESI {u.goal.shortName} — {u.realTotal}/{u.goal.metaGeral} matr. (
                            {u.pctGeral.toFixed(1)}%) · {u.renovacaoPortalCount} Portal
                            {hasWa ? ' · 📱 WhatsApp OK' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* CADASTRO DO NÚMERO DE WHATSAPP DA UNIDADE SELECIONADA */}
                  <div className="rounded-xl bg-emerald-50/90 border-2 border-emerald-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-emerald-900 uppercase flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                        WhatsApp — SESI {selectedUnit.goal.shortName}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('whatsapp_directory')}
                        className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
                      >
                        Cadastrar todas as 12 unidades →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-7">
                        <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                          Número WhatsApp (com DDD)
                        </label>
                        <input
                          ref={phoneInputRef}
                          type="tel"
                          placeholder="Ex: (81) 99999-9999"
                          value={currentUnitConfig.whatsappPhone || ''}
                          onChange={(e) =>
                            updateCurrentUnitConfig({ whatsappPhone: e.target.value })
                          }
                          onBlur={() => persistConfigToServerAndStorage(reportConfig)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                          Responsável / Setor
                        </label>
                        <input
                          type="text"
                          placeholder="Secretaria / Gestão"
                          value={currentUnitConfig.whatsappContactName || ''}
                          onChange={(e) =>
                            updateCurrentUnitConfig({ whatsappContactName: e.target.value })
                          }
                          onBlur={() => persistConfigToServerAndStorage(reportConfig)}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] text-emerald-800 font-medium">
                        {currentUnitFormattedPhone ? (
                          <>
                            Número ativo: <strong>{currentUnitFormattedPhone}</strong>
                          </>
                        ) : (
                          'Digite o celular da unidade e clique em Salvar.'
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={savingContacts}
                        onClick={() =>
                          persistConfigToServerAndStorage(
                            reportConfig,
                            `Número de WhatsApp da unidade SESI ${selectedUnit.goal.shortName} salvo com sucesso!`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-extrabold transition-colors cursor-pointer shrink-0"
                      >
                        <Save className="w-3 h-3" />
                        Salvar Número
                      </button>
                    </div>
                  </div>

                  {/* Resumo Rápido da Unidade Selecionada */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white border border-slate-200 p-2.5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        Matriculados + Pré
                      </div>
                      <div className="text-base font-extrabold text-slate-900 font-mono">
                        {selectedUnit.realTotal}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          / {selectedUnit.goal.metaGeral}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-[#009FE3]">
                        {selectedUnit.pctGeral.toFixed(1)}% da meta
                      </div>
                    </div>

                    <div className="rounded-xl bg-violet-50 border border-violet-200 p-2.5">
                      <div className="text-[10px] font-bold text-violet-700 uppercase">
                        Renovação Portal
                      </div>
                      <div className="text-base font-extrabold text-violet-950 font-mono">
                        {unitPortalStudents.length}
                      </div>
                      <div className="text-[10px] font-bold text-violet-700">
                        Para contato da secretaria
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5">
                      <div className="text-[10px] font-bold text-amber-800 uppercase">
                        Matr. Reservada
                      </div>
                      <div className="text-base font-extrabold text-amber-950 font-mono">
                        {selectedUnit.vetReservada}
                      </div>
                      <div className="text-[10px] font-bold text-amber-700">
                        Compõe sala até 31/12
                      </div>
                    </div>

                    <div className="rounded-xl bg-sky-50 border border-sky-200 p-2.5">
                      <div className="text-[10px] font-bold text-sky-800 uppercase">
                        Ocupação de Sala
                      </div>
                      <div className="text-base font-extrabold text-sky-950 font-mono">
                        {selectedUnit.turmasOcupacaoComReservadaTotal}{' '}
                        <span className="text-xs font-normal text-sky-700">
                          / {selectedUnit.turmasMaxAlunosTotal || '—'}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-sky-700">
                        {selectedUnit.pctOcupacaoTurmas.toFixed(1)}% ocupado
                      </div>
                    </div>
                  </div>

                  {/* Personalizar Conteúdo do Relatório */}
                  <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1.5">
                    <div className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#009FE3]" />
                      Seções Incluídas no Relatório:
                    </div>

                    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={currentUnitConfig.includeTurmaOccupancy}
                        onChange={(e) =>
                          updateCurrentUnitConfig({ includeTurmaOccupancy: e.target.checked })
                        }
                        className="mt-0.5 accent-[#009FE3]"
                      />
                      <span>
                        <strong>Mapa de Ocupação de Turmas</strong> (Matriculados + Matrícula
                        Reservada vs MAX ALUNOS)
                      </span>
                    </label>

                    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentUnitConfig.includePortalStudentsNominal}
                        onChange={(e) =>
                          updateCurrentUnitConfig({
                            includePortalStudentsNominal: e.target.checked,
                          })
                        }
                        className="mt-0.5 accent-[#009FE3]"
                      />
                      <span className="text-violet-950">
                        <strong>Lista Nominal — Renovação via Portal</strong> (identifica quem é o
                        aluno para a secretaria entrar em contato)
                      </span>
                    </label>

                    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentUnitConfig.includeReservadaStudentsNominal}
                        onChange={(e) =>
                          updateCurrentUnitConfig({
                            includeReservadaStudentsNominal: e.target.checked,
                          })
                        }
                        className="mt-0.5 accent-[#009FE3]"
                      />
                      <span>
                        Incluir também lista nominal de veteranos com{' '}
                        <strong>Matrícula Reservada</strong>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Botões de Enviar WhatsApp / Salvar / Imprimir / Exportar */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSendUnitWhatsapp(selectedUnit)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs border-b-4 border-emerald-700"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      Enviar Relatório (PDF de Impressão) por WhatsApp{' '}
                      {currentUnitFormattedPhone
                        ? `· ${currentUnitFormattedPhone}`
                        : `(${selectedUnit.goal.shortName})`}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-90" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAndPrintUnitPdf}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    Baixar PDF / Imprimir Relatório ({selectedUnit.goal.shortName})
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadHtmlReport(
                          `Relatorio_SESI_${selectedUnit.goal.shortName}_2027.html`,
                          builtUnitReport.html
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Salvar .HTML
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadUnitCsv}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Salvar .CSV (Excel)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyFormattedReport(builtUnitReport.html, builtUnitReport.whatsappText)
                    }
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copiedRichHtml ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copiar Texto Formatado p/ WhatsApp ou E-mail
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Visualização do Relatório ou Lista Nominal de Alunos no Portal */}
              <div className="lg:col-span-8 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setUnitViewMode('report_preview')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                        unitViewMode === 'report_preview'
                          ? 'bg-[#009FE3] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Visualizar Relatório Completo
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitViewMode('portal_list')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                        unitViewMode === 'portal_list'
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Alunos em Renovação via Portal ({unitPortalStudents.length})
                    </button>
                  </div>

                  {unitViewMode === 'portal_list' && (
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar aluno, RA, série ou turma..."
                        value={portalSearch}
                        onChange={(e) => setPortalSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  )}
                </div>

                {unitViewMode === 'report_preview' ? (
                  <div className="p-3 bg-slate-100 flex-1">
                    <iframe
                      ref={unitIframeRef}
                      title="Visualização do Relatório da Unidade"
                      srcDoc={builtUnitReport.html}
                      className="w-full h-[540px] bg-white rounded-xl border border-slate-200 shadow-xs"
                    />
                  </div>
                ) : (
                  <div className="p-4 space-y-3 overflow-y-auto max-h-[555px]">
                    <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-xs text-violet-950 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>
                          Lista de Ação para a Secretaria Escolar (SESI{' '}
                          {selectedUnit.goal.shortName}):
                        </strong>{' '}
                        Estes <strong>{filteredUnitPortalStudents.length} aluno(s)</strong> estão
                        com status de <strong>Renovação via Portal</strong> para a secretaria entrar
                        em contato e efetivar a matrícula.
                      </div>
                    </div>

                    {filteredUnitPortalStudents.length === 0 ? (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-8 text-center text-xs text-slate-500">
                        Nenhum aluno encontrado com status &ldquo;Renovação via Portal&rdquo; nesta
                        unidade.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-violet-100/80 text-violet-950 border-b border-violet-200 font-bold">
                              <th className="py-2 px-3">RA</th>
                              <th className="py-2 px-3">Nome do Aluno (Contato Secretaria)</th>
                              <th className="py-2 px-3">Série / Ano</th>
                              <th className="py-2 px-3">Turma</th>
                              <th className="py-2 px-3">Turno</th>
                              <th className="py-2 px-3">Data</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {filteredUnitPortalStudents.map((st, idx) => (
                              <tr key={`${st.RA}-${idx}`} className="hover:bg-violet-50/50">
                                <td className="py-2 px-3 font-bold text-slate-700">
                                  {String(st['RA'] ?? '-')}
                                </td>
                                <td className="py-2 px-3 font-sans font-extrabold text-slate-900">
                                  {String(st['ALUNO'] ?? '-')}
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-700">
                                  {String(st['SERIE/ANO'] ?? '-')}
                                </td>
                                <td className="py-2 px-3 font-bold text-[#009FE3]">
                                  {String(st['TURMA'] ?? '-')}
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-600">
                                  {String(st['TURNO'] ?? st['NOMETURNO'] ?? '-')}
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  {String(st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: RELATÓRIO CONSOLIDADO DE TODA A REDE */}
        {activeTab === 'network' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Coluna Esquerda: Resumo da Rede, WhatsApp da Rede, Opções e Botões */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Relatório Consolidado de Toda a Rede SESI-PE
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Reúne os principais insights estratégicos das 12 unidades: metas, ocupação de
                      turmas (com matrícula reservada), pendentes e a relação nominal de todos os
                      alunos em Renovação via Portal por escola.
                    </p>
                  </div>

                  {/* Cadastro de WhatsApp da Rede / Coordenação */}
                  <div className="rounded-xl bg-emerald-50/90 border-2 border-emerald-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-emerald-900 uppercase flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                        WhatsApp — Coordenação / Rede
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('whatsapp_directory')}
                        className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
                      >
                        Ver WhatsApp das 12 Escolas →
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="tel"
                        placeholder="Ex: (81) 99999-9999"
                        value={reportConfig.network.whatsappPhone || ''}
                        onChange={(e) => updateNetworkConfig({ whatsappPhone: e.target.value })}
                        onBlur={() => persistConfigToServerAndStorage(reportConfig)}
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        disabled={savingContacts}
                        onClick={() =>
                          persistConfigToServerAndStorage(
                            reportConfig,
                            'Número de WhatsApp da Rede SESI-PE salvo com sucesso!'
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold transition-colors cursor-pointer shrink-0"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Salvar
                      </button>
                    </div>
                  </div>

                  {/* Cards de Resumo da Rede */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white border border-slate-200 p-2.5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        Matriculados Rede
                      </div>
                      <div className="text-base font-extrabold text-slate-900 font-mono">
                        {totals.realTotal.toLocaleString('pt-BR')}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          / {totals.metaGeral.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-emerald-700">
                        {totals.pctGeral.toFixed(1)}% atingido
                      </div>
                    </div>

                    <div className="rounded-xl bg-violet-50 border border-violet-200 p-2.5">
                      <div className="text-[10px] font-bold text-violet-700 uppercase">
                        Renovação Portal (Rede)
                      </div>
                      <div className="text-base font-extrabold text-violet-950 font-mono">
                        {builtNetworkReport.totalPortalStudents.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] font-bold text-violet-700">
                        Nominados por escola
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5">
                      <div className="text-[10px] font-bold text-amber-800 uppercase">
                        Matr. Reservada (Rede)
                      </div>
                      <div className="text-base font-extrabold text-amber-950 font-mono">
                        {totals.vetReservada.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] font-bold text-amber-700">
                        Veteranos até 31/12
                      </div>
                    </div>

                    <div className="rounded-xl bg-teal-50 border border-teal-200 p-2.5">
                      <div className="text-[10px] font-bold text-teal-800 uppercase">
                        Inscrição Online
                      </div>
                      <div className="text-base font-extrabold text-teal-950 font-mono">
                        {(totals.inscricaoOnlineTotal ?? 0).toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] font-bold text-teal-700">
                        Novatos em inscrição
                      </div>
                    </div>
                  </div>

                  {/* Opções de Conteúdo da Rede */}
                  <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
                    <div className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#009FE3]" />
                      Seções do Relatório da Rede:
                    </div>

                    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={reportConfig.network.includePortalStudentsNominalAllUnits}
                        onChange={(e) =>
                          updateNetworkConfig({
                            includePortalStudentsNominalAllUnits: e.target.checked,
                          })
                        }
                        className="mt-0.5 accent-[#009FE3]"
                      />
                      <span className="text-violet-950">
                        Incluir relação nominal de todos os alunos em{' '}
                        <strong>Renovação via Portal</strong> agrupada por escola (
                        {builtNetworkReport.totalPortalStudents} alunos)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Botões de Enviar WhatsApp / Salvar / Imprimir / Exportar da Rede */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleSendNetworkWhatsapp}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs border-b-4 border-emerald-700"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      Enviar Relatório (PDF de Impressão) por WhatsApp
                      {networkFormattedPhone ? ` · ${networkFormattedPhone}` : ''}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-90" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAndPrintNetworkPdf}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#009FE3] hover:bg-sky-600 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    Baixar PDF / Imprimir Relatório (Rede Completa)
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadHtmlReport(
                          'Relatorio_Executivo_Rede_SESI_PE_2027.html',
                          builtNetworkReport.html
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Salvar .HTML
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadNetworkCsv}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Salvar .CSV (Excel)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyFormattedReport(
                        builtNetworkReport.html,
                        builtNetworkReport.whatsappText
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copiedRichHtml ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copiar Texto da Rede p/ WhatsApp ou E-mail
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Visualização do Relatório da Rede ou Lista Nominal */}
              <div className="lg:col-span-8 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setNetworkViewMode('report_preview')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                        networkViewMode === 'report_preview'
                          ? 'bg-[#009FE3] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Visualizar Relatório da Rede
                    </button>
                    <button
                      type="button"
                      onClick={() => setNetworkViewMode('portal_list')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                        networkViewMode === 'portal_list'
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Lista Nominal no Portal por Escola ({builtNetworkReport.totalPortalStudents})
                    </button>
                  </div>

                  {networkViewMode === 'portal_list' && (
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filtrar escola, aluno, RA ou turma..."
                        value={portalSearch}
                        onChange={(e) => setPortalSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  )}
                </div>

                {networkViewMode === 'report_preview' ? (
                  <div className="p-3 bg-slate-100 flex-1">
                    <iframe
                      ref={networkIframeRef}
                      title="Visualização do Relatório Consolidado da Rede"
                      srcDoc={builtNetworkReport.html}
                      className="w-full h-[540px] bg-white rounded-xl border border-slate-200 shadow-xs"
                    />
                  </div>
                ) : (
                  <div className="p-4 space-y-4 overflow-y-auto max-h-[555px]">
                    {networkPortalByUnit.length === 0 ? (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-8 text-center text-xs text-slate-500">
                        Nenhum aluno encontrado com status &ldquo;Renovação via Portal&rdquo;.
                      </div>
                    ) : (
                      networkPortalByUnit.map(({ unit: u, students }) => (
                        <div
                          key={u.goal.id}
                          className="rounded-xl border border-violet-200 overflow-hidden"
                        >
                          <div className="bg-violet-100/80 px-3.5 py-2 flex items-center justify-between text-xs font-extrabold text-violet-950 border-b border-violet-200">
                            <span>
                              Escola SESI {u.goal.shortName} — {students.length} aluno(s) em
                              Renovação via Portal
                            </span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleSendUnitWhatsapp(u)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[11px] font-extrabold cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" />
                                Enviar WhatsApp ({u.goal.shortName})
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUnitId(u.goal.id);
                                  setActiveTab('unit');
                                  setUnitViewMode('portal_list');
                                }}
                                className="text-[11px] font-bold text-violet-700 hover:underline cursor-pointer"
                              >
                                Abrir Relatório da Unidade →
                              </button>
                            </div>
                          </div>
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                                <th className="py-1.5 px-3">RA</th>
                                <th className="py-1.5 px-3">Nome do Aluno</th>
                                <th className="py-1.5 px-3">Série / Ano</th>
                                <th className="py-1.5 px-3">Turma</th>
                                <th className="py-1.5 px-3">Turno</th>
                                <th className="py-1.5 px-3">Data</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {students.map((st, idx) => (
                                <tr key={`${st.RA}-${idx}`} className="hover:bg-violet-50/40">
                                  <td className="py-1.5 px-3 font-bold text-slate-700">
                                    {String(st['RA'] ?? '-')}
                                  </td>
                                  <td className="py-1.5 px-3 font-sans font-extrabold text-slate-900">
                                    {String(st['ALUNO'] ?? '-')}
                                  </td>
                                  <td className="py-1.5 px-3 font-sans text-slate-700">
                                    {String(st['SERIE/ANO'] ?? '-')}
                                  </td>
                                  <td className="py-1.5 px-3 font-bold text-[#009FE3]">
                                    {String(st['TURMA'] ?? '-')}
                                  </td>
                                  <td className="py-1.5 px-3 font-sans text-slate-600">
                                    {String(st['TURNO'] ?? st['NOMETURNO'] ?? '-')}
                                  </td>
                                  <td className="py-1.5 px-3 text-slate-500">
                                    {String(st['DT MATRICULA'] ?? st['DT ALTERACAO'] ?? '-')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: CADASTRO DE WHATSAPP DAS 12 UNIDADES & DISPARO DIRETO */}
        {activeTab === 'whatsapp_directory' && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="rounded-2xl bg-emerald-50/80 border-2 border-emerald-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h4 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  Cadastro de Números de WhatsApp por Unidade Escolar SESI-PE (12 Escolas)
                </h4>
                <p className="text-xs text-emerald-800">
                  Cadastre abaixo o número de WhatsApp (com DDD, ex: <strong>(81) 99999-9999</strong>)
                  de cada escola. Os números ficam salvos automaticamente e permitem enviar o
                  relatório completo da unidade com 1 clique.
                </p>
              </div>

              <button
                type="button"
                disabled={savingContacts}
                onClick={() =>
                  persistConfigToServerAndStorage(
                    reportConfig,
                    'Todos os números de WhatsApp das unidades foram salvos com sucesso!'
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4" />
                Salvar Todos os Números ({configuredUnitsCount}/12 cadastrados)
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-extrabold">
                    <th className="py-2.5 px-3">Unidade Escolar SESI-PE</th>
                    <th className="py-2.5 px-3 text-center">Matr. / Meta</th>
                    <th className="py-2.5 px-3 text-center">Renov. Portal</th>
                    <th className="py-2.5 px-3">Responsável / Secretaria</th>
                    <th className="py-2.5 px-3">Número do WhatsApp (com DDD)</th>
                    <th className="py-2.5 px-3 text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {units.map((u) => {
                    const cfg = reportConfig.units[u.goal.id] || {
                      unitId: u.goal.id,
                      unitShortName: u.goal.shortName,
                      primaryEmail: '',
                      ccEmails: [],
                      whatsappPhone: '',
                      whatsappContactName: `Secretaria / Gestão SESI ${u.goal.shortName}`,
                      enabled: false,
                      frequency: 'semanal' as const,
                      sendTime: '08:00',
                      dayOfWeek: 1,
                      includeTurmaOccupancy: true,
                      includePortalStudentsNominal: true,
                      includeReservadaStudentsNominal: false,
                    };
                    const cleanDigits = normalizeWhatsappPhone(cfg.whatsappPhone);
                    const isConfigured = cleanDigits.length >= 10;

                    return (
                      <tr key={u.goal.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3">
                          <div className="font-extrabold text-slate-900">
                            Escola SESI {u.goal.shortName}
                          </div>
                          <div className="text-[10px] text-slate-500">{u.goal.totvsUnitName}</div>
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="font-extrabold text-slate-900">{u.realTotal}</span>
                          <span className="text-slate-400"> / {u.goal.metaGeral}</span>
                          <div className="text-[10px] font-bold text-[#009FE3]">
                            {u.pctGeral.toFixed(1)}%
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-violet-100 text-violet-900 font-extrabold text-xs">
                            {u.renovacaoPortalCount}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder={`Secretaria SESI ${u.goal.shortName}`}
                            value={cfg.whatsappContactName || ''}
                            onChange={(e) =>
                              updateUnitConfigById(u.goal.id, u.goal.shortName, {
                                whatsappContactName: e.target.value,
                              })
                            }
                            onBlur={() => persistConfigToServerAndStorage(reportConfig)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#009FE3]"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="tel"
                              placeholder="(81) 99999-9999"
                              value={cfg.whatsappPhone || ''}
                              onChange={(e) =>
                                updateUnitConfigById(u.goal.id, u.goal.shortName, {
                                  whatsappPhone: e.target.value,
                                })
                              }
                              onBlur={() => persistConfigToServerAndStorage(reportConfig)}
                              className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border focus:outline-none ${
                                isConfigured
                                  ? 'bg-emerald-50/60 border-emerald-400 text-emerald-950 focus:border-emerald-600'
                                  : 'bg-white border-slate-300 text-slate-900 focus:border-[#009FE3]'
                              }`}
                            />
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSendUnitWhatsapp(u)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-extrabold transition-colors cursor-pointer shadow-xs"
                              title={
                                isConfigured
                                  ? `Enviar relatório de SESI ${u.goal.shortName} para ${formatWhatsappPhoneDisplay(cfg.whatsappPhone)}`
                                  : `Enviar relatório de SESI ${u.goal.shortName} via WhatsApp`
                              }
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              Enviar WhatsApp
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUnitId(u.goal.id);
                                setActiveTab('unit');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                              title="Ver relatório completo desta unidade"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Ver
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
