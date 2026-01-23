import * as React from 'react';
import * as PropTypes from 'prop-types';
import cn from 'classnames';

import {
	computeLineInformation,
	LineInformation,
	DiffInformation,
	DiffType,
	DiffMethod,
} from './compute-lines';
import computeStyles, {
	ReactDiffViewerStylesOverride,
	ReactDiffViewerStyles,
} from './styles';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const m = require('memoize-one');

const memoize = m.default || m;

export enum LineNumberPrefix {
	LEFT = 'L',
	RIGHT = 'R',
}

export interface ReactDiffViewerProps {
	// Old value to compare.
	oldValue: string;
	// New value to compare.
	newValue: string;
	// Enable/Disable split view.
	splitView?: boolean;
	// Set line Offset
	linesOffset?: number;
	// Enable/Disable word diff.
	disableWordDiff?: boolean;
	// JsDiff text diff method from https://github.com/kpdecker/jsdiff/tree/v4.0.1#api
	compareMethod?: DiffMethod;
	// Number of unmodified lines surrounding each line diff.
	extraLinesSurroundingDiff?: number;
	// Show/hide line number.
	hideLineNumbers?: boolean;
	// Show only diff between the two values.
	showDiffOnly?: boolean;
	// Render prop to format final string before displaying them in the UI.
	renderContent?: (source: string) => JSX.Element;
	// Render prop to format code fold message.
	codeFoldMessageRenderer?: (
		totalFoldedLines: number,
		leftStartLineNumber: number,
		rightStartLineNumber: number,
	) => JSX.Element;
	// Event handler for line number click.
	onLineNumberClick?: (
		lineId: string,
		event: React.MouseEvent<HTMLTableCellElement>,
	) => void;
	// Array of line ids to highlight lines.
	highlightLines?: string[];
	// Style overrides.
	styles?: ReactDiffViewerStylesOverride;
	// Use dark theme.
	useDarkTheme?: boolean;
	// Title for left column
	leftTitle?: string | JSX.Element;
	// Title for left column
	rightTitle?: string | JSX.Element;
	// Comment row content for split view
	commentRow?: JSX.Element;
	// Line number after which to display the comment box (0-based index in lineInformation array, or actual rendered line index if showDiffOnly is true)
	commentRowLineNumber?: number;
	// End line number for comment box range (0-based index in lineInformation array, or actual rendered line index if showDiffOnly is true)
	commentRowEndLineNumber?: number;
	// Font size for code lines (e.g., '14px', '16px', or 14)
	fontSize?: string | number;
}

export interface ReactDiffViewerState {
	// Array holding the expanded code folding.
	expandedBlocks?: number[];
	// Whether the entire diff is collapsed
	isCollapsed?: boolean;
}

class DiffViewer extends React.Component<
	ReactDiffViewerProps,
	ReactDiffViewerState
