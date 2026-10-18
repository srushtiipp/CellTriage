import { Component } from 'react'
import Notice from './ui/Notice'

/** Keeps a rendering failure on one page from taking down the whole app. */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('[CellTriage] page crashed:', error)
  }

  componentDidUpdate(prev) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (this.state.failed) {
      return (
        <Notice tone="bad" title="This page hit an unexpected error">
          The rest of the app is unaffected. Choose another page, or{' '}
          <button type="button" className="font-medium underline" onClick={() => window.location.reload()}>
            reload
          </button>
          .
        </Notice>
      )
    }
    return this.props.children
  }
}
