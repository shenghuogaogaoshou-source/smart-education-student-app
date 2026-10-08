import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('application shell', () => {
  it('introduces the student learning world', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '欢迎来到数智学习世界' }),
    ).toBeInTheDocument()
  })
})
