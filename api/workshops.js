const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
)

const WORKSHOP_STATUSES = new Set([
  'draft',
  'planned',
  'open',
  'full',
  'completed',
  'cancelled'
])

const PARTICIPANT_STATUSES = new Set([
  'interested',
  'invited',
  'confirmed',
  'paid',
  'attended',
  'cancelled',
  'no_show'
])

const PAYMENT_STATUSES = new Set(['unpaid', 'pending', 'paid', 'refunded'])

const COUNTABLE_CONFIRMED = new Set(['confirmed', 'paid'])

function safeString(v, fallback = '') {
  const s = v == null ? '' : String(v).trim()
  return s || fallback
}

function parseJsonBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {}
}

async function resolveProjectIdByName(projectName) {
  const name = safeString(projectName, 'LaLampe') || 'LaLampe'
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .ilike('name', name)
    .limit(8)

  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  const exact = rows.find((r) => String(r.name || '').trim().toLowerCase() === name.toLowerCase())
  return exact?.id || rows[0]?.id || null
}

async function recomputeWorkshopCapacity(workshopId) {
  const { data: w, error: wErr } = await supabase
    .from('workshops')
    .select('id, max_participants, status')
    .eq('id', workshopId)
    .maybeSingle()

  if (wErr || !w) return

  if (['completed', 'cancelled', 'draft'].includes(w.status)) return

  const { data: parts, error: pErr } = await supabase
    .from('workshop_participants')
    .select('participant_status')
    .eq('workshop_id', workshopId)

  if (pErr) return

  let confirmed = 0
  for (const row of parts || []) {
    if (COUNTABLE_CONFIRMED.has(String(row.participant_status || ''))) confirmed += 1
  }

  const maxP = Number(w.max_participants) || 0
  let nextStatus = w.status

  if (maxP > 0 && confirmed >= maxP) {
    nextStatus = 'full'
  } else if (w.status === 'full' && confirmed < maxP) {
    nextStatus = 'open'
  } else {
    return
  }

  if (nextStatus !== w.status) {
    await supabase
      .from('workshops')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', workshopId)
  }
}

