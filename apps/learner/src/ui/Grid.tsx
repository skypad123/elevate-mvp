import { Children, isValidElement, type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'

type GridProps = {
  columns: number
  /** Space between cells, across and down. */
  gap: number
  children: ReactNode
}

/**
 * A wrapping grid of equal-width cells. Every cell is exactly 1/columns of the row, so cards on
 * a short last row stay the same size as the rest (with flexGrow they would stretch to fill it).
 * Each cell pads half the gap on both sides; the row's negative margin cancels the outer halves,
 * so the grid's edges line up with the content around it.
 */
export function Grid({ columns, gap, children }: GridProps) {
  const cell: ViewStyle = {
    // Truncate to 33.33% so float rounding can't push a full row past 100% and wrap it early.
    width: `${Math.floor(10000 / columns) / 100}%`,
    paddingHorizontal: gap / 2,
  }
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: gap, marginHorizontal: -gap / 2 }}
    >
      {Children.map(children, (child) =>
        isValidElement(child) ? <View style={cell}>{child}</View> : null,
      )}
    </View>
  )
}
