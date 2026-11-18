"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getAppToken, getListenPosition, getSpeechRate, getSpeechVoice, setListenPosition, setSpeechRate, setSpeechVoice } from "@/lib/local-settings";
import { IS_ARTIFACT } from "@/lib/runtime";
import { loadDeviceVoices, SpeechController, type DeviceVoice, type EngineKind, type PlayerState } from "@/lib/speech/player";
import type { SpeechItem } from "@/lib/speech/segment";

export type VoiceOption = { id: string; label: string; hint?: string };
export type SpeechSupport =
  | { ready: false }
  | { ready: true; engine: EngineKind | "none"; voices: VoiceOption[]; deviceAvailable: boolean };

let supportCache: Promise<SpeechSupport> | null = null;

async function detect(): Promise<SpeechSupport> {
  const device = await loadDeviceVoices();
  const hebrew = device.filter((v) => v.lang === "he-IL");
  const deviceAvailable = hebrew.length > 0;
  if (!IS_ARTIFACT) {
    try {
      const res = await fetch("/api/tts", { headers: { "x-app-token": getAppToken() } });
      const body = (await res.json()) as { provider: string | null; voices: { id: string; label: string; gender: string }[] };
      if (body.provider && body.voices.length) {
        return {
          ready: true,
          engine: "cloud",
          deviceAvailable,
          voices: body.voices.map((v) => ({ id: v.id, label: v.label, hint: v.gender === "female" ? "קול נשי" : "קול גברי" })),
        };
      }
    } catch {
      // Offline or no server: the device voice.
    }
  }
  if (!deviceAvailable) return { ready: true, engine: "none", voices: [], deviceAvailable };
  return { ready: true, engine: "device", deviceAvailable, voices: hebrew.map((v: DeviceVoice) => ({ id: v.id, label: v.label, hint: v.local ? "במכשיר" : "מקוון" })) };
}

/** Which engine this device will speak with, and its voices. Checked once per visit. */
export function useSpeechSupport(): SpeechSupport {
  const [s, setS] = useState<SpeechSupport>({ ready: false });
  useEffect(() => {
    let live = true;
    supportCache ??= detect();
    void supportCache.then((v) => live && setS(v));
    return () => {
      live = false;
    };
  }, []);
  return s;
}

const IDLE: PlayerState = { status: "idle", index: 0, total: 0, itemProgress: 0, rate: 1, voiceId: "", engine: "device" };
const noop = () => () => {};

/**
 * The player for one piece of content. Remembers the speed, the voice and where listening
 * stopped (per `contentId`), so "continue listening" picks up at the same sentence.
 */
export function useSpeechPlayer(items: SpeechItem[], contentId: string, title: string, support: SpeechSupport) {
  const ref = useRef<SpeechController | null>(null);
  const [controller, setController] = useState<SpeechController | null>(null);
  // Read once per content (the lesson page is keyed by id). Shown only after support is known,
  // which is client-only, so the server render never differs.
  const [saved, setSaved] = useState(() => getListenPosition(contentId));

  useEffect(() => {
    if (!support.ready || support.engine === "none" || !items.length) return;
    const engine = support.engine;
    const savedVoice = getSpeechVoice(engine);
    const voiceId = support.voices.some((v) => v.id === savedVoice) ? savedVoice : (support.voices[0]?.id ?? "");
    const c = new SpeechController({
      items,
      engine,
      voiceId,
      rate: getSpeechRate(),
      startIndex: getListenPosition(contentId),
      title,
      deviceFallback: engine === "cloud" && support.deviceAvailable,
      onPosition: (i) => {
        const pos = i >= items.length ? 0 : i;
        setListenPosition(contentId, pos);
        setSaved(pos);
      },
    });
    ref.current = c;
    // The controller wraps browser audio (an external system) and must be rebuilt with its inputs.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- publishing the new external object
    setController(c);
    return () => {
      c.destroy();
      ref.current = null;
    };
  }, [items, contentId, title, support]);

  const state = useSyncExternalStore(controller?.subscribe ?? noop, controller?.getState ?? (() => IDLE), () => IDLE);

  const setRate = useCallback((r: number) => {
    ref.current?.setRate(r);
    setSpeechRate(r);
  }, []);
  const setVoice = useCallback(
    (id: string) => {
      ref.current?.setVoice(id);
      if (support.ready && support.engine !== "none") setSpeechVoice(support.engine, id);
    },
    [support],
  );

  return { controller, state, saved, setRate, setVoice };
}
