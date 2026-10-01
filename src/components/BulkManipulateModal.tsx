import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { TOTVS_FIELDS, FIELD_GROUPS, FieldGroup } from '../types/totvs';

interface BulkManipulateModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onApplyBulkChange: (fieldKey: string, newValue: string | number | null) => void;
}

export const BulkManipulateModal: React.FC<BulkManipulateModalProps> = ({
  isOpen,
  selectedCount,
  onClose,
  onApplyBulkChange,
}) => {
  const [selectedField, setSelectedField] = useState<string>('PERIODO');
  const [newValue, setNewValue] = useState<string>('2027');
  const [setNull, setSetNull] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentFieldDef = TOTVS_FIELDS.find((f) => f.key === selectedField);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (setNull) {
      onApplyBulkChange(selectedField, null);
    } else if (currentFieldDef?.isNumeric && newValue.trim() !== '' && !Number.isNaN(Number(newValue))) {
      onApplyBulkChange(selectedField, Number(newValue));
    } else {
      onApplyBulkChange(selectedField, newValue);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Manipulação em Lote ({selectedCount} {selectedCount === 1 ? 'registro' : 'registros'})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Atualize simultaneamente qualquer coluna da consulta SQL selecionada
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Campo da Consulta SQL a Alterar
            </label>
            <select
              value={selectedField}
              onChange={(e) => {
                const nextKey = e.target.value;
                setSelectedField(nextKey);
                if (nextKey === 'PERIODO') setNewValue('2027');
                else setNewValue('');
              }}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {(Object.keys(FIELD_GROUPS) as FieldGroup[]).map((groupKey) => (
                <optgroup key={groupKey} label={FIELD_GROUPS[groupKey]}>
                  {TOTVS_FIELDS.filter((f) => f.group === groupKey).map((field) => (
                    <option key={String(field.key)} value={String(field.key)}>
                      {field.label} ({String(field.key)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Novo Valor para <code className="font-mono text-blue-700">{selectedField}</code>
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setNull}
                  onChange={(e) => setSetNull(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Definir como <code className="font-mono">null</code>
              </label>
            </div>
            <input
              type={currentFieldDef?.isNumeric ? 'number' : 'text'}
              disabled={setNull}
              value={setNull ? '' : newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={setNull ? 'Valor será definido como null' : 'Digite o novo valor...'}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          {selectedField === 'PERIODO' && !setNull && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Atalhos rápidos:</span>
              {['2027', '2026', '2018'].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setNewValue(yr)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors ${
                    newValue === yr
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar em {selectedCount} {selectedCount === 1 ? 'Registro' : 'Registros'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
