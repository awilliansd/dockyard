export {}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean
      platform: string
      getAppVersion?: () => Promise<string>
      onMenuEvent?: (callback: (event: string) => void) => () => void
    }
  }
}