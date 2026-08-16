// ============================================================
//  Verify your Identity — client-side KYC upload
//
//  Documents are stored ON THE SERVER (server/uploads + data.json),
//  so they survive a page reload, a re-login and a server restart,
//  and the back office sees them instantly.
//
//  Three required slots: Front of ID, Back of ID, Proof of Address.
// ============================================================
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Upload, CheckCircle2, Clock, XCircle, FileText, RefreshCw, Loader2 } from 'lucide-react';
import type { KycDocType } from '../../types';
import { KYC_DOC_LABELS } from '../../types';
import { apiKycMine, apiKycUpload, fetchKycFile } from '../../api';
import type { ApiKycDoc } from '../../api';
import { Card, Btn, Badge } from '../crm/ui';

const SLOTS: { type: KycDocType; hint: string }[] = [
  { type: 'front', hint: 'Passport, driver’s license or state ID — front side' },
  { type: 'back', hint: 'Back side of the same document' },
  { type: 'address', hint: 'Utility bill or bank statement, issued within 3 months' },
];

const MAX_MB = 8;

interface Props {
  onNotify: (message: string) => void;
  /** Bumped by the parent to force a refresh (e.g. after a review) */
  refreshKey?: number;
}

export const VerifyIdentity: React.FC<Props> = ({ onNotify, refreshKey = 0 }) => {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [documents, setDocuments] = useState<ApiKycDoc[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<KycDocType | null>(null);
  const [loading, setLoading] = useState(true);

  /** Pull the current state from the server */
  const reload = useCallback(async () => {
    try {
      const res = await apiKycMine();
      setDocuments(res.documents);

      // protected files need an authorised fetch → local object URLs
      const images = res.documents.filter(d => d.mime.startsWith('image/'));
      const pairs = await Promise.all(
        images.map(async d => {
          try {
            return [d.id, await fetchKycFile(d.id)] as const;
          } catch {
            return null;
          }
        }),
      );
      setPreviews(Object.fromEntries(pairs.filter(Boolean) as (readonly [number, string])[]));
    } catch {
      /* not signed in yet, or the server is unavailable */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  // release blob URLs when the component goes away
  useEffect(
    () => () => {
      Object.values(previews).forEach(url => URL.revokeObjectURL(url));
    },
    [previews],
  );

  const docFor = (type: KycDocType) => documents.find(d => d.type === type);

  const pick = (type: KycDocType, file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      onNotify(`File is too large — maximum ${MAX_MB} MB.`);
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      onNotify('Unsupported format — upload JPG, PNG, WEBP or PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(type);
      try {
        await apiKycUpload(type, file.name, String(reader.result));
        await reload();
        onNotify('Document uploaded — our compliance team will review it shortly.');
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setBusy(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const approvedCount = documents.filter(d => d.status === 'approved').length;
  const allApproved = approvedCount === SLOTS.length;

  return (
    <Card
      title="Verify your Identity"
      subtitle="Required before withdrawals can be processed"
      actions={
        <Badge tone={allApproved ? 'green' : approvedCount ? 'gold' : 'gray'}>
          {approvedCount}/{SLOTS.length} approved
        </Badge>
      }
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3 bg-[#1b1e26] border border-white/[.06] rounded-xl p-4">
          <ShieldCheck className="w-5 h-5 text-[#f5b400] shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-slate-400 leading-relaxed">
            Upload clear, uncropped photos where all four corners are visible. Your documents are stored securely and
            reviewed by our compliance team, usually within one business day.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SLOTS.map(slot => {
            const doc = docFor(slot.type);
            const status = doc?.status ?? 'missing';
            const isBusy = busy === slot.type;

            const border =
              status === 'approved'
                ? 'border-emerald-500/40'
                : status === 'rejected'
                ? 'border-rose-500/40'
                : status === 'pending'
                ? 'border-[#f5b400]/40'
                : 'border-white/[.08] border-dashed';

            return (
              <div key={slot.type} className={`bg-[#1b1e26] border ${border} rounded-2xl p-4 flex flex-col`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[13px] font-bold text-white">{KYC_DOC_LABELS[slot.type]}</div>
                  {status === 'approved' && (
                    <Badge tone="green">
                      <CheckCircle2 className="w-3 h-3" /> approved
                    </Badge>
                  )}
                  {status === 'pending' && (
                    <Badge tone="gold">
                      <Clock className="w-3 h-3" /> in review
                    </Badge>
                  )}
                  {status === 'rejected' && (
                    <Badge tone="red">
                      <XCircle className="w-3 h-3" /> rejected
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{slot.hint}</p>

                <div className="mt-3 h-28 rounded-xl bg-[#0f1116] border border-white/[.06] flex items-center justify-center overflow-hidden">
                  {loading ? (
                    <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                  ) : doc ? (
                    previews[doc.id] ? (
                      <img src={previews[doc.id]} alt={KYC_DOC_LABELS[slot.type]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-500">
                        <FileText className="w-6 h-6" />
                        <span className="text-[10px] px-2 text-center truncate max-w-full">{doc.fileName}</span>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-600">
                      <Upload className="w-6 h-6" />
                      <span className="text-[10px]">No file uploaded</span>
                    </div>
                  )}
                </div>

                {doc?.status === 'rejected' && doc.rejectReason && (
                  <div className="mt-2 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5">
                    {doc.rejectReason}
                  </div>
                )}

                {doc && (
                  <div className="text-[10px] text-slate-600 mt-2">
                    Uploaded {new Date(doc.uploadedAt).toLocaleString('en-US')}
                  </div>
                )}

                <input
                  ref={el => {
                    inputs.current[slot.type] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={e => {
                    pick(slot.type, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />

                <div className="mt-3">
                  {status === 'approved' ? (
                    <div className="text-[11px] text-emerald-400 text-center py-2">Verified — no action needed</div>
                  ) : (
                    <Btn
                      variant={doc && status !== 'rejected' ? 'ghost' : 'gold'}
                      icon={isBusy ? undefined : doc ? RefreshCw : Upload}
                      className="w-full justify-center"
                      disabled={isBusy}
                      onClick={() => inputs.current[slot.type]?.click()}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                        </>
                      ) : doc ? (
                        'Replace file'
                      ) : (
                        'Upload'
                      )}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {allApproved && (
          <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[12.5px] text-emerald-400">
              Identity verified. Withdrawals are now available on your account.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};
