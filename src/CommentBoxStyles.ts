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
			containerBackground: '#fff',
			containerColor: '#212529',
			commentItemBackground: '#f6f8fa',
			commentItemBorder: '#d0d7de',
			commentHeaderColor: '#212529',
			commentAuthorColor: '#000000',
			commentTimestampColor: '#656d76',
			commentContentColor: '#1f2328',
			buttonBackground: '#2da44e',
			buttonColor: '#fff',
			buttonHoverBackground: '#2c974b',
			inputBackground: '#fff',
			inputBorder: '#d0d7de',
			inputFocusBorder: '#0969da',
			avatarBackground: '#0969da',
			avatarColor: '#fff',
			...(overrideVariables.light || {}),
		},
		dark: {
			containerBackground: '#2e303c',
			containerColor: '#fff',
			commentItemBackground: '#363946',
			commentItemBorder: '#464c67',
			commentHeaderColor: '#fff',
			commentAuthorColor: '#ffffff',
			commentTimestampColor: '#8b949e',
			commentContentColor: '#c9d1d9',
			buttonBackground: '#238636',
			buttonColor: '#fff',
			buttonHoverBackground: '#2ea043',
			inputBackground: '#21262d',
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
		padding: '24px',
		borderRadius: '8px',
		label: 'comment-box-container',
	});

	const commentItem = css({
		background: variables.commentItemBackground,
		border: `1px solid ${variables.commentItemBorder}`,
		borderRadius: '8px',
		padding: '16px',
		marginBottom: '12px',
		label: 'comment-item',
		'&:last-child': {
			marginBottom: 0,
		},
	});

	const commentHeader = css({
		display: 'flex',
		alignItems: 'flex-start',
		marginBottom: '12px',
		gap: '12px',
		label: 'comment-header',
	});

	const commentAvatar = css({
		width: '46px',
		height: '48px',
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
		fontSize: '20px',
		fontWeight: 700,
		label: 'avatar-placeholder',
	});

	const commentUserInfo = css({
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		gap: '4px',
		label: 'comment-user-info',
	});

	const commentUserMain = css({
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		flexWrap: 'wrap',
		label: 'comment-user-main',
	});

	const commentAuthor = css({
		fontWeight: 600,
		color: variables.commentAuthorColor,
		fontSize: '17px',
		label: 'comment-author',
	});

	const commentHandle = css({
		color: variables.commentTimestampColor,
		fontSize: '13px',
		fontStyle: 'normal', // 确保 @ 符号显示为正体，不是斜体
		label: 'comment-handle',
	});

	const commentRole = css({
		color: '#0969da',
		fontSize: '12px',
		padding: '2px 6px',
		background: 'transparent',
		borderRadius: '3px',
		label: 'comment-role',
	});

	const commentTimestamp = css({
		color: variables.commentTimestampColor,
		fontSize: '14px',
		label: 'comment-timestamp',
	});

	const commentContent = css({
		color: variables.commentContentColor,
		fontSize: '15px',
		lineHeight: '1.6',
		marginBottom: '8px',
		marginLeft: '58px', // 头像宽度(48px) + gap(12px) = 60px，与 author 对齐
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
		marginTop: '12px',
		paddingLeft: '24px',
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

