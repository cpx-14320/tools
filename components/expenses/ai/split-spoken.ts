/** 把一句口述切成「一筆一筆」——遇到金額就當成一筆的結尾。
 *
 *  **為什麼需要**：講「晚餐150元看電影300元」的時候，使用者心裡想的是兩筆，但語音辨識
 *  回來的是一整串沒有標點的字，解析那邊靠逗號／頓號／換行斷句（見 ai-mock.ts 的
 *  splitFragments），所以整串會被當成一筆、只取到最後一個數字 300。
 *
 *  **切法**：每段吃掉「一串非數字 ＋ 一個數字 ＋ 可選的元/塊」。數字本來就是一筆帳的終點，
 *  金額唸完就是下一筆的開始，這個假設在口述記帳的情境下幾乎都成立。
 *
 *  **已經有標點就不碰**：使用者自己唸了「逗號」、或辨識引擎自己加了標點時，那是更可靠的
 *  斷句依據，插手只會把一筆切成兩半。
 *
 *  **切不出名堂就原樣回傳**：只有一個金額（「晚餐150元」）或完全沒有金額（「忘記買什麼」）
 *  都不該被動到。
 *
 *  **已知切不好的情況**：品名本身是數字（「7-11買東西100元」會先切出一個「7」）。這裡把
 *  「整段都是數字」的碎片併進下一段來擋掉最常見的那種，但沒辦法全部處理——品名是數字時
 *  使用者要自己調整，這是刻意接受的取捨，不值得為它做一套中文斷詞。 */
export function splitSpokenEntries(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // 已經有分隔符：辨識引擎或使用者自己斷過句了，那比猜的準。
  if (/[，,、;；\n]/.test(trimmed)) return [trimmed];

  const matches = trimmed.match(/[^0-9]*\d[\d,]*(?:\.\d+)?\s*(?:元|塊|圓)?/g);
  if (!matches || matches.length < 2) return [trimmed];

  // 把碎片組起來：整段只有數字的（「7」）併進下一段，不然會切出一筆沒有品名的帳。
  const parts: string[] = [];
  let carry = "";
  for (const raw of matches) {
    const piece = carry + raw;
    carry = "";
    if (!/[^0-9\s,.\-元塊圓]/.test(piece)) {
      carry = piece;
      continue;
    }
    parts.push(piece.trim());
  }
  // 收尾：最後的進位、以及金額後面還沒唸完的字（「晚餐150元買水果」的「買水果」）
  // 都接到最後一段上，不要生出一筆沒有金額的帳。
  const consumed = matches.join("");
  const rest = (carry + trimmed.slice(consumed.length)).trim();
  if (rest) {
    if (parts.length > 0) parts[parts.length - 1] = `${parts[parts.length - 1]}${rest}`;
    else parts.push(rest);
  }

  return parts.length > 1 ? parts : [trimmed];
}
