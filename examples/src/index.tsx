require('./style.scss');
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import ReactDiff, { DiffMethod } from '../../lib/index';
import CommentBox, { Comment } from '../../lib/CommentBox';

const oldJs = require('./diff/javascript/old.rjs').default;
const newJs = require('./diff/javascript/new.rjs').default;

const logo = require('../../logo.png');

interface ExampleState {
  splitView?: boolean;
  highlightLine?: string[];
  language?: string;
  enableSyntaxHighlighting?: boolean;
  compareMethod?: DiffMethod;
  showCommentBox?: boolean;
  comments?: Comment[];
  useDarkThemeComment?: boolean;
  useDarkTheme?: boolean;
}

const P = (window as any).Prism;

class Example extends React.Component<{}, ExampleState> {
  public constructor(props: any) {
    super(props);
    this.state = {
      splitView: true,
      highlightLine: [],
      enableSyntaxHighlighting: true,
      showCommentBox: true,
      useDarkThemeComment: false,
      useDarkTheme: true,
      comments: [
        {
          id: '1',
          author: 'AIROBOT',
          handle: 'liarchitect',
          role: 'Maintainer',
          content: 'main/module/exports 指向 src/*.ts 源文件,非 TS-aware 环境或外部项目可能无法直接消费。建议指向构建产物 (dist/index.cjs、dist/index.esm.js), 子路径 exports 也应对齐构建输出。',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
          replies: [],
        }
      ],
    };
  }

  private onLineNumberClick = (
    id: string,
    e: React.MouseEvent<HTMLTableCellElement>,
  ): void => {
    let highlightLine = [id];
    if (e.shiftKey && this.state.highlightLine && this.state.highlightLine.length === 1) {
      const firstLine = this.state.highlightLine[0];
      if (firstLine) {
        const [dir, oldId] = firstLine.split('-');
        const [newDir, newId] = id.split('-');
        if (dir === newDir && oldId && newId) {
          highlightLine = [];
          const lowEnd = Math.min(Number(oldId), Number(newId));
          const highEnd = Math.max(Number(oldId), Number(newId));
          for (let i = lowEnd; i <= highEnd; i++) {
            highlightLine.push(`${dir}-${i}`);
          }
        }
      }
    }
    this.setState({
      highlightLine,
    });
  };

  private syntaxHighlight = (str: string): any => {
    if (!str) return;
    const language = P.highlight(str, P.languages.javascript);
    return <span dangerouslySetInnerHTML={{ __html: language }} />;
  };

  private toggleViewMode = (): void => {
    this.setState({
      splitView: !this.state.splitView,
    });
  };

  private toggleCommentBox = (): void => {
    this.setState({
      showCommentBox: !this.state.showCommentBox,
    });
  };

  private toggleCommentTheme = (): void => {
    this.setState({
      useDarkThemeComment: !this.state.useDarkThemeComment,
    });
  };

  private toggleTheme = (): void => {
    this.setState({
      useDarkTheme: !this.state.useDarkTheme,
    });
  };

  private handleCommentSubmit = (content: string): void => {
    const newComment: Comment = {
      id: Date.now().toString(),
      author: '当前用户',
      content,
      timestamp: new Date(),
    };

    this.setState({
      comments: [newComment, ...(this.state.comments || [])],
    });
  };

  private handleReplySubmit = (commentId: string, content: string): void => {
    const newReply: Comment = {
      id: `${commentId}-${Date.now()}`,
      author: '当前用户',
      content,
      timestamp: new Date(),
    };

    const updatedComments = (this.state.comments || []).map((comment) => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply],
        };
      }
      return comment;
    });

    this.setState({
      comments: updatedComments,
    });
  };

  public render(): JSX.Element {

    return (
      <div className="react-diff-viewer-example">
        <div className="radial"></div>
        <div className="banner">
          <div className="img-container">
            <img src={logo} alt="React Diff Viewer Logo" />
          </div>
          <p>
            A simple and beautiful text diff viewer made with{' '}
            <a href="https://github.com/kpdecker/jsdiff" target="_blank">
              Diff{' '}
            </a>
            and{' '}
            <a href="https://reactjs.org" target="_blank">
              React.{' '}
            </a>
            Featuring split view, inline view, word diff, line highlight and more.
          </p>
          <div className="cta">
            <a href="https://github.com/praneshr/react-diff-viewer#install">
              <button type="button" className="btn btn-primary btn-lg">
                Documentation
              </button>
            </a>
          </div>
        </div>
        <div className="diff-viewer">
          <div style={{ marginBottom: '10px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={this.toggleViewMode}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: this.state.splitView ? '#0366d6' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginRight: '10px',
              }}
            >
              {this.state.splitView ? '切换到行内模式' : '切换到并排模式'}
            </button>
            <button
              type="button"
              onClick={this.toggleTheme}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: this.state.useDarkTheme ? '#2e303c' : '#f7f7f7',
                color: this.state.useDarkTheme ? 'white' : '#212529',
                border: '1px solid #d0d7de',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginRight: '10px',
              }}
            >
              {this.state.useDarkTheme ? '切换到白色模式' : '切换到暗黑模式'}
            </button>
          </div>
          <ReactDiff
            highlightLines={this.state.highlightLine}
            onLineNumberClick={this.onLineNumberClick}
            oldValue={oldJs}
            splitView={this.state.splitView}
            newValue={newJs}
            renderContent={this.syntaxHighlight}
            useDarkTheme={this.state.useDarkTheme}
            showDiffOnly={false}
            leftTitle="webpack.config.js master@2178133 - pushed 2 hours ago."
            rightTitle="webpack.config.js master@64207ee - pushed 13 hours ago."
            commentRow={(
              <div style={{ 
                padding: '10px',
                background: 'transparent',
                overflow: 'auto',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'stretch',
                width: '100%',
              }}>
                <CommentBox
                  comments={this.state.comments || []}
                  showAvatar={true}
                  useDarkTheme={this.state.useDarkThemeComment}
                />
              </div>
            )}
            commentRowLineNumber={10}
            commentRowEndLineNumber={40}
          />
        </div>
        <footer>
          Made with 💓 by{' '}
          <a href="https://praneshravi.in" target="_blank">
            Pranesh Ravi
          </a>
        </footer>
      </div>
    );
  }
}

ReactDOM.render(<Example />, document.getElementById('app'));
