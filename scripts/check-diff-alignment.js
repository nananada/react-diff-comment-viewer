/**
 * 检查 computeLineInformation 输出的行号、内容是否与 old.rjs / new.rjs 对齐
 * 运行: node scripts/check-diff-alignment.js
 */
const fs = require('fs');
const path = require('path');
const { computeLineInformation, DiffType } = require('../lib/compute-lines');

const oldPath = path.join(__dirname, '../examples/src/diff/javascript/old.rjs');
const newPath = path.join(__dirname, '../examples/src/diff/javascript/new.rjs');

const oldString = fs.readFileSync(oldPath, 'utf8');
const newString = fs.readFileSync(newPath, 'utf8');

const oldLines = oldString.trimRight().split('\n');
const newLines = newString.trimRight().split('\n');

const { lineInformation } = computeLineInformation(oldString, newString);

const typeStr = (t) => (t === DiffType.REMOVED ? 'REMOVED' : t === DiffType.ADDED ? 'ADDED' : 'SAME');
const clip = (s, len = 52) => (s == null ? '' : String(s).slice(0, len).replace(/\n/g, '↵'));

console.log('=== 前 95 行: 展示行号与内容 vs 文件实际行号与内容 ===\n');
console.log(
  'row'.padEnd(4) +
  'L#'.padEnd(5) + 'left content'.padEnd(56) +
  'R#'.padEnd(5) + 'right content'.padEnd(56) +
  'type'
);
console.log('-'.repeat(140));

let misalignLeft = [];
let misalignRight = [];

for (let i = 0; i < Math.min(95, lineInformation.length); i++) {
  const row = lineInformation[i];
  const left = row.left || {};
  const right = row.right || {};
  const L = left.lineNumber;
  const R = right.lineNumber;
  const lVal = left.value;
  const rVal = right.value;

  const lFile = L != null && L >= 1 && L <= oldLines.length ? oldLines[L - 1] : '';
  const rFile = R != null && R >= 1 && R <= newLines.length ? newLines[R - 1] : '';

  const lMatch = lVal === lFile || (left.type !== 0 && !lFile && !lVal);
  const rMatch = rVal === rFile || (right.type !== 0 && !rFile && !rVal);
  if (L != null && left.type !== undefined && !lMatch) misalignLeft.push({ row: i + 1, lineNum: L, show: clip(lVal), file: clip(lFile) });
  if (R != null && right.type !== undefined && !rMatch) misalignRight.push({ row: i + 1, lineNum: R, show: clip(rVal), file: clip(rFile) });

  console.log(
    String(i + 1).padEnd(4) +
    String(L ?? '-').padEnd(5) + clip(lVal).padEnd(56) +
    String(R ?? '-').padEnd(5) + clip(rVal).padEnd(56) +
    typeStr(left.type)
  );
}

console.log('\n=== 对齐检查（左列行号 N 的内容应等于 old.rjs 第 N 行）===');
if (misalignLeft.length === 0 && misalignRight.length === 0) {
  console.log('通过: 所有展示内容与文件对应行一致。');
} else {
  if (misalignLeft.length) {
    console.log('\n左列（old）不一致:');
    misalignLeft.slice(0, 15).forEach(({ row, lineNum, show, file }) =>
      console.log(`  展示行 ${row} 左#${lineNum}: 展示="${show}" 文件="${file}"`)
    );
    if (misalignLeft.length > 15) console.log(`  ... 共 ${misalignLeft.length} 处`);
  }
  if (misalignRight.length) {
    console.log('\n右列（new）不一致:');
    misalignRight.slice(0, 15).forEach(({ row, lineNum, show, file }) =>
      console.log(`  展示行 ${row} 右#${lineNum}: 展示="${show}" 文件="${file}"`)
    );
    if (misalignRight.length > 15) console.log(`  ... 共 ${misalignRight.length} 处`);
  }
}

console.log('\n=== old.rjs 85-95 行（文件实际）===');
for (let n = 84; n < 95 && n < oldLines.length; n++) console.log(`${n + 1}: ${clip(oldLines[n], 70)}`);
console.log('\n=== new.rjs 85-99 行（文件实际）===');
for (let n = 84; n < 99 && n < newLines.length; n++) console.log(`${n + 1}: ${clip(newLines[n], 70)}`);
