/**
 * Safe Alert Utility - Prevents [object Object] in alert dialogs
 *
 * Bug Pattern Prevention:
 * - PATTERN-004: alert() must use safeAlert() wrapper
 */

function safeAlert(message: unknown, title?: string): void {
  const safeMessage = typeof message === 'string'
    ? message
    : message instanceof Error
      ? message.message
      : message && typeof message === 'object' && 'message' in (message as Record<string, unknown>)
        ? String((message as Record<string, unknown>).message)
        : String(message ?? '操作失败')

  if (title) {
    alert(`${title}\n\n${safeMessage}`)
  } else {
    alert(safeMessage)
  }
}

function safeErrorMessage(error: unknown): string {
  if (!error) return '操作失败'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>
    if (err.response?.data?.message) return String(err.response.data.message)
    if (err.message) return String(err.message)
  }
  return '操作失败'
}

export { safeAlert, safeErrorMessage }