async function handleGet(req, res) {
  const id = safeString(req.query?.id)
  if (id) {
    const { data: workshop, error: wError } = await supabase
      .from('workshops')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (wError) throw wError
    if (!workshop) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const { data: participants, error: pError } = await supabase
      .from('workshop_participants')
      .select('*')
      .eq('workshop_id', id)
      .order('created_at', { ascending: true })

    if (pError) throw pError

    res.status(200).json({ workshop, participants: participants || [] })
    return
  }

  const projectId = safeString(req.query?.project_id)
  let pid = projectId
  if (!pid) {
    pid = await resolveProjectIdByName(req.query?.project_name)
  }

  if (!pid) {
    res.status(200).json({ workshops: [], project_id: null })
    return
  }

  const { data: workshops, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('project_id', pid)
    .order('workshop_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error

  const list = Array.isArray(workshops) ? workshops : []
  const ids = list.map((w) => w.id)
  let byWorkshop = new Map()

  if (ids.length) {
    const { data: parts, error: pe } = await supabase
      .from('workshop_participants')
      .select('workshop_id, participant_status')
      .in('workshop_id', ids)

    if (!pe && Array.isArray(parts)) {
      for (const row of parts) {
        const wid = row.workshop_id
        if (!byWorkshop.has(wid)) {
          byWorkshop.set(wid, { total: 0, confirmed: 0 })
        }
        const agg = byWorkshop.get(wid)
        agg.total += 1
        if (COUNTABLE_CONFIRMED.has(String(row.participant_status || ''))) agg.confirmed += 1
      }
    }
  }

  const enriched = list.map((w) => {
    const agg = byWorkshop.get(w.id) || { total: 0, confirmed: 0 }
    return {
      ...w,
      participant_total: agg.total,
      participant_confirmed: agg.confirmed
    }
  })

  res.status(200).json({ workshops: enriched, project_id: pid })
}

async function handlePost(req, res) {
  const body = parseJsonBody(req)
  const op = safeString(body.op).toLowerCase()

  if (op === 'add_participant') {
    const workshopId = safeString(body.workshop_id)
    const name = safeString(body.name)
    if (!workshopId || !name) {
      res.status(400).json({ error: 'missing_workshop_id_or_name' })
      return
    }

    const ps = safeString(body.participant_status, 'interested')
    const pay = safeString(body.payment_status, 'unpaid')
    if (!PARTICIPANT_STATUSES.has(ps)) {
      res.status(400).json({ error: 'invalid_participant_status' })
      return
    }
    if (!PAYMENT_STATUSES.has(pay)) {
      res.status(400).json({ error: 'invalid_payment_status' })
      return
    }

    const now = new Date().toISOString()
    const row = {
      workshop_id: workshopId,
      contact_id: body.contact_id || null,
      name,
      email: safeString(body.email) || null,
      phone: safeString(body.phone) || null,
      participant_status: ps,
      payment_status: pay,
      object_description: safeString(body.object_description) || null,
      notes: safeString(body.notes) || null,
      created_at: now,
      updated_at: now
    }

    const { data, error } = await supabase.from('workshop_participants').insert([row]).select().single()
    if (error) throw error

    await recomputeWorkshopCapacity(workshopId)

    res.status(200).json({ ok: true, participant: data })
    return
  }

  if (op && op !== 'create_workshop') {
    res.status(400).json({ error: 'unknown_op', op })
    return
  }

  const projectName = safeString(body.project_name, 'LaLampe') || 'LaLampe'
  const projectId = safeString(body.project_id) || (await resolveProjectIdByName(projectName))

  if (!projectId) {
    res.status(400).json({ error: 'project_not_found', hint: 'Create project LaLampe or pass project_id' })
    return
  }

  const title = safeString(body.title)
  const workshopDate = safeString(body.workshop_date)
  if (!title || !workshopDate) {
    res.status(400).json({ error: 'missing_title_or_workshop_date' })
    return
  }

  const status = safeString(body.status, 'draft')
  if (!WORKSHOP_STATUSES.has(status)) {
    res.status(400).json({ error: 'invalid_workshop_status' })
    return
  }

  const now = new Date().toISOString()
  const insert = {
    project_id: projectId,
    title,
    workshop_type: safeString(body.workshop_type, 'lalampe') || 'lalampe',
    workshop_date: workshopDate,
    start_time: safeString(body.start_time) || null,
    end_time: safeString(body.end_time) || null,
    location: safeString(body.location) || null,
    max_participants: Math.max(1, Number(body.max_participants) || 4),
    status,
    notes: safeString(body.notes) || null,
    created_at: now,
    updated_at: now
  }

  const { data, error } = await supabase.from('workshops').insert([insert]).select().single()
  if (error) throw error

  res.status(200).json({ ok: true, workshop: data })
}

async function handlePatch(req, res) {
  const body = parseJsonBody(req)
  const op = safeString(body.op).toLowerCase()

  if (op === 'update_participant') {
    const id = safeString(body.id)
    if (!id) {
      res.status(400).json({ error: 'missing_id' })
      return
    }

    const rawFields = body.fields && typeof body.fields === 'object' ? body.fields : body
    const fields = { ...rawFields }
    delete fields.op
    delete fields.id
    const patch = { updated_at: new Date().toISOString() }

    if (fields.name != null) patch.name = safeString(fields.name)
    if (fields.email != null) patch.email = safeString(fields.email) || null
    if (fields.phone != null) patch.phone = safeString(fields.phone) || null
    if (fields.object_description != null) {
      patch.object_description = safeString(fields.object_description) || null
    }
    if (fields.notes != null) patch.notes = safeString(fields.notes) || null
    if (fields.contact_id !== undefined) patch.contact_id = fields.contact_id || null

    if (fields.participant_status != null) {
      const ps = safeString(fields.participant_status)
      if (!PARTICIPANT_STATUSES.has(ps)) {
        res.status(400).json({ error: 'invalid_participant_status' })
        return
      }
      patch.participant_status = ps
    }
    if (fields.payment_status != null) {
      const pay = safeString(fields.payment_status)
      if (!PAYMENT_STATUSES.has(pay)) {
        res.status(400).json({ error: 'invalid_payment_status' })
        return
      }
      patch.payment_status = pay
    }

    const { data: existing, error: exErr } = await supabase
      .from('workshop_participants')
      .select('workshop_id')
      .eq('id', id)
      .maybeSingle()

    if (exErr) throw exErr
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const { data, error } = await supabase
      .from('workshop_participants')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await recomputeWorkshopCapacity(existing.workshop_id)

    res.status(200).json({ ok: true, participant: data })
    return
  }

  if (op && op !== 'update_workshop') {
    res.status(400).json({ error: 'unknown_op', op })
    return
  }

  const id = safeString(body.id)
  if (!id) {
    res.status(400).json({ error: 'missing_id' })
    return
  }

  const rawFields = body.fields && typeof body.fields === 'object' ? body.fields : body
  const fields = { ...rawFields }
  delete fields.op
  delete fields.id
  const patch = { updated_at: new Date().toISOString() }

  if (fields.title != null) patch.title = safeString(fields.title)
  if (fields.workshop_type != null) patch.workshop_type = safeString(fields.workshop_type) || 'lalampe'
  if (fields.workshop_date != null) patch.workshop_date = safeString(fields.workshop_date)
  if (fields.start_time !== undefined) patch.start_time = safeString(fields.start_time) || null
  if (fields.end_time !== undefined) patch.end_time = safeString(fields.end_time) || null
  if (fields.location !== undefined) patch.location = safeString(fields.location) || null
  if (fields.max_participants != null) {
    patch.max_participants = Math.max(1, Number(fields.max_participants) || 4)
  }
  if (fields.notes !== undefined) patch.notes = safeString(fields.notes) || null

  if (fields.status != null) {
    const st = safeString(fields.status)
    if (!WORKSHOP_STATUSES.has(st)) {
      res.status(400).json({ error: 'invalid_workshop_status' })
      return
    }
    patch.status = st
  }

  const { data, error } = await supabase.from('workshops').update(patch).eq('id', id).select().single()

  if (error) throw error
  if (!data) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  await recomputeWorkshopCapacity(id)

  res.status(200).json({ ok: true, workshop: data })
}

async function handleDelete(req, res) {
  const participantId = safeString(req.query?.participant_id)
  if (participantId) {
    const { data: existing, error: exErr } = await supabase
      .from('workshop_participants')
      .select('id, workshop_id')
      .eq('id', participantId)
      .maybeSingle()

    if (exErr) throw exErr
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const { error } = await supabase.from('workshop_participants').delete().eq('id', participantId)
    if (error) throw error

    await recomputeWorkshopCapacity(existing.workshop_id)

    res.status(200).json({ ok: true, deleted: 'participant', id: participantId })
    return
  }

  const workshopId = safeString(req.query?.id)
  if (!workshopId) {
    res.status(400).json({ error: 'missing_id_or_participant_id' })
    return
  }

  const { error } = await supabase.from('workshops').delete().eq('id', workshopId)
  if (error) throw error

  res.status(200).json({ ok: true, deleted: 'workshop', id: workshopId })
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      await handleGet(req, res)
      return
    }

    if (req.method === 'POST') {
      await handlePost(req, res)
      return
    }

    if (req.method === 'PATCH') {
      await handlePatch(req, res)
      return
    }

    if (req.method === 'DELETE') {
      await handleDelete(req, res)
      return
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (err) {
    res.status(500).json({
      error: 'server_error',
      details: err.message || String(err)
    })
  }
}
