import { act, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
// Jest resolves the native module by default; this test loads the web one by its own name.
import { useDeviceLanguages } from '@/lib/device-languages.web'

function Probe() {
  return <Text testID="languages">{useDeviceLanguages().join(',')}</Text>
}

const setLanguages = (languages: readonly string[]) =>
  Object.defineProperty(navigator, 'languages', { value: languages, configurable: true })

// React Native's test window has no events; give it a real EventTarget's, as a browser has.
const target = new EventTarget()
const events = {
  addEventListener: target.addEventListener.bind(target),
  removeEventListener: target.removeEventListener.bind(target),
  dispatchEvent: target.dispatchEvent.bind(target),
}
beforeEach(() => {
  for (const [name, fn] of Object.entries(events))
    Object.defineProperty(window, name, { value: fn, configurable: true, writable: true })
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'languages')
  for (const name of Object.keys(events)) Reflect.deleteProperty(window, name)
})

describe('the browser languages (web)', () => {
  it("reads the browser's languages and follows a change", async () => {
    setLanguages(['zh-TW', 'en'])
    await render(<Probe />)
    expect(screen.getByTestId('languages').props.children).toBe('zh-TW,en')
    setLanguages(['en-SG'])
    await act(async () => {
      window.dispatchEvent(new Event('languagechange'))
    })
    expect(screen.getByTestId('languages').props.children).toBe('en-SG')
  })

  it('stops listening once unmounted', async () => {
    setLanguages(['en'])
    const remove = jest.spyOn(window, 'removeEventListener')
    const view = await render(<Probe />)
    await view.unmount()
    expect(remove).toHaveBeenCalledWith('languagechange', expect.any(Function))
    remove.mockRestore()
  })
})
