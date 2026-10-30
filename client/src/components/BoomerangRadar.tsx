import type { BoomerangSwarmResult, ManifoldHop, SwarmAgentState } from "../lib/boomerang/types";

type Props = { result: BoomerangSwarmResult | null };

const COLORS = ["#67e8f9", "#c084fc", "#fbbf24"];
const RETURN_COLORS = ["#22d3ee", "#a78bfa", "#f59e0b"];

function pointForHop(agentIndex: number, hopIndex: number, total: number, direction: ManifoldHop["direction"], center: number, radius: number) {
  const agentAngle = (agentIndex / 3) * Math.PI * 2 - Math.PI / 2;
  const progress = (hopIndex + 1) / Math.max(1, total);
  const spiral = direction === "RETURN" ? Math.PI * 1.15 : Math.PI * 2.1;
  const angle = agentAngle + progress * spiral;
  const radial = direction === "RETURN" ? radius * (0.82 - progress * 0.58) : 18 + progress * (radius - 24);
  return { x: center + Math.cos(angle) * radial, y: center + Math.sin(angle) * radial };
}

function agentCoreCids(agent: SwarmAgentState): Set<string> {
  return new Set(agent.digestive?.envelopes.filter((envelope) => envelope.core_flag).map((envelope) => envelope.artifact_cid) ?? []);
}

function downloadAudit(result: BoomerangSwarmResult): void {
  const payload = {
    schemaVersion: result.schemaVersion,
    exportedAt: new Date().toISOString(),
    queryHash: result.queryHash,
    merkleRoot: result.merkleRoot,
    serverAttestation: {
      algorithm: result.serverAttestation === "ED25519_ATTESTED" ? "Ed25519" : "pending",
      signatureHex: result.serverSignatureHex ?? null,
      pubkeyHex: result.serverPubkeyHex ?? null,
      keyId: result.serverKeyId ?? null,
    },
    agents: result.agents.map((agent) => ({
      agentId: agent.agentId,
      role: agent.role,
      phase: agent.phase,
      terminationReason: agent.terminationReason,
      coverage: agent.coverage,
      maxHops: agent.maxHops,
      coverageThreshold: agent.coverageThreshold,
      syntheticReturnVector: agent.syntheticReturnVector,
      outboundHops: agent.outboundHops,
      returnHops: agent.returnHops,
      localDigestiveResult: agent.digestive,
    })),
    verifiedEnvelopes: result.verifiedEnvelopes,
    rejectedEnvelopes: result.rejectedEnvelopes,
    globalFusion: result.globalFusion,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `boomerang-audit-${result.queryHash.slice(0, 12)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BoomerangRadar({ result }: Props) {
  if (!result) {
    return <div className="rounded-2xl border border-cyan-300/15 bg-black/20 p-5 text-sm text-slate-400">No Boomerang trajectory is active. Run a local MIST trace to launch the bounded swarm.</div>;
  }

  const center = 150;
  const radius = 124;
  const top = result.globalFusion.slice(0, 30);
  const globalCoreCids = new Set(result.agents.flatMap((agent) => Array.from(agentCoreCids(agent))));

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#06121c]/80 p-4 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">BOOMERANG SWARM · MANIFOLD TRAVERSAL</p><h3 className="mt-1 text-base font-semibold text-slate-100">Orbital manifold return radar</h3></div>
        <div className="flex items-center gap-2"><span className="rounded-full border border-emerald-300/25 px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-200">{result.serverAttestation === "ED25519_ATTESTED" ? "Ed25519 attested" : "Integrity only"}</span><button type="button" onClick={() => downloadAudit(result)} className="rounded-full border border-cyan-300/30 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-100 hover:bg-cyan-300/10">Export audit</button></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <svg viewBox="0 0 300 300" role="img" aria-label="Three-agent Boomerang orbital manifold radar" className="h-[300px] w-[300px] max-w-full rounded-full bg-[#02070d]">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(103,232,249,.24)" strokeDasharray="3 5" />
          {[42, 82].map((ring) => <circle key={ring} cx={center} cy={center} r={ring} fill="none" stroke="rgba(103,232,249,.10)" />)}
          <circle cx={center} cy={center} r="7" fill="#fbbf24" /><circle cx={center} cy={center} r="14" fill="none" stroke="#fbbf24" strokeOpacity=".4" />
          {result.agents.map((agent, agentIndex) => {
            const outbound = agent.outboundHops;
            const returning = agent.returnHops;
            const all = [...outbound, ...returning];
            const coreCids = agentCoreCids(agent);
            const outboundPoints = outbound.map((hop, index) => pointForHop(agentIndex, index, Math.max(1, outbound.length), "OUTBOUND", center, radius));
            const returnPoints = returning.map((hop, index) => pointForHop(agentIndex, outbound.length + index, Math.max(1, all.length), "RETURN", center, radius));
            const points = [...outboundPoints, ...returnPoints];
            return <g key={agent.agentId}>
              {points.map((point, index) => index > 0 ? <line key={`${agent.agentId}-line-${index}`} x1={points[index - 1].x} y1={points[index - 1].y} x2={point.x} y2={point.y} stroke={all[index].direction === "RETURN" ? RETURN_COLORS[agentIndex] : COLORS[agentIndex]} strokeOpacity={all[index].direction === "RETURN" ? .9 : .5} strokeWidth={all[index].direction === "RETURN" ? 2 : 1.2} strokeDasharray={all[index].direction === "RETURN" ? "4 3" : undefined} /> : null)}
              {points.map((point, index) => <circle key={`${agent.agentId}-dot-${index}`} cx={point.x} cy={point.y} r={coreCids.has(all[index].artifact.cid) ? 4.5 : 2.7} fill={coreCids.has(all[index].artifact.cid) ? "#fbbf24" : all[index].direction === "RETURN" ? RETURN_COLORS[agentIndex] : COLORS[agentIndex]}><title>{`${agent.role} ${all[index].direction} hop ${index + 1}: ${all[index].artifact.cid}`}</title></circle>)}
            </g>;
          })}
        </svg>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">{result.agents.map((agent, index) => <div key={agent.agentId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }} /><span className="text-xs font-semibold text-slate-200">{agent.role}</span></div><p className="mt-2 text-[11px] text-slate-400">{agent.outboundHops.length} outbound · {agent.returnHops.length} return</p><p className="text-[11px] text-slate-400">{Math.max(0, agent.maxHops - agent.outboundHops.length)} hops remaining · {Math.round(agent.coverage * 100)}% coverage</p><p className="text-[11px] text-amber-200">{agentCoreCids(agent).size} core artifacts</p></div>)}</div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-slate-300"><span>Hive convergence · {result.globalFusion.length} fused artifacts</span><span className="text-amber-200">{globalCoreCids.size} core</span></div>
          <div className="max-h-44 space-y-1 overflow-auto pr-1">{top.slice(0, 8).map((item) => <div key={item.artifact.cid} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2 text-xs"><span className="truncate text-slate-300">#{item.rank} {item.artifact.cid}</span><span className="ml-3 text-cyan-200">{item.weightedRrfScore.toFixed(5)}</span></div>)}</div>
          <p className="break-all text-[10px] text-slate-500">Merkle root: {result.merkleRoot}</p>
        </div>
      </div>
    </div>
  );
}
