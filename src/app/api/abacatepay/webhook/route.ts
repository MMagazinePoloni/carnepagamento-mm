import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Webhook endpoint para o AbacatePay.
 * Evento: billing.paid
 *
 * Payload esperado:
 * {
 *   "event": "billing.paid",
 *   "data": {
 *     "billing": {
 *       "id": "bill_xxx",
 *       "status": "PAID",
 *       "products": [{ "externalId": "12764-1", ... }]
 *     }
 *   }
 * }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        console.log("Webhook recebido:", JSON.stringify(body, null, 2))

        if (body?.event !== "billing.paid") {
            console.log("Evento ignorado:", body?.event)
            return NextResponse.json({ ok: true, ignored: true })
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

        if (!url || !key) {
            return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
        }

        const supa = createClient(url, key)

        // O AbacatePay envia billing.paid para AMBOS:
        // 1) PIX QR Code → payload tem data.pixQrCode com { id, status, amount }
        // 2) Cobrança    → payload tem data.billing  com { id, status, products }

        const pixQrCode = body.data?.pixQrCode
        const billing = body.data?.billing

        if (pixQrCode) {
            // ---- PIX QR Code payment ----
            const chargeId = pixQrCode.id as string
            console.log("PIX QR Code pago, chargeId:", chargeId)

            if (chargeId) {
                // Atualizar payments pela provider_id (pixQrCode id)
                const { error: payErr } = await supa
                    .from("payments")
                    .update({ status: "paid" })
                    .eq("provider_id", chargeId)
                    .eq("status", "pending")

                if (payErr) console.error("Erro ao atualizar payments:", payErr)
                else console.log("Payment atualizado para paid, provider_id:", chargeId)

                // Buscar o installment_id do payment para atualizar NVENDA
                const { data: paymentRows } = await supa
                    .from("payments")
                    .select("installment_id")
                    .eq("provider_id", chargeId)
                    .limit(1)

                if (paymentRows && paymentRows.length > 0) {
                    const installmentId = paymentRows[0].installment_id as string
                    // installment_id tem formato "PVENUM-NPESEQ"
                    const parts = installmentId.split("-")
                    if (parts.length >= 2) {
                        const pvenum = Number(parts[0])
                        const npeseq = Number(parts[1])
                        if (!isNaN(pvenum) && !isNaN(npeseq)) {
                            await supa
                                .from("NVENDA")
                                .update({ PAGCOD: 7 })
                                .eq("PVENUM", pvenum)
                                .eq("NPESEQ", npeseq)
                            console.log("NVENDA atualizado:", { pvenum, npeseq })
                        }
                    }
                }
            }
        } else if (billing) {
            // ---- Cobrança (billing) payment ----
            const billingId = billing.id as string
            const products = billing.products as Array<{ externalId?: string }> | undefined
            console.log("Billing pago, billingId:", billingId)

            if (billingId) {
                await supa
                    .from("payments")
                    .update({ status: "paid" })
                    .eq("provider_id", billingId)
                    .eq("status", "pending")

                if (products && products.length > 0) {
                    for (const product of products) {
                        const externalId = product.externalId
                        if (!externalId) continue
                        const parts = externalId.split("-")
                        if (parts.length >= 2) {
                            const pvenum = Number(parts[0])
                            const npeseq = Number(parts[1])
                            if (!isNaN(pvenum) && !isNaN(npeseq)) {
                                await supa
                                    .from("NVENDA")
                                    .update({ PAGCOD: 7 })
                                    .eq("PVENUM", pvenum)
                                    .eq("NPESEQ", npeseq)
                            }
                        }
                    }
                }
            }
        } else {
            console.log("Payload sem pixQrCode nem billing:", JSON.stringify(body.data))
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Webhook error:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}

// AbacatePay pode enviar GET para verificar se o endpoint existe
export async function GET() {
    return NextResponse.json({ status: "ok", service: "abacatepay-webhook" })
}
