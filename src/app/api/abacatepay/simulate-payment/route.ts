import { NextResponse } from "next/server"

/**
 * Simulate a PIX QR Code payment (dev mode only).
 * POST /api/abacatepay/simulate-payment
 * Body: { chargeId: "pix_char_xxx" }
 */
export async function POST(req: Request) {
    try {
        const { chargeId } = await req.json()

        if (!chargeId) {
            return NextResponse.json({ error: "chargeId ausente" }, { status: 400 })
        }

        const apiUrl = process.env.ABACATEPAY_API_URL
        const apiKey = process.env.ABACATEPAY_API_KEY

        if (!apiUrl || !apiKey) {
            return NextResponse.json(
                { error: "API de pagamento não configurada" },
                { status: 500 }
            )
        }

        const url = `${apiUrl}/v1/pixQrCode/simulate-payment?id=${encodeURIComponent(chargeId)}`
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({ metadata: {} })
        })

        const text = await res.text()

        if (!res.ok) {
            console.error("Erro ao simular pagamento:", text)
            return NextResponse.json(
                { error: text || "Falha ao simular pagamento" },
                { status: res.status }
            )
        }

        const json = JSON.parse(text)
        return NextResponse.json({ ok: true, data: json.data || json })

    } catch (error) {
        console.error("Erro interno:", error)
        return NextResponse.json(
            { error: "Erro interno" },
            { status: 500 }
        )
    }
}