> {
	private styles: ReactDiffViewerStyles;

	public static defaultProps: ReactDiffViewerProps = {
		oldValue: '',
		newValue: '',
		splitView: true,
		highlightLines: [],
		disableWordDiff: false,
		compareMethod: DiffMethod.CHARS,
		styles: {},
		hideLineNumbers: false,
		extraLinesSurroundingDiff: 3,
		showDiffOnly: true,
		useDarkTheme: false,
		linesOffset: 0,
		fontSize: '14px',
	};

	public static propTypes = {
		oldValue: PropTypes.string.isRequired,
		newValue: PropTypes.string.isRequired,
		splitView: PropTypes.bool,
		disableWordDiff: PropTypes.bool,
		compareMethod: PropTypes.oneOf(Object.values(DiffMethod)),
		renderContent: PropTypes.func,
		onLineNumberClick: PropTypes.func,
		extraLinesSurroundingDiff: PropTypes.number,
		styles: PropTypes.object,
		hideLineNumbers: PropTypes.bool,
		showDiffOnly: PropTypes.bool,
		highlightLines: PropTypes.arrayOf(PropTypes.string),
		leftTitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
		rightTitle: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
		linesOffset: PropTypes.number,
		fontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
	};

	public constructor(props: ReactDiffViewerProps) {
		super(props);

		this.state = {
			expandedBlocks: [],
			isCollapsed: false,
		};
	}

	/**
	 * Resets code block expand to the initial stage. Will be exposed to the parent component via
	 * refs.
	 */
	public resetCodeBlocks = (): boolean => {
		if (this.state.expandedBlocks.length > 0) {
			this.setState({
				expandedBlocks: [],
			});
			return true;
		}
		return false;
	};

	/**
	 * Copies text to clipboard.
	 */
	private copyToClipboard = (text: string): void => {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).catch((err) => {
				console.error('Failed to copy text:', err);
			});
		} else {
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = text;
			textArea.style.position = 'fixed';
			textArea.style.left = '-999999px';
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
			} catch (err) {
				console.error('Failed to copy text:', err);
			}
			document.body.removeChild(textArea);
		}
	};

	/**
	 * Pushes the target expanded code block to the state. During the re-render,
	 * this value is used to expand/fold unmodified code.
	 */
	private onBlockExpand = (id: number): void => {
		const prevState = this.state.expandedBlocks.slice();
		prevState.push(id);

		this.setState({
			expandedBlocks: prevState,
		});
	};

	/**
	 * Toggles the collapsed state of the entire diff.
	 */
	private toggleCollapse = (): void => {
		this.setState({
			isCollapsed: !this.state.isCollapsed,
		});
	};

	/**
	 * Computes final styles for the diff viewer. It combines the default styles with the user
	 * supplied overrides. The computed styles are cached with performance in mind.
	 *
	 * @param styles User supplied style overrides.
	 */
	private computeStyles: (
		styles: ReactDiffViewerStylesOverride,
		useDarkTheme: boolean,
		fontSize: string | number | undefined,
	) => ReactDiffViewerStyles = memoize(computeStyles);

	/**
	 * Returns a function with clicked line number in the closure. Returns an no-op function when no
	 * onLineNumberClick handler is supplied.
	 *
	 * @param id Line id of a line.
	 */
	private onLineNumberClickProxy = (id: string): any => {
		if (this.props.onLineNumberClick) {
			return (e: any): void => this.props.onLineNumberClick(id, e);
		}
		return (): void => {};
	};

	/**
	 * Maps over the line diff and constructs the required react elements to show line diff.
	 * This takes care of both inline and split view line renders.
	 *
	 * @param lineNumber Line number of the current line.
	 * @param type Type of diff of the current line.
	 * @param prefix Unique id to prefix with the line numbers.
	 * @param value Content of the line.
	 * @param additionalLineNumber Additional line number to be shown. Useful for rendering inline
	 *  diff view. Right line number will be passed as additionalLineNumber.
	 * @param additionalPrefix Similar to prefix but for additional line number.
	 */
	private renderLine = (
		lineNumber: number,
		type: DiffType,
		prefix: LineNumberPrefix,
		value: string,
		additionalLineNumber?: number,
		additionalPrefix?: LineNumberPrefix,
		isInCommentRange?: boolean,
		leftLineNumberTemplate?: string,
		rightLineNumberTemplate?: string,
	): JSX.Element => {
		const lineNumberTemplate = `${prefix}-${lineNumber}`;
		const additionalLineNumberTemplate = `${additionalPrefix}-${additionalLineNumber}`;
		const highlightLine =
			this.props.highlightLines.includes(lineNumberTemplate) ||
			this.props.highlightLines.includes(additionalLineNumberTemplate);
		const added = type === DiffType.ADDED;
		const removed = type === DiffType.REMOVED;
		let content;
		if (this.props.renderContent) {
			content = this.props.renderContent(value);
		} else {
			content = value;
		}

		// 如果当前行在评论范围内，且不是添加或删除的行，行号背景使用淡蓝色
		// 添加和删除的行号保持原来的绿色和红色背景
		const lightBlue = this.props.useDarkTheme ? 'rgba(45, 74, 107, 0.3)' : 'rgba(230, 243, 255, 0.35)';
		const darkerLightBlue = this.props.useDarkTheme ? 'rgba(30, 74, 107, 0.4)' : 'rgba(204, 229, 255, 0.45)';
		
		// 如果当前单元格是空单元格且在评论范围内，行号背景使用稍微深一点的淡蓝色
		// 如果当前单元格不是空单元格且在评论范围内，行号背景使用淡蓝色
		// 添加和删除的行号保持原来的绿色和红色背景
		const gutterStyle = (isInCommentRange && !added && !removed) 
			? { backgroundColor: !content ? darkerLightBlue : lightBlue } 
			: {};
		
		// 如果当前行在评论范围内，且是空单元格（删除行的右侧或添加行的左侧），显示稍微深一点的淡蓝色背景
		const emptyCellStyle = (isInCommentRange && !content) ? { backgroundColor: darkerLightBlue } : {};

		// 在并排视图中，列宽由 colgroup 控制，不设置内联宽度样式
		// 在行内视图中，保持固定宽度以确保布局稳定
		const isSplitView = this.props.splitView;
		const gutterWidthStyle = isSplitView ? {} : {
			width: '50px',
			minWidth: '50px',
			maxWidth: '50px',
		};
		const markerWidthStyle = isSplitView ? {} : {
			width: '25px',
			minWidth: '25px',
			maxWidth: '25px',
		};

		return (
			<React.Fragment>
				{!this.props.hideLineNumbers && (
					<td
						onClick={
							lineNumber && this.onLineNumberClickProxy(lineNumberTemplate)
						}
						className={cn(this.styles.gutter, {
							[this.styles.emptyGutter]: !lineNumber,
							[this.styles.diffAdded]: added,
							[this.styles.diffRemoved]: removed,
							[this.styles.highlightedGutter]: highlightLine,
						})}
						style={{
							...gutterStyle,
							...gutterWidthStyle,
						}}>
						<pre className={this.styles.lineNumber}>{lineNumber}</pre>
					</td>
				)}
				{!this.props.splitView && !this.props.hideLineNumbers && (
					<td
						onClick={
							additionalLineNumber &&
							this.onLineNumberClickProxy(additionalLineNumberTemplate)
						}
						className={cn(this.styles.gutter, {
							[this.styles.emptyGutter]: !additionalLineNumber,
							[this.styles.diffAdded]: added,
							[this.styles.diffRemoved]: removed,
							[this.styles.highlightedGutter]: highlightLine,
						})}
						style={{
							...gutterStyle,
							width: '50px',
							minWidth: '50px',
							maxWidth: '50px',
						}}>
						<pre className={this.styles.lineNumber}>{additionalLineNumber}</pre>
					</td>
				)}
				<td
					className={cn(this.styles.marker, {
						[this.styles.emptyLine]: !content,
						[this.styles.diffAdded]: added,
						[this.styles.diffRemoved]: removed,
					})}
					style={{
						...emptyCellStyle,
						...markerWidthStyle,
					}}>
					<pre>
						{added && '+'}
						{removed && '-'}
					</pre>
				</td>
				<td
					className={cn(this.styles.content, {
						[this.styles.emptyLine]: !content,
						[this.styles.diffAdded]: added,
						[this.styles.diffRemoved]: removed,
					})}
					style={{
						...emptyCellStyle,
						...(this.props.splitView && prefix === LineNumberPrefix.LEFT ? { borderRight: '1px solid #d0d7de' } : {}),
						...(this.props.splitView && prefix === LineNumberPrefix.RIGHT && this.props.commentRow ? { borderRight: '1px solid #d0d7de' } : {}),
					}}>
					<pre className={this.styles.contentText} style={{ textAlign: 'left' }}>{content}</pre>
				</td>
			</React.Fragment>
		);
	};

	/**
	 * Generates lines for split view.
	 *
	 * @param obj Line diff information.
	 * @param obj.left Life diff information for the left pane of the split view.
	 * @param obj.right Life diff information for the right pane of the split view.
	 * @param index React key for the lines.
	 */
	private renderSplitView = (
		{ left, right }: LineInformation,
		index: number,
		actualRenderedIndex?: number,
		totalLines?: number,
		commentRangeRowSpan?: number,
	): JSX.Element => {
		const { commentRow, commentRowLineNumber, commentRowEndLineNumber, showDiffOnly } = this.props;
		// 并排模式：如果指定了开始行和结束行，评论框显示在中间位置；否则显示在指定行
		// commentRowLineNumber 和 commentRowEndLineNumber 对应的是 new code 的行号（right.lineNumber）
		let shouldShowComment = false;
		let isInCommentRange = false;
		let isStartOfCommentRange = false;
		// 使用传入的 commentRangeRowSpan（在 renderDiff 中已计算）
		// 如果没有传入，则使用简单的计算作为后备
		let finalCommentRangeRowSpan = commentRangeRowSpan;
		if (finalCommentRangeRowSpan === undefined && commentRowEndLineNumber !== undefined && commentRowLineNumber !== undefined) {
			finalCommentRangeRowSpan = commentRowEndLineNumber - commentRowLineNumber + 1;
		}
		
		if (commentRow && commentRowLineNumber !== undefined && right && right.lineNumber !== undefined && right.lineNumber !== null) {
			const rightLineNumber = right.lineNumber;
			if (commentRowEndLineNumber !== undefined) {
				// 有开始行和结束行：在开始行显示评论框，rowSpan 覆盖整个区间
				// 基于 new code 的行号 right.lineNumber 来判断
				shouldShowComment = rightLineNumber === commentRowLineNumber;
				// 判断当前行是否在开始行和结束行之间
				isInCommentRange = rightLineNumber >= commentRowLineNumber && rightLineNumber <= commentRowEndLineNumber;
				// 判断是否是开始行
				isStartOfCommentRange = rightLineNumber === commentRowLineNumber;
			} else {
				// 只有开始行：显示在开始行
				shouldShowComment = rightLineNumber === commentRowLineNumber;
				// 判断当前行是否在开始行
				isInCommentRange = rightLineNumber === commentRowLineNumber;
			}
		}
	
		// 如果当前行在评论范围内，且不是删除或添加的行，添加淡蓝色背景
		// 删除和添加的行保持原来的红色和绿色背景，但空单元格会单独处理显示淡蓝色
		const lightBlue = this.props.useDarkTheme ? 'rgba(45, 74, 107, 0.4)' : 'rgba(230, 243, 255, 0.35)';
		const rowStyle = (isInCommentRange && left.type !== DiffType.REMOVED && right.type !== DiffType.ADDED) 
			? { backgroundColor: lightBlue } 
			: {};
		
		const leftLineNumberTemplate = left.lineNumber ? `${LineNumberPrefix.LEFT}-${left.lineNumber}` : undefined;
		const rightLineNumberTemplate = right.lineNumber ? `${LineNumberPrefix.RIGHT}-${right.lineNumber}` : undefined;
		
		return (
			<tr 
				key={index} 
				className={this.styles.line} 
				style={rowStyle}>
				{this.renderLine(
					left.lineNumber,
					left.type,
					LineNumberPrefix.LEFT,
					left.value,
					undefined,
					undefined,
					isInCommentRange,
					leftLineNumberTemplate,
					rightLineNumberTemplate,
				)}
				{this.renderLine(
					right.lineNumber,
					right.type,
					LineNumberPrefix.RIGHT,
					right.value,
					undefined,
					undefined,
					isInCommentRange,
					leftLineNumberTemplate,
					rightLineNumberTemplate,
				)}
				{/* 在开始行显示评论框，rowSpan 覆盖从开始行到结束行的整个区域 */}
				{shouldShowComment && commentRowEndLineNumber !== undefined && (
					<td
						key="comment"
						style={{
							verticalAlign: 'middle',
							padding: 0,
							border: '1px solid rgba(128, 128, 128, 0.2)',
							borderLeft: '1px solid #d0d7de',
							backgroundColor: 'transparent',
							position: 'relative',
						}}
						rowSpan={finalCommentRangeRowSpan}>
						{commentRow}
					</td>
				)}
				{/* 如果没有结束行，评论框覆盖整个表格 */}
				{shouldShowComment && commentRowEndLineNumber === undefined && (
					<td
						key="comment"
						style={{
							verticalAlign: 'top',
							padding: 0,
							border: '1px solid rgba(128, 128, 128, 0.2)',
							borderLeft: '1px solid #d0d7de',
							backgroundColor: 'transparent',
							position: 'relative',
						}}
						rowSpan={totalLines || 10000}>
						{commentRow}
					</td>
				)}
				{/* 在开始行显示灰色背景区域，跨越从开始行到结束行的所有行 */}
				{!shouldShowComment && isStartOfCommentRange && commentRowEndLineNumber !== undefined && (
					<td
						key="comment-bg"
						style={{
							verticalAlign: 'top',
							padding: 0,
							border: '1px solid rgba(128, 128, 128, 0.2)',
							borderLeft: '1px solid #d0d7de',
							backgroundColor: '#f5f5f5',
							position: 'relative',
						}}
						rowSpan={finalCommentRangeRowSpan}>
					</td>
				)}
			</tr>
		);
	};

	/**
	 * Generates lines for inline view.
	 *
	 * @param obj Line diff information.
	 * @param obj.left Life diff information for the added section of the inline view.
	 * @param obj.right Life diff information for the removed section of the inline view.
	 * @param index React key for the lines.
	 */
	public renderInlineView = (
		{ left, right }: LineInformation,
		index: number,
	): JSX.Element => {
		const { commentRowLineNumber, commentRowEndLineNumber } = this.props;
		// 判断当前行是否在评论范围内
		let isInCommentRange = false;
		if (commentRowLineNumber !== undefined) {
			if (commentRowEndLineNumber !== undefined) {
				isInCommentRange = index >= commentRowLineNumber && index <= commentRowEndLineNumber;
			} else {
				isInCommentRange = index === commentRowLineNumber;
			}
		}
		
		let content;
		// 行内模式不显示淡蓝色效果，将 isInCommentRange 设置为 false
		const isInCommentRangeForInline = false;
		if (left.type === DiffType.REMOVED && right.type === DiffType.ADDED) {
			return (
				<React.Fragment key={index}>
					<tr className={this.styles.line}>
						{this.renderLine(
							left.lineNumber,
							left.type,
							LineNumberPrefix.LEFT,
							left.value,
							null,
							undefined,
							isInCommentRangeForInline,
						)}
					</tr>
					<tr className={this.styles.line}>
						{this.renderLine(
							null,
							right.type,
							LineNumberPrefix.RIGHT,
							right.value,
							right.lineNumber,
							undefined,
							isInCommentRangeForInline,
						)}
					</tr>
				</React.Fragment>
			);
		}
		if (left.type === DiffType.REMOVED) {
			content = this.renderLine(
				left.lineNumber,
				left.type,
				LineNumberPrefix.LEFT,
				left.value,
				null,
				undefined,
				isInCommentRangeForInline,
			);
		}
		if (left.type === DiffType.DEFAULT) {
			content = this.renderLine(
				left.lineNumber,
				left.type,
				LineNumberPrefix.LEFT,
				left.value,
				right.lineNumber,
				LineNumberPrefix.RIGHT,
				isInCommentRangeForInline,
			);
		}
		if (right.type === DiffType.ADDED) {
			content = this.renderLine(
				null,
				right.type,
				LineNumberPrefix.RIGHT,
				right.value,
				right.lineNumber,
				undefined,
				isInCommentRangeForInline,
			);
		}

		return (
			<tr key={index} className={this.styles.line}>
				{content}
			</tr>
		);
	};

	/**
	 * Returns a function with clicked block number in the closure.
	 *
	 * @param id Cold fold block id.
	 */
	private onBlockClickProxy = (id: number): any => (): void =>
		this.onBlockExpand(id);

	/**
	 * Generates cold fold block. It also uses the custom message renderer when available to show
	 * cold fold messages.
	 *
	 * @param num Number of skipped lines between two blocks.
	 * @param blockNumber Code fold block id.
	 * @param leftBlockLineNumber First left line number after the current code fold block.
	 * @param rightBlockLineNumber First right line number after the current code fold block.
	 */
	private renderSkippedLineIndicator = (
		num: number,
		blockNumber: number,
		leftBlockLineNumber: number,
		rightBlockLineNumber: number,
	): JSX.Element => {
		const { hideLineNumbers, splitView } = this.props;
		const message = this.props.codeFoldMessageRenderer ? (
			this.props.codeFoldMessageRenderer(
				num,
				leftBlockLineNumber,
				rightBlockLineNumber,
			)
		) : (
			<pre className={this.styles.codeFoldContent}>Expand {num} lines ...</pre>
		);
		const content = (
			<td>
				<a onClick={this.onBlockClickProxy(blockNumber)} tabIndex={0}>
					{message}
				</a>
			</td>
		);
		const isUnifiedViewWithoutLineNumbers = !splitView && !hideLineNumbers;
		return (
			<tr
				key={`${leftBlockLineNumber}-${rightBlockLineNumber}`}
				className={this.styles.codeFold}>
				{!hideLineNumbers && <td className={this.styles.codeFoldGutter} style={{ width: '10px', minWidth: '10px', maxWidth: '10px' }} />}
				<td
					className={cn({
						[this.styles.codeFoldGutter]: isUnifiedViewWithoutLineNumbers,
					})}
					style={isUnifiedViewWithoutLineNumbers ? { width: '10px', minWidth: '10px', maxWidth: '10px' } : undefined}
				/>

				{/* Swap columns only for unified view without line numbers */}
				{isUnifiedViewWithoutLineNumbers ? (
					<React.Fragment>
						<td />
						{content}
					</React.Fragment>
				) : (
					<React.Fragment>
						{content}
						<td />
					</React.Fragment>
				)}

				<td />
				<td />
			</tr>
		);
	};

	/**
	 * Generates the entire diff view.
	 */
	private renderDiff = (): JSX.Element[] => {
		const {
			oldValue,
			newValue,
			splitView,
			disableWordDiff,
			compareMethod,
			linesOffset,
			commentRow,
			commentRowLineNumber,
			commentRowEndLineNumber,
		} = this.props;
		const { lineInformation } = computeLineInformation(
			oldValue,
			newValue,
			disableWordDiff,
			compareMethod,
			linesOffset,
		);
		const result: (JSX.Element | null)[] = [];
		// 跟踪实际渲染的行索引（用于并排模式的 commentRowLineNumber 匹配）
		let actualRenderedIndex = 0;
		
		// 判断是否在评论范围内（基于 new code 的行号 right.lineNumber）
		const isInCommentRange = (line: LineInformation): boolean => {
			if (commentRowLineNumber === undefined) {
				return false;
			}
			// 如果 right.lineNumber 不存在，说明这是删除的行，在 new code 中没有行号，不应该算进行号里
			if (!line.right || line.right.lineNumber === undefined || line.right.lineNumber === null) {
				return false;
			}
			const rightLineNumber = line.right.lineNumber;
			if (commentRowEndLineNumber !== undefined) {
				return rightLineNumber >= commentRowLineNumber && rightLineNumber <= commentRowEndLineNumber;
			}
			return rightLineNumber === commentRowLineNumber;
		};
		
		// 新的折叠逻辑：基于 commentRowLineNumber 和 commentRowEndLineNumber
		// 计算并排模式下的 commentRangeRowSpan（统计实际在范围内的行数）
		let commentRangeRowSpan = 0;
		if (commentRowLineNumber !== undefined && commentRowEndLineNumber !== undefined && splitView) {
			lineInformation.forEach((line: LineInformation) => {
				if (line.right && line.right.lineNumber !== undefined && line.right.lineNumber !== null) {
					const rightLineNumber = line.right.lineNumber;
					if (rightLineNumber >= commentRowLineNumber && rightLineNumber <= commentRowEndLineNumber) {
						commentRangeRowSpan++;
					}
				}
			});
		}
		
		if (commentRowLineNumber !== undefined) {
			let currentFoldBlockStart: number | null = null;
			let currentFoldBlockLines: number[] = [];
			let foldBlockId = 0;
		
		lineInformation.forEach(
			(line: LineInformation, i: number): void => {
					const inRange = isInCommentRange(line);
					
					// 如果当前行不在评论范围内
					if (!inRange) {
						// 如果这是折叠块的开始
						if (currentFoldBlockStart === null) {
							currentFoldBlockStart = i;
							currentFoldBlockLines = [];
							foldBlockId = i; // 使用行索引作为折叠块 ID
						}
						currentFoldBlockLines.push(i);
						
						// 如果这是最后一行，或者是折叠块的结束（下一行在范围内）
						const isLastLine = i === lineInformation.length - 1;
						const nextLineInRange = !isLastLine && isInCommentRange(lineInformation[i + 1]);
						
						if (isLastLine || nextLineInRange) {
							// 检查该折叠块是否已展开
							const isExpanded = this.state.expandedBlocks.includes(foldBlockId);
							
							if (!isExpanded && currentFoldBlockLines.length > 0) {
								// 显示折叠指示器
								const firstLine = lineInformation[currentFoldBlockStart!];
								const lastLine = lineInformation[currentFoldBlockLines[currentFoldBlockLines.length - 1]];
							actualRenderedIndex++;
							result.push(this.renderSkippedLineIndicator(
									currentFoldBlockLines.length,
									foldBlockId,
									firstLine.left.lineNumber,
									lastLine.right.lineNumber,
							));
							} else if (isExpanded) {
								// 显示所有折叠的行
								currentFoldBlockLines.forEach((foldLineIndex) => {
									const foldLine = lineInformation[foldLineIndex];
									const diffNodes = splitView
										? this.renderSplitView(foldLine, foldLineIndex, actualRenderedIndex, lineInformation.length, commentRangeRowSpan)
										: this.renderInlineView(foldLine, foldLineIndex);
									actualRenderedIndex++;
									result.push(diffNodes);
								});
							}
							
							// 重置折叠块状态
							currentFoldBlockStart = null;
							currentFoldBlockLines = [];
						} else {
							// 继续收集折叠行，不渲染
							result.push(null);
						}
					} else {
						// 当前行在评论范围内，直接显示
						// 如果之前有折叠块，先结束它
						if (currentFoldBlockStart !== null && currentFoldBlockLines.length > 0) {
							const isExpanded = this.state.expandedBlocks.includes(foldBlockId);
							if (!isExpanded) {
								const firstLine = lineInformation[currentFoldBlockStart];
								const lastLine = lineInformation[currentFoldBlockLines[currentFoldBlockLines.length - 1]];
								actualRenderedIndex++;
								result.push(this.renderSkippedLineIndicator(
									currentFoldBlockLines.length,
									foldBlockId,
									firstLine.left.lineNumber,
									lastLine.right.lineNumber,
								));
							} else {
								currentFoldBlockLines.forEach((foldLineIndex) => {
									const foldLine = lineInformation[foldLineIndex];
									const diffNodes = splitView
										? this.renderSplitView(foldLine, foldLineIndex, actualRenderedIndex, lineInformation.length, commentRangeRowSpan)
										: this.renderInlineView(foldLine, foldLineIndex);
									actualRenderedIndex++;
									result.push(diffNodes);
								});
							}
							currentFoldBlockStart = null;
							currentFoldBlockLines = [];
						}
						
						// 渲染当前行
				const diffNodes = splitView
					? this.renderSplitView(line, i, actualRenderedIndex, lineInformation.length, commentRangeRowSpan)
					: this.renderInlineView(line, i);
				actualRenderedIndex++;
					result.push(diffNodes);

				// 在行内模式下，在指定行之后插入评论框（基于 new code 的行号 right.lineNumber）
						if (!splitView && commentRow && line.right && line.right.lineNumber !== undefined && line.right.lineNumber !== null && line.right.lineNumber === (commentRowEndLineNumber !== undefined ? commentRowEndLineNumber : commentRowLineNumber)) {
					const colSpanOnInlineView = this.props.hideLineNumbers ? 2 : 4;
					result.push(
						<tr key={`comment-${i}`}>
							<td
								colSpan={colSpanOnInlineView}
								style={{
									padding: 0,
									border: 'none',
									verticalAlign: 'top',
								}}>
								{commentRow}
							</td>
						</tr>
					);
						}
				}
			},
		);
		} else {
			// 如果没有定义 commentRowLineNumber，显示所有行（保持原有行为）
			lineInformation.forEach(
				(line: LineInformation, i: number): void => {
					const diffNodes = splitView
						? this.renderSplitView(line, i, actualRenderedIndex, lineInformation.length, commentRangeRowSpan)
						: this.renderInlineView(line, i);
					actualRenderedIndex++;
					result.push(diffNodes);
					
					// 在行内模式下，在指定行之后插入评论框
					if (!splitView && commentRow && commentRowLineNumber === undefined) {
						// 这个逻辑在 render 方法中处理
					}
				},
			);
		}
		
		return result.filter((node): node is JSX.Element => node !== null);
	};

	public render = (): JSX.Element => {
		const {
			oldValue,
			newValue,
			useDarkTheme,
			leftTitle,
			rightTitle,
			splitView,
			hideLineNumbers,
			commentRow,
			commentRowLineNumber,
		} = this.props;

		if (typeof oldValue !== 'string' || typeof newValue !== 'string') {
			throw Error('"oldValue" and "newValue" should be strings');
		}

		this.styles = this.computeStyles(this.props.styles, useDarkTheme, this.props.fontSize);
		const nodes = this.renderDiff();
		const colSpanOnSplitView = hideLineNumbers ? 2 : 3;
		const colSpanOnInlineView = hideLineNumbers ? 2 : 4;

		const title = (leftTitle || rightTitle) && (
			<tr>
				<td
					colSpan={splitView ? (colSpanOnSplitView * 2 + (commentRow ? colSpanOnSplitView : 0)) : colSpanOnInlineView}
					className={this.styles.titleBlock}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<button
							onClick={this.toggleCollapse}
							style={{
								background: 'transparent',
								border: 'none',
								cursor: 'pointer',
								padding: '4px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: '#656d76',
								fontSize: '16px',
								lineHeight: '1',
							}}
							title={this.state.isCollapsed ? 'Expand diff' : 'Collapse diff'}>
							{this.state.isCollapsed ? (
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
								</svg>
							) : (
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
								</svg>
							)}
						</button>
						<div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
							<pre className={this.styles.contentText} style={{ margin: 0 }}>
								{splitView ? (
									<>
										{leftTitle}
									</>
								) : (
									leftTitle
								)}
							</pre>
							{leftTitle && typeof leftTitle === 'string' && (
								<button
									onClick={() => this.copyToClipboard(leftTitle as string)}
									style={{
										background: 'transparent',
										border: 'none',
										cursor: 'pointer',
										padding: '2px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										color: '#656d76',
										opacity: 0.6,
									}}
									title="复制文件路径"
									onMouseEnter={(e) => {
										e.currentTarget.style.opacity = '1';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.opacity = '0.6';
									}}>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M5.5 2.5H3.75C2.50736 2.5 1.5 3.50736 1.5 4.75V12.25C1.5 13.4926 2.50736 14.5 3.75 14.5H11.25C12.4926 14.5 13.5 13.4926 13.5 12.25V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
										<path d="M5.5 2.5H10.25C11.4926 2.5 12.5 3.50736 12.5 4.75V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
										<path d="M10.5 1.5H5.5V6.5H10.5V1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
									</svg>
								</button>
							)}
						</div>
					</div>
				</td>
			</tr>
		);

		// Collapsed message row
		const collapsedMessage = this.state.isCollapsed && (
			<tr>
				<td
					colSpan={splitView ? (colSpanOnSplitView * 2 + (commentRow ? colSpanOnSplitView : 0)) : colSpanOnInlineView}
					className={this.styles.titleBlock}
					style={{ padding: '12px 16px', textAlign: 'center' }}>
					<pre className={this.styles.contentText} style={{ margin: 0, color: '#24292f', textAlign: 'center' }}>
						<span style={{ color: '#24292f' }}>This diff is collapsed. </span>
						<span
							onClick={this.toggleCollapse}
							style={{
								color: '#0969da',
								cursor: 'pointer',
								textDecoration: 'none',
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.textDecoration = 'underline';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.textDecoration = 'none';
							}}>
							Click to expand it.
						</span>
					</pre>
				</td>
			</tr>
		);

		// 行内模式下，如果 commentRowLineNumber 未指定，则在最后显示评论框
		const commentRowElement = !splitView && commentRow && commentRowLineNumber === undefined && (
			<tr>
				<td
					colSpan={colSpanOnInlineView}
					style={{
						padding: 0,
						border: 'none',
						verticalAlign: 'top',
					}}>
					{commentRow}
				</td>
			</tr>
		);

		// 保持三等分逻辑：左代码区域、右代码区域、评论区域各占33.33%
		// 行号和标记列保持固定宽度，内容列使用 calc(33.33% - 固定宽度) 来保持三等分
		// 表格使用 fixed 布局以确保三等分，但内容可以折行（通过 pre-wrap）
		const colgroup = splitView && !hideLineNumbers ? (
			<colgroup>
				{/* 左代码区域总共占33.33%：行号50px + marker 25px + 内容 */}
				{/* 左行号 - 固定50px */}
				<col style={{ width: '50px' }} />
				{/* 左代码 marker - 固定25px */}
				<col style={{ width: '25px' }} />
				{/* 左代码 content - 确保左代码区域总共占33.33%（有commentRow）或50%（无commentRow） */}
				<col style={{ width: commentRow ? '33.33%' : '50%' }} />
				{/* 右代码区域总共占33.33%：行号50px + marker 25px + 内容 */}
				{/* 右行号 - 固定50px */}
				<col style={{ width: '50px' }} />
				{/* 右代码 marker - 固定25px */}
				<col style={{ width: '25px' }} />
				{/* 右代码 content - 确保右代码区域总共占33.33%（有commentRow）或50%（无commentRow） */}
				<col style={{ width: commentRow ? '33.33%' : 'calc50%' }} />
				{/* comment 列 - 占33.33% */}
				{commentRow && <col style={{ width: '33.33%' }} />}
			</colgroup>
		) : splitView && hideLineNumbers ? (
			<colgroup>
				{/* 左代码 marker - 固定25px */}
				<col style={{ width: '25px' }} />
				{/* 左代码 content - 确保左代码区域总共占33.33%（有commentRow）或50%（无commentRow） */}
				<col style={{ width: commentRow ? '33.33%' : '50%' }} />
				{/* 右代码 marker - 固定25px */}
				<col style={{ width: '25px' }} />
				{/* 右代码 content - 确保右代码区域总共占33.33%（有commentRow）或50%（无commentRow） */}
				<col style={{ width: commentRow ? '33.33%' : '50%' }} />
				{/* comment 列 - 占33.33% */}
				{commentRow && <col style={{ width: '33.33%' }} />}
			</colgroup>
		) : !splitView && !hideLineNumbers ? (
			// 行内模式下，不设置 colgroup，让表格自动布局，content 列自适应
			null
		) : null;

		return (
			<table
				className={cn(this.styles.diffContainer, {
					[this.styles.splitView]: splitView,
				})}
				style={{
					width: '100%',
					// 使用 fixed 布局以确保三等分逻辑，但内容可以折行（通过 pre-wrap）
					...(splitView ? { tableLayout: 'fixed' } : { tableLayout: 'auto' }),
				}}>
				{colgroup}
				<tbody>
					{title}
					{this.state.isCollapsed ? collapsedMessage : nodes}
					{!this.state.isCollapsed && commentRowElement}
				</tbody>
			</table>
		);
	};
}

export default DiffViewer;
export { ReactDiffViewerStylesOverride, DiffMethod };
