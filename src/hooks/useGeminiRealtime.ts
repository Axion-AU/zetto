import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Bidirectional voice client for the Gemini Live API
 * (v1beta GenerativeService.BidiGenerateContent over WebSocket).
 *
 * Responsibilities:
 * - stream 16 kHz PCM from the mic up, play 24 kHz PCM replies back
 * - surface incremental input/output transcriptions to the caller
 * - measure true response latency: from the end of the AI's spoken prompt
 *   to the learner's speech onset (RMS threshold on mic frames)
 *
 * Turn segmentation (who is speaking, VAD) is handled server-side; this
 * hook just reports events. Audio capture/playback is web-only for now —
 * native uses the same socket but needs an expo-av capture path.
 */

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL =
  process.env.EXPO_PUBLIC_GEMINI_LIVE_MODEL ??
  'gemini-2.5-flash-native-audio-preview-09-2025';
// Overridable for corporate proxies and integration tests.
const WS_BASE =
  process.env.EXPO_PUBLIC_GEMINI_WS_URL ??
  'wss://generativelanguage.googleapis.com/ws/' +
    'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const WS_URL = `${WS_BASE}?key=${API_KEY}`;

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
/** RMS above this on two consecutive frames counts as speech onset. */
const SPEECH_RMS_THRESHOLD = 0.015;

export type GeminiStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'closed';

export interface GeminiCallbacks {
  /** Incremental transcription of the learner's speech. */
  onUserTranscript?: (text: string) => void;
  /** Incremental transcription of the AI's speech. */
  onAiTranscript?: (text: string) => void;
  /** The AI finished its turn (spoken audio may still be draining). */
  onAiTurnComplete?: () => void;
  /** The learner barged in; queued AI audio was dropped. */
  onInterrupted?: () => void;
  /** Prompt-end → speech-onset gap for the learner's latest turn. */
  onResponseLatency?: (ms: number) => void;
  onError?: (message: string) => void;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function useGeminiRealtime(callbacks: GeminiCallbacks) {
  const [status, setStatus] = useState<GeminiStatus>('idle');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);

  // Keep the latest callbacks without re-wiring the socket on each render.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const wsRef = useRef<WebSocket | null>(null);

  // Recording pipeline
  const recordCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loudFramesRef = useRef(0);

  // Playback pipeline
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const playingSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Telemetry: wall-clock time the AI's spoken prompt will have finished.
  const promptEndAtRef = useRef<number | null>(null);

  const stopPlayback = useCallback(() => {
    for (const source of playingSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    playingSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsAiSpeaking(false);
  }, []);

  const playAudioChunk = useCallback((base64: string) => {
    if (Platform.OS !== 'web') return;

    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    const ctx = playbackCtxRef.current;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x7fff;

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    playingSourcesRef.current.push(source);
    setIsAiSpeaking(true);
    source.onended = () => {
      playingSourcesRef.current = playingSourcesRef.current.filter((s) => s !== source);
      if (playingSourcesRef.current.length === 0) setIsAiSpeaking(false);
    };
  }, []);

  /** Wall-clock time at which currently queued AI audio finishes draining. */
  const scheduledPromptEnd = useCallback((): number => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return Date.now();
    const remainingSec = Math.max(0, nextStartTimeRef.current - ctx.currentTime);
    return Date.now() + remainingSec * 1000;
  }, []);

  const markSpeechOnset = useCallback(() => {
    if (promptEndAtRef.current === null) return;
    const latency = Math.max(0, Date.now() - promptEndAtRef.current);
    promptEndAtRef.current = null;
    callbacksRef.current.onResponseLatency?.(latency);
  }, []);

  const handleServerMessage = useCallback(
    (msg: Record<string, any>) => {
      // The server speaks camelCase JSON; tolerate snake_case for safety.
      const content = msg.serverContent ?? msg.server_content;
      if (!content) return;

      const inputTranscription =
        content.inputTranscription ?? content.input_transcription;
      if (inputTranscription?.text) {
        callbacksRef.current.onUserTranscript?.(inputTranscription.text);
      }

      const outputTranscription =
        content.outputTranscription ?? content.output_transcription;
      if (outputTranscription?.text) {
        callbacksRef.current.onAiTranscript?.(outputTranscription.text);
      }

      const modelTurn = content.modelTurn ?? content.model_turn;
      for (const part of modelTurn?.parts ?? []) {
        const inline = part.inlineData ?? part.inline_data;
        if (inline?.data) playAudioChunk(inline.data);
      }

      if (content.interrupted) {
        stopPlayback();
        promptEndAtRef.current = null;
        callbacksRef.current.onInterrupted?.();
      }

      if (content.turnComplete ?? content.turn_complete) {
        promptEndAtRef.current = scheduledPromptEnd();
        callbacksRef.current.onAiTurnComplete?.();
      }
    },
    [playAudioChunk, scheduledPromptEnd, stopPlayback],
  );

