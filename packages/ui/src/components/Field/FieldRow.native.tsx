import type {ReactNode} from 'react'
import type {SpacingToken} from '@greenharness/greenrack-tokens/keys'
import {Cluster} from '../Cluster/Cluster'

// On React Native a row is a plain wrapping Cluster: it provides no row line,
// so each Field keeps its own error below its control.

export interface RowProps {
  gap?: SpacingToken
  children: ReactNode
}

export function Row({gap = 'sm', children}: RowProps) {
  return (
    <Cluster gap={gap} align="end">
      {children}
    </Cluster>
  )
}

export function RowBoundary({children}: {children: ReactNode}) {
  return <>{children}</>
}

export function useRowSlot(_errorId: string, _active: boolean) {
  return {rootRef: undefined, inRow: false, slot: null}
}

export function RowError(_props: {slot: unknown; label?: string; children: ReactNode}) {
  return null
}
