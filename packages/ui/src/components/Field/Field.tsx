import {
  type ReactNode,
  Children,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import {html} from 'react-strict-dom'
import {useFormContext as useRHFFormContext, useController} from 'react-hook-form'
import {FieldContext, useFieldContext} from './FieldContext'
import type {ErrorPlacement, FieldContextValue} from './FieldContext'
import {useFormContext} from '../Form/FormContext'
import type {LabelPosition} from '../Form/FormContext'
import {styles} from './styles.css'
import {textOf} from '../../shared/textOf'

// Native error state shared by both roots, with a count of mounted Field.Error
// parts: Root shows the native message itself only while the count is zero.
function useNativeErrorState() {
  const [nativeError, setNativeError] = useState<string | undefined>()
  const [errorCount, setErrorCount] = useState(0)
  const registerError = useCallback(() => {
    setErrorCount((count) => count + 1)
    return () => setErrorCount((count) => count - 1)
  }, [])
  return {nativeError, setNativeError, errorCount, registerError}
}

// The mounted Field.Label's text, for a control that cannot point at the
// label element (React Native has no `for` / labelledby on iOS): it names
// itself with this string instead.
function useLabelTextState() {
  const [labelText, setLabelText] = useState<string | undefined>()
  const registerLabel = useCallback((text: string) => {
    setLabelText(text)
    return () => setLabelText((current) => (current === text ? undefined : current))
  }, [])
  return {labelText, registerLabel}
}

// A count of mounted Field.Description parts, so the control names the
// description id only while one is there.
function useDescriptionState() {
  const [descriptionCount, setDescriptionCount] = useState(0)
  const registerDescription = useCallback(() => {
    setDescriptionCount((count) => count + 1)
    return () => setDescriptionCount((count) => count - 1)
  }, [])
  return {hasDescription: descriptionCount > 0, registerDescription}
}

// The ids the control's aria-describedby names: each only while its element
// is mounted. An invalid Field shows an error line when a Field.Error is
// mounted (it renders whenever the Field is invalid), or when Root shows the
// native message itself.
function describedByIds(
  id: string,
  hasDescription: boolean,
  invalid: boolean,
  errorShown: boolean,
): string | undefined {
  const ids = [hasDescription && `${id}-description`, invalid && errorShown && `${id}-error`]
  return ids.filter(Boolean).join(' ') || undefined
}

// The error line's style: in the Field's flow (`'below'`, also when unset), or
// hanging out of it.
function errorStyle(placement?: ErrorPlacement) {
  return [styles.error, placement === 'hanging' && styles.errorHanging]
}

function ownError(fieldContext: FieldContextValue, errorCount: number): ReactNode {
  if (fieldContext.nativeError === undefined || errorCount > 0) return null
  return (
    <html.span
      id={fieldContext.errorId}
      role="alert"
      style={errorStyle(fieldContext.errorPlacement)}
    >
      {fieldContext.errorMessage ?? fieldContext.nativeError}
    </html.span>
  )
}

// --- Root ---
interface RootProps {
  name?: string
  /** The control is a group of controls rather than one input — the label
   *  then names the group (`aria-labelledby`) instead of pointing `for` at an
   *  input. Detected automatically when a direct child is a ToggleGroup,
   *  CheckboxGroup.Root or RadioGroup.Root; set it for any other group. */
  group?: boolean
  invalid?: boolean
  required?: boolean
  disabled?: boolean
  labelPosition?: LabelPosition
  /** Where the error line sits. `'below'` (default) puts it in the Field's flow, so the Field grows by one line when it shows. `'hanging'` takes it out of the flow, under the control, so a row of Fields (an `Inline align="end"` with a button) stays aligned on its inputs; leave one error line of room under the row: on the web `calc(typeScale.lineHeight1 + spacing.xs)`, which grows with the text; `sizes.fieldErrorReserve` where there is no calc. Set on the Field only: unlike `labelPosition`, a `Form` does not pass it down. */
  errorPlacement?: ErrorPlacement
  children: ReactNode
}

/** A group control marks itself so a Field can tell it holds a group. */
export type FieldGroupComponent = {isFieldGroup?: true}

function holdsGroup(children: ReactNode): boolean {
  let found = false
  Children.forEach(children, (child) => {
    if (isValidElement(child) && (child.type as FieldGroupComponent).isFieldGroup) found = true
  })
  return found
}

function Root({name, group, ...props}: RootProps) {
  const formCtx = useFormContext()
  const isGroup = group ?? holdsGroup(props.children)
  if (name && formCtx) {
    return <ControlledRoot name={name} formCtx={formCtx} group={isGroup} {...props} />
  }
  return <StaticRoot group={isGroup} {...props} />
}

// Always calls useController — no conditional hooks
function ControlledRoot({
  name,
  formCtx,
  group,
  invalid: invalidProp = false,
  required,
  disabled,
  labelPosition,
  errorPlacement,
  children,
}: {
  name: string
  formCtx: NonNullable<ReturnType<typeof useFormContext>>
  group: boolean
  invalid?: boolean
  required?: boolean
  disabled?: boolean
  labelPosition?: LabelPosition
  errorPlacement?: ErrorPlacement
  children: ReactNode
}) {
  const id = useId()
  const {control} = useRHFFormContext()
  const {field, fieldState} = useController({control, name})
  const {nativeError, setNativeError, errorCount, registerError} = useNativeErrorState()
  const {hasDescription, registerDescription} = useDescriptionState()
  const {labelText, registerLabel} = useLabelTextState()
  const invalid = invalidProp || !!fieldState.error || nativeError !== undefined
  const describedBy = describedByIds(
    id,
    hasDescription,
    invalid,
    errorCount > 0 || nativeError !== undefined,
  )

  const effectiveDisabled = disabled ?? formCtx.disabled
  const effectiveLabelPosition = labelPosition ?? formCtx.labelPosition
  const effectiveNecessityIndicator = formCtx.necessityIndicator

  const ctx = useMemo(
    () => ({
      controlId: `${id}-control`,
      labelId: `${id}-label`,
      group,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      invalid,
      required,
      disabled: effectiveDisabled,
      labelPosition: effectiveLabelPosition,
      errorPlacement,
      necessityIndicator: effectiveNecessityIndicator,
      field: {
        value: field.value,
        onChange: field.onChange,
        onBlur: field.onBlur,
        ref: field.ref,
        name: field.name,
      },
      errorMessage: fieldState.error?.message,
      nativeError,
      setNativeError,
      registerError,
      registerDescription,
      labelText,
      registerLabel,
      describedBy,
    }),
    [
      id,
      group,
      invalid,
      required,
      effectiveDisabled,
      effectiveLabelPosition,
      errorPlacement,
      effectiveNecessityIndicator,
      field.value,
      field.onChange,
      field.onBlur,
      field.ref,
      field.name,
      fieldState.error,
      nativeError,
      setNativeError,
      registerError,
      registerDescription,
      labelText,
      registerLabel,
      describedBy,
    ],
  )

  return (
    <FieldContext.Provider value={ctx}>
      <FieldLayout
        labelPosition={effectiveLabelPosition}
        errorPlacement={errorPlacement}
        ownError={ownError(ctx, errorCount)}
      >
        {children}
      </FieldLayout>
    </FieldContext.Provider>
  )
}

// Current behavior, no RHF dependency
function StaticRoot({
  group,
  invalid: invalidProp = false,
  required,
  disabled,
  labelPosition = 'top',
  errorPlacement,
  children,
}: {
  group: boolean
  invalid?: boolean
  required?: boolean
  disabled?: boolean
  labelPosition?: LabelPosition
  errorPlacement?: ErrorPlacement
  children: ReactNode
}) {
  const id = useId()
  const {nativeError, setNativeError, errorCount, registerError} = useNativeErrorState()
  const {hasDescription, registerDescription} = useDescriptionState()
  const {labelText, registerLabel} = useLabelTextState()
  const invalid = invalidProp || nativeError !== undefined
  const describedBy = describedByIds(
    id,
    hasDescription,
    invalid,
    errorCount > 0 || nativeError !== undefined,
  )
  const ctx = useMemo(
    () => ({
      controlId: `${id}-control`,
      labelId: `${id}-label`,
      group,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      invalid,
      required,
      disabled,
      labelPosition,
      errorPlacement,
      nativeError,
      setNativeError,
      registerError,
      registerDescription,
      labelText,
      registerLabel,
      describedBy,
    }),
    [
      id,
      group,
      invalid,
      required,
      disabled,
      labelPosition,
      errorPlacement,
      nativeError,
      setNativeError,
      registerError,
      registerDescription,
      labelText,
      registerLabel,
      describedBy,
    ],
  )

  return (
    <FieldContext.Provider value={ctx}>
      <FieldLayout
        labelPosition={labelPosition}
        errorPlacement={errorPlacement}
        ownError={ownError(ctx, errorCount)}
      >
        {children}
      </FieldLayout>
    </FieldContext.Provider>
  )
}

// --- FieldLayout ---
// When labelPosition is 'side', separates Label from other children
// and wraps the non-label children in a content column. A hanging error is
// anchored to the element that holds it: the root, or the content column when
// the label sits at the side, so it hangs under the control, not the label.
function FieldLayout({
  labelPosition,
  errorPlacement,
  ownError,
  children,
}: {
  labelPosition: LabelPosition
  errorPlacement?: ErrorPlacement
  ownError: ReactNode
  children: ReactNode
}) {
  const hanging = errorPlacement === 'hanging'
  if (labelPosition !== 'side') {
    return (
      <html.div style={[styles.root, hanging && styles.rootHanging]}>
        {children}
        {ownError}
      </html.div>
    )
  }

  let labelNode: ReactNode = null
  const rest: ReactNode[] = []

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === Label && !labelNode) {
      labelNode = child
    } else {
      rest.push(child)
    }
  })

  return (
    <html.div style={styles.rootSide}>
      {labelNode}
      <html.div style={[styles.fieldContent, hanging && styles.rootHanging]}>
        {rest}
        {ownError}
      </html.div>
    </html.div>
  )
}

