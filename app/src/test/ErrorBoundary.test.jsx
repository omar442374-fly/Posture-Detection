import { describe, it, expect, vi, useState } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { useState as useReactState } from 'react'

function Bomb ({ shouldThrow }) {
  if (shouldThrow) throw new Error('Test explosion')
  return <div>All good</div>
}

// Wrapper that lets us flip "shouldThrow" from outside the boundary
function ControlledScene () {
  const [boom, setBoom] = useReactState(true)
  return (
    <>
      <button data-testid="defuse" onClick={() => setBoom(false)}>Defuse</button>
      <ErrorBoundary>
        <Bomb shouldThrow={boom} />
      </ErrorBoundary>
    </>
  )
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders fallback UI when a child throws', () => {
    // Suppress React's noisy console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/Test explosion/)).toBeInTheDocument()

    spy.mockRestore()
  })

  it('resets error state when "Try Again" is clicked (after defusing the child)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ControlledScene />)

    // ErrorBoundary should be showing the fallback
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Defuse the child so it no longer throws, then reset the boundary
    fireEvent.click(screen.getByTestId('defuse'))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    // Now the child renders successfully
    expect(screen.getByText('All good')).toBeInTheDocument()
    spy.mockRestore()
  })
})
