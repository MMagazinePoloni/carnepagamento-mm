import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { installmentId, amount } = await req.json()

    if (!installmentId || !amount) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const apiUrl = process.env.ABACATEPAY_API_URL
    const apiKey = process.env.ABACATEPAY_API_KEY

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

    return NextResponse.json({
      chargeId: data.id,
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