// --- Label ---
interface LabelProps {
  children: ReactNode
}

function Label({children}: LabelProps) {
  const ctx = useFieldContext()
  const isSide = ctx?.labelPosition === 'side'
  const indicator = ctx?.necessityIndicator
  // The suffix a screen reader reads on the web: the " (required)" text is in
  // the label, the " *" icon is aria-hidden.
  const suffix = indicator === 'label' ? (ctx?.required ? ' (required)' : ' (optional)') : ''
  const text = textOf(children).trim()
  const registerLabel = ctx?.registerLabel
  useLayoutEffect(() => {
    if (!text || !registerLabel) return
    return registerLabel(text + suffix)
  }, [text, suffix, registerLabel])
  const content = (
    <>
      {children}
      {indicator === 'icon' && ctx?.required && (
        <html.span style={styles.necessityIcon} aria-hidden={true}>
          {' *'}
        </html.span>
      )}
      {indicator === 'label' && (
        <html.span style={styles.necessityLabel}>
          {ctx?.required ? ' (required)' : ' (optional)'}
        </html.span>
      )}
    </>
  )

  // A group is not a labelable element: `for` would point at nothing. The
  // group names itself from this id instead (aria-labelledby).
  if (ctx?.group) {
    return (
      <html.span id={ctx.labelId} style={[styles.label, isSide && styles.labelSide]}>
        {content}
      </html.span>
    )
  }
  return (
    <html.label
      id={ctx?.labelId}
      for={ctx?.controlId}
      style={[styles.label, isSide && styles.labelSide]}
    >
      {content}
    </html.label>
  )
}

// --- Description ---
interface DescriptionProps {
  children: ReactNode
}

function Description({children}: DescriptionProps) {
  const ctx = useFieldContext()
  const registerDescription = ctx?.registerDescription
  useLayoutEffect(() => registerDescription?.(), [registerDescription])
  return (
    <html.span id={ctx?.descriptionId} style={styles.description}>
      {children}
    </html.span>
  )
}

function rendersSomething(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== true && node !== ''
}

// --- Error ---
interface ErrorProps {
  children?: ReactNode
}

function Error({children}: ErrorProps) {
  const ctx = useFieldContext()
  const registerError = ctx?.registerError
  useLayoutEffect(() => registerError?.(), [registerError])
  const content = [children, ctx?.errorMessage, ctx?.nativeError].find(rendersSomething)
  if (!ctx?.invalid && !content) return null

  return (
    <html.span id={ctx?.errorId} role="alert" style={errorStyle(ctx?.errorPlacement)}>
      {content}
    </html.span>
  )
}

export type {ErrorPlacement}

export const Field = {
  Root,
  Label,
  Description,
  Error,
}
