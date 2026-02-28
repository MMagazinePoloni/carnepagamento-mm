const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supa = createClient(url, key);

async function test() {
    const { data, error } = await supa
        .from("NVENDA")
        .select("PVENUM, PVEDAT, NPESEQ, PVETPA, PAGCOD, PAGDES, CLICOD")
        .eq("CLICOD", 485)
        .order("PVENUM", { ascending: false })
        .order("NPESEQ", { ascending: true })
        .limit(5);

    console.log("Error:", error);
    console.log("Data count:", data?.length);
    if (data?.length) console.log("First row:", data[0]);
}
test();
