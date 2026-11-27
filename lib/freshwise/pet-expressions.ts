import { levelOf, unlockedStage, type CompanionId, type CompanionState } from "./companions";

export const PET_EMOTIONS = ["surprised", "happy", "sad", "curious"] as const;
export type PetEmotion = typeof PET_EMOTIONS[number];
export type PetMood = PetEmotion | "neutral";
export const PET_EMOTION_LABELS: Record<PetMood, string> = { neutral: "平常", surprised: "驚訝", happy: "開心", sad: "難過", curious: "疑問" };
/**
 * 每位夥伴的檔名前綴（不含階段、表情與副檔名）。
 *
 * 檔名一律是 `pet-<食材>-<角色>-stage-0<階段>[-<表情>|-action-<照護>]`，三個階段都一樣
 * ——第三階本來沒有 `-stage-03`（基底叫 `pet-cabbage-tuantuan.png`、波波的平常表情又另外
 * 叫 `-neutral.webp`），於是只有它需要在程式裡開特例。
 */
export const PET_IMAGE_PREFIX: Record<CompanionId, string> = {
  cabbage: "pet-cabbage-tuantuan", corn: "pet-corn-nuannuan", eggplant: "pet-eggplant-bobo",
  pumpkin: "pet-pumpkin-manman", radish: "pet-radish-bengbeng", strawberry: "pet-strawberry-jiujiu",
};

/** 六位夥伴共用成長門檻：1–3級嫩芽期、4–7級成長期、8級以上成熟期。
 *  門檻只定義在 companions.ts 的 `unlockedStage` 一處——那邊同時用來判斷「能不能挑這一階
 *  的外觀」，兩邊各寫一次的話調門檻就會有一邊漏改。 */
export type PetStage = 1 | 2 | 3;
export function petStage(_id: CompanionId, level: number): PetStage {
  return unlockedStage(level);
}

/**
 * 這隻夥伴現在**實際要畫**哪一階。
 *
 * 預設跟等級走，但使用者可以在圖鑑裡挑回第一、二階的樣子（`state.look`）。挑過頭的值
 * （還沒長到那一階）一律當沒挑——驗證在 `chooseCompanionLook`，這裡再擋一次是因為狀態
 * 可能是從舊資料或別台裝置來的。
 */
export function petLookStage(state: CompanionState, id: CompanionId): PetStage {
  const reached = unlockedStage(levelOf(state.growth[id]));
  const choice = state.look[id];
  return choice && choice <= reached ? choice : reached;
}

/** 階段圖的路徑。`suffix` 是表情（`-happy`）或照護動作（`-action-water`），不給就是這一階
 *  的平常樣子。三個階段、七種姿態都是 640×640 的 webp——**網頁用圖一律 webp**，PNG 母圖
 *  留在素材庫（見 public/freshwise/README.md）。 */
function petStageFile(id: CompanionId, stage: PetStage, suffix = ""): string {
  return `/freshwise/${PET_IMAGE_PREFIX[id]}-stage-0${stage}${suffix}.webp`;
}

/** 這一階的平常樣子。**吃的是階段不是等級**——畫哪一張圖只跟階段有關，而階段可能是
 *  使用者自己挑的（見 petLookStage）。 */
export function petBaseFile(id: CompanionId, stage: PetStage = 1): string {
  return petStageFile(id, stage);
}

export function petEmotionFile(id: CompanionId, mood: PetEmotion, stage: PetStage = 1): string {
  return petStageFile(id, stage, `-${mood}`);
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

export function petCareFile(id: CompanionId, action: PetCareAction, stage: PetStage = 1): string {
  return petStageFile(id, stage, `-action-${action}`);
}

/** 畫面狀態只保存動作，檔案依目前階段即時決定，升階（或在圖鑑換樣子）不會留住前一階的圖。 */
export function petPoseFile(id: CompanionId, pose: PetPose, stage: PetStage = 1): string {
  if (pose === "neutral") return petBaseFile(id, stage);
  return pose === "water" || pose === "play" ? petCareFile(id, pose, stage) : petEmotionFile(id, pose, stage);
}
