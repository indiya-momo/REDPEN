import { Component } from 'react';

/**
 * 렌더 크래시 시 흰 화면 대신 안내 표시
 */
export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'unknown');
      return (
        <div className="app-fatal" role="alert">
          <h1>화면을 불러오지 못했습니다</h1>
          <p>아래 오류를 확인한 뒤 새로고침해 주세요.</p>
          <pre className="app-fatal__detail">{message}</pre>
          <button
            type="button"
            className="btn-primary app-fatal__reload"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
