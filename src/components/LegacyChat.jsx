import React, { useEffect, useMemo, useRef } from 'react'
import ModalSelfie from "./ChatWidget.jsx";

/** ===== Utilidades que existiam no chat.js ===== */
const BASE_URL = "https://ksk.syncrono.com.br/api/";
// const BASE_URL = "http://localhost:9090/";
const STORAGE_SESSION = 'session_id_bot'
const STORAGE_TOKEN = 'token_auth_bot'

function generateUUID() {
  let d = new Date().getTime()
  let d2 =
    (typeof performance !== 'undefined' &&
      performance.now &&
      performance.now() * 1000) ||
    0
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16
    if (d > 0) {
      r = (d + r) % 16 | 0
      d = Math.floor(d / 16)
    } else {
      r = (d2 + r) % 16 | 0
      d2 = Math.floor(d2 / 16)
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
function getDeviceInfo() {
  const ua = navigator.userAgent
  let nomeDispositivo = 'Desktop/Notebook',
    tipoDispositivo = /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop',
    navegador = 'Desconhecido'
  if (/Chrome\/(\d+)/i.test(ua) && !/Edg/i.test(ua))
    navegador = `Chrome ${ua.match(/Chrome\/(\d+)/i)[1]}`
  else if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua))
    navegador = `Safari ${
      ua.match(/Version\/(\d+(\.\d+)?)/i)?.[1] || 'Desconhecido'
    }`
  else if (/Firefox\/(\d+)/i.test(ua))
    navegador = `Firefox ${ua.match(/Firefox\/(\d+)/i)[1]}`
  else if (/Edg\/(\d+)/i.test(ua))
    navegador = `Edge ${ua.match(/Edg\/(\d+)/i)[1]}`
  if (/iPhone/i.test(ua))
    nomeDispositivo = `iPhone ${
      ua.match(/iPhone(?:.*?OS (\d+_\d+))?/i)?.[1]?.replace('_', '.') || ''
    }`
  else if (/iPad/i.test(ua)) nomeDispositivo = 'iPad'
  else if (/Android/i.test(ua))
    nomeDispositivo = `Android ${ua.match(/Android\s+([\d\.]+)/i)?.[1] || ''}`
  return { nomeDispositivo, tipoDispositivo, navegador }
}
const escapeHtml = (s = '') =>
  s.replace(
    /[&<>"']/g,
    (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        m
      ])
  )

