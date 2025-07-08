#!/usr/bin/env bun

/**
 * 潮位計算メインスクリプト
 *
 * 使用例: bun run choi.ts WN 20250701 20250705
 * 引数: [地点記号] [開始日YYYYMMDD] [終了日YYYYMMDD]
 */

import { generateTideData } from './src/harmonic-calculator.ts';
import { loadHarmonicConstants, getAvailableStations } from './src/json-parser.ts';
import { mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * 日付文字列をDateオブジェクトに変換
 * @param dateStr YYYYMMDD形式の日付文字列
 * @returns Dateオブジェクト（JST）
 */
function parseDate(dateStr: string): Date {
  if (dateStr.length !== 8) {
    throw new Error('日付は YYYYMMDD 形式で入力してください');
  }

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // Dateオブジェクトは0ベース
  const day = parseInt(dateStr.substring(6, 8));

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error('無効な日付形式です');
  }

  // JSTで日付を作成
  return new Date(year, month, day, 0, 0, 0);
}

/**
 * 出力ファイルパスを生成
 */
function generateOutputPath(stationCode: string, startDate: string, endDate: string): string {
  return `./build/choi/${stationCode}-${startDate}-${endDate}.json`;
}

/**
 * 使用方法を表示
 */
function showUsage(): void {
  console.log('使用方法: bun run choi.ts [地点記号] [開始日] [終了日]');
  console.log('');
  console.log('引数:');
  console.log('  地点記号: 潮位表の地点記号（例: WN）');
  console.log('  開始日:   YYYYMMDD形式（例: 20250701）');
  console.log('  終了日:   YYYYMMDD形式（例: 20250705）');
  console.log('');
  console.log('例: bun run choi.ts WN 20250701 20250705');
  console.log('');
  console.log('利用可能な地点記号を確認するには:');
  console.log('  bun run choi.ts --list');
}

/**
 * 利用可能な地点一覧を表示
 */
async function showAvailableStations(): Promise<void> {
  console.log('利用可能な地点記号を取得中...');
  const stations = await getAvailableStations();

  if (stations.length === 0) {
    console.log('地点データが見つかりませんでした。');
    return;
  }

  console.log(`\n利用可能な地点記号（${stations.length}地点）:`);
  console.log('地点記号');
  console.log('--------');
  stations.forEach(station => {
    console.log(station);
  });
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 引数チェック
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    return;
  }

  if (args[0] === '--list' || args[0] === '-l') {
    await showAvailableStations();
    return;
  }

  if (args.length !== 3) {
    console.error('❌ 引数の数が正しくありません。');
    showUsage();
    process.exit(1);
  }

  const [stationCode, startDateStr, endDateStr] = args;

  try {
    // 日付の解析
    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);

    // 日付の妥当性チェック
    if (startDate > endDate) {
      throw new Error('開始日は終了日より前である必要があります');
    }

    // 期間の長さチェック（あまりに長い期間は処理時間とファイルサイズの問題）
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 31) {
      console.warn('⚠️  31日を超える期間が指定されました。処理に時間がかかる場合があります。');
    }

    console.log('🌊 潮位計算を開始します...');
    console.log(`地点記号: ${stationCode}`);
    console.log(`期間: ${startDateStr} ～ ${endDateStr} (${daysDiff + 1}日間)`);

    // 調和定数を読み込み
    console.log('📊 調和定数を読み込み中...');
    const year = startDate.getFullYear();
    const harmonics = await loadHarmonicConstants(stationCode, year);

    if (!harmonics) {
      console.error(`❌ 地点記号 '${stationCode}' が見つかりません。`);
      console.log('\n利用可能な地点記号を確認するには:');
      console.log('  bun run choi.ts --list');
      process.exit(1);
    }

    console.log(`地点名: ${harmonics.stationName}`);
    console.log(`基準面: ${harmonics.baseLevel} cm`);

    // 潮位データを生成
    console.log('⚙️  潮位データを計算中...');

    // 終了日の23:59まで計算するため、終了日に23時間59分を追加
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 0, 0);

    const result = generateTideData(startDate, endDateTime, harmonics);

    console.log(`📈 ${result.data.length}件のデータポイントを生成しました`);


    // TODO:
    // 検証用に気象庁の潮位表をダウンロードして、指定した地点の潮位データを取得する機能を追加する。
    // URLの例: https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/2025/WN.txt
    // データのフォーマット:
    // テキストファイルの改行コードは「LF」です。
    // テキストファイルのフォーマットは以下のようになっています。
    // 毎時潮位データ	：	　１～　７２カラム	　３桁×２４時間（０時から２３時）
    //　年月日	：	７３～　７８カラム	　２桁×３
　  // 地点記号	：	７９～　８０カラム	　２桁英数字記号


    // 出力ディレクトリを作成
    const outputPath = generateOutputPath(stationCode, startDateStr, endDateStr);
    const outputDir = join(process.cwd(), 'build', 'choi');

    try {
      await mkdir(outputDir, { recursive: true });
    } catch (error) {
      // ディレクトリが既に存在する場合は無視
    }

    // JSONファイルに出力
    console.log('💾 ファイルに出力中...');
    const jsonContent = JSON.stringify(result, null, 2);
    await Bun.write(outputPath, jsonContent);

    console.log('✅ 潮位計算が完了しました！');
    console.log(`出力ファイル: ${outputPath}`);
    console.log(`ファイルサイズ: ${Math.round(jsonContent.length / 1024 * 100) / 100} KB`);

    // 統計情報を表示
    const tideLevels = result.data.map(d => d.tide_level);
    const minTide = Math.min(...tideLevels);
    const maxTide = Math.max(...tideLevels);
    const avgTide = tideLevels.reduce((sum, level) => sum + level, 0) / tideLevels.length;

    console.log('\n📊 統計情報:');
    console.log(`最高潮位: ${maxTide.toFixed(2)} cm`);
    console.log(`最低潮位: ${minTide.toFixed(2)} cm`);
    console.log(`平均潮位: ${avgTide.toFixed(2)} cm`);
    console.log(`潮位差: ${(maxTide - minTide).toFixed(2)} cm`);

  } catch (error) {
    console.error(`❌ エラーが発生しました: ${error}`);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみメイン処理を実行
if (import.meta.main) {
  main();
}
