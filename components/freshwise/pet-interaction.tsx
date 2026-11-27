"use client";

import Image from "next/image";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { nextPetPose, petPoseFile, PET_EMOTION_LABELS, PET_POSE_LABELS, type PetPose, type PetEmotion, type PetCareAction, type PetStage } from "@/lib/freshwise/pet-expressions";
import type { CompanionId } from "@/lib/freshwise/companions";

type PendingFrame = { mood: PetEmotion | PetCareAction };

export interface PetReactionHandle {
  react: (action: PetCareAction) => void;
}

/** 畫框固定；圖片依目前等級取用，照護動作在升階後也會延續到新造型。 */
export function PetInteraction({ id, name, stage, size, priority, reactionRef }: { id: CompanionId; name: string; stage: PetStage; size: number; priority: boolean; reactionRef?: Ref<PetReactionHandle> }) {
  const [mood, setMood] = useState<PetPose>("neutral");
  const [pending, setPending] = useState<PendingFrame | null>(null);
  const [reaction, setReaction] = useState(0);
  const [message, setMessage] = useState("");
  const request = useRef<PendingFrame | null>(null);

  useImperativeHandle(reactionRef, () => ({
    react(action) {
      const next = { mood: action };
      request.current = next;
      setPending(next);
      setMessage("");
    },
  }), []);

  function interact() {
    if (request.current) return;
    const next = { mood: nextPetPose(mood) };
    request.current = next;
    setPending(next);
    setMessage("");
  }
  function show(next: PendingFrame) {
    if (request.current !== next) return;
    request.current = null;
    setMood(next.mood);
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
  const src = petPoseFile(id, mood, stage);
  const pendingSrc = pending ? petPoseFile(id, pending.mood, stage) : null;
  return <button type="button" className="fw-pet-trigger" onClick={interact} aria-busy={pending !== null} aria-label={`和${name}互動，隨機換表情與動作，目前${PET_POSE_LABELS[mood]}`}>
    <span key={reaction} className="fw-pet-visual" data-mood={mood} data-reacted={reaction > 0 ? "true" : "false"}>
      <Image src={src} alt={name} fill sizes={`${size}px`} priority={priority && mood === "neutral"} unoptimized={mood !== "neutral"} draggable={false}/>
    </span>
    {pending && pendingSrc && <span className="fw-pet-pending" aria-hidden="true"><Image key={pendingSrc} src={pendingSrc} alt="" fill sizes={`${size}px`} loading="eager" unoptimized draggable={false} onLoad={() => show(pending)} onError={() => failed(pending)}/></span>}
    <span className="sr-only" role="status" aria-live="polite">{message}</span>
  </button>;
}
