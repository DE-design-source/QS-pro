import { Component } from 'react'
import StatusView from './StatusView'

/* Chặn lỗi khi vẽ một vùng của QS để phần còn lại (và SiteFlow) vẫn chạy; lỗi được hiện rõ, không nuốt.
   Props: children; onError(error, info) (tuỳ chọn: caller gửi logClientError, PLAN 1.4 G16; gọi trong
          componentDidCatch, không phải trong effect lúc vẽ); resetKey (đổi giá trị = thử vẽ lại, vd. đổi tab/dự án);
          title (tiêu đề thẻ lỗi, mặc định "Có lỗi khi hiển thị"); fallback(error, retry) (tuỳ chọn: tự vẽ thay thẻ lỗi). */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, key: props.resetKey }
    this.retry = () => this.setState({ error: null })
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.key) return { key: props.resetKey, error: null }
    return null
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      try { this.props.onError(error, info) } catch (e) { console.error('ErrorBoundary onError', e) }
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.retry)
    return (
      <StatusView
        kind="error"
        title={this.props.title || 'Có lỗi khi hiển thị'}
        message={String((error && error.message) || error)}
        onRetry={this.retry}
      />
    )
  }
}
