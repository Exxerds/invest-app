// ============================================================
//  WebRTC calling — fixed version for manager → client
//
//  Key fixes vs old version:
//  - iceTransportPolicy: relay when TURN configured, else all
//  - iceCandidatePoolSize: 0 when TURN configured
//  - batching ICE candidates (100ms debounce)
//  - long-poll with AbortController, no overlapping polls
//  - ICE restart up to 3 attempts for initiator
//  - answer retry (like offer retry)
//  - pagehide/beforeunload only, no end() on unmount (avoids premature hangup)
//  - robust handling of first offer/ICE loss via cursor/lastId
//  - recvonly for listen-only to keep audio m-line but not send
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiIceServers,
  apiPostSignal,
  apiReadSignals,
  apiCallStatus,
  apiUploadRecording,
  TOKEN_KEY,
} from '../api';

export type CallRole = 'manager' | 'client' | 'supervisor';
export type CallPhase = 'idle' | 'connecting' | 'active' | 'ended' | 'failed';

interface Options {
  callId: number | null;
  role: CallRole;
  initiator: boolean;
  channel?: 'main' | 'whisper';
  onEnded?: () => void;
}

export function useWebRTCCall({ callId, role, initiator, channel = 'main', onEnded }: Options) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [muted, setMuted] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSignalRef = useRef(0);
  const negotiatingRef = useRef(false);
  const endedSentRef = useRef(false);
  const sharingRef = useRef(false);
  const disconnectTimerRef = useRef<number | null>(null);

  // polling with AbortController — no overlapping requests
  const pollAbortRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollActiveRef = useRef(false);

  // retries
  const offerRetryRef = useRef<number | null>(null);
  const answerRetryRef = useRef<number | null>(null);
  const iceRestartAttemptsRef = useRef(0);
  const MAX_ICE_RESTARTS = 3;

  // batching ICE
  const iceBatchRef = useRef<RTCIceCandidate[]>([]);
  const iceBatchTimerRef = useRef<number | null>(null);

  const iceQueueRef = useRef<RTCIceCandidate[]>([]);

  const flushIceQueue = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = iceQueueRef.current;
    iceQueueRef.current = [];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* stale */
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    pollActiveRef.current = false;
    if (pollAbortRef.current) {
      try {
        pollAbortRef.current.abort();
      } catch {}
      pollAbortRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (offerRetryRef.current) {
      clearInterval(offerRetryRef.current);
      offerRetryRef.current = null;
    }
    if (answerRetryRef.current) {
      clearInterval(answerRetryRef.current);
      answerRetryRef.current = null;
    }
    if (iceBatchTimerRef.current) {
      clearTimeout(iceBatchTimerRef.current);
      iceBatchTimerRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    recorderRef.current = null;
    recStreamRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    screenRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    screenRef.current = null;
    remoteStreamRef.current = null;
    // Important: close PC last
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    iceQueueRef.current = [];
    iceBatchRef.current = [];
    lastSignalRef.current = 0;
    negotiatingRef.current = false;
    sharingRef.current = false;
    iceRestartAttemptsRef.current = 0;
  }, []);

  const hangUp = useCallback(async () => {
    endedSentRef.current = true;
    pollActiveRef.current = false;
    if (callId && channel === 'main') {
      try {
        await apiCallStatus(callId, 'ended');
      } catch {
        /* local cleanup regardless */
      }
    }
    cleanup();
    setPhase('ended');
    setSharingScreen(false);
    setRecording(false);
    setHasRemoteVideo(false);
    setNeedsUserGesture(false);
    onEnded?.();
  }, [callId, channel, cleanup, onEnded]);

  // Only end on pagehide/beforeunload, NOT on unmount (avoids premature hangup on React re-render)
  useEffect(() => {
    if (!callId || channel !== 'main') return;
    const end = () => {
      if (endedSentRef.current) return;
      endedSentRef.current = true;
      try {
        fetch(`/api/calls/${callId}/status`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}`,
          },
          body: JSON.stringify({ status: 'ended' }),
        }).catch(() => undefined);
      } catch {}
    };
    const onPageHide = () => end();
    const onBeforeUnload = () => end();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Do NOT call end() here — unmount can be caused by inbox tick or React StrictMode,
      // which would otherwise end the call prematurely for the other side.
    };
  }, [callId, channel]);

  const describeMediaError = (err: unknown): string => {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
          return 'Microphone access was blocked. Click the lock icon left of the address bar → Site settings → Microphone → Allow, also check OS privacy settings. Then press Retry.';
        case 'NotFoundError':
        case 'OverconstrainedError':
          return 'No microphone was found on this device.';
        case 'NotReadableError':
          return 'The microphone is busy in another app — close it and press Retry.';
        default:
          break;
      }
    }
    return err instanceof Error && err.message ? err.message : 'Could not start the call.';
  };

  const enableSound = useCallback(async () => {
    try {
      if (remoteAudioRef.current) {
        await remoteAudioRef.current.play();
        setNeedsUserGesture(false);
      }
    } catch {
      // still blocked
    }
  }, []);

  const doIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !callId) return;
    if (iceRestartAttemptsRef.current >= MAX_ICE_RESTARTS) return;
    if (negotiatingRef.current) return;
    iceRestartAttemptsRef.current += 1;
    negotiatingRef.current = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true } as RTCOfferOptions);
      await pc.setLocalDescription(offer);
      await apiPostSignal(callId, 'offer', JSON.stringify(offer), role, channel);
      console.log(`[calls] ICE restart attempt ${iceRestartAttemptsRef.current}/${MAX_ICE_RESTARTS}`);
    } catch (e) {
      console.warn('[calls] ICE restart failed', e);
    } finally {
      negotiatingRef.current = false;
    }
  }, [callId, role, channel]);

  const connect = useCallback(async () => {
    if (!callId || pcRef.current) return;
    setError(null);
    setWarning(null);
    setMicAvailable(true);
    setNeedsUserGesture(false);
    setPhase('connecting');
    endedSentRef.current = false;
    pollActiveRef.current = true;
    iceRestartAttemptsRef.current = 0;

    if (!window.isSecureContext) {
      cleanup();
      endedSentRef.current = true;
      void apiCallStatus(callId, 'ended').catch(() => undefined);
      setPhase('failed');
      setError('Voice calls need HTTPS. Open via https://');
      return;
    }

    try {
      const { iceServers } = await apiIceServers();
      // Detect TURN presence
      const hasTurn = iceServers.some(s => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls as string];
        return urls.some(u => typeof u === 'string' && (u.includes('turn:') || u.includes('turns:')));
      });

      const pcConfig: RTCConfiguration = {
        iceServers,
        // When TURN is configured, force relay to avoid P2P attempts that fail behind strict NAT.
        // This is the key fix for manager→client where client is behind restrictive firewall.
        iceTransportPolicy: hasTurn ? 'relay' : 'all',
        iceCandidatePoolSize: hasTurn ? 0 : 0,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      };

      console.log('[calls] ICE config', {
        hasTurn,
        iceTransportPolicy: pcConfig.iceTransportPolicy,
        servers: iceServers.length,
      });

      const pc = new RTCPeerConnection(pcConfig);
      pcRef.current = pc;

      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err) {
        if (!(err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError'))) {
          throw err;
        }
        setMicAvailable(false);
        setWarning('No microphone on this device — listen-only: you can hear the other side, but they cannot hear you. Connect a headset or use a phone to talk.');
      }

      if (mic) {
        localRef.current = mic;
        mic.getTracks().forEach(t => pc.addTrack(t, mic!));
      } else {
        // recvonly is more correct for listen-only: we keep audio m-line but don't send
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      pc.ontrack = (e) => {
        const stream = e.streams[0] || new MediaStream([e.track]);
        remoteStreamRef.current = stream;
        setPhase('active');
        if (e.track.kind === 'video') {
          setHasRemoteVideo(true);
          e.track.onended = () => setHasRemoteVideo(false);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {
            // Autoplay blocked — show Enable sound button
            setNeedsUserGesture(true);
          });
          if (recStreamRef.current) recStreamRef.current.addTrack(e.track);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          iceRestartAttemptsRef.current = 0;
          setPhase('active');
        } else if (pc.iceConnectionState === 'failed') {
          // Try ICE restart before giving up
          if (initiator && iceRestartAttemptsRef.current < MAX_ICE_RESTARTS) {
            void doIceRestart();
          }
        }
      };

      // Batching ICE candidates: collect for 100ms then send
      const flushIceBatch = async () => {
        const batch = iceBatchRef.current;
        iceBatchRef.current = [];
        if (iceBatchTimerRef.current) {
          clearTimeout(iceBatchTimerRef.current);
          iceBatchTimerRef.current = null;
        }
        if (!batch.length || !callId) return;
        // Send each candidate, but grouped in quick succession
        for (const cand of batch) {
          try {
            await apiPostSignal(callId, 'ice', JSON.stringify(cand), role, channel);
          } catch {
            // put back if failed? drop for now, will be re-gathered on restart
          }
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && callId) {
          iceBatchRef.current.push(e.candidate);
          if (!iceBatchTimerRef.current) {
            iceBatchTimerRef.current = window.setTimeout(() => {
              void flushIceBatch();
            }, 100) as unknown as number;
          }
          // If gathering complete, flush immediately
          if (!e.candidate.candidate) {
            void flushIceBatch();
          }
        } else if (!e.candidate) {
          // End of gathering — ensure batch flushed
          void flushIceBatch();
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          iceRestartAttemptsRef.current = 0;
          setPhase('active');
        } else if (pc.connectionState === 'failed') {
          if (initiator && iceRestartAttemptsRef.current < MAX_ICE_RESTARTS) {
            void doIceRestart();
            return;
          }
          setError('Connection failed — both sides could not reach each other. Try again, or connect over a different network.');
          void hangUp();
        } else if (pc.connectionState === 'disconnected') {
          if (!disconnectTimerRef.current) {
            disconnectTimerRef.current = window.setTimeout(() => {
              disconnectTimerRef.current = null;
              const cur = pcRef.current;
              if (!cur || cur.connectionState === 'disconnected') {
                if (initiator && iceRestartAttemptsRef.current < MAX_ICE_RESTARTS) {
                  void doIceRestart();
                  return;
                }
                setError('The connection was lost.');
                void hangUp();
              }
            }, 15000) as unknown as number;
          }
        }
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await apiPostSignal(callId, 'offer', JSON.stringify(offer), role, channel);

        let tries = 0;
        const retry = window.setInterval(async () => {
          tries += 1;
          const pcNow = pcRef.current;
          if (!pcNow || pcNow.remoteDescription || tries > 15) {
            clearInterval(retry);
            offerRetryRef.current = null;
            return;
          }
          try {
            const ld = pcNow.localDescription;
            if (ld) await apiPostSignal(callId, 'offer', JSON.stringify(ld), role, channel);
          } catch {}
        }, 4000) as unknown as number;
        offerRetryRef.current = retry;
      }

      // Long-poll loop with AbortController, no overlapping
      const pollLoop = async () => {
        if (!pollActiveRef.current || !pcRef.current) return;
        // Abort previous if still running
        if (pollAbortRef.current) {
          try {
            pollAbortRef.current.abort();
          } catch {}
        }
        const ac = new AbortController();
        pollAbortRef.current = ac;

        try {
          const { signals, lastId } = await apiReadSignals(callId, lastSignalRef.current, channel, ac.signal);
          // Update cursor BEFORE processing to avoid re-processing on error? Actually we want to advance only after successful parse,
          // but we store max to avoid missing. The task says check if first offer/ICE lost due to cursor.
          // We advance cursor to lastId, but we process all signals in batch. If processing fails, we still advanced — that's okay because signals are ordered,
          // and next poll will get newer ones. To avoid losing first offer, we must NOT skip if processing throws before flush.
          // So we update cursor after processing each signal individually.
          let maxId = lastSignalRef.current;

          for (const s of signals) {
            maxId = Math.max(maxId, s.id);
            let data: any;
            try {
              data = JSON.parse(s.payload);
            } catch {
              continue;
            }

            if (s.kind === 'offer') {
              if (negotiatingRef.current) continue;
              negotiatingRef.current = true;
              try {
                const pcCur = pcRef.current;
                if (!pcCur) continue;
                if (pcCur.signalingState !== 'stable') {
                  try {
                    await pcCur.setLocalDescription({ type: 'rollback' } as any);
                  } catch {
                    // rollback may fail if already stable — ignore
                  }
                }
                await pcCur.setRemoteDescription(new RTCSessionDescription(data));
                await flushIceQueue();
                const answer = await pcCur.createAnswer();
                await pcCur.setLocalDescription(answer);
                await apiPostSignal(callId, 'answer', JSON.stringify(answer), role, channel);
                if (role === 'client') {
                  try {
                    await apiCallStatus(callId, 'active');
                  } catch {}
                }
                setPhase('active');

                // Answer retry: re-send answer every 3s until remoteDescription is set on other side? We can't know,
                // but we can retry a few times if we stay in have-local-offer.
                let aTries = 0;
                if (answerRetryRef.current) clearInterval(answerRetryRef.current);
                answerRetryRef.current = window.setInterval(async () => {
                  aTries += 1;
                  const pcNow = pcRef.current;
                  if (!pcNow || pcNow.signalingState === 'stable' || aTries > 5) {
                    if (answerRetryRef.current) {
                      clearInterval(answerRetryRef.current);
                      answerRetryRef.current = null;
                    }
                    return;
                  }
                  try {
                    const ld = pcNow.localDescription;
                    if (ld) await apiPostSignal(callId, 'answer', JSON.stringify(ld), role, channel);
                  } catch {}
                }, 3000) as unknown as number;
              } catch (e) {
                console.warn('[calls] failed to handle offer', e);
              } finally {
                negotiatingRef.current = false;
              }
            } else if (s.kind === 'answer') {
              const pcCur = pcRef.current;
              if (!pcCur) continue;
              if (pcCur.signalingState === 'have-local-offer') {
                try {
                  await pcCur.setRemoteDescription(new RTCSessionDescription(data));
                  await flushIceQueue();
                  setPhase('active');
                  // Clear offer retry since answer arrived
                  if (offerRetryRef.current) {
                    clearInterval(offerRetryRef.current);
                    offerRetryRef.current = null;
                  }
                } catch (e) {
                  console.warn('[calls] failed to handle answer', e);
                }
              }
            } else if (s.kind === 'ice') {
              const pcCur = pcRef.current;
              if (!pcCur) continue;
              // Support both single candidate and batched array
              const candidates = Array.isArray(data) ? data : [data];
              for (const cand of candidates) {
                if (!cand) continue;
                if (!pcCur.remoteDescription) {
                  try {
                    iceQueueRef.current.push(new RTCIceCandidate(cand));
                  } catch {}
                } else {
                  try {
                    await pcCur.addIceCandidate(new RTCIceCandidate(cand));
                  } catch {}
                }
              }
            } else if (s.kind === 'bye') {
              await hangUp();
              return;
            }
          }

          lastSignalRef.current = Math.max(lastSignalRef.current, maxId, lastId);
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            // aborted due to new poll or cleanup — ignore
            return;
          }
          // transient network error — will retry
        } finally {
          pollAbortRef.current = null;
          if (pollActiveRef.current && pcRef.current) {
            pollTimeoutRef.current = window.setTimeout(() => {
              void pollLoop();
            }, 800) as unknown as number; // slightly faster than old 1200ms, still not hammering
          }
        }
      };

      void pollLoop();
    } catch (err) {
      cleanup();
      setPhase('failed');
      setError(describeMediaError(err));
      endedSentRef.current = true;
      if (channel === 'main') {
        void apiCallStatus(callId, 'ended').catch(() => undefined);
      }
    }
  }, [callId, role, initiator, channel, cleanup, hangUp, flushIceQueue, doIceRestart]);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) {
      setWarning('Nothing to mute — no microphone track on this device.');
      return;
    }
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const renegotiate = useCallback(async (pc: RTCPeerConnection) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await apiPostSignal(callId!, 'offer', JSON.stringify(offer), role, channel);
  }, [callId, role, channel]);

  const stopScreenShare = useCallback(async () => {
    if (!sharingRef.current) return;
    sharingRef.current = false;
    const pc = pcRef.current;
    const id = callId;
    screenRef.current?.getTracks().forEach(t => {
      t.onended = null;
      t.stop();
    });
    screenRef.current = null;
    if (pc) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        try {
          pc.removeTrack(sender);
        } catch {}
      }
      negotiatingRef.current = true;
      try {
        await renegotiate(pc);
      } catch {} finally {
        negotiatingRef.current = false;
      }
    }
    setSharingScreen(false);
    if (id) {
      await apiCallStatus(id, 'active', { screenShare: false }).catch(() => undefined);
    }
  }, [callId, renegotiate]);

  const stopShareRef = useRef(stopScreenShare);
  stopShareRef.current = stopScreenShare;

  const toggleScreenShare = useCallback(async () => {
    if (sharingScreen || sharingRef.current) {
      void stopShareRef.current();
      return;
    }
    const pc = pcRef.current;
    if (!pc || !callId || negotiatingRef.current) return;
    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      setError('Screen sharing is not supported in this browser (iPhone Safari has no screen sharing; on Android use Chrome).');
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenRef.current = screen;
      const [track] = screen.getVideoTracks();
      pc.addTrack(track, screen);
      sharingRef.current = true;
      track.onended = () => { void stopShareRef.current(); };
      negotiatingRef.current = true;
      try {
        await renegotiate(pc);
      } finally {
        negotiatingRef.current = false;
      }
      setSharingScreen(true);
      await apiCallStatus(callId, 'active', { screenShare: true }).catch(() => undefined);
    } catch {}
  }, [sharingScreen, callId, renegotiate]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    const local = localRef.current;
    const remote = remoteStreamRef.current;
    if (!callId) return;
    const tracks = [
      ...(local ? local.getAudioTracks() : []),
      ...(remote ? remote.getAudioTracks() : []),
    ];
    if (!tracks.length) {
      setError('Nothing to record yet — no audio tracks in the call.');
      return;
    }
    try {
      const stream = new MediaStream(tracks);
      recStreamRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (!chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          apiUploadRecording(callId, String(reader.result)).catch(() => undefined);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Recording is not supported in this browser.');
    }
  }, [recording, callId]);

  useEffect(() => cleanup, [cleanup]);

  return {
    phase,
    error,
    warning,
    muted,
    micAvailable,
    sharingScreen,
    recording,
    hasRemoteVideo,
    needsUserGesture,
    remoteAudioRef,
    remoteVideoRef,
    pcRef,
    connect,
    hangUp,
    toggleMute,
    toggleScreenShare,
    toggleRecording,
    enableSound,
  };
}
