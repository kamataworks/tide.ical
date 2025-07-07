import * as cheerio from 'cheerio';
import { stringify } from "csv-stringify/sync";
import fs from 'node:fs/promises'

const landingUrl = 'https://www.data.jma.go.jp/kaiyou/db/tide/suisan/index.php'

const htmlResp = await fetch(landingUrl)
const html = await htmlResp.text()
const $ = cheerio.load(html);
const years: string[] = [];
const formAction = $('#choihyolist').attr('action')


const headerMap: Record<string, { type: 'string' | 'degreeAndMinute' | 'number' | 'linkText', normalizedName: string }> = {
    "番号": { type: "string", normalizedName: "number" },
    "地点記号": { type: "string", normalizedName: "stationCode" },
    "掲載地点名": { type: "linkText", normalizedName: "station" },
    "緯度": { type: "degreeAndMinute", normalizedName: "latitude" },
    "経度": { type: "degreeAndMinute", normalizedName: "longitude" },
    "MSL-潮位表基準面": { type: "number", normalizedName: "MSLTideStandardSurface" },
    "MSLの標高": { type: "number", normalizedName: "MSLAltitude" },
    "潮位表基準面の標高": { type: "number", normalizedName: "tideStandardSurfaceAltitude" },
    "主要4分潮/M2/M2の振幅": { type: "number", normalizedName: "M2Amplitude" },
    "主要4分潮/M2/M2の遅角": { type: "number", normalizedName: "M2Phase" },
    "主要4分潮/S2/S2の振幅": { type: "number", normalizedName: "S2Amplitude" },
    "主要4分潮/S2/S2の遅角": { type: "number", normalizedName: "S2Phase" },
    "主要4分潮/K1/K1の振幅": { type: "number", normalizedName: "K1Amplitude" },
    "主要4分潮/K1/K1の遅角": { type: "number", normalizedName: "K1Phase" },
    "主要4分潮/O1/O1の振幅": { type: "number", normalizedName: "O1Amplitude" },
    "主要4分潮/O1/O1の遅角": { type: "number", normalizedName: "O1Phase" },
    "分潮一覧表": { type: "linkText", normalizedName: "harmonic60Constants" },
    "備考": { type: "string", normalizedName: "remarks" },
}

$('#choihyolist > select[name="ys"] option').each((_, option) => {
  const year = $(option).attr('value');
  if (year) {
    years.push(year)
  };
});

if(!formAction) {
  throw new Error('スクレイピングが失敗しました。')
}
const postUrl = new URL(formAction, landingUrl).toString();

await fs.mkdir('./choihyo', { recursive: true })

for (const year of years) {
  const choihyoResp = await fetch(postUrl, { method: 'POST' })
  const choihyoHtml = await choihyoResp.text()

  const $ = cheerio.load(choihyoHtml)

  // ヘッダー構築
  const rows: { abbr: string, colspan: number, rowspan: number }[][] = [];
  $('table.data2 thead tr, table.data2 tbody tr').slice(0, 3).each((_, tr) => {
    const row: { abbr: string, colspan: number, rowspan: number }[] = [];
    $(tr).children('th').each((_, th) => {
      const $th = $(th);
      const abbr = $th.attr('abbr') || $th.text().replace(/\s+/g, ' ').trim();
      const colspan = parseInt($th.attr('colspan') || '1');
      const rowspan = parseInt($th.attr('rowspan') || '1');
      row.push({ abbr, colspan, rowspan });
    });
    rows.push(row);
  });

  const maxDepth = rows.length;
  const table: string[][] = Array.from({ length: maxDepth }, () => []);

  rows.forEach((row, rowIndex) => {
    let colIndex = 0;
    row.forEach(cell => {
      while (table[rowIndex][colIndex]) colIndex++;
      for (let i = 0; i < cell.rowspan; i++) {
        for (let j = 0; j < cell.colspan; j++) {
          table[rowIndex + i][colIndex + j] = cell.abbr;
        }
      }
      colIndex += cell.colspan;
    });
  });

  // フラットな列名を構築
  const colCount = table[0].length;
  const headers: string[] = [];
  for (let col = 0; col < colCount; col++) {
    const parts: string[] = [];
    for (let row = 0; row < maxDepth; row++) {
      const val = table[row][col];
      if (val && (parts.length === 0 || parts[parts.length - 1] !== val)) {
        parts.push(val);
      }
    }
    headers.push(parts.join('/'));
  }

  // データ行を抽出
  const dataRows: any[] = [];
  $('table.data2 tbody tr.mtx').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length !== headers.length) return; // 備考行など無視
    const rowData = {};
    tds.each((i, td) => {
      const cell = $(td);
      const name = cell.text().trim().replace(/\s+/g, ' ');
      const relative_href = cell.find('a').attr('href')
      const href = relative_href ? new URL(relative_href, postUrl).toString() : null;

      if(href) {
        // @ts-ignore
        rowData[headers[i]] = { name, href };
      } else {
        // @ts-ignore
        rowData[headers[i]] = name;
      }
    });
    dataRows.push(rowData);
  });

  const jsonArray = dataRows.map(row => {
    const jsonRow: Record<string, string | { degree: number, minute: number } | number | { name: string, href: string }> = {};
    for (const [key, value] of Object.entries(row)) {
      switch(headerMap[key].type){
        case 'string':
          jsonRow[headerMap[key].normalizedName] = value as string;
          break;
        case 'degreeAndMinute':
          const degreeAndMinute = value as string; // 例: 139゜33'
          const match = degreeAndMinute.match(/^(\d+)゜(\d+)'$/);
          if (match) {
            const degree = parseInt(match[1], 10);
            const minute = parseInt(match[2], 10);
            jsonRow[headerMap[key].normalizedName] = { degree, minute };
          } else {
            jsonRow[headerMap[key].normalizedName] = 0; // 無効な値の場合は0
          }
          break;
        case 'number':
          jsonRow[headerMap[key].normalizedName] = parseFloat(value as string) || 0;
          break;
        case 'linkText':
          jsonRow[headerMap[key].normalizedName] = value as any;
          break;
      }
    }
    return jsonRow;
  })

  await fs.writeFile(`./choihyo/${year}.json`, JSON.stringify(jsonArray, null, 2), 'utf-8')

  await new Promise((resolve => setTimeout(resolve, 1000)))
}
