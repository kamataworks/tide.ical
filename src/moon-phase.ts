/**
 * 月齢計算機能
 * 朔の基準: 2000年1月6日 18:14（UTC）
 * 月齢周期: 29.53059日
 */

// 朔の基準日時（UTC）
const NEW_MOON_REFERENCE = new Date('2000-01-06T18:14:00.000Z');
const LUNAR_CYCLE_DAYS = 29.53059;

/**
 * 指定した日時の月齢を計算する
 * @param date 計算対象の日時
 * @returns 月齢（0-29.53059の範囲）
 */
export function calculateMoonAge(date: Date): number {
  const diffMs = date.getTime() - NEW_MOON_REFERENCE.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const moonAge = diffDays % LUNAR_CYCLE_DAYS;
  return moonAge < 0 ? moonAge + LUNAR_CYCLE_DAYS : moonAge;
}

/**
 * 月齢から黄経差を計算する
 * @param moonAge 月齢
 * @returns 黄経差（度）
 */
export function calculateLongitudeDifference(moonAge: number): number {
  // 月齢を360度に変換（0-360度の範囲）
  return (moonAge / LUNAR_CYCLE_DAYS) * 360;
}

/**
 * 月齢に基づいて適切な月の満ち欠けEmojiを取得する
 * @param moonAge 月齢
 * @returns 月の満ち欠けEmoji
 */
export function getMoonEmoji(moonAge: number): string {
  const phase = moonAge / LUNAR_CYCLE_DAYS;

  if (phase < 0.0625) return '🌑'; // 新月
  if (phase < 0.1875) return '🌒'; // 三日月
  if (phase < 0.3125) return '🌓'; // 上弦の月
  if (phase < 0.4375) return '🌔'; // 十三夜月
  if (phase < 0.5625) return '🌕'; // 満月
  if (phase < 0.6875) return '🌖'; // 寝待月
  if (phase < 0.8125) return '🌗'; // 下弦の月
  if (phase < 0.9375) return '🌘'; // 二十六夜月
  return '🌑'; // 新月
}

/**
 * 指定期間の各日の月齢情報を計算する
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns 各日の月齢情報の配列
 */
export function calculateMoonPhases(startDate: Date, endDate: Date): Array<{
  date: Date;
  moonAge: number;
  longitudeDifference: number;
  emoji: string;
}> {
  const phases: Array<{
    date: Date;
    moonAge: number;
    longitudeDifference: number;
    emoji: string;
  }> = [];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // Asia/Tokyoタイムゾーンで正午の時刻を基準に月齢を計算
    const noonJST = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0);
    const moonAge = calculateMoonAge(noonJST);
    const longitudeDifference = calculateLongitudeDifference(moonAge);
    const emoji = getMoonEmoji(moonAge);

    phases.push({
      date: new Date(currentDate),
      moonAge,
      longitudeDifference,
      emoji
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return phases;
}
