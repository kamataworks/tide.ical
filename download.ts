import * as cheerio from 'cheerio';
import { stringify } from "csv-stringify/sync";
import fs from 'node:fs/promises'

const landingUrl = 'https://www.data.jma.go.jp/kaiyou/db/tide/suisan/index.php'

const htmlResp = await fetch(landingUrl)
const html = await htmlResp.text()

const $ = cheerio.load(html);

const years: string[] = [];

const formAction = $('#choihyolist').attr('action')

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

await fs.mkdir('./cyoihyo', { recursive: true })

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
      const text = cell.text().trim().replace(/\s+/g, ' ');
      const link = cell.find('a').attr('href');
      // @ts-ignore
      rowData[headers[i]] = link ? JSON.stringify({ text, href: link }) : text;
    });
    dataRows.push(rowData);
  });


  const csv = stringify(dataRows, { header: true })
  await fs.writeFile(`./cyoihyo/${year}.csv`, csv)

  await new Promise((resolve => setTimeout(resolve, 1000)))

}
