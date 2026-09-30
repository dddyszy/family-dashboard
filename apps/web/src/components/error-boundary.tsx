import { Component, type ReactNode } from 'react'

type Props = { fallback: ReactNode; children: ReactNode; resetKey?: unknown }
type State = { error: Error | null; resetKey: unknown }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey }
    return null
  }

  override componentDidCatch(error: Error): void {
    console.error(error)
  }

  override render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}
