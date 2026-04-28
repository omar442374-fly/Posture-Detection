import { Component } from 'react'

/**
 * ErrorBoundary
 * Catches unhandled render errors in child components and shows a friendly
 * fallback UI instead of crashing the entire app.
 */
export default class ErrorBoundary extends Component {
  constructor (props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError (error) {
    return { hasError: true, error }
  }

  componentDidCatch (error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render () {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: '1rem',
          background: '#0f172a', color: '#f1f5f9', fontFamily: 'inherit',
          padding: '2rem', textAlign: 'center'
        }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: '#94a3b8', maxWidth: '480px' }}>
            An unexpected error occurred. Try reloading the application.
          </p>
          <pre style={{
            background: '#1e293b', color: '#f87171', borderRadius: '0.5rem',
            padding: '1rem', fontSize: '0.75rem', maxWidth: '600px',
            overflow: 'auto', textAlign: 'left', maxHeight: '160px'
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1.5rem', borderRadius: '0.5rem',
              background: '#0d9488', color: 'white', border: 'none',
              fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
