// 手機版佈局的 <main> 在夠高的視窗裡自己會有內部 overflow，但視窗太矮時 <main> 反而會被撐到跟內容
// 一樣高（沒有自己的捲動），這時真正在捲的是外層整個頁面。瀏覽器的 scrollIntoView 在兩種情況混著用
// 容易沿多層可捲祖先一起捲、捲過頭變空白，所以先判斷 <main> 這次是不是真的有自己的 overflow 再決定
// 要自己算距離捲 <main>，還是直接交給 scrollIntoView 捲外層。電腦版沒有 <main> 這層，一律走後者。
// behavior 固定用 "auto"（不是 "smooth"）——自動化測試環境下 smooth 捲動曾經完全卡住不動。
export function scrollWithin(el: HTMLElement, align: "start" | "center") {
  const container = el.closest("main");
  const mainHasOwnScroll = !!container && container.scrollHeight > container.clientHeight + 2;

  if (!mainHasOwnScroll) {
    el.scrollIntoView({ block: align, behavior: "auto" });
    return;
  }
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offsetWithinContainer = elRect.top - containerRect.top + container.scrollTop;
  const target = align === "start" ? offsetWithinContainer : offsetWithinContainer - container.clientHeight / 2 + el.clientHeight / 2;
  container.scrollTo({ top: Math.max(0, target), behavior: "auto" });
}

/**
 * 捲回最頂端，直接傳可捲動容器本身（例如 <main>）就好，不用像 scrollWithin 那樣傳容器內的子元素
 * ——傳容器自己給 scrollWithin 的話，元素跟容器重疊，算出來的偏移量會等於目前捲動位置，變成沒效果。
 */
export function scrollContainerToTop(container: HTMLElement) {
  if (container.scrollHeight > container.clientHeight + 2) {
    container.scrollTo({ top: 0, behavior: "auto" });
  } else {
    container.scrollIntoView({ block: "start", behavior: "auto" });
  }
}
