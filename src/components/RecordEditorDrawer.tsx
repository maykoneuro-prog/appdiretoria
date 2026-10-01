import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Copy, Check, Search } from 'lucide-react';
import {
  TotvsStudentRow,
  TOTVS_FIELDS,
  FIELD_GROUPS,
  FieldGroup,
} from '../types/totvs';

interface RecordEditorDrawerProps {
  row: TotvsStudentRow | null;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updatedRow: TotvsStudentRow, isNew: boolean) => void;
  onDuplicate?: (row: TotvsStudentRow) => void;
}

export const RecordEditorDrawer: React.FC<RecordEditorDrawerProps> = ({
  row,
  isNew = false,
  onClose,
  onSave,
  onDuplicate,
}) => {
  const [formData, setFormData] = useState<TotvsStudentRow | null>(null);
  const [activeGroup, setActiveGroup] = useState<FieldGroup | 'todos' | 'json'>('academico');
  const [fieldSearch, setFieldSearch] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (row) {
      setFormData({ ...row });
    } else {
      setFormData(null);
    }
  }, [row]);

  if (!row || !formData) return null;

  const handleFieldChange = (key: string, rawValue: string, isNumeric?: boolean) => {
    let parsedValue: string | number | null = rawValue;
    if (rawValue === '') {
      parsedValue = null;
    } else if (isNumeric && !Number.isNaN(Number(rawValue))) {
      parsedValue = Number(rawValue);
    }

    const currentModified = new Set(formData._modifiedFields || []);
    if (parsedValue !== row[key]) {
      currentModified.add(key);
    }

    setFormData({
      ...formData,
      [key]: parsedValue,
      _modified: true,
      _modifiedFields: Array.from(currentModified),
    });
  };

  const handleReset = () => {
    setFormData({ ...row });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData, isNew);
    }
  };

  const getCleanRowJson = () => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (!k.startsWith('_')) {
        clean[k] = v;
      }
    }
    return JSON.stringify(clean, null, 2);
  };

  const handleCopyRowJson = () => {
    navigator.clipboard.writeText(getCleanRowJson());
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const filteredFields = TOTVS_FIELDS.filter((field) => {
    if (fieldSearch.trim()) {
      const q = fieldSearch.toLowerCase();
      return (
        String(field.key).toLowerCase().includes(q) ||
        field.label.toLowerCase().includes(q)
      );
    }
    if (activeGroup === 'todos' || activeGroup === 'json') return true;
    return field.group === activeGroup;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-white border-l border-slate-200 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>{isNew ? 'NOVO REGISTRO' : `RA: ${formData['RA'] || 'N/A'}`}</span>
              <span aria-hidden="true">·</span>
              <span>Período: {formData['PERIODO'] || 'N/A'}</span>
              <span aria-hidden="true">·</span>
              <span>{formData['UNIDADE'] || 'Sem Unidade'}</span>
            </div>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900">
              {formData['ALUNO'] || 'Registro Sem Nome de Aluno'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(formData)}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
                title="Duplicar este registro no período 2027"
              >
                Duplicar p/ 2027
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Fechar editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Field Filter */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(Object.keys(FIELD_GROUPS) as FieldGroup[]).map((groupKey) => (
                <button
                  key={groupKey}
                  type="button"
                  onClick={() => {
                    setActiveGroup(groupKey);
                    setFieldSearch('');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeGroup === groupKey && !fieldSearch
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {FIELD_GROUPS[groupKey]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setActiveGroup('todos');
                  setFieldSearch('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeGroup === 'todos' && !fieldSearch
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos (57)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveGroup('json');
                  setFieldSearch('');
                }}
                className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeGroup === 'json' && !fieldSearch
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                JSON Row
              </button>
            </div>
          </div>

          {activeGroup !== 'json' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Buscar campo SQL (ex: PERIODO, CODPLANOPGTO, CPF, EBEP, TURMA)..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          {activeGroup === 'json' && !fieldSearch ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Representação JSON exata desta linha na consulta <code className="font-mono text-slate-700">SE42018_2 Produc</code>
                </span>
                <button
                  type="button"
                  onClick={handleCopyRowJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedJson ? 'JSON Copiado' : 'Copiar Objeto JSON'}
                </button>
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
                {getCleanRowJson()}
              </pre>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredFields.map((field) => {
                const keyStr = String(field.key);
                const val = formData[keyStr];
                const displayVal = val === null || val === undefined ? '' : String(val);
                const isModified = formData._modifiedFields?.includes(keyStr);

                return (
                  <div
                    key={keyStr}
                    className={`flex flex-col gap-1 p-3 rounded-lg border transition-colors ${
                      keyStr === 'PERIODO'
                        ? 'border-blue-300 bg-blue-50/40'
                        : isModified
                        ? 'border-amber-300 bg-amber-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`field-${keyStr}`}
                        className="text-xs font-semibold text-slate-800 truncate"
                      >
                        {field.label}
                      </label>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {keyStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <input
                        id={`field-${keyStr}`}
                        type={field.isNumeric ? 'number' : 'text'}
                        value={displayVal}
                        placeholder="null"
                        onChange={(e) =>
                          handleFieldChange(keyStr, e.target.value, field.isNumeric)
                        }
                        className={`w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-300 placeholder:italic focus:outline-none focus:border-blue-600 ${
                          field.isMono ? 'font-mono tabular-nums' : ''
                        }`}
                      />
                      {keyStr === 'PERIODO' && displayVal !== '2027' && (
                        <button
                          type="button"
                          onClick={() => handleFieldChange('PERIODO', '2027', false)}
                          className="px-2 py-1.5 text-[11px] font-mono font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          Usar 2027
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Valores Originais
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {isNew ? 'Adicionar Registro' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
