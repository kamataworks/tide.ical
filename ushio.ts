#!/usr/bin/env bun

/**
 * 潮まわりICSファイル生成メインスクリプト
 * 実行日時の月の3ヶ月前から12ヶ月後（合計15ヶ月分）の潮まわり情報を生成
 */

import { calculateMoonPhases } from './src/moon-phase.ts';
import { calculateTidePeriods } from './src/tide-calculator.ts';
import { generateICSContent, saveICSFile, generateTideStatistics, type TidePeriod } from './src/ics-generator.ts';

/**
 * 実行日時を基準に期間を計算する
 * @param baseDate 基準日時（デフォルトは現在日時）
 * @returns 開始日と終了日
 */
function calculateDateRange(baseDate: Date = new Date()): { startDate: Date; endDate: Date } {
  // 基準月の3ヶ月前を開始日とする
  const startDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - 3, baseDate.getDate());

  // 基準月の12ヶ月後を終了日とする
  const endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 13, baseDate.getDate());

  return { startDate, endDate };
}

/**
 * 日付を日本語形式でフォーマットする
 * @param date フォーマット対象の日付
 * @returns 日本語形式の日付文字列
 */
function formatDateJapanese(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 統計情報を表示する
 * @param statistics 統計情報
 */
function displayStatistics(statistics: ReturnType<typeof generateTideStatistics>): void {
  console.log('\n=== 潮まわり統計情報 ===');
  console.log(`期間: ${formatDateJapanese(statistics.dateRange.start)} ～ ${formatDateJapanese(statistics.dateRange.end)}`);
  console.log(`総期間数: ${statistics.totalPeriods}期間`);
  console.log('\n各潮まわりの出現回数:');

  const tideNames: Array<keyof typeof statistics.tideCount> = ['大潮', '中潮', '小潮', '長潮', '若潮'];
  tideNames.forEach(tideName => {
    console.log(`  ${tideName}: ${statistics.tideCount[tideName]}回`);
  });
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    console.log('🌊 潮まわりICSファイル生成を開始します...\n');

    // 実行時刻を取得
    const now = new Date();
    console.log(`実行日時: ${formatDateJapanese(now)} ${now.toLocaleTimeString('ja-JP')}`);

    // 期間を計算
    const { startDate, endDate } = calculateDateRange(now);
    console.log(`生成期間: ${formatDateJapanese(startDate)} ～ ${formatDateJapanese(endDate)}`);
    console.log(`期間: ${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}日間\n`);

    // 月齢情報を計算
    console.log('🌙 月齢情報を計算中...');
    const moonPhases = calculateMoonPhases(startDate, endDate);
    console.log(`月齢データ: ${moonPhases.length}日分を計算完了`);

    // 潮まわり期間を計算
    console.log('🌊 潮まわり期間を計算中...');
    const tidePeriods = calculateTidePeriods(moonPhases);
    console.log(`潮まわり期間: ${tidePeriods.length}期間を計算完了`);

    // 統計情報を表示
    const statistics = generateTideStatistics(tidePeriods);
    displayStatistics(statistics);

    // ICSファイルを生成
    console.log('\n📅 ICSファイルを生成中...');
    const icsContent = generateICSContent(tidePeriods, '日本の潮まわりカレンダー');

    // ファイルを保存
    const outputPath = './build/ushio.ics';
    await saveICSFile(icsContent, outputPath);

    console.log('\n✅ 潮まわりICSファイルの生成が完了しました！');
    console.log(`出力ファイル: ${outputPath}`);
    console.log(`ファイルサイズ: ${Math.round(icsContent.length / 1024 * 100) / 100} KB`);

    // 最初の数期間を表示（デバッグ用）
    console.log('\n=== 最初の5期間（プレビュー） ===');
    tidePeriods.slice(0, 5).forEach((period, index) => {
      const duration = Math.ceil((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`${index + 1}. ${period.emoji} ${period.tideName}: ${formatDateJapanese(period.startDate)} ～ ${formatDateJapanese(period.endDate)} (${duration}日間)`);
    });

    if (tidePeriods.length > 5) {
      console.log(`... 他 ${tidePeriods.length - 5} 期間`);
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみメイン処理を実行
if (import.meta.main) {
  main();
}
