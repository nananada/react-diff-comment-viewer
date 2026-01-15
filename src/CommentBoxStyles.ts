import { css, cx } from 'emotion';
import { Interpolation } from 'create-emotion';

export interface CommentBoxStylesVariables {
	containerBackground?: string;
	containerColor?: string;
	commentItemBackground?: string;
	commentItemBorder?: string;
	commentHeaderColor?: string;
	commentAuthorColor?: string;
	commentTimestampColor?: string;
	commentContentColor?: string;
	buttonBackground?: string;
	buttonColor?: string;
	buttonHoverBackground?: string;
	inputBackground?: string;
	inputBorder?: string;
	inputFocusBorder?: string;
	avatarBackground?: string;
	avatarColor?: string;
}

export interface CommentBoxStylesOverride {
	variables?: {
		dark?: CommentBoxStylesVariables;
		light?: CommentBoxStylesVariables;
	};
	container?: Interpolation;
	commentItem?: Interpolation;
	commentHeader?: Interpolation;
	commentContent?: Interpolation;
	commentFooter?: Interpolation;
	replyBox?: Interpolation;
	inputBox?: Interpolation;
}

export interface CommentBoxStyles {
	container?: string;
	commentItem?: string;
	commentHeader?: string;
	commentAvatar?: string;
	avatarPlaceholder?: string;
	commentUserInfo?: string;
	commentUserMain?: string;
	commentAuthor?: string;
	commentHandle?: string;
	commentRole?: string;
	commentTimestamp?: string;
	commentContent?: string;
	commentFooter?: string;
	replyButton?: string;
	toggleRepliesButton?: string;
	submitButton?: string;
	replyBox?: string;
	replyInput?: string;
	commentInputBox?: string;
	commentInput?: string;
	repliesContainer?: string;
}

