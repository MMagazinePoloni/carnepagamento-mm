import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const { installmentId, amount, clicod, pvenum, index } = await req.json()

    // Validação básica de entrada
    if (!installmentId || !amount || isNaN(Number(amount)) || isNaN(Number(clicod))) {
      return NextResponse.json({ error: "Dados de entrada inválidos" }, { status: 400 })
    }

    const apiUrl = process.env.ABACATEPAY_API_URL
    const apiKey = process.env.ABACATEPAY_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: "API de pagamento não configurada" },
        { status: 500 }
      )
    }

    const amountInCents = Math.round(Number(amount) * 100)

    // Use PIX QR Code API instead of billing
    const url = `${apiUrl}/v1/pixQrCode/create`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        amount: amountInCents,
        expiresIn: 3600, // 1 hour
        description: `Parcela ${installmentId}`.slice(0, 37),
        metadata: {
          externalId: installmentId
        }
      })
    })

    const text = await res.text()

    if (!res.ok) {
      console.error("Erro AbacatePay PIX QR Code:", text)
      return NextResponse.json(
        { error: text || "Falha ao criar QR Code PIX" },
        { status: res.status }
      )
    }

    const json = JSON.parse(text)
    const data = json.data || json
    const chargeId = data.id

    // Server-side insertion into PAGAMENTOS to bypass RLS
    if (supabaseUrl && supabaseKey) {
        const supa = createClient(supabaseUrl, supabaseKey)
        const { error: insertErr } = await supa.from("PAGAMENTOS").insert({
            CLICOD: clicod || 0,
            PCRNOT: pvenum || 0,
            FCRPAR: index || 0,
            FBRVLR: Number(amount),
            COBCOD: 7, // PIX
            STATUS: "pending",
            PROVIDER_ID: chargeId || null,
            METHOD: "pix"
        })
        if (insertErr) console.error("Erro ao inserir PAGAMENTOS via servidor:", insertErr)
        else console.log("PAGAMENTOS inserido com sucesso via servidor:", chargeId)
    }

    return NextResponse.json({
      chargeId: chargeId,
      brCode: data.brCode,
      brCodeBase64: data.brCodeBase64,
      status: data.status,
      expiresAt: data.expiresAt
    })

  } catch (error) {
    console.error("Erro interno:", error)
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}