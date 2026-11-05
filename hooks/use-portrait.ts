import * as React from 'react'

// Igual que useIsMobile pero por orientación: true cuando la pantalla es más
// alta que ancha (celular o tablet parados, ventana angosta vertical).
export function useIsPortrait() {
  const [isPortrait, setIsPortrait] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    const onChange = () => {
      setIsPortrait(mql.matches)
    }
    mql.addEventListener('change', onChange)
    onChange()
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isPortrait
}
