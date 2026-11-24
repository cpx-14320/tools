import type { CompanionId } from "./companions";

export const PET_EMOTIONS = ["surprised", "happy", "sad", "curious"] as const;
export type PetEmotion = typeof PET_EMOTIONS[number];
export type PetMood = PetEmotion | "neutral";
export const PET_EMOTION_LABELS: Record<PetMood, string> = { neutral: "平常", surprised: "驚訝", happy: "開心", sad: "難過", curious: "疑問" };
export const PET_IMAGE_FILES: Record<CompanionId, string> = {
  cabbage: "pet-cabbage-tuantuan.png", corn: "pet-corn-nuannuan.png", eggplant: "pet-eggplant-bobo.png",
  pumpkin: "pet-pumpkin-manman.png", radish: "pet-radish-bengbeng.png", strawberry: "pet-strawberry-jiujiu.png",
};

/** 六位夥伴共用成長門檻：1–3級嫩芽期、4–7級成長期、8級以上成熟期。 */
export type PetStage = 1 | 2 | 3;
export function petStage(_id: CompanionId, level: number): PetStage {
  return level >= 8 ? 3 : level >= 4 ? 2 : 1;
}

function petStageFile(id: CompanionId, stage: PetStage, suffix = ""): string {
  return `/freshwise/${PET_IMAGE_FILES[id].replace(/\.png$/, `-stage-0${stage}${suffix}.webp`)}`;
}

export function petBaseFile(id: CompanionId, level = 1): string {
  const stage = petStage(id, level);
  if (stage < 3) return petStageFile(id, stage);
  return `/freshwise/${id === "eggplant" ? "pet-eggplant-bobo-neutral.webp" : PET_IMAGE_FILES[id]}`;
}

export function petEmotionFile(id: CompanionId, mood: PetEmotion, level = 1): string {
  const stage = petStage(id, level);
  if (stage < 3) return petStageFile(id, stage, `-${mood}`);
  return `/freshwise/${PET_IMAGE_FILES[id].replace(/\.png$/, `-${mood}.webp`)}`;
}
/** 排除目前表情，避免連續點擊像是沒有變化。sample 可注入以驗證邊界。 */
export function nextPetEmotion(current: PetMood, sample = Math.random()): PetEmotion {
  const choices = PET_EMOTIONS.filter((mood) => mood !== current);
  const index = Number.isFinite(sample) ? Math.min(choices.length - 1, Math.max(0, Math.floor(sample * choices.length))) : 0;
  return choices[index];
}

/** 照護按鈕對應獨立輕量圖，與隨機表情分開命名。 */
export const PET_CARE_ACTIONS = ["water", "play"] as const;
export type PetCareAction = typeof PET_CARE_ACTIONS[number];
export type PetPose = PetMood | PetCareAction;
export const PET_POSE_LABELS: Record<PetPose, string> = { ...PET_EMOTION_LABELS, water: "開心接受澆水", play: "開心玩球" };

/** 點擊夥伴可隨機切換四種表情、澆水與玩耍，排除當前動作。 */
export function nextPetPose(current: PetPose, sample = Math.random()): PetEmotion | PetCareAction {
  const choices = [...PET_EMOTIONS, ...PET_CARE_ACTIONS].filter((pose) => pose !== current);
  const index = Number.isFinite(sample) ? Math.min(choices.length - 1, Math.max(0, Math.floor(sample * choices.length))) : 0;
  return choices[index];
}

export function petCareFile(id: CompanionId, action: PetCareAction, level = 1): string {
  const stage = petStage(id, level);
  if (stage < 3) return petStageFile(id, stage, `-action-${action}`);
  return `/freshwise/${PET_IMAGE_FILES[id].replace(/\.png$/, `-action-${action}.webp`)}`;
}

/** 畫面狀態只保存動作，檔案依目前等級即時決定，升階不會留住前一階的圖片。 */
export function petPoseFile(id: CompanionId, pose: PetPose, level = 1): string {
  if (pose === "neutral") return petBaseFile(id, level);
  return pose === "water" || pose === "play" ? petCareFile(id, pose, level) : petEmotionFile(id, pose, level);
}
