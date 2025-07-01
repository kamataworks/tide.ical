/**
 * 潮まわり判定機能
 * 黄経差に基づいて大潮・中潮・小潮・長潮・若潮を判定する
 */

export type TideName = '大潮' | '中潮' | '小潮' | '長潮' | '若潮';

export interface TideInfo {
  name: TideName;
  startLongitude: number;
  endLongitude: number;
  duration: number;
}

// 潮まわり判定表
const TIDE_RULES: TideInfo[] = [
  { name: '大潮', startLongitude: 343, endLongitude: 31, duration: 4 },
  { name: '中潮', startLongitude: 31, endLongitude: 67, duration: 3 },
  { name: '小潮', startLongitude: 67, endLongitude: 103, duration: 3 },
  { name: '長潮', startLongitude: 103, endLongitude: 115, duration: 1 },
  { name: '若潮', startLongitude: 115, endLongitude: 127, duration: 1 },
  { name: '中潮', startLongitude: 127, endLongitude: 163, duration: 3 },
  { name: '大潮', startLongitude: 163, endLongitude: 211, duration: 4 },
  { name: '中潮', startLongitude: 211, endLongitude: 247, duration: 3 },
  { name: '小潮', startLongitude: 247, endLongitude: 283, duration: 3 },
  { name: '長潮', startLongitude: 283, endLongitude: 295, duration: 1 },
  { name: '若潮', startLongitude: 295, endLongitude: 307, duration: 1 },
  { name: '中潮', startLongitude: 307, endLongitude: 343, duration: 3 }
];

/**
 * 黄経差から潮まわりを判定する
 * @param longitudeDifference 黄経差（度）
 * @returns 潮まわり名
 */
export function determineTideName(longitudeDifference: number): TideName {
  // 0-360度の範囲に正規化
  const normalizedLongitude = ((longitudeDifference % 360) + 360) % 360;

  for (const rule of TIDE_RULES) {
    if (isInRange(normalizedLongitude, rule.startLongitude, rule.endLongitude)) {
      return rule.name;
    }
  }

  // デフォルト（通常は到達しない）
  return '大潮';
}

/**
 * 角度が指定された範囲内にあるかチェックする
 * 360度を跨ぐ範囲も考慮する
 * @param angle チェック対象の角度
 * @param start 開始角度
 * @param end 終了角度
 * @returns 範囲内にある場合true
 */
function isInRange(angle: number, start: number, end: number): boolean {
  if (start <= end) {
    // 通常の範囲（例: 31° ～ 67°）
    return angle >= start && angle < end;
  } else {
    // 360度を跨ぐ範囲（例: 343° ～ 31°）
    return angle >= start || angle < end;
  }
}

/**
 * 日付と月齢情報の配列から潮まわり期間を計算する
 * @param moonPhases 月齢情報の配列
 * @returns 潮まわり期間の配列
 */
export function calculateTidePeriods(moonPhases: Array<{
  date: Date;
  moonAge: number;
  longitudeDifference: number;
  emoji: string;
}>): Array<{
  tideName: TideName;
  startDate: Date;
  endDate: Date;
  emoji: string;
}> {
  if (moonPhases.length === 0) return [];

  const tidePeriods: Array<{
    tideName: TideName;
    startDate: Date;
    endDate: Date;
    emoji: string;
  }> = [];

  let currentTide = determineTideName(moonPhases[0].longitudeDifference);
  let periodStart = moonPhases[0].date;
  let periodEmoji = moonPhases[0].emoji;

  for (let i = 1; i < moonPhases.length; i++) {
    const newTide = determineTideName(moonPhases[i].longitudeDifference);

    if (newTide !== currentTide) {
      // 潮まわりが変わった場合、前の期間を終了
      tidePeriods.push({
        tideName: currentTide,
        startDate: new Date(periodStart),
        endDate: new Date(moonPhases[i - 1].date),
        emoji: periodEmoji
      });

      // 新しい期間を開始
      currentTide = newTide;
      periodStart = moonPhases[i].date;
      periodEmoji = moonPhases[i].emoji;
    }
  }

  // 最後の期間を追加
  if (moonPhases.length > 0) {
    tidePeriods.push({
      tideName: currentTide,
      startDate: new Date(periodStart),
      endDate: new Date(moonPhases[moonPhases.length - 1].date),
      emoji: periodEmoji
    });
  }

  return tidePeriods;
}

/**
 * 潮まわり名に基づいて説明を取得する
 * @param tideName 潮まわり名
 * @returns 潮まわりの説明
 */
export function getTideDescription(tideName: TideName): string {
  const descriptions: Record<TideName, string> = {
    '大潮': '満潮と干潮の差が最も大きい時期',
    '中潮': '大潮と小潮の中間の潮汐',
    '小潮': '満潮と干潮の差が最も小さい時期',
    '長潮': '小潮の終わりで潮の動きが緩やかな時期',
    '若潮': '小潮から大潮に向かう時期'
  };

  return descriptions[tideName];
}
