// Cria um conjunto de contas fictícias (3 missionários + 4 parceiros) com
// projetos, publicações, seguidores, parcerias formais e doações reais
// (transações de verdade, disparando os triggers de saldo do banco) — só
// para você testar manualmente seguir/parceria/doação. Todas as contas usam
// e-mail @seed.goguide.test, o que permite apagar tudo de uma vez com
// scripts/delete-test-accounts.mjs.
//
// Uso: node --env-file=.env.local scripts/seed-test-accounts.mjs

import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, 'seed-test-accounts.output.json')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com: node --env-file=.env.local scripts/seed-test-accounts.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const PASSWORD = 'holyholy'
const DOMAIN = '@seed.goguide.test'

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

function fail(context, error) {
  console.error(`✖ ${context}:`, error.message ?? error)
  process.exit(1)
}

async function createPersonAccount({ email, fullName, updates }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) fail(`criar usuário ${email}`, error)
  const userId = data.user.id

  // handle_new_user() já criou a linha em profiles nesse ponto (trigger
  // AFTER INSERT síncrono, na mesma transação do createUser).
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('user_id', userId)
    .single()
  if (profileErr) fail(`buscar profile recém-criado de ${email}`, profileErr)

  const { error: updateErr } = await supabase.from('profiles').update(updates).eq('id', profile.id)
  if (updateErr) fail(`atualizar profile de ${email}`, updateErr)

  return { userId, profileId: profile.id }
}

async function insertOne(table, row, context) {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) fail(`inserir em ${table} (${context})`, error)
  return data
}

console.log('--- Criando missionários ---')

const ana = await createPersonAccount({
  email: `ana.ferreira${DOMAIN}`,
  fullName: 'Ana Ferreira',
  updates: {
    username: 'ana_ferreira',
    display_name: 'Ana Ferreira',
    user_role: 'missionary',
    account_type: 'individual',
    privacy_mode: 'public',
    bio: 'Missionária no Quênia desde 2019, com foco em evangelismo e saúde comunitária em Nairóbi.',
    location: 'Nairóbi, Quênia',
    mission_start_date: '2019-03-01',
  },
})
console.log('✓ Ana Ferreira')

const joaoMarina = await createPersonAccount({
  email: `joao.marina${DOMAIN}`,
  fullName: 'João & Marina Costa',
  updates: {
    username: 'joao_marina',
    display_name: 'João & Marina Costa',
    user_role: 'missionary',
    account_type: 'family',
    privacy_mode: 'public',
    bio: 'Casal servindo no interior do Peru, com foco em educação infantil e desenvolvimento comunitário.',
    location: 'Cusco, Peru',
    mission_start_date: '2021-06-01',
  },
})
console.log('✓ João & Marina Costa')

const institutoNovaVida = await createPersonAccount({
  email: `instituto.novavida${DOMAIN}`,
  fullName: 'Instituto Nova Vida',
  updates: {
    username: 'instituto_novavida',
    display_name: 'Instituto Nova Vida',
    user_role: 'missionary',
    account_type: 'organization',
    privacy_mode: 'public',
    bio: 'Organização de resposta a emergências e desastres naturais na América Latina.',
    location: 'São Paulo, Brasil',
    mission_start_date: '2015-01-01',
  },
})
console.log('✓ Instituto Nova Vida')

console.log('--- Métodos de recebimento + contas financeiras ---')

const missionaries = [
  { ref: ana, key: 'ana', pixKey: 'ana.ferreira.missoes@pix.com.br' },
  { ref: joaoMarina, key: 'joaoMarina', pixKey: 'joaomarina.peru@pix.com.br' },
  { ref: institutoNovaVida, key: 'instituto', pixKey: 'contato@institutonovavida.org.br' },
]

for (const m of missionaries) {
  await insertOne('payment_methods', {
    profile_id: m.ref.profileId,
    type: 'pix',
    value: m.pixKey,
    is_active: true,
    sort_order: 0,
  }, `pix de ${m.key}`)

  // Guardado no objeto original (ana/joaoMarina/institutoNovaVida), não na
  // cópia local `m` — é `ana.account`/`joaoMarina.account` que os pledges
  // abaixo usam.
  m.ref.account = await insertOne('financial_accounts', {
    profile_id: m.ref.profileId,
    currency_code: 'BRL',
    name: 'Conta Principal',
    account_type: 'checking',
    is_shared: false,
  }, `conta financeira de ${m.key}`)
}

