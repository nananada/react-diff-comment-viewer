import * as React from 'react';
import * as PropTypes from 'prop-types';
import cn from 'classnames';

import computeCommentBoxStyles, {
	CommentBoxStylesOverride,
	CommentBoxStyles,
} from './CommentBoxStyles';

export interface Comment {
	id: string;
	author: string;
	handle?: string;  // 用户handle，如 @liarchitect
	role?: string;    // 用户角色，如 "Maintainer"
	content: string;
	timestamp: Date;
	avatar?: string;
	replies?: Comment[];
}

export interface CommentBoxProps {
	comments: Comment[];
	showAvatar?: boolean;
	useDarkTheme?: boolean;
	styles?: CommentBoxStylesOverride;
}

export interface CommentBoxState {
	// No state needed for read-only comment box
}

class CommentBox extends React.Component<CommentBoxProps, CommentBoxState> {
	private styles: CommentBoxStyles;

	public static defaultProps: Partial<CommentBoxProps> = {
		comments: [],
		showAvatar: true,
		useDarkTheme: false,
		styles: {},
	};

	public static propTypes = {
		comments: PropTypes.arrayOf(PropTypes.object).isRequired,
		showAvatar: PropTypes.bool,
		styles: PropTypes.object,
	};

	public constructor(props: CommentBoxProps) {
		super(props);

		this.state = {};
	}

	/**
	 * Computes final styles for the comment box. It combines the default styles with the user
	 * supplied overrides. The computed styles are cached with performance in mind.
	 *
	 * @param styles User supplied style overrides.
	 * @param useDarkTheme Whether to use dark theme.
	 */
	private computeStyles = (
		styles: CommentBoxStylesOverride,
		useDarkTheme: boolean,
	): CommentBoxStyles => computeCommentBoxStyles(styles, useDarkTheme);

	/**
	 * Formats timestamp to relative time (e.g., "3 hours ago").
	 */
	private formatTimestamp = (timestamp: Date): string => {
		const now = new Date();
		const diff = now.getTime() - timestamp.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days} ${days === 1 ? 'day' : 'days'} ago`;
		}
		if (hours > 0) {
			return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
		}
		if (minutes > 0) {
			return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
		}
		return 'just now';
	};


	/**
	 * Renders a single comment item.
	 *
	 * @param comment Comment data object.
	 * @param index Index of the comment in the list.
	 */
	private renderComment = (
		comment: Comment,
		index: number,
	): JSX.Element => {
		const { showAvatar } = this.props;
		const hasReplies = comment.replies && comment.replies.length > 0;

		return (
			<div key={comment.id} className={this.styles.commentItem}>
				<div className={this.styles.commentHeader}>
					{showAvatar && (
						<div className={this.styles.commentAvatar}>
							{comment.avatar ? (
								<img src={comment.avatar} alt={comment.author} />
							) : (
								<div className={this.styles.avatarPlaceholder}>
									{comment.author.charAt(0).toUpperCase()}
								</div>
							)}
						</div>
					)}
					<div className={this.styles.commentUserInfo}>
						<div className={this.styles.commentUserMain}>
							<span className={this.styles.commentAuthor}>{comment.author}</span>
							{comment.handle && (
								<span className={this.styles.commentHandle}>@{comment.handle}</span>
							)}
							{comment.role && (
								<span className={this.styles.commentRole}>{comment.role}</span>
							)}
						</div>
						<div className={this.styles.commentTimestamp}>
							{this.formatTimestamp(comment.timestamp)}
						</div>
					</div>
				</div>
				<div className={this.styles.commentContent}>
					{comment.content}
				</div>
				{hasReplies && (
					<div className={this.styles.repliesContainer}>
						{this.renderReplies(comment.replies)}
					</div>
				)}
			</div>
		);
	};

	/**
	 * Renders replies for a comment.
	 *
	 * @param replies Array of reply comments.
	 */
	private renderReplies = (replies: Comment[]): JSX.Element[] => {
		return replies.map(
			(reply: Comment, index: number): JSX.Element => {
				return this.renderComment(reply, index);
			},
		);
	};


	/**
	 * Generates the entire comment list.
	 */
	private renderComments = (): JSX.Element[] => {
		const { comments } = this.props;

		return comments.map(
			(comment: Comment, index: number): JSX.Element => {
				return this.renderComment(comment, index);
			},
		);
	};

	public render = (): JSX.Element => {
		const { comments, useDarkTheme, styles } = this.props;

		if (!Array.isArray(comments)) {
			throw Error('"comments" should be an array');
		}

		this.styles = this.computeStyles(styles, useDarkTheme);

		return (
			<div className={this.styles.container}>
				<div>
					{this.renderComments()}
				</div>
			</div>
		);
	};
}

export default CommentBox;
export { CommentBoxStylesOverride };

