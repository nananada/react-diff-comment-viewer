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
	// Array holding the expanded code folding (fully expanded block IDs, for backward compatibility).
	expandedBlocks?: number[];
	// Record of blockId -> number of lines expanded (for progressive expand: 10 lines per click)
	expandedBlocksCount?: Record<number, number>;
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
			expandedBlocksCount: {},
			isCollapsed: false,
		};
	}

	/**
	 * Resets code block expand to the initial stage. Will be exposed to the parent component via
	 * refs.
	 */
	public resetCodeBlocks = (): boolean => {
		if (this.state.expandedBlocks.length > 0 || Object.keys(this.state.expandedBlocksCount || {}).length > 0) {
			this.setState({
				expandedBlocks: [],
				expandedBlocksCount: {},
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

	/** 每次展开 10 行，而非全部展开 */
	private readonly LINES_PER_EXPAND = 10;

	/**
	 * 逐步展开折叠块，每次展开 10 行。
	 * @param id 折叠块 ID
	 * @param totalLines 折叠块总行数
	 */
	private onBlockExpand = (id: number, totalLines: number): void => {
		const expandedBlocksCount = this.state.expandedBlocksCount || {};
		const current = expandedBlocksCount[id] || 0;
		const toAdd = Math.min(this.LINES_PER_EXPAND, totalLines - current);

		if (toAdd <= 0) return;

		this.setState({
			expandedBlocksCount: {
				...expandedBlocksCount,
				[id]: current + toAdd,
			},
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

		// 评论区间改为虚线边框，不再用实心背景；红/绿 diff 效果始终保留
		const gutterStyle = {};
		const emptyCellStyle = {};

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
		isFirstRowInCommentRange?: boolean,
		overrideIsInCommentRange?: boolean,
		isLastRowInCommentRange?: boolean,
	): JSX.Element => {
		const { commentRow, commentRowLineNumber, commentRowEndLineNumber, showDiffOnly } = this.props;
		// 并排模式：评论框显示在评论范围的第一行（包含相邻的删除行，确保与代码区深蓝色对齐）
		let shouldShowComment = false;
		let isInCommentRange = false;
		let isStartOfCommentRange = false;
		// 使用传入的 commentRangeRowSpan（在 renderDiff 中已计算，包含所有 isInCommentRange 行）
		let finalCommentRangeRowSpan = commentRangeRowSpan;
		if (finalCommentRangeRowSpan === undefined && commentRowEndLineNumber !== undefined && commentRowLineNumber !== undefined) {
			finalCommentRangeRowSpan = commentRowEndLineNumber - commentRowLineNumber + 1;
		}
		
		if (commentRow && commentRowLineNumber !== undefined) {
			// 优先用传入的 overrideIsInCommentRange（用于删除行等无 right 的情况）
			const hasRightInRange = right && right.lineNumber !== undefined && right.lineNumber !== null
				&& (commentRowEndLineNumber === undefined
					? right.lineNumber === commentRowLineNumber
					: right.lineNumber >= commentRowLineNumber && right.lineNumber <= commentRowEndLineNumber);
			isInCommentRange = overrideIsInCommentRange === true || hasRightInRange;
			if (commentRowEndLineNumber !== undefined) {
				// 在第一行 isInCommentRange 的行显示评论框，保证与代码区深蓝色起始对齐
				shouldShowComment = isFirstRowInCommentRange === true;
				isStartOfCommentRange = shouldShowComment;
			} else {
				shouldShowComment = (hasRightInRange && right!.lineNumber === commentRowLineNumber) || isFirstRowInCommentRange === true;
				isStartOfCommentRange = shouldShowComment;
			}
		}
	
		// 评论区间用深蓝色虚线边框（加粗），框住代码区+右侧评论区；红/绿 diff 效果保留
		const commentRangeBorderColor = this.props.useDarkTheme ? 'rgba(45, 74, 107, 0.9)' : 'rgba(70, 130, 180, 0.95)';
		const commentRangeBorderWidth = '2px';
		const commentRangeBorder = `${commentRangeBorderWidth} dashed ${commentRangeBorderColor}`;
		const rowStyle: React.CSSProperties = isInCommentRange
			? {
					borderLeft: commentRangeBorder,
					...(isFirstRowInCommentRange ? { borderTop: commentRangeBorder } : {}),
					...(isLastRowInCommentRange ? { borderBottom: commentRangeBorder } : {}),
				}
			: {};
		const commentTdBg = 'transparent';
		// 评论区 td 的虚线（右、上、下），使整块虚线框把右侧评论区包进去；该 td 有 rowSpan 故下边框始终画在底部
		const commentTdBorderStyle: React.CSSProperties = isInCommentRange
			? {
					borderRight: commentRangeBorder,
					...(isFirstRowInCommentRange ? { borderTop: commentRangeBorder } : {}),
					...(commentRowEndLineNumber !== undefined ? { borderBottom: commentRangeBorder } : {}),
				}
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
				{/* 在开始行显示评论框，rowSpan 覆盖从开始行到结束行的整个区域；虚线框包含本列 */}
				{shouldShowComment && commentRowEndLineNumber !== undefined && (
					<td
						key="comment"
						style={{
							verticalAlign: 'middle',
							padding: 0,
							border: '1px solid rgba(128, 128, 128, 0.2)',
							borderLeft: '1px solid #d0d7de',
							backgroundColor: commentTdBg,
							position: 'relative',
							...commentTdBorderStyle,
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
							backgroundColor: commentTdBg,
							position: 'relative',
							...commentTdBorderStyle,
						}}
						rowSpan={totalLines || 10000}>
						{commentRow}
					</td>
				)}
				{/* 在开始行显示占位区域，虚线框包含本列 */}
				{!shouldShowComment && isStartOfCommentRange && commentRowEndLineNumber !== undefined && (
					<td
						key="comment-bg"
						style={{
							verticalAlign: 'top',
							padding: 0,
							border: '1px solid rgba(128, 128, 128, 0.2)',
							borderLeft: '1px solid #d0d7de',
							backgroundColor: 'transparent',
							position: 'relative',
							...commentTdBorderStyle,
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
		isInCommentRangeInline?: boolean,
		isFirstRowInCommentRange?: boolean,
		isLastRowInCommentRange?: boolean,
	): JSX.Element => {
		// 与并排模式一致：评论区间用深蓝色虚线边框（加粗），红/绿 diff 效果保留
		const isInCommentRange = isInCommentRangeInline === true;
		const commentRangeBorderColor = this.props.useDarkTheme ? 'rgba(45, 74, 107, 0.9)' : 'rgba(70, 130, 180, 0.95)';
		const commentRangeBorder = `2px dashed ${commentRangeBorderColor}`;
		const rowStyle: React.CSSProperties = isInCommentRange
			? {
					borderLeft: commentRangeBorder,
					borderRight: commentRangeBorder,
					...(isFirstRowInCommentRange ? { borderTop: commentRangeBorder } : {}),
					...(isLastRowInCommentRange ? { borderBottom: commentRangeBorder } : {}),
				}
			: {};
		if (left.type === DiffType.REMOVED && right.type === DiffType.ADDED) {
			return (
				<React.Fragment key={index}>
					<tr className={this.styles.line} style={rowStyle}>
						{this.renderLine(
							left.lineNumber,
							left.type,
							LineNumberPrefix.LEFT,
							left.value,
							null,
							undefined,
							isInCommentRange,
						)}
					</tr>
					<tr className={this.styles.line} style={rowStyle}>
						{this.renderLine(
							null,
							right.type,
							LineNumberPrefix.RIGHT,
							right.value,
							right.lineNumber,
							undefined,
							isInCommentRange,
						)}
					</tr>
				</React.Fragment>
			);
		}
		let content;
		if (left.type === DiffType.REMOVED) {
			content = this.renderLine(
				left.lineNumber,
				left.type,
				LineNumberPrefix.LEFT,
				left.value,
				null,
				undefined,
				isInCommentRange,
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
				isInCommentRange,
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
				isInCommentRange,
			);
		}

		return (
			<tr key={index} className={this.styles.line} style={rowStyle}>
				{content}
			</tr>
		);
	};

	/**
	 * Returns a function with clicked block number and total lines in the closure.
	 */
	private onBlockClickProxy = (id: number, totalLines: number): any => (): void =>
		this.onBlockExpand(id, totalLines);

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
		remainingNum: number,
		blockNumber: number,
		leftBlockLineNumber: number,
		rightBlockLineNumber: number,
		totalLines: number,
	): JSX.Element => {
		const { hideLineNumbers, splitView, commentRow } = this.props;
		const message = this.props.codeFoldMessageRenderer ? (
			this.props.codeFoldMessageRenderer(
				remainingNum,
				leftBlockLineNumber,
				rightBlockLineNumber,
			)
		) : (
			<pre className={this.styles.codeFoldContent}>展开剩下 {remainingNum} 行...</pre>
		);
		
		if (splitView) {
			// 并排视图：深灰色仅应用在行号列（50px），与下方行号列等宽
			const gutterWidth = { width: '50px', minWidth: '50px', maxWidth: '50px' };
			const markerWidth = { width: '25px', minWidth: '25px', maxWidth: '25px' };
			return (
				<tr
					key={`fold-${blockNumber}-${leftBlockLineNumber}-${rightBlockLineNumber}-${remainingNum}`}
					className={this.styles.codeFold}>
					{/* 左侧区域：仅行号列用 codeFoldGutter 深灰，marker 列用行背景色 */}
					{!hideLineNumbers && <td className={this.styles.codeFoldGutter} style={gutterWidth} />}
					<td style={markerWidth} />
					<td style={{ textAlign: 'left', paddingLeft: '14px' }}>
						<a onClick={this.onBlockClickProxy(blockNumber, totalLines)} tabIndex={0}>
							{message}
						</a>
					</td>
					{/* 右侧区域 */}
					{!hideLineNumbers && <td className={this.styles.codeFoldGutter} style={gutterWidth} />}
					<td style={markerWidth} />
					<td />
					{/* 评论区域（如果有） */}
					{commentRow && <td />}
				</tr>
			);
		}
		
		// 行内视图：保持原有逻辑
		const content = (
			<td>
				<a onClick={this.onBlockClickProxy(blockNumber, totalLines)} tabIndex={0}>
					{message}
				</a>
			</td>
		);
		const isUnifiedViewWithoutLineNumbers = !splitView && !hideLineNumbers;
		return (
			<tr
				key={`fold-${blockNumber}-${leftBlockLineNumber}-${rightBlockLineNumber}-${remainingNum}`}
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
		// 问题：删除的行没有 right.lineNumber，会被误判为不在范围内
		// 解决方案：如果一行是删除的行，检查它是否应该和评论范围内的行一起显示
		// 策略：删除的行如果紧邻评论范围内的行（在同一行信息对象中，或者前后相邻），也应该显示
		const isInCommentRange = (line: LineInformation, lineIndex?: number, allLines?: LineInformation[]): boolean => {
			if (commentRowLineNumber === undefined) {
				return false;
			}
			
			// 优先使用 right.lineNumber（新代码的行号）
			if (line.right && line.right.lineNumber !== undefined && line.right.lineNumber !== null) {
				const rightLineNumber = line.right.lineNumber;
				if (commentRowEndLineNumber !== undefined) {
					if (rightLineNumber >= commentRowLineNumber && rightLineNumber <= commentRowEndLineNumber) {
						return true;
					}
				} else {
					if (rightLineNumber === commentRowLineNumber) {
						return true;
					}
				}
			}
			
			// 如果 right.lineNumber 不存在（删除的行），需要特殊处理
			// 删除的行应该和评论范围内的行一起显示，如果它们在同一行信息对象中或相邻
			if (!line.right || line.right.lineNumber === undefined || line.right.lineNumber === null) {
				// 这是删除的行，检查前后行是否在评论范围内
				// 如果前后行在评论范围内，这行也应该显示
				if (lineIndex !== undefined && allLines !== undefined) {
					// 检查前一行
					if (lineIndex > 0) {
						const prevLine = allLines[lineIndex - 1];
						if (prevLine.right && prevLine.right.lineNumber !== undefined && prevLine.right.lineNumber !== null) {
							const prevRightLineNumber = prevLine.right.lineNumber;
							if (commentRowEndLineNumber !== undefined) {
								if (prevRightLineNumber >= commentRowLineNumber && prevRightLineNumber <= commentRowEndLineNumber) {
									return true;
								}
							} else {
								if (prevRightLineNumber === commentRowLineNumber) {
									return true;
								}
							}
						}
					}
					// 检查后一行
					if (lineIndex < allLines.length - 1) {
						const nextLine = allLines[lineIndex + 1];
						if (nextLine.right && nextLine.right.lineNumber !== undefined && nextLine.right.lineNumber !== null) {
							const nextRightLineNumber = nextLine.right.lineNumber;
							if (commentRowEndLineNumber !== undefined) {
								if (nextRightLineNumber >= commentRowLineNumber && nextRightLineNumber <= commentRowEndLineNumber) {
									return true;
								}
							} else {
								if (nextRightLineNumber === commentRowLineNumber) {
									return true;
								}
							}
						}
					}
				}
				return false;
			}
			
			return false;
		};
		
		// 新的折叠逻辑：基于 commentRowLineNumber 和 commentRowEndLineNumber
		// 首/末行索引：并排与行内模式都需要，用于绘制评论区上下虚线
		// commentRangeRowSpan：仅并排模式需要，用于评论框 td 的 rowSpan
		let commentRangeRowSpan = 0;
		let firstCommentRangeIndex: number | null = null;
		let lastCommentRangeIndex: number | null = null;
		if (commentRowLineNumber !== undefined) {
			lineInformation.forEach((line: LineInformation, i: number) => {
				if (isInCommentRange(line, i, lineInformation)) {
					if (splitView && commentRowEndLineNumber !== undefined) {
						commentRangeRowSpan++;
					}
					if (firstCommentRangeIndex === null) {
						firstCommentRangeIndex = i;
					}
					lastCommentRangeIndex = i;
				}
			});
		}
		
		if (commentRowLineNumber !== undefined) {
			let currentFoldBlockStart: number | null = null;
			let currentFoldBlockLines: number[] = [];
			let foldBlockId = 0;
			let hasSeenCommentRange = false;
		
		lineInformation.forEach(
			(line: LineInformation, i: number): void => {
					const inRange = isInCommentRange(line, i, lineInformation);
					
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
							const totalLines = currentFoldBlockLines.length;
							const expandedCount = (this.state.expandedBlocksCount && this.state.expandedBlocksCount[foldBlockId]) || 0;
							const isFullyExpanded = expandedCount >= totalLines || (this.state.expandedBlocks && this.state.expandedBlocks.includes(foldBlockId));
							// 块在评论范围上方：nextLineInRange；块在评论范围下方：isLastLine 且 hasSeenCommentRange
							const isBlockAboveCommentRange = nextLineInRange;

							if (!isFullyExpanded && totalLines > 0) {
								if (expandedCount === 0) {
									// 完全折叠：只显示折叠指示器
									const firstLine = lineInformation[currentFoldBlockStart!];
									const lastLine = lineInformation[currentFoldBlockLines[currentFoldBlockLines.length - 1]];
									actualRenderedIndex++;
									result.push(this.renderSkippedLineIndicator(
										totalLines,
										foldBlockId,
										firstLine.left.lineNumber,
										(lastLine.right && lastLine.right.lineNumber != null ? lastLine.right.lineNumber : lastLine.left.lineNumber),
										totalLines,
									));
								} else {
									// 上方块：slice(-N) 展开底部；下方块：slice(0,N) 展开顶部
									const linesToShow = isBlockAboveCommentRange
										? currentFoldBlockLines.slice(-expandedCount) // 块在上方：展开底部N行（10-20）
										: currentFoldBlockLines.slice(0, expandedCount); // 块在下方：展开顶部N行（30-40）
									const remaining = totalLines - expandedCount;
									const remainingIndices = isBlockAboveCommentRange
										? currentFoldBlockLines.slice(0, remaining) // 块在上方：剩余在顶部
										: currentFoldBlockLines.slice(expandedCount); // 块在下方：剩余在底部
									const remainingFirstLine = lineInformation[remainingIndices[0]];
									const remainingLastLine = lineInformation[remainingIndices[remainingIndices.length - 1]];

									if (isBlockAboveCommentRange) {
										// 上方块：「展开剩下 n 行」在展开区最上面（记录上面还折叠了多少行）
										actualRenderedIndex++;
										result.push(this.renderSkippedLineIndicator(
											remaining,
											foldBlockId,
											remainingFirstLine.left.lineNumber,
											(remainingLastLine.right && remainingLastLine.right.lineNumber != null ? remainingLastLine.right.lineNumber : remainingLastLine.left.lineNumber),
											totalLines,
										));
										linesToShow.forEach((foldLineIndex) => {
											const foldLine = lineInformation[foldLineIndex];
											const diffNodes = splitView
												? this.renderSplitView(foldLine, foldLineIndex, actualRenderedIndex, lineInformation.length, commentRangeRowSpan, foldLineIndex === firstCommentRangeIndex, undefined, foldLineIndex === lastCommentRangeIndex)
												: this.renderInlineView(foldLine, foldLineIndex, isInCommentRange(foldLine, foldLineIndex, lineInformation), foldLineIndex === firstCommentRangeIndex, foldLineIndex === lastCommentRangeIndex);
											actualRenderedIndex++;
											result.push(diffNodes);
										});
									} else {
										// 下方块：「展开剩下 n 行」在展开区最下面（记录下面还折叠了多少行）
										linesToShow.forEach((foldLineIndex) => {
											const foldLine = lineInformation[foldLineIndex];
											const diffNodes = splitView
												? this.renderSplitView(foldLine, foldLineIndex, actualRenderedIndex, lineInformation.length, commentRangeRowSpan, foldLineIndex === firstCommentRangeIndex, undefined, foldLineIndex === lastCommentRangeIndex)
												: this.renderInlineView(foldLine, foldLineIndex, isInCommentRange(foldLine, foldLineIndex, lineInformation), foldLineIndex === firstCommentRangeIndex, foldLineIndex === lastCommentRangeIndex);
											actualRenderedIndex++;
											result.push(diffNodes);
										});
										actualRenderedIndex++;
										result.push(this.renderSkippedLineIndicator(
											remaining,
											foldBlockId,
											remainingFirstLine.left.lineNumber,
											(remainingLastLine.right && remainingLastLine.right.lineNumber != null ? remainingLastLine.right.lineNumber : remainingLastLine.left.lineNumber),
											totalLines,
										));
									}
								}
							} else if (isFullyExpanded) {
								// 完全展开：显示所有行
								currentFoldBlockLines.forEach((foldLineIndex) => {
									const foldLine = lineInformation[foldLineIndex];
									const diffNodes = splitView
										? this.renderSplitView(foldLine, foldLineIndex, actualRenderedIndex, lineInformation.length, commentRangeRowSpan, foldLineIndex === firstCommentRangeIndex, undefined, foldLineIndex === lastCommentRangeIndex)
										: this.renderInlineView(foldLine, foldLineIndex, isInCommentRange(foldLine, foldLineIndex, lineInformation), foldLineIndex === firstCommentRangeIndex, foldLineIndex === lastCommentRangeIndex);
									actualRenderedIndex++;
									result.push(diffNodes);
								});
							}
							
							// 重置折叠块状态
							currentFoldBlockStart = null;
							currentFoldBlockLines = [];
						} else {
							// 继续收集折叠行，不渲染（不 push null，避免影响「展开剩下」位置）
						}
					} else {
						hasSeenCommentRange = true;
						// 当前行在评论范围内，直接显示
						// 如果之前有折叠块，先结束它
						if (currentFoldBlockStart !== null && currentFoldBlockLines.length > 0) {
							const totalLines = currentFoldBlockLines.length;
							const expandedCount = (this.state.expandedBlocksCount && this.state.expandedBlocksCount[foldBlockId]) || 0;
							const isFullyExpanded = expandedCount >= totalLines || (this.state.expandedBlocks && this.state.expandedBlocks.includes(foldBlockId));

							if (!isFullyExpanded && totalLines > 0) {
								if (expandedCount === 0) {
									const firstLine = lineInformation[currentFoldBlockStart];
									const lastLine = lineInformation[currentFoldBlockLines[currentFoldBlockLines.length - 1]];
									actualRenderedIndex++;
									result.push(this.renderSkippedLineIndicator(
										totalLines,
										foldBlockId,
										firstLine.left.lineNumber,
										(lastLine.right && lastLine.right.lineNumber != null ? lastLine.right.lineNumber : lastLine.left.lineNumber),
										totalLines,
									));
								} else {
									// 进入评论范围，说明块在评论范围上方，「展开剩下 n 行」在展开区最上面
									const linesToShow = currentFoldBlockLines.slice(-expandedCount);
									const remaining = totalLines - expandedCount;
									const remainingIndices = currentFoldBlockLines.slice(0, remaining);
									const remainingFirstLine = lineInformation[remainingIndices[0]];
									const remainingLastLine = lineInformation[remainingIndices[remainingIndices.length - 1]];
									actualRenderedIndex++;
									result.push(this.renderSkippedLineIndicator(
										remaining,
										foldBlockId,
										remainingFirstLine.left.lineNumber,
										(remainingLastLine.right && remainingLastLine.right.lineNumber != null ? remainingLastLine.right.lineNumber : remainingLastLine.left.lineNumber),
										totalLines,
									));
									linesToShow.forEach((foldLineIndex) => {
										const foldLine = lineInformation[foldLineIndex];
										const diffNodes = splitView
											? this.renderSplitView(foldLine, foldLineIndex, actualRenderedIndex, lineInformation.length, commentRangeRowSpan, foldLineIndex === firstCommentRangeIndex, undefined, foldLineIndex === lastCommentRangeIndex)
											: this.renderInlineView(foldLine, foldLineIndex, isInCommentRange(foldLine, foldLineIndex, lineInformation), foldLineIndex === firstCommentRangeIndex, foldLineIndex === lastCommentRangeIndex);
										actualRenderedIndex++;
										result.push(diffNodes);
									});
								}
							} else if (isFullyExpanded) {
								currentFoldBlockLines.forEach((foldLineIndex) => {
									const foldLine = lineInformation[foldLineIndex];
									const diffNodes = splitView
										? this.renderSplitView(foldLine, foldLineIndex, actualRenderedIndex, lineInformation.length, commentRangeRowSpan, foldLineIndex === firstCommentRangeIndex, undefined, foldLineIndex === lastCommentRangeIndex)
										: this.renderInlineView(foldLine, foldLineIndex, isInCommentRange(foldLine, foldLineIndex, lineInformation), foldLineIndex === firstCommentRangeIndex, foldLineIndex === lastCommentRangeIndex);
									actualRenderedIndex++;
									result.push(diffNodes);
								});
							}
							currentFoldBlockStart = null;
							currentFoldBlockLines = [];
						}
						
						// 渲染当前行
				const diffNodes = splitView
					? this.renderSplitView(line, i, actualRenderedIndex, lineInformation.length, commentRangeRowSpan, i === firstCommentRangeIndex, true, i === lastCommentRangeIndex)
					: this.renderInlineView(line, i, isInCommentRange(line, i, lineInformation), i === firstCommentRangeIndex, i === lastCommentRangeIndex);
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
						? this.renderSplitView(line, i, actualRenderedIndex, lineInformation.length, commentRangeRowSpan, i === firstCommentRangeIndex, undefined, i === lastCommentRangeIndex)
						: this.renderInlineView(line, i, isInCommentRange(line, i, lineInformation), i === firstCommentRangeIndex, i === lastCommentRangeIndex);
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