console.log('--- Projetos ---')

const anaProjectEvangelismo = await insertOne('highlights', {
  profile_id: ana.profileId,
  title: 'Evangelismo em Kibera',
  description: 'Campanha de evangelismo e discipulado na comunidade de Kibera, Nairóbi.',
  goal_type: ['financial', 'prayer'],
  category: ['evangelism'],
  goal_amount: 15000,
  current_amount: 0,
  currency: 'BRL',
  status: 'active',
}, 'Evangelismo em Kibera')

const anaProjectClinica = await insertOne('highlights', {
  profile_id: ana.profileId,
  title: 'Clínica Comunitária 2025',
  description: 'Clínica de saúde básica gratuita para a comunidade local — projeto já concluído.',
  goal_type: ['financial'],
  category: ['health'],
  goal_amount: 8000,
  current_amount: 8000,
  currency: 'BRL',
  status: 'completed',
  completed_at: daysAgo(45),
}, 'Clínica Comunitária 2025')

const joaoProjectEscola = await insertOne('highlights', {
  profile_id: joaoMarina.profileId,
  title: 'Escolinha Esperança',
  description: 'Escola infantil para crianças da comunidade, com merenda e material escolar.',
  goal_type: ['financial', 'volunteer'],
  category: ['education'],
  goal_amount: 25000,
  current_amount: 0,
  currency: 'BRL',
  status: 'active',
}, 'Escolinha Esperança')

const joaoProjectPoco = await insertOne('highlights', {
  profile_id: joaoMarina.profileId,
  title: 'Poço de água para a vila',
  description: 'Perfuração de poço artesiano para levar água potável à vila.',
  goal_type: ['financial'],
  category: ['community_development'],
  goal_amount: 6000,
  current_amount: 0,
  currency: 'BRL',
  status: 'active',
}, 'Poço de água para a vila')

const institutoProjectEnchentes = await insertOne('highlights', {
  profile_id: institutoNovaVida.profileId,
  title: 'Resposta a enchentes no Sul',
  description: 'Ajuda humanitária emergencial para famílias afetadas por enchentes.',
  goal_type: ['financial', 'ambassador'],
  category: ['disaster_relief'],
  goal_amount: 40000,
  current_amount: 0,
  currency: 'BRL',
  status: 'active',
}, 'Resposta a enchentes no Sul')

const institutoProjectBase = await insertOne('highlights', {
  profile_id: institutoNovaVida.profileId,
  title: 'Manutenção da base de operações',
  description: 'Custos fixos da base que sustenta as operações de resposta a desastres.',
  goal_type: ['financial', 'ongoing'],
  category: ['other'],
  goal_amount: null,
  current_amount: 0,
  currency: 'BRL',
  status: 'active',
}, 'Manutenção da base de operações')

console.log('--- Publicações ---')

const posts = [
  { profileId: ana.profileId, content: 'Cheguei em Nairóbi! Obrigada a cada um que orou por essa viagem — começamos amanhã as visitas em Kibera.', projectId: null, daysAgo: 58 },
  { profileId: ana.profileId, content: 'Primeira semana em Kibera: já são mais de 40 famílias participando dos encontros de discipulado. Sigam orando pela abertura de portas.', projectId: anaProjectEvangelismo.id, daysAgo: 50 },
  { profileId: ana.profileId, content: 'A Clínica Comunitária foi concluída! Atendemos mais de 300 pessoas na semana de inauguração. Obrigada por tornarem isso possível.', projectId: anaProjectClinica.id, daysAgo: 30 },
  { profileId: ana.profileId, content: 'Pedido de oração: estamos entrando numa nova fase do trabalho em Kibera, com mais visitas domiciliares. Peço oração por sabedoria e proteção.', projectId: null, daysAgo: 8 },

  { profileId: joaoMarina.profileId, content: 'Chegamos em Cusco! A adaptação está sendo linda, e já fomos recebidos com muito carinho pela comunidade.', projectId: null, daysAgo: 55 },
  { profileId: joaoMarina.profileId, content: 'A Escolinha Esperança abriu as inscrições! Já temos 25 crianças matriculadas para o próximo semestre.', projectId: joaoProjectEscola.id, daysAgo: 40 },
  { profileId: joaoMarina.profileId, content: 'Começamos os estudos para o poço da vila — o acesso à água ainda é um dos maiores desafios daqui.', projectId: joaoProjectPoco.id, daysAgo: 20 },
  { profileId: joaoMarina.profileId, content: 'Marina começou as aulas de reforço escolar essa semana. Muita alegria em ver as crianças animadas para aprender!', projectId: joaoProjectEscola.id, daysAgo: 6 },

  { profileId: institutoNovaVida.profileId, content: 'Nossa equipe já está no Sul do país, avaliando as áreas mais afetadas pelas enchentes desta semana.', projectId: institutoProjectEnchentes.id, daysAgo: 15 },
  { profileId: institutoNovaVida.profileId, content: 'Já distribuímos mais de 500 kits de higiene e alimentos para famílias desabrigadas. Obrigado por apoiarem essa resposta.', projectId: institutoProjectEnchentes.id, daysAgo: 9 },
  { profileId: institutoNovaVida.profileId, content: 'A base segue funcionando graças aos parceiros mensais — é o que nos permite responder rápido quando uma emergência acontece.', projectId: institutoProjectBase.id, daysAgo: 3 },
]

