import type { CompanionId } from "./companions";

export const PET_EMOTIONS = ["surprised", "happy", "sad", "curious"] as const;
export type PetEmotion = typeof PET_EMOTIONS[number];
export type PetMood = PetEmotion | "neutral";
export const PET_EMOTION_LABELS: Record<PetMood, string> = { neutral: "平常", surprised: "驚訝", happy: "開心", sad: "難過", curious: "疑問" };
export const PET_IMAGE_FILES: Record<CompanionId, string> = {
  cabbage: "pet-cabbage-tuantuan.png", corn: "pet-corn-nuannuan.png", eggplant: "pet-eggplant-bobo.png",
  pumpkin: "pet-pumpkin-manman.png", radish: "pet-radish-bengbeng.png", strawberry: "pet-strawberry-jiujiu.png",
};
export function petEmotionFile(id: CompanionId, mood: PetEmotion): string {
  return `/freshwise/${PET_IMAGE_FILES[id].replace(/\.png$/, `-${mood}.webp`)}`;
}
/** 排除目前表情，避免連續點擊像是沒有變化。sample 可注入以驗證邊界。 */
export function nextPetEmotion(current: PetMood, sample = Math.random()): PetEmotion {
  const choices = PET_EMOTIONS.filter((mood) => mood !== current);
  const index = Number.isFinite(sample) ? Math.min(choices.length - 1, Math.max(0, Math.floor(sample * choices.length))) : 0;
  return choices[index];
}