export default (
	styleOverride: CommentBoxStylesOverride = {},
	useDarkTheme = false,
): CommentBoxStyles => {
	const { variables: overrideVariables = {}, ...styles } = styleOverride;

	const themeVariables = {
		light: {
			containerBackground: '#ffffff',
			containerColor: '#24292f',
			commentItemBackground: '#ffffff',
			commentItemBorder: '#d1d9e0',
			commentHeaderColor: '#24292f',
			commentAuthorColor: '#0969da',
			commentTimestampColor: '#656d76',
			commentContentColor: '#24292f',
			buttonBackground: '#2da44e',
			buttonColor: '#fff',
			buttonHoverBackground: '#2c974b',
			inputBackground: '#ffffff',
			inputBorder: '#d1d9e0',
			inputFocusBorder: '#0969da',
			avatarBackground: '#0969da',
			avatarColor: '#fff',
			...(overrideVariables.light || {}),
		},
		dark: {
			containerBackground: '#0d1117',
			containerColor: '#c9d1d9',
			commentItemBackground: '#161b22',
			commentItemBorder: '#30363d',
			commentHeaderColor: '#c9d1d9',
			commentAuthorColor: '#58a6ff',
			commentTimestampColor: '#8b949e',
			commentContentColor: '#c9d1d9',
			buttonBackground: '#238636',
			buttonColor: '#fff',
			buttonHoverBackground: '#2ea043',
			inputBackground: '#0d1117',
			inputBorder: '#30363d',
			inputFocusBorder: '#58a6ff',
			avatarBackground: '#58a6ff',
			avatarColor: '#0d1117',
			...(overrideVariables.dark || {}),
		},
	};

	const variables = useDarkTheme ? themeVariables.dark : themeVariables.light;

	const container = css({
		width: '100%',
		background: variables.containerBackground,
		color: variables.containerColor,
		padding: '16px',
		borderRadius: 0,
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
		fontSize: '14px',
		lineHeight: '1.5',
		label: 'comment-box-container',
	});

	const commentItem = css({
		background: variables.commentItemBackground,
		border: `1px solid ${variables.commentItemBorder}`,
		borderRadius: '6px',
		padding: '16px',
		marginBottom: '16px',
		label: 'comment-item',
		'&:last-child': {
			marginBottom: 0,
		},
	});

	const commentHeader = css({
		display: 'flex',
		alignItems: 'flex-start',
		marginBottom: '12px',
		gap: '8px',
		label: 'comment-header',
	});

	const commentAvatar = css({
		width: '32px',
		height: '32px',
		borderRadius: '50%',
		overflow: 'hidden',
		flexShrink: 0,
		label: 'comment-avatar',
		img: {
			width: '100%',
			height: '100%',
			objectFit: 'cover',
		},
	});

	const avatarPlaceholder = css({
		width: '100%',
		height: '100%',
		background: variables.avatarBackground,
		color: variables.avatarColor,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: '14px',
		fontWeight: 600,
		label: 'avatar-placeholder',
	});

	const commentUserInfo = css({
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		gap: '2px',
		label: 'comment-user-info',
	});

	const commentUserMain = css({
		display: 'flex',
		alignItems: 'center',
		gap: '6px',
		flexWrap: 'wrap',
		label: 'comment-user-main',
	});

	const commentAuthor = css({
		fontWeight: 600,
		color: variables.commentAuthorColor,
		fontSize: '14px',
		textDecoration: 'none',
		'&:hover': {
			textDecoration: 'underline',
		},
		label: 'comment-author',
	});

	const commentHandle = css({
		color: variables.commentTimestampColor,
		fontSize: '12px',
		fontStyle: 'normal',
		label: 'comment-handle',
	});

	const commentRole = css({
		color: variables.commentTimestampColor,
		fontSize: '12px',
		padding: '2px 6px',
		background: 'transparent',
		borderRadius: '3px',
		border: `1px solid ${variables.commentItemBorder}`,
		label: 'comment-role',
	});

	const commentTimestamp = css({
		color: variables.commentTimestampColor,
		fontSize: '12px',
		label: 'comment-timestamp',
	});

	const commentContent = css({
		color: variables.commentContentColor,
		fontSize: '14px',
		lineHeight: '1.5',
		marginTop: '8px',
		marginBottom: '0',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
		label: 'comment-content',
	});

	const commentFooter = css({
		display: 'flex',
		gap: '12px',
		alignItems: 'center',
		marginTop: '8px',
		label: 'comment-footer',
	});

	const replyButton = css({
		background: 'transparent',
		border: 'none',
		color: variables.commentTimestampColor,
		cursor: 'pointer',
		fontSize: '14px',
		padding: '4px 0',
		borderRadius: '4px',
		textDecoration: 'none',
		label: 'reply-button',
		'&:hover': {
			color: variables.commentAuthorColor,
			textDecoration: 'underline',
		},
	});

	const toggleRepliesButton = css({
		background: 'transparent',
		border: 'none',
		color: variables.commentTimestampColor,
		cursor: 'pointer',
		fontSize: '14px',
		padding: '4px 8px',
		borderRadius: '4px',
		label: 'toggle-replies-button',
		'&:hover': {
			background: variables.commentItemBorder,
		},
	});

	const submitButton = css({
		background: variables.buttonBackground,
		color: variables.buttonColor,
		border: 'none',
		padding: '8px 16px',
		borderRadius: '4px',
		cursor: 'pointer',
		fontSize: '14px',
		fontWeight: 500,
		marginTop: '8px',
		label: 'submit-button',
		'&:hover': {
			background: variables.buttonHoverBackground,
		},
		'&:disabled': {
			opacity: 0.5,
			cursor: 'not-allowed',
		},
	});

	const replyBox = css({
		marginTop: '12px',
		paddingTop: '12px',
		borderTop: `1px solid ${variables.commentItemBorder}`,
		label: 'reply-box',
	});

	const replyInput = css({
		width: '100%',
		padding: '8px 12px',
		border: `1px solid ${variables.inputBorder}`,
		borderRadius: '4px',
		background: variables.inputBackground,
		color: variables.containerColor,
		fontSize: '14px',
		fontFamily: 'inherit',
		resize: 'vertical',
		label: 'reply-input',
		'&:focus': {
			outline: 'none',
			borderColor: variables.inputFocusBorder,
		},
	});

	const commentInputBox = css({
		marginBottom: '24px',
		label: 'comment-input-box',
	});

	const commentInput = css({
		width: '100%',
		padding: '12px',
		border: `1px solid ${variables.inputBorder}`,
		borderRadius: '4px',
		background: variables.inputBackground,
		color: variables.containerColor,
		fontSize: '14px',
		fontFamily: 'inherit',
		resize: 'vertical',
		marginBottom: '8px',
		label: 'comment-input',
		'&:focus': {
			outline: 'none',
			borderColor: variables.inputFocusBorder,
		},
	});

	const repliesContainer = css({
		marginTop: '16px',
		paddingLeft: '16px',
		borderLeft: `2px solid ${variables.commentItemBorder}`,
		label: 'replies-container',
	});

	const defaultStyles: CommentBoxStyles = {
		container,
		commentItem,
		commentHeader,
		commentAvatar,
		avatarPlaceholder,
		commentUserInfo,
		commentUserMain,
		commentAuthor,
		commentHandle,
		commentRole,
		commentTimestamp,
		commentContent,
		commentFooter,
		replyButton,
		toggleRepliesButton,
		submitButton,
		replyBox,
		replyInput,
		commentInputBox,
		commentInput,
		repliesContainer,
	};

	const computedOverrideStyles: any = Object.keys(styles).reduce(
		(acc: any, key: string): any => ({
			...acc,
			...{
				[key]: css((styles as any)[key]),
			},
		}),
		{},
	);

	return Object.keys(defaultStyles).reduce(
		(acc: CommentBoxStyles, key: string): CommentBoxStyles => ({
			...acc,
			...{
				[key]: computedOverrideStyles[key]
					? cx(defaultStyles[key as keyof CommentBoxStyles], computedOverrideStyles[key])
					: defaultStyles[key as keyof CommentBoxStyles],
			},
		}),
		{} as CommentBoxStyles,
	);
};

