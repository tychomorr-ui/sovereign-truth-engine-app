import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, FileCode2, ShieldAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyAuditReport, type AuditVerificationResult } from "../lib/mist/audit-verifier";

export default function KeiraVerify() {
  const [reportText, setReportText] = useState("");
  const [result, setResult] = useState<AuditVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const verify = async (text = reportText) => {
    setIsVerifying(true);
    try {
      const parsed = JSON.parse(text) as unknown;
      setResult(await verifyAuditReport(parsed));
    } catch (error) {
      setResult({ valid: false, reason: error instanceof Error ? error.message : "The uploaded file is not valid JSON." });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setReportText(text);
    await verify(text);
  };

  return (
    <main className="min-h-screen bg-[#03050d] px-5 py-10 text-[#f3eadb] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-[#273865] pb-5">
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#8be9ff]">KEIRA · external audit</div>
            <h1 className="mt-3 text-3xl tracking-[0.08em] text-[#f3eadb]">Trajectory verifier</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a6aec0]">Validate the report’s minimal Merkle commitment and its server-issued Ed25519 attestation entirely in this browser.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 border border-[#273865] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[#8be9ff] hover:bg-[#13213e]"><ArrowLeft className="h-4 w-4" /> Portal</Link>
        </div>

        <section className="border border-[#273865] bg-[#080f22]/90 p-5">
          <label htmlFor="audit-report-file" className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-[#6f55c7] bg-[#21154d]/25 px-4 py-5 text-xs uppercase tracking-[0.16em] text-[#cbb8ff] hover:bg-[#21154d]/50"><Upload className="h-4 w-4" /> Upload signed JSON report</label>
          <input id="audit-report-file" type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />
          <div className="my-4 text-center text-[0.62rem] uppercase tracking-[0.2em] text-[#737b8f]">or paste report JSON</div>
          <textarea aria-label="Audit report JSON" value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="Paste a KEIRA_MIST_MERKLE_VERIFICATION report here…" className="min-h-64 w-full resize-y border border-[#273865] bg-[#03050d] p-4 font-mono text-xs leading-5 text-[#dce7ff] outline-none focus:border-[#8be9ff]" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void verify()} disabled={!reportText.trim() || isVerifying} className="rounded-none bg-[#8be9ff] text-[#041018] hover:bg-[#c4f7ff]"><FileCode2 className="mr-2 h-4 w-4" />{isVerifying ? "Verifying…" : "Verify report"}</Button>
            <span className="text-xs text-[#737b8f]">No report data is uploaded to KEIRA by this verifier.</span>
          </div>
        </section>

        {result && (
          <section className={`mt-6 border p-5 ${result.valid ? "border-[#43d9b0] bg-[#0d302b]" : "border-[#ff7f9f] bg-[#351526]"}`} aria-live="polite">
            <div className={`flex items-center gap-3 text-lg font-bold tracking-[0.08em] ${result.valid ? "text-[#8ff5d5]" : "text-[#ffb6c7]"}`}>
              {result.valid ? <CheckCircle2 className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              {result.valid ? "✓ VALID TRAJECTORY" : "✗ INVALID OR TAMPERED REPORT"}
            </div>
            <p className="mt-3 text-sm leading-6 text-[#dce7ff]">{result.reason}</p>
            {result.valid && <dl className="mt-4 grid gap-3 border-t border-current/20 pt-4 text-xs sm:grid-cols-2"><div><dt className="uppercase tracking-[0.16em] text-[#a6aec0]">Timestamp</dt><dd className="mt-1 font-mono text-[#f3eadb]">{result.timestamp}</dd></div><div><dt className="uppercase tracking-[0.16em] text-[#a6aec0]">Query hash</dt><dd className="mt-1 break-all font-mono text-[#f3eadb]">{result.queryHash}</dd></div><div className="sm:col-span-2"><dt className="uppercase tracking-[0.16em] text-[#a6aec0]">Verified root</dt><dd className="mt-1 break-all font-mono text-[#8ff5d5]">{result.computedRoot}</dd></div></dl>}
          </section>
        )}
      </div>
    </main>
  );
}
