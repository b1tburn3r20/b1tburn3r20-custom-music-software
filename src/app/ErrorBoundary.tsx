import { Component, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = { children: ReactNode; label: string; onHome?: () => void }
type State = { error: Error | null }

/** Catches render errors in one part of the app so the rest (e.g. the player) keeps working. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[${this.props.label}] crashed:`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertTriangle className="size-12 text-warning" aria-hidden />
        <p className="text-lg font-medium">Something went wrong on this page</p>
        <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          {this.props.onHome && (
            <Button
              onClick={() => {
                this.setState({ error: null })
                this.props.onHome?.()
              }}
            >
              Go home
            </Button>
          )}
        </div>
      </div>
    )
  }
}
