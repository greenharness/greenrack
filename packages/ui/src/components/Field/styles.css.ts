import {css} from 'react-strict-dom'
import {colors} from '@greenharness/greenrack-tokens/tokens/colors.css'
import {spacing} from '@greenharness/greenrack-tokens/tokens/spacing.css'
import {typeScale, typography} from '@greenharness/greenrack-tokens/tokens/typography.css'
import {sizes} from '@greenharness/greenrack-tokens/tokens/sizes.css'

export const styles = css.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  rootSide: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  label: {
    fontSize: typography.fontSizeSm,
    fontWeight: typography.fontWeightMedium,
    color: colors.text,
  },
  labelSide: {
    minWidth: sizes.labelMinW,
    paddingTop: spacing.sm,
    flexShrink: 0,
  },
  description: {
    fontSize: typography.fontSizeXs,
    color: colors.textMuted,
  },
  error: {
    fontSize: typography.fontSizeXs,
    color: colors.errorText,
  },
  // The error line out of the Field's flow, under the control: the Field keeps
  // the height of its label and control. The line height is pinned so the
  // reserve a row leaves is exact: calc(lineHeight1 + spacing.xs), whose
  // default-size equal is sizes.fieldErrorReserve.
  errorHanging: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    lineHeight: typeScale.lineHeight1,
    // Past one line the message reaches over what follows: it must not take its clicks
    // (the cost: its text cannot be selected).
    pointerEvents: 'none',
  },
  rootHanging: {
    position: 'relative',
  },
  fieldContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
  },
  // The row's one error line: in flow, full width, wrapping freely. Empty (no
  // box) until a Field adds its message; the gap comes once one has.
  rowLine: {
    fontSize: typography.fontSizeXs,
    color: colors.errorText,
  },
  rowLineShown: {
    marginTop: spacing.xs,
  },
  necessityIcon: {
    color: colors.error,
  },
  necessityLabel: {
    color: colors.textMuted,
    fontWeight: typography.fontWeightNormal,
    fontSize: typography.fontSizeXs,
  },
})