for (const p of posts) {
  await insertOne('posts', {
    profile_id: p.profileId,
    type: 'text',
    content: p.content,
    media_urls: [],
    project_id: p.projectId,
    is_draft: false,
    published_at: daysAgo(p.daysAgo),
  }, p.content.slice(0, 30))
}

console.log('--- Criando parceiros ---')

const carlos = await createPersonAccount({
  email: `carlos.mendes${DOMAIN}`,
  fullName: 'Carlos Mendes',
  updates: {
    username: 'carlos_mendes',
    display_name: 'Carlos Mendes',
    bio: 'Apoio missões na África e América Latina há alguns anos.',
  },
})
console.log('✓ Carlos Mendes')

const beatriz = await createPersonAccount({
  email: `beatriz.santos${DOMAIN}`,
  fullName: 'Beatriz Santos',
  updates: {
    username: 'beatriz_santos',
    display_name: 'Beatriz Santos',
    bio: 'Parceira de oração de algumas missões que acompanho de perto.',
  },
})
console.log('✓ Beatriz Santos')

const rafael = await createPersonAccount({
  email: `rafael.lima${DOMAIN}`,
  fullName: 'Rafael Lima',
  updates: {
    username: 'rafael_lima',
    display_name: 'Rafael Lima',
    bio: 'Apoiando projetos de educação e evangelismo.',
  },
})
console.log('✓ Rafael Lima')

const camila = await createPersonAccount({
  email: `camila.rocha${DOMAIN}`,
  fullName: 'Camila Rocha',
  updates: {
    username: 'camila_rocha',
    display_name: 'Camila Rocha',
  },
})
console.log('✓ Camila Rocha (conta zerada, sem relações)')

console.log('--- Seguir ---')

const follows = [
  [carlos, ana], [carlos, joaoMarina], [carlos, institutoNovaVida],
  [beatriz, joaoMarina], [beatriz, institutoNovaVida],
  [rafael, ana],
]
for (const [partner, missionary] of follows) {
  await insertOne('follows', {
    follower_user_id: partner.userId,
    profile_id: missionary.profileId,
  }, `${partner.profileId} segue ${missionary.profileId}`)
}

console.log('--- Parcerias formais ---')

const carlosPartnerOfAna = await insertOne('partners', {
  profile_id: ana.profileId,
  user_id: carlos.userId,
  name: 'Carlos Mendes',
  email: 'carlos.mendes@seed.goguide.test',
  type: 'financial',
  joined_at: daysAgo(25),
}, 'Carlos parceiro de Ana')

const beatrizPartnerOfInstituto = await insertOne('partners', {
  profile_id: institutoNovaVida.profileId,
  user_id: beatriz.userId,
  name: 'Beatriz Santos',
  email: 'beatriz.santos@seed.goguide.test',
  type: 'prayer',
  joined_at: daysAgo(18),
}, 'Beatriz parceira do Instituto')

const rafaelPartnerOfJoaoMarina = await insertOne('partners', {
  profile_id: joaoMarina.profileId,
  user_id: rafael.userId,
  name: 'Rafael Lima',
  email: 'rafael.lima@seed.goguide.test',
  type: 'both',
  joined_at: daysAgo(12),
}, 'Rafael parceiro de João & Marina')

console.log('--- Doações confirmadas (com transação real) ---')

