/** 給文字行內、小尺寸（搜尋框圖示、導覽列圖示等）用的小圖示佔位，不適合用 ImageSlot 那種
 *  大面積佔位框。漸層色跟真圖網址要寫在同一個 background-image 的逗號清單裡（不能分開用
 *  Tailwind 的 bg-gradient class + inline url 疊圖——inline style 的 background-image 會
 *  整個覆蓋掉 class 設的 background-image，不是疊加），圖片還沒上傳、404 時瀏覽器才會自動
 *  退回畫清單裡的下一層（漸層色），不需要額外的 onError 判斷。 */
export function IconImg({
  src,
  alt,
  size = 16,
  className = "",
  background = true,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  /** 已經有真圖、不需要漸層佔位墊底時關掉（例如底部導覽列）——不然圖片本身透明的地方
   *  會透出漸層色，看起來像圖示後面多一層顏色底。 */
  background?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={`inline-block shrink-0 rounded-[3px] bg-cover bg-center ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: background ? `url("${src}"), linear-gradient(to bottom right, #E4DCFB, #F6D9EE)` : `url("${src}")`,
      }}
    />
  );
}
