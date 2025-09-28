import React, { useEffect, useRef, useState } from 'react'

export default function WebcamModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [useFront, setUseFront] = useState(true)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!open) { cleanup(); return }
    start()
    return () => cleanup()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, useFront])

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: useFront ? 'user' : 'environment' } })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      setStatus(useFront ? 'Usando câmera frontal' : 'Usando câmera traseira')
    } catch (e) {
      setStatus('Erro: ' + e.message)
    }
  }

  function cleanup(callback=null) {
    if (stream) stream.getTracks().forEach(t => t.stop())
    setStream(null); setPreview(null); setStatus('');
    if(callback)
      callback();
  }

  function doCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/png')
    setPreview(data)
  }

  function usePhoto() {
    if (preview) {
      cleanup(() => {
        onCapture?.(preview)
        onClose?.()
      });
    }
  }

  return !open ? null : (
    <div className="modal-backdrop" style={{ zIndex:999999, width: '100%' }} role="dialog" aria-modal="true">
      <div className="modal-card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <h5 className="text-white" style={{margin:0}}>Webcam</h5>
          <button className="icon-btn" onClick={() => {cleanup(); if(onClose) onClose();}} title="Fechar">✕</button>
        </div>
        <div>
          {!preview && <video ref={videoRef} className="video" autoPlay playsInline muted />}
          <canvas ref={canvasRef} className="hidden" />
          {preview && <img src={preview} alt="preview" className="preview" />}
          <p className="badge" style={{marginTop:8}}>
            {status || 'Pronto para capturar'}
          </p>
        </div>
        <div className="modal-footer">
          {!preview ? (
            <>
              <button className="btn btn--ghost" onClick={() => setUseFront(v => !v)}>Trocar câmera</button>
              <button className="btn btn--primary" onClick={doCapture}>Capturar</button>
            </>
          ) : (
            <>
              <button className="btn btn--ghost" onClick={() => {setPreview(null); start();}}>Tirar outra</button>
              <button className="btn btn--success" onClick={usePhoto}>Enviar</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
