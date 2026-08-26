// ============================================================
//  Call diagnostics — live stats from RTCPeerConnection
//  Shows during active call, not after hangup (avoids new/new artifact)
// ============================================================
import { useEffect, useState, useRef } from 'react';

export interface CallDiag {
  connectionState: string;
  iceConnectionState: string;
  iceGatheringState: string;
  signalingState: string;
  localCandidateType: string;   // host / srflx / relay / -
  remoteCandidateType: string;
  localCandidateProtocol: string;
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsReceived: number;
  rttMs: number | null;
  hasRelay: boolean;
  gatheringComplete: boolean;
}

const EMPTY: CallDiag = {
  connectionState: '-',
  iceConnectionState: '-',
  iceGatheringState: '-',
  signalingState: '-',
  localCandidateType: '-',
  remoteCandidateType: '-',
  localCandidateProtocol: '-',
  bytesSent: 0,
  bytesReceived: 0,
  packetsSent: 0,
  packetsReceived: 0,
  rttMs: null,
  hasRelay: false,
  gatheringComplete: false,
};

export function useCallDiagnostics(
  pcRef: React.MutableRefObject<RTCPeerConnection | null> | { current: RTCPeerConnection | null },
  active: boolean,
) {
  const [diag, setDiag] = useState<CallDiag>(EMPTY);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setDiag(EMPTY);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const tick = async () => {
      const pc = pcRef.current;
      if (!pc) {
        // Keep last known values instead of resetting to '-' during brief null
        return;
      }

      let localType = '-';
      let remoteType = '-';
      let localProto = '-';
      let bytesSent = 0;
      let bytesReceived = 0;
      let packetsSent = 0;
      let packetsReceived = 0;
      let rtt: number | null = null;
      let hasRelay = false;

      try {
        const stats = await pc.getStats();
        for (const report of stats.values()) {
          // @ts-ignore
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            // @ts-ignore
            const localId = report.localCandidateId;
            // @ts-ignore
            const remoteId = report.remoteCandidateId;
            const local = stats.get(localId);
            const remote = stats.get(remoteId);
            // @ts-ignore
            if (local) {
              localType = local.candidateType || localType;
              localProto = local.protocol || localProto;
              if (local.candidateType === 'relay') hasRelay = true;
            }
            // @ts-ignore
            if (remote) {
              remoteType = remote.candidateType || remoteType;
              if (remote.candidateType === 'relay') hasRelay = true;
            }
            // @ts-ignore
            if (typeof report.currentRoundTripTime === 'number') {
              rtt = Math.round(report.currentRoundTripTime * 1000);
            }
          }
          // Fallback: check all local candidates for relay presence
          // @ts-ignore
          if (report.type === 'local-candidate' && report.candidateType === 'relay') {
            hasRelay = true;
            if (localType === '-') localType = 'relay';
          }
          // @ts-ignore
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            // @ts-ignore
            bytesSent += report.bytesSent || 0;
            // @ts-ignore
            packetsSent += report.packetsSent || 0;
          }
          // @ts-ignore
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            // @ts-ignore
            bytesReceived += report.bytesReceived || 0;
            // @ts-ignore
            packetsReceived += report.packetsReceived || 0;
          }
        }
      } catch {
        // getStats can throw if pc closed
      }

      setDiag({
        connectionState: pc.connectionState || '-',
        iceConnectionState: pc.iceConnectionState || '-',
        iceGatheringState: pc.iceGatheringState || '-',
        signalingState: pc.signalingState || '-',
        localCandidateType: localType,
        remoteCandidateType: remoteType,
        localCandidateProtocol: localProto,
        bytesSent,
        bytesReceived,
        packetsSent,
        packetsReceived,
        rttMs: rtt,
        hasRelay,
        gatheringComplete: pc.iceGatheringState === 'complete',
      });
    };

    // Immediate first tick
    void tick();
    timerRef.current = window.setInterval(tick, 1000) as unknown as number;

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, pcRef]);

  return diag;
}
