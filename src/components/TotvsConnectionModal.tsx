import React, { useState } from 'react';
import { X, RefreshCw, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';
import { TotvsQueryParams, TotvsStudentRow } from '../types/totvs';
import { parseTotvsJsonInput } from '../utils/totvsParser';

interface TotvsConnectionModalProps {
  isOpen: boolean;
  initialMode?: 'api' | 'json';
  params: TotvsQueryParams;
  onClose: () => void;
  onUpdateParams: (newParams: TotvsQueryParams) => void;
  onImportRows: (rows: TotvsStudentRow[], mode: 'replace' | 'merge', sourceLabel: string) => void;
}

export const TotvsConnectionModal: React.FC<TotvsConnectionModalProps> = ({
  isOpen,
  initialMode = 'api',
  params,
  onClose,
  onUpdateParams,
  onImportRows,
}) => {
  const [tab, setTab] = useState<'api' | 'json'>(initialMode);
  const [localParams, setLocalParams] = useState<TotvsQueryParams>(params);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [importStrategy, setImportStrategy] = useState<'replace' | 'merge'>('replace');

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const builtFullUrl = () => {
    try {
      const url = new URL(localParams.baseUrl);
      url.searchParams.set('codcoligada', localParams.codcoligada);
      url.searchParams.set('codsentenca', localParams.codsentenca);
      url.searchParams.set('codsistema', localParams.codsistema);
      url.searchParams.set('PARAMETERS', localParams.parameters);
      return url.toString();
    } catch {
      return `${localParams.baseUrl}?codcoligada=${localParams.codcoligada}&codsentenca=${localParams.codsentenca}&codsistema=${localParams.codsistema}&PARAMETERS=${localParams.parameters}`;
    }
  };

  const handleExecuteApiQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setApiSuccess(null);
    onUpdateParams(localParams);

    try {
      const response = await fetch('/api/totvs/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...localParams,
          periodo: '2027',
          forceRefresh: true,
          username: username.trim() || undefined,
          password: password || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setApiError(
          data.message ||
            `Falha ao consultar API TOTVS RM (Status ${response.status}).`
        );
        return;
      }

      const rows: TotvsStudentRow[] = Array.isArray(data.Row) ? data.Row : [];
      onImportRows(rows, importStrategy, `API TOTVS RM (${rows.length} reg. em 2027 de ${data.totalScanned || rows.length} lidos)`);
      setApiSuccess(
        `Consulta concluída! ${rows.length} registro(s) do Período 2027 extraídos de ${data.totalScanned || rows.length} registros totais (${((data.totalBytes || 0) / 1024 / 1024).toFixed(1)} MB).`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro de rede';
      setApiError(`Erro ao comunicar com o servidor proxy: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleParseJson = (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);

    const result = parseTotvsJsonInput(jsonText);
    if (result.error || result.rows.length === 0) {
      setJsonError(result.error || 'Nenhum registro encontrado no JSON informado.');
      return;
    }

    onImportRows(result.rows, importStrategy, 'Importação JSON');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Fonte de Dados — Consulta SQL TOTVS RM
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sentença <span className="font-mono text-slate-700">SE42018_2 Produc</span> · Coligada <span className="font-mono text-slate-700">2</span> · Sistema <span className="font-mono text-slate-700">S</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('api')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'api'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Conexão Direta API TOTVS
            </button>
            <button
              type="button"
              onClick={() => setTab('json')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'json'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Colar Resultado JSON (Row)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Ao carregar:</span>
            <select
              value={importStrategy}
              onChange={(e) => setImportStrategy(e.target.value as 'replace' | 'merge')}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value="merge">Mesclar aos registros atuais</option>
              <option value="replace">Substituir tabela atual</option>
            </select>
          </div>
        </div>

        {tab === 'api' ? (
          <form onSubmit={handleExecuteApiQuery} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Endpoint REST TOTVS RM (ExecutaConsultaSQL)
              </label>
              <input
                type="url"
                required
                value={localParams.baseUrl}
                onChange={(e) =>
                  setLocalParams({ ...localParams, baseUrl: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  codcoligada
                </label>
                <input
                  type="text"
                  required
                  value={localParams.codcoligada}
                  onChange={(e) =>
                    setLocalParams({ ...localParams, codcoligada: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  codsentenca
                </label>
                <input
                  type="text"
                  required
                  value={localParams.codsentenca}
                  onChange={(e) =>
                    setLocalParams({ ...localParams, codsentenca: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  codsistema
                </label>
                <input
                  type="text"
                  required
                  value={localParams.codsistema}
                  onChange={(e) =>
                    setLocalParams({ ...localParams, codsistema: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PARAMETERS
              </label>
              <input
                type="text"
                required
                value={localParams.parameters}
                onChange={(e) =>
                  setLocalParams({ ...localParams, parameters: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Credenciais Basic Auth para o RM */}
            <div className="pt-2 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-800 mb-2">
                Credenciais de Acesso TOTVS RM (Basic Auth)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Usuário RM (ou via variável TOTVS_USER)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: mestre / integracao.sge"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Senha RM (ou via variável TOTVS_PASSWORD)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* URL completa gerada */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-medium text-slate-500 mb-1">
                URL de Requisição Configurada:
              </div>
              <div className="text-[11px] font-mono text-slate-700 break-all">
                {builtFullUrl()}
              </div>
            </div>

            {apiError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{apiError}</p>
                  <p className="text-red-600">
                    Dica: Caso o servidor SGE SESI-PE exija VPN interna ou você já tenha o retorno JSON, utilize a aba &ldquo;Colar Resultado JSON (Row)&rdquo; acima.
                  </p>
                </div>
              </div>
            )}

            {apiSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{apiSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Consultando TOTVS RM...' : 'Executar Consulta SQL'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleParseJson} className="p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Cole o retorno JSON da consulta (<code className="font-mono">{'{ "Row": [ ... ] }'}</code>)
                </label>
                <span className="text-[11px] text-slate-500">
                  Suporta JSON completo ou recorte parcial de objetos
                </span>
              </div>
              <textarea
                rows={10}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={'{\n  "Row": [\n    {\n      "UNIDADE": "SESI GOIANA",\n      "PERIODO": "2027",\n      "RA": "00004364",\n      "ALUNO": "NOME DO ALUNO"\n    }\n  ]\n}'}
                className="w-full p-3 text-xs font-mono bg-slate-900 text-slate-100 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            {jsonError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileJson className="w-3.5 h-3.5" />
                Carregar Registros do JSON
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
