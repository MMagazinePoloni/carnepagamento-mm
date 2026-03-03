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

        // Update payment status
        const { error: updErr, count } = await supa
            .from("payments")
            .update({ status: "paid" })
            .eq("provider_id", chargeId)
            .eq("status", "pending")

        console.log("mark-paid: provider_id=", chargeId, "count=", count, "err=", updErr)

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

                const today = new Date().toISOString().split("T")[0]
                const { error: fbcErr } = await supa
                    .from("FBCRECEBER")
                    .upsert({
                        CLICOD: finalClicod,
                        PCRNOT: pvenum,
                        FCRPAR: npeseq,
                        FBRVLR: fbrvlr,
                        COBCOD: 7,
                        FBRPGT: today,
                        ACATUR: 1
                    }, { onConflict: "PCRNOT,FCRPAR" })

                if (fbcErr) console.error("mark-paid FBCRECEBER error:", fbcErr)
                else console.log("mark-paid FBCRECEBER upserted:", { PCRNOT: pvenum, FCRPAR: npeseq, CLICOD: finalClicod })
            }
        }

        return NextResponse.json({ ok: true, updated: count })
    } catch (error) {
        console.error("mark-paid error:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
