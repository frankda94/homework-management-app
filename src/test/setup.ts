import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React Testing Library only registers its automatic cleanup when Vitest globals are enabled.
// This project imports test APIs explicitly, so cleanup happens here instead.
afterEach(() => {
  cleanup()
})