async function confirmedPledge({ missionary, partner, partnerRow, amount, daysAgoValue, highlight, description }) {
  const transaction = await insertOne('transactions', {
    account_id: missionary.account.id,
    profile_id: missionary.profileId,
    type: 'income',
    amount,
    currency: 'BRL',
    description,
    partner_id: partnerRow?.id ?? null,
    highlight_id: highlight?.id ?? null,
    date: daysAgoValue !== undefined ? daysAgo(daysAgoValue).slice(0, 10) : undefined,
  }, description)

  await insertOne('pledges', {
    highlight_id: highlight?.id ?? null,
    profile_id: missionary.profileId,
    partner_id: partnerRow?.id ?? null,
    reporter_user_id: partner.userId,
    reporter_name: partner.displayName,
    reported_amount: amount,
    currency: 'BRL',
    payment_method: 'pix',
    reported_at: daysAgo(daysAgoValue),
    status: 'confirmed',
    confirmed_transaction_id: transaction.id,
  }, description)
}

carlos.displayName = 'Carlos Mendes'
rafael.displayName = 'Rafael Lima'

await confirmedPledge({
  missionary: ana, partner: carlos, partnerRow: carlosPartnerOfAna,
  amount: 500, daysAgoValue: 20, highlight: anaProjectEvangelismo,
  description: 'Doação de Carlos Mendes — Evangelismo em Kibera',
})

await confirmedPledge({
  missionary: ana, partner: rafael, partnerRow: null,
  amount: 300, daysAgoValue: 10, highlight: null,
  description: 'Doação avulsa de Rafael Lima',
})

await confirmedPledge({
  missionary: joaoMarina, partner: rafael, partnerRow: rafaelPartnerOfJoaoMarina,
  amount: 800, daysAgoValue: 5, highlight: joaoProjectEscola,
  description: 'Doação de Rafael Lima — Escolinha Esperança',
})

console.log('--- Doação pendente ---')

await insertOne('pledges', {
  highlight_id: null,
  profile_id: institutoNovaVida.profileId,
  partner_id: null,
  reporter_user_id: rafael.userId,
  reporter_name: 'Rafael Lima',
  reported_amount: 200,
  currency: 'BRL',
  payment_method: 'pix',
  reported_at: daysAgo(2),
  status: 'pending',
}, 'Pledge pendente de Rafael pro Instituto')

console.log('--- Parceria recorrente ---')

await insertOne('recurring_pledges', {
  profile_id: ana.profileId,
  partner_id: carlosPartnerOfAna.id,
  reporter_user_id: carlos.userId,
  amount: 150,
  currency: 'BRL',
  payment_method: 'pix',
  highlight_id: null,
  reminder_opt_in: true,
  next_reminder_at: daysAgo(-30).slice(0, 10),
  status: 'active',
}, 'Recorrência de Carlos para Ana')

console.log('--- Gravando manifesto ---')

const roster = [
  { persona: 'Ana Ferreira', role: 'missionary', email: `ana.ferreira${DOMAIN}`, username: 'ana_ferreira' },
  { persona: 'João & Marina Costa', role: 'missionary', email: `joao.marina${DOMAIN}`, username: 'joao_marina' },
  { persona: 'Instituto Nova Vida', role: 'missionary', email: `instituto.novavida${DOMAIN}`, username: 'instituto_novavida' },
  { persona: 'Carlos Mendes', role: 'partner', email: `carlos.mendes${DOMAIN}`, username: 'carlos_mendes' },
  { persona: 'Beatriz Santos', role: 'partner', email: `beatriz.santos${DOMAIN}`, username: 'beatriz_santos' },
  { persona: 'Rafael Lima', role: 'partner', email: `rafael.lima${DOMAIN}`, username: 'rafael_lima' },
  { persona: 'Camila Rocha', role: 'partner', email: `camila.rocha${DOMAIN}`, username: 'camila_rocha' },
].map((r) => ({ ...r, password: PASSWORD }))

await writeFile(OUTPUT_PATH, JSON.stringify(roster, null, 2))

console.log('\n=== Contas criadas ===')
console.table(roster.map(({ persona, role, email, username }) => ({ persona, role, email, username })))
console.log(`Senha de todas: ${PASSWORD}`)
console.log(`Lista salva em: ${OUTPUT_PATH}`)
console.log('Para apagar tudo depois: node --env-file=.env.local scripts/delete-test-accounts.mjs')
