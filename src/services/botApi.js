import { generateUUID } from '../utils/uuid'
import { getDeviceInfo } from '../utils/device'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://ksk.syncrono.com.br/api/';
// const BASE_URL = "http://localhost:8080/api/";
const BOT_ID = Number(import.meta.env.VITE_DEFAULT_BOT_ID || 2);
const BOT_SLUG = import.meta.env.VITE_DEFAULT_BOT_SLUG || 'tim';

function qsParams() {
  const urlParams = new URLSearchParams(window.location.search)
  const p = (k) => urlParams.get(k) || null
  return {
    nomeCampanha: p('nome_campanha'),
    tituloHtml: p('nome_html'),
    dataInicioCampanha: p('data_inicio_campanha'),
    tituloLandingPage: p('data_landing_page'),
    fonteUtm: p('fonte_utm'),
    midiaUtm: p('midia_utm'),
    termoUtm: p('termo_utm'),
    conteudoUtm: p('conteudo_utm'),
  }
}

export class BotApi {
  constructor() {
    this.sessionId = localStorage.getItem('session_id_bot') || generateUUID()
    localStorage.setItem('session_id_bot', this.sessionId)
    this.token = null
  }

  static resetSession() {
    localStorage.removeItem('session_id_bot')
    localStorage.removeItem('token_auth_bot')
  }

  async _fetch(path, { method = 'GET', body, headers = {}, blob = false, _retry = false } = {}) {
    const h = { 'Content-Type': 'application/json', ...headers }
    const url = BASE_URL + path.replace(/^\//, '')

    const doRequest = async () => fetch(url, { method, headers: h, body })
    let res = await doRequest()

    // If token expired (403), try to refresh token once and retry
    if (res.status === 403) {
      const isAuthRequest = /sessoes\/token/.test(path)
      const hasAuthHeader = !!h.Authorization
      if (!_retry && hasAuthHeader && !isAuthRequest) {
        try {
          // Force new token
          localStorage.removeItem('token_auth_bot')
          this.token = null
          await this.login(true)
          if (hasAuthHeader) h.Authorization = `Bearer ${this.token}`
          res = await fetch(url, { method, headers: h, body })
        } catch (_) {
          // fall through to error handling below
        }
      }
    }

    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${t}`)
    }
    return blob ? res.blob() : res.json()
  }

    async login(force = false) {
        const cached = !force && localStorage.getItem('token_auth_bot');
        if (cached) { this.token = cached; return cached; }
        // Call token endpoint without Authorization and without retry loop
        const j = await this._fetch(`sessoes/token?bot=${BOT_SLUG}`, { method:'POST', body: JSON.stringify({}), _retry: true });
        this.token = j.token; localStorage.setItem('token_auth_bot', this.token);
        return this.token;
    }

  async trackView() {
    const device = getDeviceInfo()
    const payload = {
      clienteId: null,
      sessionId: this.sessionId,
      telefone: '',
      dataVisualizacao: new Date().toISOString(),
      url: window.location.href,
      ...qsParams(),
      nomeDispositivo: device.nomeDispositivo,
      tipoDispositivo: device.tipoDispositivo,
      navegador: device.navegador,
    }
    return this._fetch('sessoes/trafego', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${this.token}` },
    }).catch(() => null)
  }

  async startSession() {
    const payload = { botId: BOT_ID, sessionId: this.sessionId }
    return this._fetch('sessoes/start', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${this.token}` },
    })
  }

  async sendText(valor) {
    return this._fetch(`sessoes/${this.sessionId}/responder`, {
      method: 'POST',
      body: JSON.stringify({ tipo: 'TEXT_INPUT', valor }),
      headers: { Authorization: `Bearer ${this.token}` },
    })
  }

  async sendButtons(valor) {
    return this._fetch(`sessoes/${this.sessionId}/responder`, {
      method: 'POST',
      body: JSON.stringify({ tipo: 'BUTTONS', valor }),
      headers: { Authorization: `Bearer ${this.token}` },
    })
  }

  async sendList(chaves) {
    return this._fetch(`sessoes/${this.sessionId}/responder`, {
      method: 'POST',
      body: JSON.stringify({ tipo: 'LIST', chaves }),
      headers: { Authorization: `Bearer ${this.token}` },
    })
  }

  async uploadDocumento(file) {
    const formData = new FormData()
    formData.append('file', file)
    const url = BASE_URL + `sessoes/${this.sessionId}/documento`
    const h = { Authorization: `Bearer ${this.token}` }
    let res = await fetch(url, { method: 'POST', headers: h, body: formData })
    if (res.status === 403) {
      try {
        await this.login(true)
        res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: formData })
      } catch (_) {}
    }
    if (!res.ok) throw new Error('Falha ao enviar documento')
    return res.json()
  }

  async uploadSelfie(file) {
    const formData = new FormData()
    formData.append('file', file)
    const url = BASE_URL + `sessoes/${this.sessionId}/selfie`
    const h = { Authorization: `Bearer ${this.token}` }
    let res = await fetch(url, { method: 'POST', headers: h, body: formData })
    if (res.status === 403) {
      try {
        await this.login(true)
        res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: formData })
      } catch (_) {}
    }
    if (!res.ok) throw new Error('Falha ao enviar selfie')
    return res.json()
  }

    downloadPdfBase64(base64, name='arquivo.pdf') {
        const b64 = (base64 || '').split(',').pop();
        const bin = atob(b64); const arr = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = name.endsWith('.pdf') ? name : `${name}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }
}
