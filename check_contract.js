const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar .env.local manualmente
try {
  const envContent = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key && val && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  });
} catch (e) {
  console.error('Error reading .env.local', e);
}

async function checkContract(pvenum) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('URL:', url);
  console.log('KEY (primeiros 10):', key ? key.substring(0, 10) + '...' : 'MISSING');

  if (!url || !key) {
    console.error('Supabase credentials missing');
    return;
  }

  const supabase = createClient(url, key);

  console.log(`Checking contract: ${pvenum}...`);

  const { data, error } = await supabase
    .from('NVENDA')
    .select('PVENUM, PVEDAT, NPESEQ')
    .eq('PVENUM', pvenum)
    .limit(5);

  if (error) {
    console.error('Error fetching NVENDA:', error);
  } else {
    console.log('NVENDA found:', data ? data.length : 0, 'rows');
    if (data && data.length > 0) {
        console.log('Sample row:', data[0]);
    } else {
        console.log('No rows found for PVENUM', pvenum);
    }
  }
}

// Verifica o contrato 12787 (do exemplo do usuário)
checkContract(12787);
