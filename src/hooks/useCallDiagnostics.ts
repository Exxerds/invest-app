import { useCallback, useEffect, useState } from 'react';

type StatsRecord = Record<string, unknown> & { id: string; type: string };

export interface CallDiagnosticsSnapshot {
  connectionState: string;
  iceConnectionState: string;
  iceGatheringState: string;
  localCandidateType: string;
  remoteCandidateType: string;
  protocol: string;
  relay: boolean;
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsReceived: number;
  roundTripTimeMs: number | null;
  updatedAt: number | null;
}

const EMPTY: CallDiagnosticsSnapshot = {
  connectionState: '—',
  iceConnectionState: '—',
  iceGatheringState: '—',
  localCandidateType: '—',
  remoteCandidateType: '—',
  protocol: '—',
  relay: false,
  bytesSent: 0,
  bytesReceived: 0,
  packetsSent: 0,
  packetsReceived: 0,
  roundTripTimeMs: null,
  updatedAt: null,
};

/** Read-only, secret-free WebRTC telemetry for the call diagnostics drawer. */
export function useCallDiagnostics(pc: RTCPeerConnection | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<CallDiagnosticsSnapshot>(EMPTY);

  const read = useCallback(async () => {
    if (!pc) {
      setSnapshot(EMPTY);
      return;
    }

    const stats = await pc.getStats();
    const reports = new Map<string, StatsRecord>();
    stats.forEach(report => {
      const item = report as StatsRecord;
      reports.set(item.id, item);
    });

    let pair: StatsRecord | undefined;
    reports.forEach(report => {
      if (report.type !== 'candidate-pair') return;
      if (report['state'] === 'succeeded' && (report['selected'] || report['nominated'])) pair = report;
    });

    let bytesSent = Number(pair?.['bytesSent'] || 0);
    let bytesReceived = Number(pair?.['bytesReceived'] || 0);
    let packetsSent = Number(pair?.['packetsSent'] || 0);
    let packetsReceived = Number(pair?.['packetsReceived'] || 0);

    reports.forEach(report => {
      if (report.type === 'outbound-rtp' && report['kind'] === 'audio') {
        bytesSent += Number(report['bytesSent'] || 0);
        packetsSent += Number(report['packetsSent'] || 0);
      }
      if (report.type === 'inbound-rtp' && report['kind'] === 'audio') {
        bytesReceived += Number(report['bytesReceived'] || 0);
        packetsReceived += Number(report['packetsReceived'] || 0);
      }
    });

    const local = typeof pair?.['localCandidateId'] === 'string'
      ? reports.get(pair['localCandidateId'])
      : undefined;
    const remote = typeof pair?.['remoteCandidateId'] === 'string'
      ? reports.get(pair['remoteCandidateId'])
      : undefined;
    const rawRtt = pair?.['currentRoundTripTime'];
    const roundTripTimeMs = typeof rawRtt === 'number' ? Math.round(rawRtt * 1000) : null;
    const localType = String(local?.['candidateType'] || '—');
    const remoteType = String(remote?.['candidateType'] || '—');

    setSnapshot({
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState,
      localCandidateType: localType,
      remoteCandidateType: remoteType,
      protocol: String(local?.['protocol'] || pair?.['protocol'] || '—'),
      relay: localType === 'relay' || remoteType === 'relay',
      bytesSent,
      bytesReceived,
      packetsSent,
      packetsReceived,
      roundTripTimeMs,
      updatedAt: Date.now(),
    });
  }, [pc]);

  useEffect(() => {
    if (!enabled || !pc) {
      setSnapshot(EMPTY);
      return;
    }
    let stopped = false;
    const tick = () => {
      if (!stopped) void read().catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled, pc, read]);

  return { snapshot, refresh: read };
}