/** ===== Serviço do Bot (portado do chat.js) ===== */
function useBot(onResponse, { botId = 2 } = {}) {
  const tokenRef = useRef(null)
  const sessionRef = useRef(null)

  // token
  async function getToken() {
    const cached = localStorage.getItem(STORAGE_TOKEN)
    if (cached) {
      tokenRef.current = cached
      return cached
    }
    const res = await fetch(`${BASE_URL}sessoes/token?bot=tim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) throw new Error('Falha ao obter token')
    const { token } = await res.json()
    localStorage.setItem(STORAGE_TOKEN, token)
    tokenRef.current = token
    return token
  }

  async function refreshToken() {
    try {
      localStorage.removeItem(STORAGE_TOKEN)
      tokenRef.current = null
    } catch {}
    return getToken()
  }

  // Fetch helper that retries once on 403 by regenerating token
  async function authorizedFetch(url, init = {}, { retryOn403 = true } = {}) {
    const baseHeaders = init.headers || {}
    const token = tokenRef.current || (await getToken())
    let headers = { ...baseHeaders, Authorization: `Bearer ${token}` }
    let res = await fetch(url, { ...init, headers })
    if (res.status === 403 && retryOn403) {
      const newToken = await refreshToken()
      headers = { ...baseHeaders, Authorization: `Bearer ${newToken}` }
      res = await fetch(url, { ...init, headers })
    }
    return res
  }

  // sessão
  function ensureSession() {
    let s = localStorage.getItem(STORAGE_SESSION)
    if (!s) {
      s = generateUUID()
      localStorage.setItem(STORAGE_SESSION, s)
    }
    sessionRef.current = s
    return s
  }

    async function start() {
        const sessionId = ensureSession();
        await getToken();

        // Pega os parâmetros da URL
        const q = new URLSearchParams(window.location.search);
        const dev = getDeviceInfo();

        // Inicializa o objeto trafego
        const trafego = {
            clienteId: null,
            sessionId,
            telefone: '',
            dataVisualizacao: new Date().toISOString(),
            url: window.location.href,
            nomeCampanha: q.get('nome_campanha'),
            tituloHtml: q.get('nome_html'),
            dataInicioCampanha: q.get('data_inicio_campanha'),
            tituloLandingPage: q.get('data_landing_page'),
            fonteUtm: q.get('fonte_utm'),
            midiaUtm: q.get('midia_utm'),
            termoUtm: q.get('termo_utm'),
            conteudoUtm: q.get('conteudo_utm'),
            nomeDispositivo: dev.nomeDispositivo,
            tipoDispositivo: dev.tipoDispositivo,
            navegador: dev.navegador,
        };

        // Adiciona dinamicamente todos os parâmetros da URL que ainda não estão no objeto trafego
        for (const [key, value] of q.entries()) {
            // if (!(key in trafego)) {
                trafego[key] = value;
            // }
        }

        // ignora erro de trafego, mas se 403 tentar renovar token e reenviar
        try {
            await authorizedFetch(
                `${BASE_URL}sessoes/trafego`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(trafego),
                },
                { retryOn403: true }
            );
        } catch (_) {
            // silencioso como antes
        }

        // start
        const res = await authorizedFetch(
            `${BASE_URL}sessoes/start${q.get('customerId')?("?customerId="+q.get('customerId')):""}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botId, sessionId }),
            },
            { retryOn403: true }
        );
        if (!res.ok) throw new Error('Falha ao iniciar sessão');
        const data = await res.json();
        onResponse?.(data);
    }


    async function responder(payload) {
    const sess = sessionRef.current || ensureSession()
    const res = await authorizedFetch(
      `${BASE_URL}sessoes/${sess}/responder`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      { retryOn403: true }
    )
    if (!res.ok) throw new Error('Falha ao responder')
    return res.json()
  }

  // API pública
  return useMemo(
    () => ({
      start,
      enviarMsgTexto: (valor) => responder({ tipo: 'TEXT_INPUT', valor }),
      enviarPlanoSelecionado: (chaves) => responder({ tipo: 'LIST', chaves }),
      enviarButton: (valor) => responder({ tipo: 'BUTTONS', valor }),
      enviarDocumento: async (formData) => {
        const token = tokenRef.current || (await getToken())
        const sess = sessionRef.current || ensureSession()
        const res = await fetch(`${BASE_URL}sessoes/${sess}/documento`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (!res.ok) throw new Error('Falha ao enviar documento')
        return res.json()
      },
      enviarSelfie: async (formData) => {
        const token = tokenRef.current || (await getToken())
        const sess = sessionRef.current || ensureSession()
        const res = await fetch(`${BASE_URL}sessoes/${sess}/selfie`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (!res.ok) throw new Error('Falha ao enviar selfie')
        return res.json()
      },
      downloadPDFBase64: (base64, fileName = 'arquivo.pdf') => {
        const clean = base64.split(',').pop()
        const bytes = atob(clean)
        const buf = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
        const blob = new Blob([buf], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      },
      downloadPDF: async (name, linkPDF) => {
        const token = tokenRef.current || (await getToken())
        const res = await fetch(
          `${BASE_URL}${String(linkPDF).replaceAll('//api', '/api')}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        if (!res.ok) throw new Error('Erro ao baixar PDF')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name.endsWith('.pdf') ? name : `${name}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      },
      // eslint-disable-next-line
    }),
    []
  )
}

/** ===== Componente do Chat com toda a UI e handlers ===== */
export default function LegacyChat() {
  const chatRef = useRef(null)
  const messagesRef = useRef(null)
  const textareaRef = useRef(null)
  const sendBtnRef = useRef(null)
  const pixCodeRef = useRef('')
  const [showWebcam, setShowWebcam] = React.useState(false);
  const [actionAtual, setActionAtual] = React.useState();
  const [fazendoUploadArquivo, setFazendoUploadArquivo] = React.useState(false);
  const [disableEnviar , setDisableEnviar ] = React.useState(false);

  const bot = useBot(handleResponse, { botId: 2 })

  useEffect(() => {
    bot.start().catch((e) => console.error(e))

    const btn = sendBtnRef.current
    const txt = textareaRef.current
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        send()
      }
    }
    btn?.addEventListener('click', send)
    txt?.addEventListener('keydown', onKey)

    document.addEventListener('click', openClickDelegate, true)
    chatRef.current
      ?.querySelector('#close-chat')
      ?.addEventListener('click', closeChat)
    chatRef.current
      ?.querySelector('#reset-chat')
      ?.addEventListener('click', resetChat)

    rewriteWhatsappLinks()
    hideInitialLoading()

    setTimeout(function () {
      if(window.innerWidth > 766) {
        openChat();
      }
    }, 3000);

    return () => {
      btn?.removeEventListener('click', send)
      txt?.removeEventListener('keydown', onKey)
      document.removeEventListener('click', openClickDelegate, true)
      chatRef.current
        ?.querySelector('#close-chat')
        ?.removeEventListener('click', closeChat)
      chatRef.current
        ?.querySelector('#reset-chat')
        ?.removeEventListener('click', resetChat)
    }
    // eslint-disable-next-line
  }, [])

  function hideInitialLoading() {
    const el = chatRef.current?.querySelector('#loading-chat')
    if (el) {
      el.style.display = 'none'
      el.classList.remove('d-flex')
    }
  }

  function rewriteWhatsappLinks() {
    const qa = new URLSearchParams(window.location.search);
    const dev = getDeviceInfo();

    let args = {
      clienteId: null,
      sessionId: localStorage.getItem(STORAGE_SESSION),
      telefone: '',
      dataVisualizacao: new Date().toISOString(),
      url: window.location.href,
      nomeCampanha: qa.get('nome_campanha'),
      tituloHtml: qa.get('nome_html'),
      dataInicioCampanha: qa.get('data_inicio_campanha'),
      tituloLandingPage: qa.get('data_landing_page'),
      fonteUtm: qa.get('fonte_utm'),
      midiaUtm: qa.get('midia_utm'),
      termoUtm: qa.get('termo_utm'),
      conteudoUtm: qa.get('conteudo_utm'),
      nomeDispositivo: dev.nomeDispositivo,
      tipoDispositivo: dev.tipoDispositivo,
      navegador: dev.navegador,
    };

    // Converte args em query string
    const argsQuery = new URLSearchParams(args).toString();

    // Mantém os parâmetros originais também
    const originalQuery = window.location.search.replace(/^\?/, '');

    let finalQuery = argsQuery;
    if (originalQuery) {
      finalQuery += `&${originalQuery}`;
    }

    const target = `https://ksk.syncrono.com.br/api/events/trafego?${finalQuery}`;

    document.querySelectorAll('.whatsapp-btn').forEach((a) => {
      if (a.getAttribute('href') !== '#') {
        a.setAttribute('href', target);
      }
    });
  }


  function openClickDelegate(e) {
    const t = e.target.closest?.(
      '.whatsapp_btn, .whatsapp-btn, .pop-up-mobile, .close-btn'
    )
    if (!t) return
    if (t.classList.contains('close-btn')) {
      document.getElementById('popup')?.style &&
        (document.getElementById('popup').style.display = 'none')
      return
    }
    openChat()
    setTimeout(() => textareaRef.current?.focus(), 200)
  }

  function openChat() {
    const el = chatRef.current
    if (!el) return
    if (window.innerWidth < 500) {
      document.documentElement.style.setProperty(
        'overflow',
        'hidden',
        'important'
      )
      document.body.style.setProperty('overflow', 'hidden', 'important')
    }
    el.style.right = '0px'
  }
  function closeChat() {
    const el = chatRef.current
    if (!el) return
    if (window.innerWidth < 500) {
      document.documentElement.style.removeProperty('overflow')
      document.body.style.removeProperty('overflow')
    }
    el.style.right = '-550px'
  }
  async function resetChat() {
    try {
      localStorage.removeItem(STORAGE_SESSION)
      localStorage.removeItem(STORAGE_TOKEN)
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs =
          (await navigator.getRegistrations?.()) ||
          (await navigator.serviceWorker.getRegistrations())
        await Promise.all(regs.map((r) => r.unregister()))
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('session_id')
      url.searchParams.set('chat_reset', Date.now().toString())
      window.location.replace(url.toString())
    } catch (e) {
      console.error(e)
    }
  }

  async function send() {
    const txt = textareaRef.current
    const val = (txt?.value || '').trim()
    if (!val) return
    appendMe(val)
    txt.value = ''
    scrollToEnd()
    try {
      const resp = await bot.enviarMsgTexto(val)
      handleResponse(resp)
    } catch (e) {
      console.error('Erro ao enviar', e)
    }
  }

  /** ===== Renderização das respostas do backend ===== */
  function handleResponse(data) {
    setDisableEnviar(false);
    document.querySelectorAll("#chat #messages button").forEach(e => {
      e.setAttribute('disabled', true)
    });
    // suporte ao seu formato atual: html + props + attachments + buttons + contexto.pix
    if (!data) return
    if (data.html) appendBotHTML(data.html)
    if (data?.props?.attachments?.length) {
      data.props.attachments.forEach((a) => appendPDF(a, /*isBase64*/ false))
    }
    if (data?.contexto?.contratoPdfB64 && data?.props?.autoGenerateContract) {
      appendPDF(
        {
          name: data?.contexto?.contratoFilename,
          downloadUrl: data?.contexto?.contratoPdfB64,
        },
        true
      )
    }
    // guarda PIX (pra ação copiar)
    pixCodeRef.current = data?.contexto?.pix?.code || pixCodeRef.current

    if (Array.isArray(data?.props?.buttons) && data.props.buttons.length) {
      appendButtons(data.props.buttons, data?.props?.url_redirect || '')
      setDisableEnviar(true);
    }
    if (data?.items && data?.items?.bensCredito) {
      appendList(data?.items?.bensCredito)
      setDisableEnviar(true);
      //data?.items?.bensCredito.forEach(function () {
      //})
    }
  }

  function appendMe(text) {
    messagesRef.current?.insertAdjacentHTML(
      'beforeend',
      `<li me><p>${escapeHtml(text)}</p></li>`
    )
  }
  function appendMeHTML(text) {
    messagesRef.current?.insertAdjacentHTML(
      'beforeend',
      `<li me><p>${text}</p></li>`
    )
  }
  function appendBotHTML(html) {
    messagesRef.current?.insertAdjacentHTML(
      'beforeend',
      `<li style="width:100%">${html}</li>`
    )
    scrollToEnd()
  }

  function appendBotElement(element) {
    messagesRef.current?.insertAdjacentElement('beforeend', element)
    scrollToEnd()
  }

  function appendPDF(attachment, isBase64) {
    const { name, downloadUrl } = attachment || {}
    const li = document.createElement('li')
    li.style.cursor = 'pointer'
    li.innerHTML = `
      <div class="d-flex">
        <div class="pdf-content mr-2">PDF</div>
        <div style="margin-left:10px;"><p>${escapeHtml(
          name || 'arquivo.pdf'
        )}</p></div>
      </div>`
    li.onclick = async (ev) => {
      try {
        if (isBase64) {
          bot.downloadPDFBase64(downloadUrl, name)
        } else {
          await bot.downloadPDF(name, downloadUrl)
        }
      } catch (e) {
        console.error(e)
      }
    }
    messagesRef.current?.appendChild(li)
    scrollToEnd()
  }

  function appendButtons(buttons, urlRedirect) {
    const wrap = document.createElement('li')
    wrap.setAttribute('btn', '')
    wrap.style.width = '100%'
    wrap.style.maxWidth = '100%'
    wrap.innerHTML = `<div class="container"><div class="row"></div></div>`
    const row = wrap.querySelector('.row')

    buttons
      .filter((b) => b.action)
      .forEach((b) => {
        const col = document.createElement('div')
        col.className = 'col-6'
        const btn = document.createElement('button')
        btn.className = 'btnAction btnMini'
        btn.textContent = b.label
        btn.onclick = () =>
          handleButtonAction(b.action, b.label, urlRedirect, btn)
        col.appendChild(btn)
        row.appendChild(col)
      })

    messagesRef.current?.appendChild(wrap)
    scrollToEnd()
  }

  function appendImage(base64) {
    const wrap = document.createElement('li')
    wrap.setAttribute("me", true);
    wrap.style.width = '100%'
    wrap.style.maxWidth = '85%'
    wrap.innerHTML = `<img src="${base64}" />`;

    messagesRef.current?.appendChild(wrap)
    scrollToEnd()
  }

  function appendList(lista) {
    console.log(lista)
    scrollToEnd()

    setTimeout(() => {
      const container = document.createElement('div')
      container.className = ''
      container.id = ''

      lista?.forEach((benCredito) => {
        const details = document.createElement('details')
        details.className = 'group border-b border-gray-500 detail-acordion'
        details.ontoggle = function fecharOutros(e) {
          const current = e.currentTarget

          if (e.currentTarget.open) {
            current.querySelector('img').style.transform = 'rotate(180deg)'
          } else {
            current.querySelector('img').style.transform = 'rotate(0deg)'
          }

          if (current.open) {
            document
              .querySelectorAll('.detail-acordion[open]')
              .forEach((element) => {
                if (element !== current) {
                  element.open = false
                }
              })
          }
        }

        const summary = document.createElement('summary')
        summary.className = 'd-flex justify-content-between pt-4 pb-4'

        const span = document.createElement('span')
        span.className = 'text-gray-900 font-medium text-lg'
        span.textContent = benCredito.credito

        const imgIcon = document.createElement('img')
        imgIcon.style.width = '12px'
        imgIcon.src = '/Ksk_Consorcio_files/arrow-down-sign-to-navigate.png'

        summary.appendChild(span)
        summary.appendChild(imgIcon)

        const contentDiv = document.createElement('div')
        contentDiv.appendChild(montarBens(benCredito.bens))

        details.appendChild(summary)
        details.appendChild(contentDiv)
        container.appendChild(details)
      })

      const li = document.createElement('li')
      li.style = 'width:100%;'
      li.appendChild(container)

      appendBotElement(li)
    }, 3000)
  }

  async function selecionarLista(
    codigo,
    credito,
    grupo,
    prazo,
    planCode,
    parcela,
    restanteParcela,
    wppTituloCredito,
    msg1,
    msg2
  ) {
    document.querySelectorAll('.btn-acordion')?.forEach((btn) => {
      console.log(btn)
      btn.setAttribute('disabled', true)
    })

    appendMeHTML(`${msg1}<br />${msg2}`)
    var response = await bot.enviarPlanoSelecionado({
      codigo: codigo,
      credito: credito,
      grupo: grupo,
      prazo: prazo,
      planCode: planCode,
      parcela: parcela,
      restanteParcela: restanteParcela,
      wppTituloCredito: wppTituloCredito,
    })

    handleResponse(response)
  }

  function montarBens(bens) {
    const container = document.createElement('div')

    bens?.forEach((benCredito) => {
      const itemDiv = document.createElement('div')
      itemDiv.className = 'p-2'

      const titleText = document.createTextNode(benCredito.wppTituloParcela)
      itemDiv.appendChild(titleText)

      const br = document.createElement('br')
      itemDiv.appendChild(br)

      const tagDiv = document.createElement('div')
      tagDiv.className = 'mb-2'

      const tagSpan = document.createElement('span')
      tagSpan.className = 'tag'
      tagSpan.textContent = benCredito.wppDescParcela
      tagDiv.appendChild(tagSpan)

      const button = document.createElement('button')
      button.className = 'btnAction btnMini btnActionWhite btn-acordion'
      button.textContent = 'Selecionar'
      button.addEventListener('click', function () {
        selecionarLista(
          benCredito.codigo,
          benCredito.credito,
          benCredito.grupo,
          benCredito.prazo,
          benCredito.planCode,
          benCredito.parcela,
          benCredito.restanteParcela,
          benCredito.wppTituloCredito,
          benCredito.wppTituloParcela,
          benCredito.wppDescParcela
        )
      })
      //button.onclick = () => alert('aioba')

      const hr = document.createElement('hr')

      itemDiv.appendChild(tagDiv)
      itemDiv.appendChild(button)
      container.appendChild(itemDiv)
      container.appendChild(hr)
    })

    return container
  }

  const openDetailsSummary = (e) => {
    console.log('click')
    console.log(e)
  }

  async function handleButtonAction(action, label, urlRedirect, btnEl) {
    try {
      if (action === 'REDIRECT' && urlRedirect) {
        window.open(urlRedirect, '_blank')?.focus()
        return
      }
      if (action === 'COPIAR CODIGO PIX') {
        if (pixCodeRef.current) {
          await navigator.clipboard.writeText(pixCodeRef.current)
          appendMe('PIX Copiado!')
          scrollToEnd()
        }
        return
      }
      if (action === 'UPLOAD_DOC' || action === 'UPLOAD_SELFIE') {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/jpeg,image/png'
        input.onchange = async () => {
          if (!input.files?.length) return
          const file = input.files[0]
          // preview na UI
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = reader.result
            messagesRef.current?.insertAdjacentHTML(
              'beforeend',
              `<li me><img src="${base64}" style="max-width:150px;border-radius:6px" /></li>`
            )
            scrollToEnd()
          }
          reader.readAsDataURL(file)

          setFazendoUploadArquivo(true);
          const form = new FormData()
          form.append('file', file)
          const resp =
            action === 'UPLOAD_DOC'
              ? await bot.enviarDocumento(form)
              : await bot.enviarSelfie(form)
          setFazendoUploadArquivo(false);
          handleResponse(resp)
        }
        input.click()
        return
      }
      if(action === 'CAPTURAR_SELFIE') {
        setActionAtual('CAPTURAR_SELFIE');
        setShowWebcam(true);
        return false;
      }

      if(action === 'CAPTURAR_FOTO') {
        setActionAtual('CAPTURAR_FOTO');
        setShowWebcam(true);
        return false;
      }

      document.querySelectorAll("#chat #messages button").forEach(e => {
        e.setAttribute('disabled', true)
      });

      // default: BUTTONS
      appendMe(label)
      scrollToEnd()
      const resp = await bot.enviarButton(action)
      handleResponse(resp)
    } catch (e) {
      console.error(e)
    }
  }

  function scrollToEnd() {
    const ul = messagesRef.current
    if (!ul) return
    ul.scrollTop = ul.scrollHeight
  }

  async function onCaptureSelfie(base64) {
    // Convert base64 to Blob then File
    const [meta, data] = base64.split(',')
    const mime = meta.match(/:(.*?);/)[1] || 'image/png'
    const bin = atob(data); const arr = new Uint8Array(bin.length)
    for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i)
    const file = new File([arr], 'selfie.png', { type: mime });
    const formData = new FormData();
    formData.append('file', file);

    document.querySelectorAll("#chat #messages button").forEach(e => {
      e.setAttribute('disabled', true)
    });

    setFazendoUploadArquivo(true);
    appendImage(base64);
    if(actionAtual === "CAPTURAR_SELFIE") {
      setShowWebcam(false);
      const response = await bot.enviarSelfie(formData);
      handleResponse(response);
    }
    if(actionAtual === "CAPTURAR_FOTO") {
      setShowWebcam(false);
      console.log(bot);
      const response = await bot.enviarDocumento(formData);
      handleResponse(response);
    }
    setFazendoUploadArquivo(false);

  }

  return (
      <>
        {
          showWebcam ? <ModalSelfie onClose={() => setShowWebcam(false)} onSend={onCaptureSelfie} action={actionAtual} /> : ''
        }

        <div id='chat' ref={chatRef}>
          <div
              className='header'
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'white'
              }}
          >
            <img
                className='img-perfil'
                src='/Ksk_Consorcio_files/Logo_full_white_ksk.svg'
                alt='logo'
            />
            Canal de aquisição
            <div
                className='header-actions'
                style={{display: 'flex', gap: '.25rem'}}
            >
              <button
                  id='reset-chat'
                  className='icon-btn'
                  title='Reiniciar conversa'
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '5px',
                  }}
              >
                <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    style={{color: '#fff'}}
                >
                  <polyline points='23 4 23 10 17 10'></polyline>
                  <polyline points='1 20 1 14 7 14'></polyline>
                  <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'></path>
                </svg>
              </button>
              <button
                  id='close-chat'
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '5px',
                  }}
              >
                <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    style={{color: '#fff'}}
                >
                  <line x1='18' y1='6' x2='6' y2='18'></line>
                  <line x1='6' y1='6' x2='18' y2='18'></line>
                </svg>
              </button>
            </div>
          </div>

          <div className='content'>
            <div className='d-flex justify-content-center' id='loading-chat'>
              <div
                  className='spinner-border spinner-border mr-2'
                  style={{marginRight: 10, color: '#0B2145'}}
                  role='status'
              ></div>
            </div>
            <ul id='messages' ref={messagesRef}></ul>
            <div id='send-message'>
              <textarea disabled={disableEnviar || fazendoUploadArquivo} ref={textareaRef} placeholder='Escreva algo...'></textarea>
              <button
                  className='btnAction'
                  id='send-btn'
                  type='button'
                  disabled={fazendoUploadArquivo || disableEnviar}
                  ref={sendBtnRef}
              >
                Enviar
                {
                  fazendoUploadArquivo ? <div
                      className='spinner-border spinner-border-sm mr-2'
                      style={{marginLeft: 10, color: '#FFF'}}
                      role='status'
                  ></div> : ''
                }
              </button>

            </div>
          </div>
        </div>
      </>
  )
}
