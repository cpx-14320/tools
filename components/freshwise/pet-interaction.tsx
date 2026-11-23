"use client";

import Image from "next/image";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { nextPetEmotion, petEmotionFile, petCareFile, PET_EMOTION_LABELS, PET_POSE_LABELS, type PetPose, type PetEmotion, type PetCareAction } from "@/lib/freshwise/pet-expressions";
import type { CompanionId } from "@/lib/freshwise/companions";

type Frame = { mood: PetPose; src: string };
type PendingFrame = { mood: PetEmotion | PetCareAction; src: string };

export interface PetReactionHandle {
  react: (action: PetCareAction) => void;
}

/** 畫框固定；新圖片解碼完成後才切換，照護動作可優先取代還在載入的隨機表情。 */
export function PetInteraction({ id, name, baseSrc, size, priority, reactionRef }: { id: CompanionId; name: string; baseSrc: string; size: number; priority: boolean; reactionRef?: Ref<PetReactionHandle> }) {
  const [frame, setFrame] = useState<Frame>({ mood: "neutral", src: baseSrc });
  const [pending, setPending] = useState<PendingFrame | null>(null);
  const [reaction, setReaction] = useState(0);
  const [message, setMessage] = useState("");
  const request = useRef<PendingFrame | null>(null);

  useImperativeHandle(reactionRef, () => ({
    react(action) {
      const src = petCareFile(id, action);
      if (!src) return;
      const next = { mood: action, src };
      request.current = next;
      setPending(next);
      setMessage("");
    },
  }), [id]);

  function interact() {
    if (request.current) return;
    const currentMood = frame.mood === "water" || frame.mood === "play" ? "neutral" : frame.mood;
    const mood = nextPetEmotion(currentMood);
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
    setMessage(next.mood === "water" ? `${name}收到澆水，好舒服！` : next.mood === "play" ? `${name}和你一起玩球，好開心！` : `${name}換成${PET_EMOTION_LABELS[next.mood]}的表情`);
  }
  function failed(next: PendingFrame) {
    if (request.current !== next) return;
    request.current = null;
    setPending(null);
    setMessage("圖片暫時載入失敗，可以再試一次。");
  }
  return <button type="button" className="fw-pet-trigger" onClick={interact} aria-busy={pending !== null} aria-label={`和${name}互動，隨機換表情，目前${PET_POSE_LABELS[frame.mood]}`}>
    <span key={reaction} className="fw-pet-visual" data-mood={frame.mood} data-reacted={reaction > 0 ? "true" : "false"}>
      <Image src={frame.src} alt={name} fill sizes={`${size}px`} priority={priority && frame.mood === "neutral"} unoptimized={frame.mood !== "neutral"} draggable={false}/>
    </span>
    {pending && <span className="fw-pet-pending" aria-hidden="true"><Image src={pending.src} alt="" fill sizes={`${size}px`} loading="eager" unoptimized draggable={false} onLoad={() => show(pending)} onError={() => failed(pending)}/></span>}
    <span className="sr-only" role="status" aria-live="polite">{message}</span>
  </button>;
}

