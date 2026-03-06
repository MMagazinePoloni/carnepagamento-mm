import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Server-side endpoint to mark a payment as paid.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * POST /api/abacatepay/mark-paid
 * Body: { chargeId: "pix_char_xxx", pvenum?: number, npeseq?: number, clicod?: number }
 */
export async function POST(req: Request) {
    try {
        const { chargeId, pvenum, npeseq, clicod, amount } = await req.json()

        if (!chargeId) {
            return NextResponse.json({ error: "chargeId ausente" }, { status: 400 })
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

        if (!url || !key) {
            return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
        }

        const supa = createClient(url, key)

        // SECURITY: Verify payment with AbacatePay before updating the database
        // This prevents someone from calling this endpoint with a fake chargeId.
        const apiUrl = process.env.ABACATEPAY_API_URL
        const apiKey = process.env.ABACATEPAY_API_KEY
        if (apiUrl && apiKey) {
            const checkUrl = `${apiUrl}/v1/pixQrCode/check?id=${encodeURIComponent(chargeId)}`
            const checkRes = await fetch(checkUrl, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                }
            })
            if (!checkRes.ok) {
                return NextResponse.json({ error: "Falha ao verificar status do pagamento" }, { status: 403 })
            }
            const checkJson = await checkRes.json()
            const paymentData = checkJson.data || checkJson
            if (paymentData.status !== "PAID") {
                return NextResponse.json({ error: "Pagamento não confirmado na operadora" }, { status: 403 })
            }
        }

        // Update payment status in the new PAGAMENTOS table structure
        // The user robot expects 'paid' to change it to 'processed'
        const today = new Date().toISOString()
        const { error: updErr, count } = await supa
            .from("PAGAMENTOS")
            .update({ 
                STATUS: "paid",
                FCRPGT: today 
            })
            .eq("PROVIDER_ID", chargeId)
            .neq("STATUS", "processed") // Don't update if already processed by robot

        console.log("mark-paid: PROVIDER_ID=", chargeId, "count=", count, "err=", updErr)

        if (updErr) {
            return NextResponse.json({ error: updErr.message }, { status: 500 })
        }

        // Update NVENDA if pvenum/npeseq provided
        if (pvenum && npeseq) {
            const { error: nvErr } = await supa
                .from("NVENDA")
                .update({ PAGCOD: 7 })
                .eq("PVENUM", pvenum)
                .eq("NPESEQ", npeseq)

            if (nvErr) console.error("mark-paid NVENDA error:", nvErr)
            else console.log("mark-paid NVENDA updated:", { pvenum, npeseq })

            // Upsert into FBCRECEBER to persist paid status
            let finalClicod = clicod
            if (!finalClicod) {
                // Fallback: fetch CLICOD from NVENDA
                const { data: nvendaRow } = await supa
                    .from("NVENDA")
                    .select("CLICOD")
                    .eq("PVENUM", pvenum)
                    .eq("NPESEQ", npeseq)
                    .maybeSingle()
                if (nvendaRow) finalClicod = Number((nvendaRow as any).CLICOD)
            }

            if (finalClicod) {
                // Get installment value for FBRVLR
                let fbrvlr = amount || 0
                if (!fbrvlr) {
                    const { data: valRow } = await supa
                        .from("NVENDA")
                        .select("PVETPA")
                        .eq("PVENUM", pvenum)
                        .eq("NPESEQ", npeseq)
                        .maybeSingle()
                    if (valRow) fbrvlr = Number((valRow as any).PVETPA)
                }

                const todayDateOnly = new Date().toISOString().split("T")[0]
                const { error: fbcErr } = await supa
                    .from("FCRECEBER")
                    .upsert({
                        CLICOD: finalClicod,
                        PCRNOT: pvenum,
                        FCRPAR: npeseq,
                        FCRVLP: fbrvlr,
                        COBCOD: 7,
                        FCRPGT: todayDateOnly,
                        ACATUR: 1
                    }, { onConflict: "PCRNOT,FCRPAR" })

                if (fbcErr) console.error("mark-paid FCRECEBER error:", fbcErr)
                else console.log("mark-paid FCRECEBER upserted:", { PCRNOT: pvenum, FCRPAR: npeseq, CLICOD: finalClicod })
            }
        }

        return NextResponse.json({ ok: true, updated: count })
    } catch (error) {
        console.error("mark-paid error:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
