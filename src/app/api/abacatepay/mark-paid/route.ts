import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Server-side endpoint to mark a payment as paid.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * POST /api/abacatepay/mark-paid
 * Body: { chargeId: "pix_char_xxx", pvenum?: number, npeseq?: number }
 */
export async function POST(req: Request) {
    try {
        const { chargeId, pvenum, npeseq } = await req.json()

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
        }

        return NextResponse.json({ ok: true, updated: count })
    } catch (error) {
        console.error("mark-paid error:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
