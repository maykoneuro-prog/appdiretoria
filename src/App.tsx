/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Download,
  SlidersHorizontal,
  Edit3,
  Trash2,
  Copy,
  Check,
  ArrowUpDown,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import {
  TotvsStudentRow,
  TotvsQueryParams,
  TOTVS_FIELDS,
  FIELD_GROUPS,
  FieldGroup,
} from './types/totvs';
import {
  INITIAL_TOTVS_ROWS,
  DEFAULT_TOTVS_PARAMS,
} from './data/initialTotvsData';
import {
  formatToTotvsJson,
  formatToCsv,
  normalizeTotvsRow,
} from './utils/totvsParser';
import { RecordEditorDrawer } from './components/RecordEditorDrawer';
import { TotvsConnectionModal } from './components/TotvsConnectionModal';
import { BulkManipulateModal } from './components/BulkManipulateModal';
import { GamerEnrollmentDashboard } from './components/GamerEnrollmentDashboard';
import {
  useAccessControlAuth,
  AuthLoginAndPendingScreen,
  AdminAccessControlModal,
} from './components/AuthGateAndApprovalModal';
import {
  SESI_PE_GOALS_2027,
  UnitGoal2027,
  computeNetworkMetrics2027,
} from './data/sesiGoals2027';

type ColumnPreset = 'default' | FieldGroup | 'all';

