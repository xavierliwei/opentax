import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => Promise.resolve(undefined)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    }),
  ),
}))

const { useTaxStore } = await import('../../../src/store/taxStore.ts')
import { AppShell } from '../../../src/ui/components/AppShell.tsx'

function renderAppShell(initialPath = '/interview/filing-status') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppShell />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('Mobile overlay z-index stack', () => {
  it('sidebar aside uses z-40 (above LiveBalance z-20)', () => {
    renderAppShell()
    const aside = document.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(aside!.className).toContain('z-40')
  })

  it('LiveBalance uses z-20 (below sidebar z-40)', () => {
    renderAppShell()
    const balance = screen.getByTestId('live-balance')
    expect(balance.className).toContain('z-20')
    expect(balance.className).not.toContain('z-40')
  })

  it('opening sidebar renders overlay at z-30', () => {
    renderAppShell()
    const hamburger = screen.getByLabelText('Open sidebar')
    fireEvent.click(hamburger)
    // Overlay backdrop should exist with z-30
    const overlays = document.querySelectorAll('.fixed.inset-0')
    const backdrop = Array.from(overlays).find(el => el.className.includes('bg-black'))
    expect(backdrop).toBeDefined()
    expect(backdrop!.className).toContain('z-30')
  })

  it('z-index order: LiveBalance (z-20) < overlay (z-30) < sidebar (z-40)', () => {
    renderAppShell()
    fireEvent.click(screen.getByLabelText('Open sidebar'))

    const balance = screen.getByTestId('live-balance')
    const aside = document.querySelector('aside')
    const overlays = document.querySelectorAll('.fixed.inset-0')
    const backdrop = Array.from(overlays).find(el => el.className.includes('bg-black'))

    // Extract z-index values from class names
    const getZ = (cls: string) => {
      const match = cls.match(/z-(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    }

    const balanceZ = getZ(balance.className)
    const overlayZ = getZ(backdrop!.className)
    const sidebarZ = getZ(aside!.className)

    expect(balanceZ).toBeLessThan(overlayZ)
    expect(overlayZ).toBeLessThan(sidebarZ)
  })
})

describe('Sidebar touch comfort', () => {
  it('sidebar step links include mobile-friendly py-3 class', () => {
    renderAppShell()
    // Open sidebar to ensure it renders
    fireEvent.click(screen.getByLabelText('Open sidebar'))
    const navLinks = document.querySelectorAll('aside nav a')
    // At least one step link should exist
    expect(navLinks.length).toBeGreaterThan(0)
    // Step links (not the dashboard link) should have py-3 for mobile
    const stepLink = navLinks[0] as HTMLElement
    expect(stepLink.className).toContain('py-3')
  })
})