  const connect = useCallback(
    (systemPrompt: string): Promise<void> => {
      if (!API_KEY) {
        setStatus('error');
        callbacksRef.current.onError?.(
          'Missing EXPO_PUBLIC_GEMINI_API_KEY — add it to .env.local to enable live sessions.',
        );
        return Promise.reject(new Error('missing API key'));
      }
      if (wsRef.current) return Promise.resolve();

      setStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      return new Promise((resolve, reject) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              setup: {
                model: `models/${MODEL}`,
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
                  },
                },
                systemInstruction: { parts: [{ text: systemPrompt }] },
                outputAudioTranscription: {},
                inputAudioTranscription: {},
              },
            }),
          );
        };

        ws.onmessage = async (event) => {
          try {
            const raw =
              typeof event.data === 'string'
                ? event.data
                : await (event.data as Blob).text();
            const msg = JSON.parse(raw);

            if (msg.setupComplete ?? msg.setup_complete) {
              setStatus('ready');
              resolve();
              return;
            }
            handleServerMessage(msg);
          } catch (err) {
            console.error('Failed to handle Gemini message:', err);
          }
        };

        ws.onerror = () => {
          setStatus('error');
          callbacksRef.current.onError?.(
            'Connection to the voice engine failed. Check your API key and network.',
          );
          reject(new Error('websocket error'));
        };

        ws.onclose = (event) => {
          wsRef.current = null;
          setStatus((prev) => (prev === 'error' ? prev : 'closed'));
          if (!event.wasClean && event.code !== 1000) {
            callbacksRef.current.onError?.(
              `Voice session closed unexpectedly (${event.code}${event.reason ? `: ${event.reason}` : ''}).`,
            );
          }
        };
      });
    },
    [handleServerMessage],
  );

  const closeMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    processorRef.current?.disconnect();
    recordCtxRef.current?.close();
    streamRef.current = null;
    processorRef.current = null;
    recordCtxRef.current = null;
    loudFramesRef.current = 0;
    setIsMicOpen(false);
  }, []);

  const openMic = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      callbacksRef.current.onError?.(
        'Voice capture is currently supported on web only. Use the text input on this platform.',
      );
      return false;
    }
    if (recordCtxRef.current) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      recordCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);

        // Speech-onset detection for latency telemetry.
        let sumSquares = 0;
        for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
        const rms = Math.sqrt(sumSquares / input.length);
        if (rms > SPEECH_RMS_THRESHOLD) {
          loudFramesRef.current += 1;
          if (loudFramesRef.current === 2) markSpeechOnset();
        } else {
          loudFramesRef.current = 0;
        }

        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  data: base64FromBytes(new Uint8Array(pcm16.buffer)),
                  mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
                },
              },
            }),
          );
        }
      };

      source.connect(processor);
      // ScriptProcessor needs a destination to fire; route through zero gain
      // so mic input is never audible locally.
      const silent = ctx.createGain();
      silent.gain.value = 0;
      processor.connect(silent);
      silent.connect(ctx.destination);

      setIsMicOpen(true);
      return true;
    } catch (err) {
      console.error('Failed to open microphone:', err);
      callbacksRef.current.onError?.(
        'Could not access the microphone. Check browser permissions.',
      );
      return false;
    }
  }, [markSpeechOnset]);

  /** Send a typed learner turn (text fallback for mic-less environments). */
  const sendText = useCallback(
    (text: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      markSpeechOnset();
      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text }] }],
            turnComplete: true,
          },
        }),
      );
    },
    [markSpeechOnset],
  );

  const disconnect = useCallback(() => {
    wsRef.current?.close(1000);
    wsRef.current = null;
    closeMic();
    stopPlayback();
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
    promptEndAtRef.current = null;
    setStatus('idle');
  }, [closeMic, stopPlayback]);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    status,
    isAiSpeaking,
    isMicOpen,
    hasApiKey: Boolean(API_KEY),
    connect,
    disconnect,
    openMic,
    closeMic,
    sendText,
  };
}