export default function App() {
  const isTvUrlMode = useMemo(() => {
    try {
      return (
        new URLSearchParams(window.location.search).get('tv') === '1' ||
        window.location.hostname.endsWith('.trycloudflare.com')
      );
    } catch {
      return false;
    }
  }, []);

  const [tvBypassAuth, setTvBypassAuth] = useState<boolean>(isTvUrlMode);
  const [accessModalOpen, setAccessModalOpen] = useState<boolean>(false);

  const {
    firebaseUser,
    authReady,
    accessRecord,
    allRecords,
    isAdmin,
    authError,
    signingIn,
    handleGoogleLogin,
    handleLogout,
    handleAdminDecision,
    syncUserAccessState,
  } = useAccessControlAuth(tvBypassAuth);

  const pendingApprovalsCount = useMemo(
    () => allRecords.filter((r) => r.status === 'pending').length,
    [allRecords]
  );

  // Aba ativa: 'dashboard' (Gestão à Vista Gamer 2027) ou 'grid' (Manipulador SQL)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'grid'>('dashboard');
  const [dashboardViewRequest, setDashboardViewRequest] = useState<{
    view: 'arena' | 'planilha' | 'ambos' | 'aniversariantes';
    ts: number;
  } | null>(null);
  const [unitGoals, setUnitGoals] = useState<UnitGoal2027[]>(() => {
    try {
      const saved = localStorage.getItem('sesi_pe_unit_goals_2027_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignora erro de leitura local
    }
    return SESI_PE_GOALS_2027;
  });

  // Estado principal dos registros da consulta SQL SE42018_2 Produc
  const [rows, setRows] = useState<TotvsStudentRow[]>(INITIAL_TOTVS_ROWS);
  const [queryParams, setQueryParams] = useState<TotvsQueryParams>(DEFAULT_TOTVS_PARAMS);
  const [lastSyncSource, setLastSyncSource] = useState<string>(
    'Sentença SE42018_2 Produc (CODCOLIGADA=2)'
  );

  // Filtro único principal solicitado: Período '2027' ativo por padrão
  const [periodoFilter, setPeriodoFilter] = useState<string>('2027');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Controle de colunas visíveis na grade
  const [columnPreset, setColumnPreset] = useState<ColumnPreset>('default');

  // Ordenação da grade
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'ALUNO', direction: 'asc' });

  // Seleção de linhas para manipulação em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edição inline de célula (duplo clique)
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    fieldKey: string;
    value: string;
  } | null>(null);

  // Drawer de edição completa de 57 campos
  const [drawerRow, setDrawerRow] = useState<TotvsStudentRow | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Modais de Conexão/Importação e Manipulação em Lote
  const [connectionModal, setConnectionModal] = useState<{
    open: boolean;
    mode: 'api' | 'json';
  }>({ open: false, mode: 'api' });
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);

  // Feedback visual de cópia/exportação e status de sincronização
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const [totalScannedInSql, setTotalScannedInSql] = useState<number | null>(null);
  const [nextSyncSeconds, setNextSyncSeconds] = useState<number>(3600);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
  // Escolas que receberam novas matrículas na última sincronização: { [unitId]: +delta }
  const [flashingUnits, setFlashingUnits] = useState<Record<string, number>>({});
  const prevUnitCountsRef = useRef<Record<string, number> | null>(null);
  const flashTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Paginação da tabela para suportar os 5.952 registros reais de 2027 sem travar o navegador
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 100;

  // Detecta novas matrículas por escola sempre que a base rows é atualizada
  // O contorno verde pisca por apenas 5 minutos (300.000 ms) e depois para automaticamente
  useEffect(() => {
    const { units } = computeNetworkMetrics2027(rows, unitGoals, 'efetivados');
    const currentMap: Record<string, number> = {};
    for (const u of units) {
      currentMap[u.goal.id] = u.realTotal;
    }

    if (prevUnitCountsRef.current !== null) {
      const prevMap = prevUnitCountsRef.current;
      const newFlashes: Record<string, number> = {};
      for (const u of units) {
        const prevVal = prevMap[u.goal.id] ?? u.realTotal;
        const delta = u.realTotal - prevVal;
        if (delta > 0) {
          const unitId = u.goal.id;
          newFlashes[unitId] = (flashingUnits[unitId] || 0) + delta;

          if (flashTimeoutsRef.current[unitId]) {
            clearTimeout(flashTimeoutsRef.current[unitId]);
          }
          flashTimeoutsRef.current[unitId] = setTimeout(() => {
            setFlashingUnits((prev) => {
              const next = { ...prev };
              delete next[unitId];
              return next;
            });
            delete flashTimeoutsRef.current[unitId];
          }, 5 * 60 * 1000);
        }
      }
      if (Object.keys(newFlashes).length > 0) {
        setFlashingUnits((prev) => ({ ...prev, ...newFlashes }));
      }
    }
    prevUnitCountsRef.current = currentMap;
  }, [rows, unitGoals]);

  useEffect(() => {
    return () => {
      Object.values(flashTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  const syncFromTotvsApi = useCallback(async (targetPeriodo = '2027', force = false) => {
    setIsAutoSyncing(true);
    setNextSyncSeconds(3600);
    try {
      if (isTvUrlMode && !force) {
        const tvRes = await fetch('/api/tv-public-data');
        const tvData = await tvRes.json();
        if (tvRes.ok && tvData.ok && Array.isArray(tvData.Row) && tvData.Row.length > 0) {
          setRows(tvData.Row);
          setTotalScannedInSql(tvData.totalRows || tvData.Row.length);
          setLastSyncTime(
            new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
          setLastSyncSource('Modo TV Público (Indicadores Agregados — Sem Dados Sensíveis)');
          setIsAutoSyncing(false);
          return;
        }
      }

      const res = await fetch('/api/totvs/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...queryParams,
          periodo: targetPeriodo,
          forceRefresh: force,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.Row) && data.Row.length > 0) {
        setRows(data.Row);
        setTotalScannedInSql(data.totalScanned || data.Row.length);
        setLastSyncTime(
          new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        setLastSyncSource(
          `API TOTVS RM Ao Vivo (${data.Row.length} reg. em ${targetPeriodo} de ${data.totalScanned || data.Row.length} lidos)`
        );
        setCurrentPage(1);
      }
    } catch {
      // Mantém base local caso haja falha de rede
    } finally {
      setIsAutoSyncing(false);
    }
  }, [queryParams, isTvUrlMode]);

  // Cronômetro regressivo de 60 minutos (3600s) para sincronização automática
  useEffect(() => {
    const timer = setInterval(() => {
      setNextSyncSeconds((prev) => {
        if (prev <= 1) {
          syncFromTotvsApi('2027', true);
          return 3600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [syncFromTotvsApi]);

  useEffect(() => {
    syncFromTotvsApi('2027', false);
    fetch('/api/goals-2027')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.goals) && data.goals.length > 0) {
          setUnitGoals(data.goals);
          try {
            localStorage.setItem('sesi_pe_unit_goals_2027_v1', JSON.stringify(data.goals));
          } catch {
            // ignora erro de storage
          }
        }
      })
      .catch(() => {});
  }, [syncFromTotvsApi]);

  // Lista de períodos distintos existentes na base carregada
  const availablePeriods = useMemo(() => {
    const set = new Set<string>(['2027']);
    for (const r of rows) {
      if (r['PERIODO']) {
        set.add(String(r['PERIODO']).trim());
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  // Colunas visíveis de acordo com o preset selecionado
  const visibleColumns = useMemo(() => {
    if (columnPreset === 'all') return TOTVS_FIELDS;
    if (columnPreset === 'default') {
      return TOTVS_FIELDS.filter((f) => f.defaultVisible);
    }
    // Sempre inclui PERIODO, RA e ALUNO para contexto + colunas do grupo
    return TOTVS_FIELDS.filter(
      (f) =>
        f.key === 'PERIODO' ||
        f.key === 'RA' ||
        f.key === 'ALUNO' ||
        f.group === columnPreset
    );
  }, [columnPreset]);

  // Filtragem principal por PERIODO === '2027' (ou período escolhido) + busca textual rápida
  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        // Filtro estrito de Período
        if (periodoFilter !== 'TODOS') {
          const rowPeriodo = String(row['PERIODO'] ?? '').trim();
          if (rowPeriodo !== periodoFilter.trim()) {
            return false;
          }
        }

        // Busca textual opcional dentro do período filtrado (suporta múltiplos termos separados por "|")
        if (searchQuery.trim() !== '') {
          const terms = searchQuery
            .toLowerCase()
            .split('|')
            .map((t) => t.trim())
            .filter(Boolean);
          const searchableValues = [
            row['RA'],
            row['ALUNO'],
            row['CPF'],
            row['UNIDADE'],
            row['TURMA'],
            row['NOME EMPRESA'],
            row['CATEGORIA'],
            row['SITUACAO MATRICULA'],
            row['FORMAINGRESSO'],
            row['FORMA INGRESSO'],
            row['CODPLANOPGTO'],
          ]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase());

          return terms.every((term) =>
            searchableValues.some((val) => val.includes(term))
          );
        }

        return true;
      })
      .sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const cmp = String(valA).localeCompare(String(valB), 'pt-BR', {
          numeric: true,
        });
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
  }, [rows, periodoFilter, searchQuery, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, totalPages]);

  // Métricas resumidas do Período filtrado
  const stats = useMemo(() => {
    const totalInPeriod = filteredRows.length;
    const totalModified = filteredRows.filter((r) => r._modified).length;
    const totalIndustry = filteredRows.filter((r) =>
      String(r['CATEGORIA'] || '')
        .toLowerCase()
        .includes('indústria')
    ).length;
    const totalEbep = filteredRows.filter((r) => String(r['EBEP']) === '1').length;

    return {
      totalInPeriod,
      totalDatabase: rows.length,
      totalModified,
      totalIndustry,
      totalEbep,
    };
  }, [filteredRows, rows]);

  const showToast = (msg: string) => {
    setCopiedBanner(msg);
    setTimeout(() => setCopiedBanner(null), 3000);
  };

  // Ordenação por coluna
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Seleção de linhas
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => String(r._id))));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Salvar edição inline de célula
  const handleCommitInlineEdit = () => {
    if (!editingCell) return;
    const { rowId, fieldKey, value } = editingCell;
    const fieldDef = TOTVS_FIELDS.find((f) => f.key === fieldKey);

    let parsedVal: string | number | null = value;
    if (value.trim() === '') {
      parsedVal = null;
    } else if (fieldDef?.isNumeric && !Number.isNaN(Number(value))) {
      parsedVal = Number(value);
    }

    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== rowId) return r;
        if (r[fieldKey] === parsedVal) return r;
        const modSet = new Set(r._modifiedFields || []);
        modSet.add(fieldKey);
        return {
          ...r,
          [fieldKey]: parsedVal,
          _modified: true,
          _modifiedFields: Array.from(modSet),
        };
      })
    );
    setEditingCell(null);
  };

  // Salvar registro do Drawer (edição completa ou novo registro)
  const handleSaveDrawerRow = (updatedRow: TotvsStudentRow, isNew: boolean) => {
    if (isNew) {
      setRows((prev) => [updatedRow, ...prev]);
      showToast(`Novo registro (RA: ${updatedRow['RA'] || 'N/A'}) adicionado no período ${updatedRow['PERIODO']}.`);
    } else {
      setRows((prev) =>
        prev.map((r) => (r._id === updatedRow._id ? updatedRow : r))
      );
      showToast(`Registro RA ${updatedRow['RA']} atualizado com sucesso.`);
    }
    setDrawerRow(null);
    setIsCreatingNew(false);
  };

  // Criar novo registro já pré-configurado com PERIODO = '2027'
  const handleCreateNewRecord = () => {
    const blank = normalizeTotvsRow(
      {
        PERIODO: periodoFilter === 'TODOS' ? '2027' : periodoFilter,
        UNIDADE: 'SESI GOIANA',
        RA: String(Math.floor(94200 + Math.random() * 500)).padStart(8, '0'),
        STATUS: 1,
        TURNO: 23,
        NOMETURNO: 'DIURNO',
        'NOME CURSO': 'Ensino Médio',
        'COD CURSO': 'EM',
        'TIPO MATRICULA': 'NOVATO',
        'SITUACAO MATRICULA': 'Matriculado',
        CATEGORIA: 'Dependente da Indústria',
        CODPLANOPGTO: 'PP-EM-IND',
        NOME: '6. PLANO DE PAGAMENTO - ENSINO MÉDIO - INDÚSTRIA',
        UF: 'PE',
        NATURALIDADE: 'PE',
        _modified: true,
      },
      rows.length + 1
    );
    setIsCreatingNew(true);
    setDrawerRow(blank);
  };

  // Duplicar registro existente para o período 2027
  const handleDuplicateTo2027 = (sourceRow: TotvsStudentRow) => {
    const duplicated: TotvsStudentRow = {
      ...sourceRow,
      _id: `row-${sourceRow['RA']}-2027-dup-${Date.now()}`,
      PERIODO: '2027',
      'HABILITACAO GRADE': sourceRow['HABILITACAO GRADE']
        ? String(sourceRow['HABILITACAO GRADE']).replace(/\b20\d{2}\b/g, '2027')
        : 'M-EM-3A - ENSINO MÉDIO - 3ª SÉRIE - 2027',
      _modified: true,
      _modifiedFields: ['PERIODO', 'HABILITACAO GRADE'],
    };
    setRows((prev) => [duplicated, ...prev]);
    setPeriodoFilter('2027');
    setDrawerRow(null);
    showToast(`Registro de ${sourceRow['ALUNO']} duplicado para o Período 2027.`);
  };

  // Manipulação em Lote
  const handleApplyBulkChange = (
    fieldKey: string,
    newValue: string | number | null
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (!selectedIds.has(String(r._id))) return r;
        const modSet = new Set(r._modifiedFields || []);
        modSet.add(fieldKey);
        return {
          ...r,
          [fieldKey]: newValue,
          _modified: true,
          _modifiedFields: Array.from(modSet),
        };
      })
    );
    showToast(
      `Campo "${fieldKey}" atualizado em ${selectedIds.size} registro(s).`
    );
  };

  // Excluir linhas selecionadas
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setRows((prev) => prev.filter((r) => !selectedIds.has(String(r._id))));
    setSelectedIds(new Set());
    showToast(`${count} registro(s) removido(s) da sessão de manipulação.`);
  };

  // Importar linhas vindas da API TOTVS ou JSON colado
  const handleImportRows = (
    incomingRows: TotvsStudentRow[],
    mode: 'replace' | 'merge',
    sourceLabel: string
  ) => {
    if (mode === 'replace') {
      setRows(incomingRows);
    } else {
      setRows((prev) => [...incomingRows, ...prev]);
    }
    setSelectedIds(new Set());
    setLastSyncSource(`${sourceLabel} (${incomingRows.length} registros)`);
    showToast(`${incomingRows.length} registro(s) carregados via ${sourceLabel}.`);
  };

  // Exportar JSON no padrão { "Row": [...] }
  const handleDownloadJson = () => {
    const jsonString = formatToTotvsJson(filteredRows);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TOTVS_SE42018_2_PERIODO_${periodoFilter}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Arquivo JSON (${filteredRows.length} registros) exportado.`);
  };

  // Exportar CSV (Excel)
  const handleDownloadCsv = () => {
    const csvString = formatToCsv(filteredRows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TOTVS_SE42018_2_PERIODO_${periodoFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Planilha CSV (${filteredRows.length} registros) exportada.`);
  };

  // Copiar JSON para área de transferência
  const handleCopyJson = () => {
    const jsonString = formatToTotvsJson(filteredRows);
    navigator.clipboard.writeText(jsonString);
    showToast(`JSON de ${filteredRows.length} registro(s) copiado para a área de transferência.`);
  };

  // Restaurar base inicial
  const handleResetDataset = () => {
    setRows(INITIAL_TOTVS_ROWS);
    setSelectedIds(new Set());
    setPeriodoFilter('2027');
    setSearchQuery('');
    showToast('Dados restaurados para o estado original.');
  };

  const persistGoals = (nextGoals: UnitGoal2027[]) => {
    try {
      localStorage.setItem('sesi_pe_unit_goals_2027_v1', JSON.stringify(nextGoals));
    } catch {
      // ignora erro de storage
    }
    fetch('/api/goals-2027', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goals: nextGoals }),
    }).catch(() => {});
  };

  const handleUpdateGoalObs = (unitId: string, obs: string) => {
    setUnitGoals((prev) => {
      const next = prev.map((g) => (g.id === unitId ? { ...g, observacoes: obs } : g));
      persistGoals(next);
      return next;
    });
  };

  const handleUpdateUnitGoalField = (
    unitId: string,
    field:
      | 'metaGeral'
      | 'metaUnidade2027'
      | 'gratuidadeRemanescente'
      | 'pagasRenovacoes'
      | 'pagasNovatos2027'
      | 'novasVagasGratuidade2027',
    rawValue: number
  ) => {
    const cleanVal = Math.max(0, Math.round(Number.isFinite(rawValue) ? rawValue : 0));
    let updatedUnitName = '';
    setUnitGoals((prev) => {
      const next = prev.map((g) => {
        if (g.id !== unitId) return g;
        updatedUnitName = g.shortName;
        if (field === 'metaGeral' || field === 'metaUnidade2027') {
          return {
            ...g,
            metaGeral: cleanVal,
            metaUnidade2027: cleanVal,
          };
        }
        const updated = {
          ...g,
          [field]: cleanVal,
        };
        const newSum =
          updated.gratuidadeRemanescente +
          updated.pagasRenovacoes +
          updated.pagasNovatos2027 +
          updated.novasVagasGratuidade2027;
        return {
          ...updated,
          metaGeral: newSum,
          metaUnidade2027: newSum,
        };
      });
      persistGoals(next);
      return next;
    });
    if (updatedUnitName) {
      showToast(`Meta da escola SESI ${updatedUnitName} atualizada para ${cleanVal.toLocaleString('pt-BR')}.`);
    }
  };

  const handleSaveUnitGoalFull = (updatedGoal: UnitGoal2027) => {
    setUnitGoals((prev) => {
      const next = prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g));
      persistGoals(next);
      return next;
    });
    showToast(`Metas da escola SESI ${updatedGoal.shortName} salvas com sucesso.`);
  };

  const handleResetUnitGoals = () => {
    setUnitGoals(SESI_PE_GOALS_2027);
    persistGoals(SESI_PE_GOALS_2027);
    showToast('Metas das 12 escolas restauradas para os valores originais da planilha (9.357).');
  };

  const handleInspectUnitInGrid = (totvsUnitName: string, extraStatusQuery?: string) => {
    setPeriodoFilter('2027');
    const composedQuery = extraStatusQuery
      ? `${totvsUnitName} | ${extraStatusQuery}`
      : totvsUnitName;
    setSearchQuery(composedQuery);
    setCurrentPage(1);
    setActiveTab('grid');
    showToast(
      extraStatusQuery
        ? `Filtrando ${totvsUnitName} (${extraStatusQuery}) no Período 2027.`
        : `Filtrando alunos de ${totvsUnitName} no Período 2027.`
    );
  };

  const handleDismissFlash = (unitId: string) => {
    setFlashingUnits((prev) => {
      const next = { ...prev };
      delete next[unitId];
      return next;
    });
  };

  if (!tvBypassAuth && !authReady) {
    return (
      <div className="min-h-screen bg-[#F0F7FF] flex items-center justify-center p-4">
        <div className="rounded-3xl bg-white border-2 border-b-8 border-[#009FE3] px-8 py-6 shadow-xl text-center space-y-2">
          <RefreshCw className="w-6 h-6 text-[#009FE3] animate-spin mx-auto" />
          <div className="text-sm font-extrabold text-slate-900">
            Verificando credenciais de segurança...
          </div>
        </div>
      </div>
    );
  }

  if (!tvBypassAuth && (!firebaseUser || accessRecord?.status !== 'approved')) {
    return (
      <AuthLoginAndPendingScreen
        firebaseUser={firebaseUser}
        accessRecord={accessRecord}
        signingIn={signingIn}
        authError={authError}
        onGoogleLogin={handleGoogleLogin}
        onLogout={handleLogout}
        onRefreshStatus={() => {
          if (firebaseUser) syncUserAccessState(firebaseUser);
        }}
        onEnterPublicTvMode={() => {
          const url = new URL(window.location.href);
          url.searchParams.set('tv', '1');
          window.history.replaceState({}, '', url.toString());
          setTvBypassAuth(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F7FC] text-slate-900">
      {/* Top Bar Contract: 3 Zonas (Oculto no Modo TV Público ?tv=1 para não expor Lista SQL nem dados sensíveis) */}
      {!tvBypassAuth && (
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-sky-200 bg-[#009FE3] text-white shadow-xs">
        {/* Zona 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-base font-extrabold tracking-tight whitespace-nowrap text-white"
        >
          ESCOLAS SESI-PE · MATRÍCULAS 2027
        </a>

        {/* Zona 2: 4-5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-sky-100">
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setDashboardViewRequest({ view: 'ambos', ts: Date.now() });
            }}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap ${
              activeTab === 'dashboard' && dashboardViewRequest?.view !== 'aniversariantes'
                ? 'text-white font-extrabold underline decoration-2 decoration-amber-300'
                : ''
            }`}
          >
            Mural Escolar & Campanha de Matrículas 2027
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setDashboardViewRequest({ view: 'aniversariantes', ts: Date.now() });
            }}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap ${
              activeTab === 'dashboard' && dashboardViewRequest?.view === 'aniversariantes'
                ? 'text-amber-300 font-extrabold underline decoration-2 decoration-amber-300'
                : 'text-amber-200'
            }`}
          >
            Aniversariantes do Mês
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grid')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap ${
              activeTab === 'grid'
                ? 'text-white font-extrabold underline decoration-2 decoration-amber-300'
                : ''
            }`}
          >
            Lista de Alunos SQL ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setConnectionModal({ open: true, mode: 'api' })}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Conexão TOTVS RM
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Baixar Planilha Excel
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAccessModalOpen(true)}
              className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap ${
                pendingApprovalsCount > 0
                  ? 'text-amber-300 font-extrabold underline decoration-2 decoration-amber-300'
                  : 'text-sky-100'
              }`}
              title="Gerenciar e aprovar solicitações de acesso ao painel (Administrador: maykon.euro@hotmail.com)"
            >
              Aprovar Acessos{pendingApprovalsCount > 0 ? ` (${pendingApprovalsCount})` : ''}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap text-sky-100"
            title={`Conectado como ${firebaseUser?.email || ''}. Clique para sair.`}
          >
            Sair
          </button>
        </nav>

        {/* Zona 3: 1-2 primary actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              setActiveTab(activeTab === 'dashboard' ? 'grid' : 'dashboard')
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border-2 border-b-4 border-sky-200 bg-white text-[#009FE3] hover:bg-sky-50 transition-colors whitespace-nowrap"
          >
            {activeTab === 'dashboard'
              ? 'Ver Alunos na Tabela (57 Colunas)'
              : 'Voltar ao Mural Escolar'}
          </button>
          <button
            type="button"
            onClick={() => syncFromTotvsApi('2027', true)}
            disabled={isAutoSyncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-950 bg-amber-300 border-2 border-b-4 border-amber-500 rounded-xl hover:bg-amber-200 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isAutoSyncing ? 'animate-spin' : ''}`}
            />
            {isAutoSyncing ? 'Atualizando TOTVS...' : 'Sincronizar TOTVS RM'}
          </button>
        </div>
      </header>
      )}

      {/* Notificação Toast discreta */}
      {copiedBanner && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copiedBanner}</span>
        </div>
      )}

      {/* Renderização Condicional: Dashboard Gamer Gestão à Vista 2027 vs Grade SQL */}
      {activeTab === 'dashboard' ? (
        <GamerEnrollmentDashboard
          rows={rows}
          goals={unitGoals}
          onUpdateGoalObs={handleUpdateGoalObs}
          onUpdateUnitGoalField={handleUpdateUnitGoalField}
          onSaveUnitGoalFull={handleSaveUnitGoalFull}
          onResetUnitGoals={handleResetUnitGoals}
          onInspectUnitInGrid={handleInspectUnitInGrid}
          isAutoSyncing={isAutoSyncing}
          nextSyncSeconds={nextSyncSeconds}
          lastSyncTime={lastSyncTime}
          onForceSync={() => syncFromTotvsApi('2027', true)}
          flashingUnits={flashingUnits}
          onDismissFlash={handleDismissFlash}
          externalViewRequest={dashboardViewRequest}
          isAdmin={isAdmin}
          pendingApprovalsCount={pendingApprovalsCount}
          onOpenAccessControl={() => setAccessModalOpen(true)}
        />
      ) : (
        /* Main Content Container (Manipulador SQL) */
        <main className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto px-6 py-6 gap-5">
        {/* Cabeçalho de Contexto da Sentença SQL & Métricas Tabulares */}
        <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>ExecutaConsultaSQL</span>
              <span aria-hidden="true">·</span>
              <span>codcoligada={queryParams.codcoligada}</span>
              <span aria-hidden="true">·</span>
              <span>codsentenca={queryParams.codsentenca}</span>
              <span aria-hidden="true">·</span>
              <span>codsistema={queryParams.codsistema}</span>
              <span aria-hidden="true">·</span>
              <span>PARAMETERS={queryParams.parameters}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Manipulador de Dados — Consulta SQL TOTVS RM
            </h1>
            <p className="text-xs text-slate-600">
              Fonte ativa: {lastSyncSource} · Clique duplo em qualquer célula para edição rápida ou clique em &ldquo;Manipular&rdquo; para editar os 57 campos do registro.
            </p>
          </div>

          {/* Métricas limpas em linha com divisores sutis (Zero-Pill Discipline) */}
          <div className="flex flex-wrap items-center gap-6 bg-white border border-slate-200 rounded-lg px-5 py-3">
            <div>
              <div className="text-[11px] text-slate-500">
                Registros (Período {periodoFilter})
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-blue-600">
                {stats.totalInPeriod}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[11px] text-slate-500">Total Lido no SQL</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                {totalScannedInSql ? totalScannedInSql.toLocaleString('pt-BR') : stats.totalDatabase}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[11px] text-slate-500">Dep. da Indústria</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                {stats.totalIndustry}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[11px] text-slate-500">Registros Editados</div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-600">
                {stats.totalModified}
              </div>
            </div>
          </div>
        </section>

        {/* Barra de Filtro Focada Exclusivamente no Período '2027' (conforme solicitado) */}
        <section className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro de Período em Destaque */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="periodo-filter-input"
                className="text-xs font-semibold text-slate-800 whitespace-nowrap"
              >
                Filtro de Período (PERIODO):
              </label>

              {/* Controles segmentados interativos para Período */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {availablePeriods.map((per) => (
                  <button
                    key={per}
                    type="button"
                    onClick={() => setPeriodoFilter(per)}
                    className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap ${
                      periodoFilter === per
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {per === '2027' ? '2027 (Ativo)' : per}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPeriodoFilter('TODOS')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    periodoFilter === 'TODOS'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({rows.length})
                </button>
              </div>

              {/* Input direto para digitar qualquer período específico */}
              <input
                id="periodo-filter-input"
                type="text"
                value={periodoFilter === 'TODOS' ? '' : periodoFilter}
                onChange={(e) =>
                  setPeriodoFilter(e.target.value ? e.target.value : 'TODOS')
                }
                placeholder="Ex: 2027"
                className="w-24 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                title="Digite o ano do PERIODO que deseja filtrar (ex: 2027)"
              />
            </div>

            <div className="hidden sm:block h-6 w-px bg-slate-200" />

            {/* Busca rápida dentro dos registros do período 2027 */}
            <div className="relative min-w-[260px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Localizar aluno, RA, CPF ou turma..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Seletor de Grupo de Colunas (57 campos da consulta SQL) e Ações de Exportação */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-600 whitespace-nowrap">
                Colunas:
              </span>
              <select
                value={columnPreset}
                onChange={(e) => setColumnPreset(e.target.value as ColumnPreset)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-blue-600"
              >
                <option value="default">Visão Principal (14 colunas)</option>
                <option value="academico">Acadêmico e Matrícula</option>
                <option value="aluno">Identificação do Aluno</option>
                <option value="contato">Endereço e Contato</option>
                <option value="responsaveis">Filiação e Responsáveis</option>
                <option value="financeiro">Indústria, EBEP e Financeiro</option>
                <option value="all">Todas as 57 Colunas SQL</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
              title="Copiar registros filtrados no formato JSON TOTVS { Row: [...] }"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar JSON
            </button>

            <button
              type="button"
              onClick={handleResetDataset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
              title="Restaurar registros para o estado inicial"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetar
            </button>
          </div>
        </section>

        {/* Barra de Ações em Lote quando há linhas selecionadas */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 text-white rounded-xl">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono font-semibold tabular-nums text-blue-400">
                {selectedIds.size} registro(s) selecionado(s)
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-300 hover:text-white underline underline-offset-2"
              >
                Limpar seleção
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyBulkChange('PERIODO', '2027')}
                className="px-3 py-1.5 text-xs font-mono font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                Definir PERIODO = 2027
              </button>
              <button
                type="button"
                onClick={() => setBulkModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Alterar Campo em Lote...
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover Selecionados
              </button>
            </div>
          </div>
        )}

        {/* Aviso de sincronização em andamento com o stream de 266 MB do TOTVS RM */}
        {isAutoSyncing && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span>
                Lendo stream da consulta SQL <strong className="font-mono">SE42018_2 Produc</strong> diretamente no servidor TOTVS RM (<strong className="font-mono">sge.pe.sesi.org.br</strong>) e filtrando os registros do <strong>Período 2027</strong> (~25s na 1ª leitura de 266 MB)...
              </span>
            </div>
          </div>
        )}

        {/* Grade de Dados de Alta Densidade (High-Density Data Grid) */}
        <section className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Nenhum registro encontrado para o filtro PERIODO = &ldquo;{periodoFilter}&rdquo;
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md">
                Existem {rows.length} registro(s) carregados no total na consulta SQL. Você pode visualizar todos os períodos, migrar o registro de 2018 para 2027 ou criar um novo registro em 2027.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPeriodoFilter('TODOS')}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Visualizar Todos os Períodos ({rows.length})
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewRecord}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Criar Registro no Período 2027
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold text-slate-600">
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 w-10 border-r border-slate-200">
                      <input
                        type="checkbox"
                        checked={
                          filteredRows.length > 0 &&
                          selectedIds.size === filteredRows.length
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Selecionar todos os registros"
                      />
                    </th>
                    <th className="sticky left-10 z-10 bg-slate-50 px-3 py-2.5 border-r border-slate-200 whitespace-nowrap">
                      Ação
                    </th>
                    {visibleColumns.map((col) => {
                      const colKey = String(col.key);
                      const isSorted = sortConfig.key === colKey;
                      return (
                        <th
                          key={colKey}
                          onClick={() => handleSort(colKey)}
                          className={`px-3 py-2.5 border-r border-slate-100 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100/80 transition-colors ${
                            colKey === 'PERIODO' ? 'bg-blue-50/60 text-blue-900' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span>{col.label}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {isSorted ? (
                                sortConfig.direction === 'asc' ? (
                                  '↑'
                                ) : (
                                  '↓'
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono font-normal text-slate-400">
                            {colKey}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {paginatedRows.map((row) => {
                    const rowId = String(row._id);
                    const isSelected = selectedIds.has(rowId);

                    return (
                      <tr
                        key={rowId}
                        className={`group transition-colors ${
                          isSelected
                            ? 'bg-blue-50/50 hover:bg-blue-50/80'
                            : row._modified
                            ? 'bg-amber-50/20 hover:bg-slate-50'
                            : 'hover:bg-slate-50/90'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-2 border-r border-slate-200">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(rowId)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`Selecionar ${row['ALUNO']}`}
                          />
                        </td>

                        {/* Botão Manipular (Abre Drawer com todos os 57 campos) */}
                        <td className="sticky left-10 z-10 bg-white group-hover:bg-slate-50 px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingNew(false);
                                setDrawerRow(row);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                            >
                              <Edit3 className="w-3 h-3" />
                              Manipular
                            </button>
                            {row._modified && (
                              <span
                                className="text-[10px] font-mono text-amber-700"
                                title="Registro possui alterações locais"
                              >
                                *
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Células das Colunas */}
                        {visibleColumns.map((col) => {
                          const colKey = String(col.key);
                          const cellVal = row[colKey];
                          const isEditingThisCell =
                            editingCell?.rowId === rowId &&
                            editingCell?.fieldKey === colKey;
                          const isFieldModified =
                            row._modifiedFields?.includes(colKey);

                          return (
                            <td
                              key={colKey}
                              onDoubleClick={() =>
                                setEditingCell({
                                  rowId,
                                  fieldKey: colKey,
                                  value:
                                    cellVal === null || cellVal === undefined
                                      ? ''
                                      : String(cellVal),
                                })
                              }
                              className={`px-3 py-2 border-r border-slate-100 whitespace-nowrap max-w-[280px] truncate cursor-text ${
                                col.isMono ? 'font-mono tabular-nums' : ''
                              } ${
                                col.isNumeric ? 'text-right' : 'text-left'
                              } ${
                                colKey === 'PERIODO'
                                  ? 'font-semibold text-blue-700 bg-blue-50/20'
                                  : isFieldModified
                                  ? 'bg-amber-50/50 text-slate-900 font-medium'
                                  : 'text-slate-700'
                              }`}
                              title="Duplo clique para editar esta célula diretamente"
                            >
                              {isEditingThisCell ? (
                                <input
                                  type={col.isNumeric ? 'number' : 'text'}
                                  autoFocus
                                  value={editingCell.value}
                                  onChange={(e) =>
                                    setEditingCell({
                                      ...editingCell,
                                      value: e.target.value,
                                    })
                                  }
                                  onBlur={handleCommitInlineEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCommitInlineEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full min-w-[90px] px-1.5 py-0.5 text-xs bg-white border border-blue-600 rounded text-slate-900 focus:outline-none"
                                />
                              ) : cellVal === null ||
                                cellVal === undefined ||
                                cellVal === '' ? (
                                <span className="text-slate-300 italic font-mono text-[11px]">
                                  null
                                </span>
                              ) : (
                                String(cellVal)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé da Tabela com paginação, resumo e exportação rápida */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
              <span>
                Total Filtrado ({periodoFilter}): <strong>{filteredRows.length}</strong> registros
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Página {Math.min(currentPage, totalPages)} de {totalPages}
              </span>
              <div className="inline-flex items-center gap-1 ml-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar CSV (Excel)
              </button>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar JSON TOTVS ({'{ "Row": [...] }'})
              </button>
            </div>
          </div>
        </section>
      </main>
      )}

      {/* Drawer Lateral de Edição Completa dos 57 Campos da Consulta SQL */}
      <RecordEditorDrawer
        row={drawerRow}
        isNew={isCreatingNew}
        onClose={() => {
          setDrawerRow(null);
          setIsCreatingNew(false);
        }}
        onSave={handleSaveDrawerRow}
        onDuplicate={handleDuplicateTo2027}
      />

      {/* Modal de Conexão REST TOTVS RM e Importação de JSON */}
      <TotvsConnectionModal
        isOpen={connectionModal.open}
        initialMode={connectionModal.mode}
        params={queryParams}
        onClose={() => setConnectionModal({ ...connectionModal, open: false })}
        onUpdateParams={setQueryParams}
        onImportRows={handleImportRows}
      />

      {/* Modal de Manipulação em Lote */}
      <BulkManipulateModal
        isOpen={bulkModalOpen}
        selectedCount={selectedIds.size}
        onClose={() => setBulkModalOpen(false)}
        onApplyBulkChange={handleApplyBulkChange}
      />

      {/* Modal de Aprovação de Acessos do Administrador (maykon.euro@hotmail.com) */}
      <AdminAccessControlModal
        isOpen={accessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        currentUserEmail={firebaseUser?.email || accessRecord?.email || ''}
        records={allRecords}
        onDecide={handleAdminDecision}
      />
    </div>
  );
}
