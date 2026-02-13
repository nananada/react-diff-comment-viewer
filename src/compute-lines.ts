import * as diff from 'diff';

const jsDiff: { [key: string]: any } = diff;

export enum DiffType {
	DEFAULT = 0,
	ADDED = 1,
	REMOVED = 2,
}

// See https://github.com/kpdecker/jsdiff/tree/v4.0.1#api for more info on the below JsDiff methods
export enum DiffMethod {
	CHARS = 'diffChars',
	WORDS = 'diffWords',
	WORDS_WITH_SPACE = 'diffWordsWithSpace',
	LINES = 'diffLines',
	TRIMMED_LINES = 'diffTrimmedLines',
	SENTENCES = 'diffSentences',
	CSS = 'diffCss',
}

export interface DiffInformation {
	value?: string;
	lineNumber?: number;
	type?: DiffType;
}

export interface LineInformation {
	left?: DiffInformation;
	right?: DiffInformation;
}

export interface ComputedLineInformation {
	lineInformation: LineInformation[];
	diffLines: number[];
}

/**
 * Splits diff text by new line and computes final list of diff lines based on
 * conditions.
 *
 * @param value Diff text from the js diff module.
 */
const constructLines = (value: string): string[] => {
	const lines = value.split('\n');
	const isAllEmpty = lines.every((val): boolean => !val);
	if (isAllEmpty) {
		// This is to avoid added an extra new line in the UI.
		if (lines.length === 2) {
			return [];
		}
		lines.pop();
		return lines;
	}

	const lastLine = lines[lines.length - 1];
	const firstLine = lines[0];
	// Remove the first and last element if they are new line character. This is
	// to avoid addition of extra new line in the UI.
	if (!lastLine) {
		lines.pop();
	}
	if (!firstLine) {
		lines.shift();
	}
	return lines;
};

/**
 * [TODO]: Think about moving common left and right value assignment to a
 * common place. Better readability?
 *
 * Computes line wise information based in the js diff information passed. Each
 * line contains information about left and right section. Left side denotes
 * deletion and right side denotes addition.
 *
 * @param oldString Old string to compare.
 * @param newString New string to compare with old string.
 * @param disableWordDiff Flag to enable/disable word diff (deprecated, no longer used).
 * @param compareMethod JsDiff text diff method (deprecated, no longer used).
 * @param linesOffset line number to start counting from
 */
/** 是否为空或仅空白（用于 comparator，使空白行之间可匹配，避免顺延行被误判为删减） */
const public_isBlankLine = (s: string): boolean => /^\s*$/.test(s);

/** 两行是否“仅首尾空白不同”视为等价（仅用于 diff 匹配，展示仍用原始行内容） */
const public_linesMatchIgnoreTrailingWhitespace = (a: string, b: string): boolean =>
	a.trimRight() === b.trimRight();

/** 行相等：严格相等 / 均空白 / 尾部空白归一后相等（处理行尾空格差异） */
const public_lineEqual = (a: string, b: string): boolean =>
	a === b ||
	(public_isBlankLine(a) && public_isBlankLine(b)) ||
	a.trimRight() === b.trimRight();

/**
 * 行级 diff，LCS + 回溯时“优先走能马上匹配的路径”：若 remove 后下一对可匹配则优先 remove，否则若 add 后可匹配则优先 add。
 * 这样相同行（如 old92=new94）会按顺序匹配为 SAME，不会被标成删除+新增。
 * 返回与 jsdiff 兼容的 Change[]，便于后续 getLineInformation 复用。
 */
