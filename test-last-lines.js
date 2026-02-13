/**
 * 测试代码：检查 new.rjs 最后几行为何不显示
 */
const fs = require('fs');
const path = require('path');
const { computeLineInformation } = require('./lib/compute-lines');

const oldPath = path.join(__dirname, 'examples/src/diff/javascript/old.rjs');
const newPath = path.join(__dirname, 'examples/src/diff/javascript/new.rjs');

const oldString = fs.readFileSync(oldPath, 'utf8');
const newString = fs.readFileSync(newPath, 'utf8');

// 1. 检查原始文件
console.log('========================================');
console.log('第一步：检查原始文件');
console.log('========================================\n');

const oldRaw = oldString.split('\n');
const newRaw = newString.split('\n');
console.log('原始文件行数（包括空结尾）:');
console.log('  old.rjs:', oldRaw.length, '行');
console.log('  new.rjs:', newRaw.length, '行');

console.log('\nnew.rjs 最后 5 行（原始）:');
for (let i = newRaw.length - 5; i < newRaw.length; i++) {
  console.log(`  行 ${i + 1}:`, JSON.stringify(newRaw[i]));
}

// 2. 检查 trimRight 后
console.log('\n========================================');
console.log('第二步：trimRight 后的行数');
console.log('========================================\n');

const trimmedOld = oldString.trimRight();
const trimmedNew = newString.trimRight();
const oldLines = trimmedOld.split('\n');
const newLines = trimmedNew.split('\n');

console.log('trimRight 后的行数:');
console.log('  oldLines.length:', oldLines.length);
console.log('  newLines.length:', newLines.length);

console.log('\nnewLines 最后 5 行:');
for (let i = newLines.length - 5; i < newLines.length; i++) {
  console.log(`  索引 [${i}] (行号 ${i + 1}):`, JSON.stringify(newLines[i]));
}

// 3. 检查 computeLineInformation 的输出
console.log('\n========================================');
console.log('第三步：computeLineInformation 输出');
console.log('========================================\n');

const { lineInformation } = computeLineInformation(oldString, newString);

console.log('lineInformation.length:', lineInformation.length);

// 统计各类型行数
let sameCount = 0, addedCount = 0, removedCount = 0;
lineInformation.forEach(r => {
  if (r.left && r.left.type === 0) sameCount++;
  if (r.right && r.right.type === 1) addedCount++;
  if (r.left && r.left.type === 2) removedCount++;
});
console.log('行类型统计:');
console.log('  SAME:', sameCount);
console.log('  ADDED:', addedCount);
console.log('  REMOVED:', removedCount);

// 4. 检查具体行号
console.log('\n========================================');
console.log('第四步：检查 new.rjs 的 466-471 行');
console.log('========================================\n');

for (let targetLine = 466; targetLine <= 471; targetLine++) {
  const rows = lineInformation.filter(r => r.right && r.right.lineNumber === targetLine);
  
  if (rows.length > 0) {
    const r = rows[0];
    const rowIndex = lineInformation.indexOf(r) + 1;
    const type = r.right.type === 0 ? 'SAME' : r.right.type === 1 ? 'ADDED' : 'REMOVED';
    const leftPair = r.left ? `配对 L${r.left.lineNumber}` : '无左边';
    console.log(`✓ new.rjs 第 ${targetLine} 行:`);
    console.log(`  - 在 diff 的第 ${rowIndex} 行`);
    console.log(`  - 类型: ${type}`);
    console.log(`  - ${leftPair}`);
    console.log(`  - 内容: ${JSON.stringify(r.right.value.slice(0, 50))}`);
  } else {
    console.log(`✗ new.rjs 第 ${targetLine} 行: 未找到`);
  }
  console.log('');
}

// 5. 检查 lineInformation 最后 10 行
console.log('========================================');
console.log('第五步：lineInformation 最后 10 行');
console.log('========================================\n');

lineInformation.slice(-10).forEach((r, i) => {
  const idx = lineInformation.length - 10 + i + 1;
  const L = r.left ? r.left.lineNumber : '-';
  const R = r.right ? r.right.lineNumber : '-';
  const ltype = r.left ? (r.left.type === 0 ? 'S' : r.left.type === 1 ? 'A' : 'R') : '-';
  const rtype = r.right ? (r.right.type === 0 ? 'S' : r.right.type === 1 ? 'A' : 'R') : '-';
  const content = (r.left && r.left.value) || (r.right && r.right.value) || '';
  console.log(`row ${idx}: L${L} R${R} (${ltype}/${rtype}) - ${JSON.stringify(content.slice(0, 40))}`);
});

// 6. 检查是否有重复的行号
console.log('\n========================================');
console.log('第六步：检查是否有重复的右边行号');
console.log('========================================\n');

const rightLineCounts = {};
lineInformation.forEach(r => {
  if (r.right && r.right.lineNumber) {
    const ln = r.right.lineNumber;
    rightLineCounts[ln] = (rightLineCounts[ln] || 0) + 1;
  }
});

const duplicates = Object.entries(rightLineCounts).filter(([_, count]) => count > 1);
if (duplicates.length > 0) {
  console.log('发现重复的右边行号:');
  duplicates.slice(-5).forEach(([line, count]) => {
    console.log(`  第 ${line} 行出现了 ${count} 次`);
  });
} else {
  console.log('✓ 没有重复的行号');
}

console.log('\n========================================');
console.log('诊断总结');
console.log('========================================\n');
console.log('如果 new.rjs 的 469、470、471 行都显示"未找到"，');
console.log('说明这些行号在 lineInformation 中不存在。');
console.log('请检查上面"第五步"的输出，看最后的 rightLineNumber 到多少。');
