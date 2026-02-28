import { useEffect, useMemo, useRef, useState } from "react"
import QRCode from "react-qr-code"
import type { Installment, InstallmentStatus } from "../lib/types"
import { supabase } from "../lib/supabaseClient"

export default function PaymentModal({
  installment,
  onClose,
  onStatusChange
}: {
  installment: Installment
  onClose: () => void
  onStatusChange: (newStatus: InstallmentStatus) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrText, setQrText] = useState<string>("")
  const [amount, setAmount] = useState<number>(installment.amount + (installment.fine_amount || 0))
  const [copyCode, setCopyCode] = useState<string>("")
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const body = useMemo(() => ({
    installmentId: installment.id,
    amount
  }), [installment.id, amount])

  useEffect(() => {
    async function createCharge() {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/abacatepay/create-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        let msg = "Falha ao criar cobrança Pix."
        try {
          const j = await res.json()
          const details = j?.details || j?.error
          if (details) msg += ` ${String(details).slice(0, 300)}`
        } catch {
          try {
            const t = await res.text()
            if (t) msg += ` ${t.slice(0, 300)}`
          } catch {}
        }
        setError(msg)
        setLoading(false)
        return
      }
      const data = await res.json()
      // A AbacatePay retorna uma URL de checkout para o cliente
      if (data.paymentUrl) {
        // Registra a intenção de pagamento no Supabase antes de redirecionar
        await supabase.from("payments").insert({
          installment_id: installment.id,
          amount,
          method: "pix",
          status: "pending",
          provider_id: data.chargeId || null
        })
        
        // Atualiza a venda indicando que foi enviado para cobrança
        if (installment.pcrnot) {
          await supabase
            .from("NVENDA")
            .update({ ENVIADO: true, PAGDES: "PIX" })
            .eq("PVENUM", installment.pcrnot)
            .eq("NPESEQ", installment.index)
        }

        // Redireciona para o checkout da AbacatePay
        window.location.href = data.paymentUrl
        return
      }

      setQrText(data.pixCopiaCola || data.qrText || "")
      setCopyCode(data.pixCopiaCola || "")
      await supabase.from("payments").insert({
        installment_id: installment.id,
        amount,
        method: "pix",
        status: "pending",
        provider_id: data.chargeId || null
      })
      if (installment.pcrnot) {
        await supabase
          .from("NVENDA")
          .update({ ENVIADO: true, PAGDES: "PIX" })
          .eq("PVENUM", installment.pcrnot)
          .eq("NPESEQ", installment.index)
      }
      setLoading(false)
      startPolling()
    }
    createCharge()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [body])

  function startPolling() {
    timerRef.current = setInterval(async () => {
      if (!installment.pcrnot) return
      const { data } = await supabase
        .from("NVENDA")
        .select("PAGCOD")
        .eq("PVENUM", installment.pcrnot)
        .eq("NPESEQ", installment.index)
        .maybeSingle()
      const pago = Number((data as any)?.PAGCOD) === 7
      if (pago) {
        if (timerRef.current) clearInterval(timerRef.current)
        await supabase
          .from("payments")
          .update({ status: "paid" })
          .eq("installment_id", installment.id)
          .eq("status", "pending")
        onStatusChange("pago")
      }
    }, 5000)
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "grid",
      placeItems: "end center",
      paddingBottom: 24
    }}>
      <div className="card" style={{ width: "100%", maxWidth: 560 }}>
        <div className="row">
          <div className="title" style={{ margin: 0 }}>Pagamento Pix</div>
          <button className="button secondary" onClick={onClose} style={{ width: 120 }}>Fechar</button>
        </div>
        <div className="subtitle">Aguardando confirmação de pagamento...</div>
        {loading && <div className="subtitle">Gerando QR Code...</div>}
        {error && <div className="subtitle">{error}</div>}
        {!loading && !error && (
          <>
            <div className="qrbox">
              <QRCode value={qrText || " "} size={200} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="muted">Código copia e cola</div>
              <div style={{
                background: "#f1f5f9",
                padding: 12,
                borderRadius: 12,
                wordBreak: "break-all",
                fontSize: 12
              }}>{copyCode}</div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <div className="muted">Valor</div>
              <div className="money">
                {Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
