"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { nextPetEmotion, petEmotionFile, PET_EMOTION_LABELS, type PetMood, type PetEmotion } from "@/lib/freshwise/pet-expressions";
import type { CompanionId } from "@/lib/freshwise/companions";

type Frame = { mood: PetMood; src: string };
type PendingFrame = { mood: PetEmotion; src: string };

/** 固定畫框內切圖；只在點擊後載入單張 WebP，舊圖保留至新圖已解碼。 */
export function PetInteraction({ id, name, baseSrc, size, priority }: { id: CompanionId; name: string; baseSrc: string; size: number; priority: boolean }) {
  const [frame, setFrame] = useState<Frame>({ mood: "neutral", src: baseSrc });
  const [pending, setPending] = useState<PendingFrame | null>(null);
  const [reaction, setReaction] = useState(0);
  const [message, setMessage] = useState("");
  const request = useRef<PendingFrame | null>(null);

  function interact() {
    if (request.current) return;
    const mood = nextPetEmotion(frame.mood);
    const next = { mood, src: petEmotionFile(id, mood) };
    request.current = next;
    setPending(next);
    setMessage("");
  }
  function show(next: PendingFrame) {
    if (request.current !== next) return;
    request.current = null;
    setFrame(next);
    setPending(null);
    setReaction((value) => value + 1);
    setMessage(`${name}換成${PET_EMOTION_LABELS[next.mood]}的表情`);
  }
  function failed(next: PendingFrame) {
    if (request.current !== next) return;
    request.current = null;
    setPending(null);
    setMessage("表情暫時載入失敗，可以再點一次。");
  }
  return <button type="button" className="fw-pet-trigger" onClick={interact} aria-busy={pending !== null} aria-label={`和${name}互動，隨機換表情，目前${PET_EMOTION_LABELS[frame.mood]}`}>
    <span key={reaction} className="fw-pet-visual" data-mood={frame.mood} data-reacted={reaction > 0 ? "true" : "false"}>
      <Image src={frame.src} alt={name} fill sizes={`${size}px`} priority={priority && frame.mood === "neutral"} unoptimized={frame.mood !== "neutral"} draggable={false}/>
    </span>
    {pending && <span className="fw-pet-pending" aria-hidden="true"><Image src={pending.src} alt="" fill sizes={`${size}px`} loading="eager" unoptimized draggable={false} onLoad={() => show(pending)} onError={() => failed(pending)}/></span>}
    <span className="sr-only" role="status" aria-live="polite">{message}</span>
  </button>;
}
