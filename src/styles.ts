import { css, cx } from 'emotion';
import { Interpolation } from 'create-emotion';

export interface ReactDiffViewerStyles {
	diffContainer?: string;
	diffRemoved?: string;
	diffAdded?: string;
	line?: string;
	highlightedGutter?: string;
	contentText?: string;
	gutter?: string;
	highlightedLine?: string;
	lineNumber?: string;
	marker?: string;
	wordDiff?: string;
	wordAdded?: string;
	wordRemoved?: string;
	codeFoldGutter?: string;
	emptyGutter?: string;
	emptyLine?: string;
	codeFold?: string;
	titleBlock?: string;
	content?: string;
	splitView?: string;
	[key: string]: string | undefined;
}

export interface ReactDiffViewerStylesVariables {
	diffViewerBackground?: string;
	diffViewerTitleBackground?: string;
	diffViewerColor?: string;
	diffViewerTitleColor?: string;
	diffViewerTitleBorderColor?: string;
	addedBackground?: string;
	addedColor?: string;
	removedBackground?: string;
	removedColor?: string;
	wordAddedBackground?: string;
	wordRemovedBackground?: string;
	addedGutterBackground?: string;
	removedGutterBackground?: string;
	gutterBackground?: string;
	gutterBackgroundDark?: string;
	highlightBackground?: string;
	highlightGutterBackground?: string;
	codeFoldGutterBackground?: string;
	codeFoldBackground?: string;
	emptyLineBackground?: string;
	gutterColor?: string;
	addedGutterColor?: string;
	removedGutterColor?: string;
	codeFoldContentColor?: string;
}

export interface ReactDiffViewerStylesOverride {
	variables?: {
		dark?: ReactDiffViewerStylesVariables;
		light?: ReactDiffViewerStylesVariables;
	};
	diffContainer?: Interpolation;
	diffRemoved?: Interpolation;
	diffAdded?: Interpolation;
	marker?: Interpolation;
	emptyGutter?: Interpolation;
	highlightedLine?: Interpolation;
	lineNumber?: Interpolation;
	highlightedGutter?: Interpolation;
	contentText?: Interpolation;
	gutter?: Interpolation;
	line?: Interpolation;
	wordDiff?: Interpolation;
	wordAdded?: Interpolation;
	wordRemoved?: Interpolation;
	codeFoldGutter?: Interpolation;
	emptyLine?: Interpolation;
	content?: Interpolation;
	titleBlock?: Interpolation;
	splitView?: Interpolation;
}

