// Vercel Serverless Function: POST /api/charge
// Chama só a API de charge da Nova Pay. Sem dependências (usa fetch nativo do Node 18+).
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   NOVAPAY_CI        client id
//   NOVAPAY_CS        client secret
//   ALLOWED_ORIGINS   opcional. Ex: https://meusite.com,https://outro.com  (padrão: *)

const ENDPOINT = 'https://api.anovapay.com.br/charges';

function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '*').split(',').map(function (s) { return s.trim(); });
  const origin = req.headers.origin || '';
  if (allowed.indexOf('*') !== -1) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowed.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const ci = process.env.NOVAPAY_CI;
  const cs = process.env.NOVAPAY_CS;
  if (!ci || !cs) return res.status(500).json({ error: 'Servidor sem credenciais configuradas' });

  const body = req.body || {};
  const amount = Math.round(Number(body.amount) * 100) / 100; // em reais, não em centavos
  if (!isFinite(amount) || amount < 1 || amount > 50000) {
    return res.status(400).json({ error: 'Valor inválido' });
  }
  const description = String(body.description || 'Doação').slice(0, 140);

  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ci: ci, cs: cs },
      body: JSON.stringify({ amount: amount, description: description }),
      signal: AbortSignal.timeout(15000)
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!r.ok) {
      console.error('Nova Pay respondeu', r.status, text);
      return res.status(502).json({ error: 'Não foi possível gerar o Pix agora' });
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error('Erro ao chamar Nova Pay', e);
    return res.status(502).json({ error: 'Não foi possível gerar o Pix agora' });
  }
};