function public_diffLinesInOrder(
	oldLines: string[],
	newLines: string[],
	lineEqual: (a: string, b: string) => boolean,
): diff.Change[] {
	const ol = oldLines.length;
	const nl = newLines.length;
	const dp: number[][] = [];
	for (let i = 0; i <= ol; i++) {
		dp[i] = [];
		for (let j = 0; j <= nl; j++) {
			if (i === 0 || j === 0) {
				dp[i][j] = 0;
			} else if (lineEqual(oldLines[i - 1], newLines[j - 1])) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}
	const chunks: diff.Change[] = [];
	let i = ol;
	let j = nl;
	let current: { value: string; added?: boolean; removed?: boolean } | null = null;
	const flush = (): void => {
		if (current && current.value !== '') {
			chunks.push(current);
			current = null;
		}
	};
	const push = (line: string, added?: boolean, removed?: boolean): void => {
		const lineWithNl = line + '\n';
		if (current && current.added === added && current.removed === removed) {
			current.value = lineWithNl + current.value;
		} else {
			flush();
			current = { value: lineWithNl, added, removed };
		}
	};
	while (i > 0 || j > 0) {
		const curMatch = i > 0 && j > 0 && lineEqual(oldLines[i - 1], newLines[j - 1]);
		if (i > 0 && j > 0 && curMatch) {
			push(oldLines[i - 1], false, false);
			i -= 1;
			j -= 1;
		} else if (
			i > 0 &&
			j > 0 &&
			i >= 2 &&
			lineEqual(oldLines[i - 2], newLines[j - 1])
		) {
			push(oldLines[i - 1], false, true);
			i -= 1;
		} else if (
			i > 0 &&
			j > 0 &&
			j >= 2 &&
			lineEqual(oldLines[i - 1], newLines[j - 2])
		) {
			push(newLines[j - 1], true, false);
			j -= 1;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			// 当 dp 相等时优先 add，以便有机会走到 (i,j) 匹配（如 92/94）
			push(newLines[j - 1], true, false);
			j -= 1;
		} else if (i > 0) {
			push(oldLines[i - 1], false, true);
			i -= 1;
		} else if (j > 0) {
			// 处理剩余的 new 行（当 i=0 但前面条件未匹配时）
			push(newLines[j - 1], true, false);
			j -= 1;
		} else {
			// i=0 且 j=0，退出
			break;
		}
	}
	flush();
	return chunks.reverse();
}

const computeLineInformation = (
	oldString: string,
	newString: string,
	disableWordDiff: boolean = false,
	compareMethod: string = DiffMethod.CHARS,
	linesOffset: number = 0,
): ComputedLineInformation => {
	const trimmedOld = oldString.trimRight();
	const trimmedNew = newString.trimRight();
	const oldLines = trimmedOld.split('\n');
	const newLines = trimmedNew.split('\n');
	// 使用自定义“按顺序优先”行级 diff（LCS + 优先走可匹配路径），避免 92/94 等相同行被误判为删除
	const diffArray: diff.Change[] = public_diffLinesInOrder(
		oldLines,
		newLines,
		public_lineEqual,
	);
	let rightLineNumber = linesOffset;
	let leftLineNumber = linesOffset;
	let lineInformation: LineInformation[] = [];
	let counter = 0;
	const diffLines: number[] = [];
	const ignoreDiffIndexes: string[] = [];
	const getLineInformation = (
		value: string,
		diffIndex: number,
		added?: boolean,
		removed?: boolean,
		evaluateOnlyFirstLine?: boolean,
	): LineInformation[] => {
		const lines = constructLines(value);

		return lines
			.map(
				(line: string, lineIndex): LineInformation => {
					const left: DiffInformation = {};
					const right: DiffInformation = {};
					if (
						ignoreDiffIndexes.includes(`${diffIndex}-${lineIndex}`) ||
						(evaluateOnlyFirstLine && lineIndex !== 0)
					) {
						return undefined;
					}
					if (added || removed) {
						if (!diffLines.includes(counter)) {
							diffLines.push(counter);
						}
						if (removed) {
							leftLineNumber += 1;
							left.lineNumber = leftLineNumber;
							left.type = DiffType.REMOVED;
							// 展示用原始行内容（归一化仅用于 diff 匹配）
							left.value =
								oldLines[leftLineNumber - 1] !== undefined
									? oldLines[leftLineNumber - 1]
									: line || ' ';
							// When the current line is of type REMOVED, check the next item in
							// the diff array whether it is of type ADDED. If true, the current
							// diff will be marked as both REMOVED and ADDED. Meaning, the
							// current line is a modification.
						const nextDiff = diffArray[diffIndex + 1];
						if (nextDiff && nextDiff.added) {
							const nextDiffLines = constructLines(nextDiff.value)[lineIndex];
							if (nextDiffLines) {
								const {
									value: rightValue,
									lineNumber,
									type,
								} = getLineInformation(
									nextDiff.value,
									diffIndex,
									true,
									false,
									true,
								)[0].right;
								// When identified as modification, push the next diff to ignore
								// list as the next value will be added in this line computation as
								// right and left values.
								ignoreDiffIndexes.push(`${diffIndex + 1}-${lineIndex}`);
								right.lineNumber = lineNumber;
								right.type = type;
								right.value = (newLines[lineNumber - 1] !== undefined
									? newLines[lineNumber - 1]
									: rightValue) as string;
								left.value =
									oldLines[leftLineNumber - 1] !== undefined
										? oldLines[leftLineNumber - 1]
										: line || ' ';
								// 如果左右内容 trim 后相同，标记为 SAME 而不是修改
								const leftFinalValue = left.value;
								const rightFinalValue = right.value;
								if (
									leftFinalValue &&
									rightFinalValue &&
									(leftFinalValue === rightFinalValue ||
										leftFinalValue.trim() === rightFinalValue.trim())
								) {
									left.type = DiffType.DEFAULT;
									right.type = DiffType.DEFAULT;
								}
							}
						}
						} else {
							rightLineNumber += 1;
							right.lineNumber = rightLineNumber;
							right.type = DiffType.ADDED;
							right.value =
								newLines[rightLineNumber - 1] !== undefined
									? newLines[rightLineNumber - 1]
									: line;
						}
				} else {
					leftLineNumber += 1;
					rightLineNumber += 1;

					left.lineNumber = leftLineNumber;
					left.type = DiffType.DEFAULT;
					left.value =
						oldLines[leftLineNumber - 1] !== undefined
							? oldLines[leftLineNumber - 1]
							: line;
					right.lineNumber = rightLineNumber;
					right.type = DiffType.DEFAULT;
					right.value =
						newLines[rightLineNumber - 1] !== undefined
							? newLines[rightLineNumber - 1]
							: line;
				}

				counter += 1;
				return { right, left };
				},
			)
			.filter(Boolean);
	};

	diffArray.forEach(({ added, removed, value }: diff.Change, index: number): void => {
		lineInformation = [
			...lineInformation,
			...getLineInformation(value, index, added, removed),
		];
	});

	// 补齐因 ignoreDiffIndexes 机制而缺失的行
	// 找出所有已存在的行号
	const existingLeft = new Set<number>();
	const existingRight = new Set<number>();
	lineInformation.forEach(r => {
		if (r.left && r.left.lineNumber) existingLeft.add(r.left.lineNumber);
		if (r.right && r.right.lineNumber) existingRight.add(r.right.lineNumber);
	});

	// 补齐缺失的行（确保 left 和 right 都存在，避免 renderSplitView 中访问 undefined）
	for (let i = 1; i <= oldLines.length; i++) {
		if (!existingLeft.has(i)) {
			lineInformation.push({
				left: {
					lineNumber: i,
					type: DiffType.REMOVED,
					value: oldLines[i - 1],
				},
				right: {
					type: DiffType.DEFAULT,
				},
			});
		}
	}
	for (let i = 1; i <= newLines.length; i++) {
		if (!existingRight.has(i)) {
			lineInformation.push({
				left: {
					type: DiffType.DEFAULT,
				},
				right: {
					lineNumber: i,
					type: DiffType.ADDED,
					value: newLines[i - 1],
				},
			});
		}
	}

	return {
		lineInformation,
		diffLines,
	};
};

export { computeLineInformation };
