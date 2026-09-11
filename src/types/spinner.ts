export interface SpinnerHandle {
  spin: (target: number, duration?: number) => Promise<void>
}
