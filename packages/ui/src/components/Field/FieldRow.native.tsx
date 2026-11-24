import type {RefObject} from 'react'
import {Cluster} from '../Cluster/Cluster'
import type {RowErrorProps, RowProps, RowSlotState} from './FieldRowTypes'

// On React Native a row is a plain wrapping Cluster: it provides no row line,
// so each Field keeps its own error below its control.

export function Row({gap = 'sm', children}: RowProps) {
  return (
    <Cluster gap={gap} align="end">
      {children}
    </Cluster>
  )
}

export function RowBoundary({children}: Pick<RowProps, 'children'>) {
  return <>{children}</>
}

export function useRowSlot(
  _errorId: string,
  _controlId: string,
  _active: boolean,
): RowSlotState<RefObject<null> | undefined> {
  return {rootRef: undefined, inRow: false, slot: null, fallbackLabel: undefined}
}

export function RowError(_props: RowErrorProps) {
  return null
}
