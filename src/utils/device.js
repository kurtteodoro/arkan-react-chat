export function getDeviceInfo() {
  const ua = navigator.userAgent
  let nomeDispositivo = 'Desktop/Notebook'
  let tipoDispositivo = 'desktop'
  let navegador = 'Desconhecido'

  if (/Mobi|Android/i.test(ua)) tipoDispositivo = 'mobile'
  else if (/iPad|Tablet/i.test(ua)) tipoDispositivo = 'tablet'

  if (/Chrome\/(\d+)/i.test(ua) && !/Edg/i.test(ua)) {
    navegador = `Chrome ${ua.match(/Chrome\/(\d+)/i)[1]}`
  } else if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua)) {
    const m = ua.match(/Version\/(\d+(\.\d+)?)/i)
    navegador = `Safari ${m?.[1] || 'Desconhecido'}`
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    navegador = `Firefox ${ua.match(/Firefox\/(\d+)/i)[1]}`
  } else if (/Edg\/(\d+)/i.test(ua)) {
    navegador = `Edge ${ua.match(/Edg\/(\d+)/i)[1]}`
  }

  if (/iPhone/i.test(ua)) {
    const m = ua.match(/iPhone(?:.*?OS (\d+_\d+))?/i)
    nomeDispositivo = `iPhone${m ? ' ' + m[1].replace('_', '.') : ''}`
  } else if (/iPad/i.test(ua)) {
    nomeDispositivo = 'iPad'
  } else if (/Android/i.test(ua)) {
    const m = ua.match(/Android\s+([\d\.]+)/i)
    nomeDispositivo = `Android ${m ? m[1] : ''}`
  }

  return { nomeDispositivo, tipoDispositivo, navegador }
}
