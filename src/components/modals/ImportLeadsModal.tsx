import React, { useState } from 'react';
import { X, Upload, Users, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Btn, Select, Badge } from '../crm/ui';
import { apiImportLeads } from '../../api';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  managers: string[];
  onImportSuccess: (count: number) => void;
}

interface ParsedRow {
  name: string;
  phone: string;
  email: string;
  potentialAmount: number;
  notes: string;
}

export const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({
  isOpen,
  onClose,
  managers,
  onImportSuccess,
}) => {
  const [csvText, setCsvText] = useState('');
  const [assignMode, setAssignMode] = useState<'round-robin' | 'single'>('round-robin');
  const [selectedManager, setSelectedManager] = useState(managers[0] || 'Laura Bennett (Senior Advisor)');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; invalid: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseCsv = (text: string) => {
    setError(null);
    setResult(null);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      setParsedRows([]);
      return;
    }

    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('name') || firstLine.includes('phone') || firstLine.includes('email');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const rows: ParsedRow[] = [];
    for (const line of dataLines) {
      // Split by comma, semicolon or tab
      const cols = line.split(/[,;\t]/).map(c => c.replace(/^["']|["']$/g, '').trim());
      if (!cols[0]) continue;

      const name = cols[0] || '';
      const phone = cols[1] || '';
      const email = cols[2] || '';
      const potential = Number(cols[3]?.replace(/[^0-9.]/g, '')) || 10000;
      const notes = cols.slice(4).join(' ') || 'Imported via CSV';

      rows.push({
        name,
        phone,
        email,
        potentialAmount: potential,
        notes,
      });
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setCsvText(content);
      parseCsv(content);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setImporting(true);
    setError(null);

    try {
      const assignees = assignMode === 'single' ? [selectedManager] : managers;
      const res = await apiImportLeads(parsedRows, assignees);
      setResult({
        imported: res.imported,
        duplicates: res.duplicates?.length || 0,
        invalid: res.invalid?.length || 0,
      });
      if (res.imported > 0) {
        onImportSuccess(res.imported);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-[#1C412C] p-6 text-[#F5F2E9] relative border-b border-[#1C412C]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[#B08B48] text-xs font-semibold mb-2">
            <Upload className="w-3.5 h-3.5 text-[#B08B48]" />
            <span>Lead Management</span>
          </div>
          <h2 className="font-serif text-xl font-bold">Import Leads from CSV</h2>
          <p className="text-xs text-[#F5F2E9]/75 mt-1">
            Batch import contacts with deduplication and round-robin manager assignment
          </p>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-[#1C412C]">Import Complete</div>
              <div className="text-sm text-[#213532]/80 space-y-1">
                <p>Successfully added <strong className="text-emerald-700">{result.imported}</strong> new leads into the pipeline.</p>
                {result.duplicates > 0 && (
                  <p className="text-amber-800 text-xs">Skipped {result.duplicates} duplicate contact(s).</p>
                )}
                {result.invalid > 0 && (
                  <p className="text-rose-700 text-xs">Skipped {result.invalid} invalid row(s).</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Btn variant="gold" onClick={onClose}>
                Done
              </Btn>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* File Upload Area */}
            <div>
              <label className="block text-xs font-bold text-[#213532] uppercase tracking-wide mb-1.5">
                Upload CSV file or paste text
              </label>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#F5F2E9] border-2 border-dashed border-[#E4DECB] rounded-xl cursor-pointer hover:border-[#B08B48] transition-colors text-xs font-semibold text-[#1C412C]">
                  <FileText className="w-4 h-4 text-[#B08B48]" />
                  <span>Choose CSV file</span>
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Paste Area */}
            <div>
              <textarea
                rows={3}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  parseCsv(e.target.value);
                }}
                placeholder="Name, Phone, Email, Potential Amount, Notes&#10;John Doe, +14155550199, john@example.com, 25000, Interested in Crypto"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E4DECB] rounded-xl text-xs text-[#213532] font-mono placeholder:text-[#213532]/40 focus:outline-none focus:border-[#B08B48] focus:ring-2 focus:ring-[#B08B48]/20 resize-none"
              />
            </div>

            {/* Manager Assignment */}
            <div className="p-4 bg-[#F5F2E9] border border-[#E4DECB] rounded-xl space-y-3">
              <div className="text-xs font-bold text-[#1C412C] uppercase tracking-wide flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#B08B48]" />
                <span>Manager Assignment (Distribution)</span>
              </div>
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-[#213532] font-medium">
                  <input
                    type="radio"
                    name="assignMode"
                    checked={assignMode === 'round-robin'}
                    onChange={() => setAssignMode('round-robin')}
                    className="accent-[#1C412C]"
                  />
                  <span>Round-Robin across all ({managers.length}) managers</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#213532] font-medium">
                  <input
                    type="radio"
                    name="assignMode"
                    checked={assignMode === 'single'}
                    onChange={() => setAssignMode('single')}
                    className="accent-[#1C412C]"
                  />
                  <span>Assign to specific manager</span>
                </label>
              </div>

              {assignMode === 'single' && (
                <Select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="w-full text-xs"
                >
                  {managers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              )}
            </div>

            {/* Preview table */}
            {parsedRows.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#213532] uppercase tracking-wide">
                    Preview ({parsedRows.length} rows ready)
                  </span>
                  <Badge tone="green">Valid CSV format</Badge>
                </div>
                <div className="max-h-40 overflow-y-auto border border-[#E4DECB] rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F5F2E9] sticky top-0 border-b border-[#E4DECB]">
                      <tr>
                        <th className="p-2 font-semibold text-[#1C412C]">Name</th>
                        <th className="p-2 font-semibold text-[#1C412C]">Phone</th>
                        <th className="p-2 font-semibold text-[#1C412C]">Email</th>
                        <th className="p-2 font-semibold text-[#1C412C]">Potential</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DECB]">
                      {parsedRows.slice(0, 10).map((r, idx) => (
                        <tr key={idx} className="hover:bg-[#F2EEDF]/50">
                          <td className="p-2 font-medium text-[#213532]">{r.name}</td>
                          <td className="p-2 font-mono text-[#213532]/70">{r.phone || '—'}</td>
                          <td className="p-2 text-[#213532]/70">{r.email || '—'}</td>
                          <td className="p-2 font-bold text-[#B08B48]">${r.potentialAmount.toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 10 && (
                  <p className="text-[10px] text-[#213532]/60 mt-1">Showing first 10 rows of {parsedRows.length} total.</p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Btn variant="ghost" onClick={onClose}>
                Cancel
              </Btn>
              <Btn
                variant="gold"
                icon={Upload}
                disabled={!parsedRows.length || importing}
                onClick={handleImport}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  `Import ${parsedRows.length} Leads`
                )}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
