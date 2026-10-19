import type { BoomerangSwarmResult } from "../lib/boomerang/types";

type Props = { result: BoomerangSwarmResult | null };

const COLORS = ["#67e8f9", "#c084fc", "#fbbf24"];

export function BoomerangRadar({ result }: Props) {
  if (!result) {
    return <div className="rounded-2xl border border-cyan-300/15 bg-black/20 p-5 text-sm text-slate-400">No Boomerang trajectory is active. Run a local MIST trace to launch the bounded swarm.</div>;
  }

  const center = 150;
  const maxRadius = 112;
  const top = result.globalFusion.slice(0, 30);
  const points = top.map((item, index) => {
    const angle = (index / Math.max(1, top.length)) * Math.PI * 2 - Math.PI / 2;
    const radius = 34 + (index / Math.max(1, top.length - 1)) * maxRadius;
    return { item, x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });
  const agentLines = result.agents.flatMap((agent, agentIndex) => {
    const color = COLORS[agentIndex % COLORS.length];
    return agent.hops.slice(0, 16).map((hop, hopIndex) => {
      const from = points.find((point) => point.item.artifact.cid === (agent.hops[hopIndex - 1]?.artifact.cid ?? hop.artifact.cid));
      const to = points.find((point) => point.item.artifact.cid === hop.artifact.cid);
      if (!to) return null;
      return <line key={`${agent.agentId}-${hop.direction}-${hop.hopIndex}`} x1={from?.x ?? center} y1={from?.y ?? center} x2={to.x} y2={to.y} stroke={color} strokeOpacity={hop.direction === "RETURN" ? 0.82 : 0.42} strokeWidth={hop.direction === "RETURN" ? 1.8 : 1} strokeDasharray={hop.direction === "RETURN" ? "4 3" : undefined} />;
    }).filter(Boolean);
  });

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#06121c]/80 p-4 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">BOOMERANG SWARM · PHASES 5–10</p><h3 className="mt-1 text-base font-semibold text-slate-100">Orbital manifold return radar</h3></div>
        <span className="rounded-full border border-emerald-300/25 px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-200">{result.serverAttestation === "ED25519_ATTESTED" ? "Attested" : "Integrity only"}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <svg viewBox="0 0 300 300" role="img" aria-label="Boomerang agent orbital radar" className="h-[300px] w-[300px] max-w-full rounded-full bg-[#02070d]">
          {[42, 82, 122].map((radius) => <circle key={radius} cx={center} cy={center} r={radius} fill="none" stroke="rgba(103,232,249,.13)" />)}
          <line x1={center} y1="12" x2={center} y2="288" stroke="rgba(103,232,249,.08)" /><line x1="12" y1={center} x2="288" y2={center} stroke="rgba(103,232,249,.08)" />
          {agentLines}
          {points.map(({ item, x, y }) => <g key={item.artifact.cid}><circle cx={x} cy={y} r={item.rank <= 3 ? 5 : 3} fill={item.rank <= 3 ? "#fbbf24" : "#67e8f9"} /><title>{`${item.rank}. ${item.artifact.cid} · ${item.weightedRrfScore.toFixed(5)}`}</title></g>)}
          <circle cx={center} cy={center} r="8" fill="#c084fc" /><circle cx={center} cy={center} r="14" fill="none" stroke="#c084fc" strokeOpacity=".35" />
        </svg>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">{result.agents.map((agent, index) => <div key={agent.agentId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }} /><span className="text-xs font-semibold text-slate-200">{agent.role}</span></div><p className="mt-2 text-[11px] text-slate-400">{agent.hops.length} hops · {Math.round(agent.coverage * 100)}% coverage</p></div>)}</div>
          <div className="max-h-44 space-y-1 overflow-auto pr-1">{top.slice(0, 8).map((item) => <div key={item.artifact.cid} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2 text-xs"><span className="truncate text-slate-300">#{item.rank} {item.artifact.cid}</span><span className="ml-3 text-cyan-200">{item.weightedRrfScore.toFixed(5)}</span></div>)}</div>
          <p className="break-all text-[10px] text-slate-500">Merkle root: {result.merkleRoot}</p>
        </div>
      </div>
    </div>
  );
}