export default (
	styleOverride: ReactDiffViewerStylesOverride,
	useDarkTheme = false,
	fontSize: string | number | undefined = '14px',
): ReactDiffViewerStyles => {
	const { variables: overrideVariables = {}, ...styles } = styleOverride;
	
	// Normalize fontSize: if number, add 'px', otherwise use as is
	const normalizedFontSize = typeof fontSize === 'number' ? `${fontSize}px` : (fontSize || '14px');
	
	// Calculate codeFoldContent fontSize (2px smaller than code font size)
	const parseFontSize = (size: string): number => {
		const match = size.match(/(\d+(?:\.\d+)?)/);
		return match ? parseFloat(match[1]) : 14;
	};
	const codeFontSizeNum = parseFontSize(normalizedFontSize);
	const codeFoldFontSize = `${Math.max(codeFontSizeNum - 2, 8)}px`; // Minimum 8px

	const themeVariables = {
		light: {
			...{
				diffViewerBackground: '#faf9f6',
				diffViewerColor: '#4a5568',
				addedBackground: '#dcfce7',
				addedColor: '#4a5568',
				removedBackground: '#fee2e2',
				removedColor: '#4a5568',
				wordAddedBackground: '#86efac',
				wordRemovedBackground: '#fca5a5',
				addedGutterBackground: '#bbf7d0',
				removedGutterBackground: '#fecaca',
				gutterBackground: '#f5f4f1',
				gutterBackgroundDark: '#f0efe9',
				highlightBackground: '#fffbdd',
				highlightGutterBackground: '#fff5b1',
				codeFoldGutterBackground: '#e8e8e8',
				codeFoldBackground: '#f5f5f5',
				emptyLineBackground: '#f5f4f1',
				gutterColor: '#656d76',
				addedGutterColor: '#656d76',
				removedGutterColor: '#656d76',
				codeFoldContentColor: '#212529',
				diffViewerTitleBackground: '#f5f4f1',
				diffViewerTitleColor: '#212529',
				diffViewerTitleBorderColor: '#e8e6e0',
			},
			...(overrideVariables.light || {}),
		},
		dark: {
			...{
				diffViewerBackground: '#2e303c',
				diffViewerColor: '#FFF',
				addedBackground: '#1a472a',
				addedColor: 'white',
				removedBackground: '#490202',
				removedColor: 'white',
				wordAddedBackground: '#1e5a2e',
				wordRemovedBackground: '#5d1f23',
				addedGutterBackground: '#132f1b',
				removedGutterBackground: '#3d1f23',
				gutterBackground: '#2c2f3a',
				gutterBackgroundDark: '#262933',
				highlightBackground: '#2a3967',
				highlightGutterBackground: '#2d4077',
				codeFoldGutterBackground: '#21232b',
				codeFoldBackground: '#262831',
				emptyLineBackground: '#363946',
				gutterColor: '#464c67',
				addedGutterColor: '#8c8c8c',
				removedGutterColor: '#8c8c8c',
				codeFoldContentColor: '#555a7b',
				diffViewerTitleBackground: '#2f323e',
				diffViewerTitleColor: '#555a7b',
				diffViewerTitleBorderColor: '#353846',
			},
			...(overrideVariables.dark || {}),
		},
	};

	const variables = useDarkTheme ? themeVariables.dark : themeVariables.light;

	const content = css({
		// 在并排模式下，宽度由 colgroup 控制，不设置固定宽度
		verticalAlign: 'middle',
		textAlign: 'left',
		label: 'content',
	});

	const splitView = css({
		// 移除对 content 宽度的设置，完全通过 colgroup 来控制列宽
		// 这样可以确保三个区域（左代码、右代码、评论）各占33.33%
		label: 'split-view',
	});

	const diffContainer = css({
		width: '100%',
		background: variables.diffViewerBackground,
		fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace",
		fontSize: normalizedFontSize,
		pre: {
			margin: 0,
			whiteSpace: 'pre-wrap', // 允许代码折行
			lineHeight: '24px',
			fontFamily: "'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace",
			fontSize: normalizedFontSize,
			textAlign: 'left',
			wordBreak: 'break-word', // 允许长单词折行
		},
		label: 'diff-container',
		borderCollapse: 'collapse',
		// 默认使用 fixed 布局以确保三等分逻辑，但可以通过内联样式覆盖为 auto
		tableLayout: 'fixed',
	});

	const codeFoldContent = css({
		color: '#6a737d', // 灰色
		fontStyle: 'italic', // 斜体
		fontSize: `${codeFoldFontSize} !important`, // 字号比代码行小两号，使用 !important 确保覆盖父元素
		label: 'code-fold-content',
	});

	const contentText = css({
		color: variables.diffViewerColor,
		margin: 0,
		textAlign: 'left',
		label: 'content-text',
	});

	const titleBlock = css({
		background: variables.diffViewerTitleBackground,
		padding: 10,
		borderBottom: `1px solid ${variables.diffViewerTitleBorderColor}`,
		label: 'title-block',
		':last-child': {
			borderLeft: `1px solid ${variables.diffViewerTitleBorderColor}`,
		},
		[`.${contentText}`]: {
			color: variables.diffViewerTitleColor,
		},
	});

	const lineNumber = css({
		color: variables.gutterColor,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		textAlign: ['center', '!important'] as any,
		label: 'line-number',
	});

	const diffRemoved = css({
		background: variables.removedBackground,
		color: variables.removedColor,
		pre: {
			color: variables.removedColor,
		},
		[`.${lineNumber}`]: {
			color: variables.removedGutterColor,
		},
		label: 'diff-removed',
	});

	const diffAdded = css({
		background: variables.addedBackground,
		color: variables.addedColor,
		pre: {
			color: variables.addedColor,
		},
		[`.${lineNumber}`]: {
			color: variables.addedGutterColor,
		},
		label: 'diff-added',
	});

	const wordDiff = css({
		padding: 2,
		display: 'inline-flex',
		borderRadius: 1,
		label: 'word-diff',
	});

	const wordAdded = css({
		background: variables.wordAddedBackground,
		label: 'word-added',
	});

	const wordRemoved = css({
		background: variables.wordRemovedBackground,
		label: 'word-removed',
	});

	const codeFoldGutter = css({
		backgroundColor: variables.codeFoldGutterBackground,
		// 在 tableLayout: 'fixed' 模式下，列宽由 colgroup 控制
		// 在行内视图模式下，通过内联样式设置固定宽度
		label: 'code-fold-gutter',
	});

	const codeFold = css({
		backgroundColor: variables.codeFoldBackground,
		height: 40,
		fontSize: normalizedFontSize, // Use the same font size as code lines
		fontWeight: 700,
		label: 'code-fold',
		a: {
			textDecoration: 'underline !important',
			cursor: 'pointer',
			pre: {
				display: 'inline',
			},
		},
	});

	const emptyLine = css({
		backgroundColor: variables.emptyLineBackground,
		label: 'empty-line',
	});

	const marker = css({
		// 在 tableLayout: 'fixed' 模式下，列宽由 colgroup 控制，不设置固定宽度
		// 在行内视图模式下，通过内联样式设置固定宽度
		padding: '0 2px',
		overflow: 'visible',
		textAlign: 'center',
		userSelect: 'none',
		label: 'marker',
		color: variables.gutterColor,
		pre: {
			color: `${variables.gutterColor} !important`,
			textAlign: 'center',
		},
		[`&.${diffAdded}`]: {
			color: variables.addedGutterColor,
			pre: {
				color: `${variables.addedGutterColor} !important`,
			},
		},
		[`&.${diffRemoved}`]: {
			color: variables.removedGutterColor,
			pre: {
				color: `${variables.removedGutterColor} !important`,
			},
		},
	});

	const highlightedLine = css({
		background: variables.highlightBackground,
		label: 'highlighted-line',
		[`.${wordAdded}, .${wordRemoved}`]: {
			backgroundColor: 'initial',
		},
	});

	const highlightedGutter = css({
		label: 'highlighted-gutter',
	});

	const gutter = css({
		userSelect: 'none',
		// 在 tableLayout: 'fixed' 模式下，列宽由 colgroup 控制，不设置固定宽度
		// 在行内视图模式下，通过内联样式设置固定宽度
		padding: '0 2px',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		label: 'gutter',
		textAlign: 'center',
		verticalAlign: 'middle',
		background: variables.gutterBackground,
		borderRight: useDarkTheme ? '1px solid #30363d' : '1px solid #d1d9e0',
		'&:hover': {
			cursor: 'pointer',
			pre: {
				opacity: 1,
			},
		},
		pre: {
			opacity: 0.5,
			textAlign: ['center', '!important'] as any,
		},
		[`&.${diffAdded}`]: {
			background: variables.addedGutterBackground,
			borderRight: useDarkTheme ? '1px solid #1e5a2e' : '1px solid #a8d5ba',
		},
		[`&.${diffRemoved}`]: {
			background: variables.removedGutterBackground,
			borderRight: useDarkTheme ? '1px solid #5d1f23' : '1px solid #f5c2c7',
		},
		[`&.${highlightedGutter}`]: {
			background: variables.highlightGutterBackground,
			'&:hover': {
				background: variables.highlightGutterBackground,
			},
		},
	});

	const emptyGutter = css({
		'&:hover': {
			background: variables.gutterBackground,
			cursor: 'initial',
		},
		label: 'empty-gutter',
	});

	const line = css({
		verticalAlign: 'middle',
		label: 'line',
	});

	const defaultStyles: any = {
		diffContainer,
		diffRemoved,
		diffAdded,
		splitView,
		marker,
		highlightedGutter,
		highlightedLine,
		gutter,
		line,
		wordDiff,
		wordAdded,
		wordRemoved,
		codeFoldGutter,
		codeFold,
		emptyGutter,
		emptyLine,
		lineNumber,
		contentText,
		content,
		codeFoldContent,
		titleBlock,
	};

	const computerOverrideStyles: ReactDiffViewerStyles = Object.keys(
		styles,
	).reduce(
		(acc, key): ReactDiffViewerStyles => ({
			...acc,
			...{
				[key]: css((styles as any)[key]),
			},
		}),
		{},
	);

	return Object.keys(defaultStyles).reduce(
		(acc, key): ReactDiffViewerStyles => ({
			...acc,
			...{
				[key]: computerOverrideStyles[key]
					? cx(defaultStyles[key], computerOverrideStyles[key])
					: defaultStyles[key],
			},
		}),
		{},
	);
};
