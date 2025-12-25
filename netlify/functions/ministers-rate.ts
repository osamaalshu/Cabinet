import { createAdminClient } from '../../src/lib/supabase/server'

// Performance thresholds
const THRESHOLDS = {
  WARNING_AVG: 2.5,        // Average below this over 5+ sessions = warning
  PROBATION_WARNINGS: 2,   // 2 warnings = probation
  SUSPENSION_AVG: 2.0,     // Below this while on probation = suspension
  CONSECUTIVE_LOW: 3,      // 3 consecutive ratings of 1-2 = suspension
  MIN_SESSIONS: 5,         // Minimum sessions before performance review
}

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const authHeader = event.headers.authorization
    if (!authHeader) return { statusCode: 401, body: 'Unauthorized' }

    const token = authHeader.replace('Bearer ', '')
    const supabase = await createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return { statusCode: 401, body: 'Unauthorized' }

    const { brief_id, ratings } = JSON.parse(event.body)
    // ratings: [{ minister_id, rating (1-5), feedback?, was_helpful? }]

    const results = []

    for (const r of ratings) {
      // Insert rating
      await supabase.from('minister_ratings').upsert({
        cabinet_member_id: r.minister_id,
        brief_id,
        rating: r.rating,
        feedback: r.feedback || null,
        was_helpful: r.was_helpful ?? true,
      })

      // Get minister and update stats
      const { data: minister } = await supabase
        .from('cabinet_members')
        .select('*')
        .eq('id', r.minister_id)
        .single()

      if (!minister) continue

      const newTotalSum = (minister.total_rating_sum || 0) + r.rating
      const newTotalCount = (minister.total_rating_count || 0) + 1
      const newAverage = newTotalSum / newTotalCount

      // Track consecutive low ratings
      let consecutiveLow = minister.consecutive_low_ratings || 0
      if (r.rating <= 2) {
        consecutiveLow++
      } else {
        consecutiveLow = 0
      }

      // Determine status changes
      let newStatus = minister.status || 'active'
      let warnings = minister.warnings || 0
      let statusChange = null

      // Check for status changes (only after minimum sessions)
      if (newTotalCount >= THRESHOLDS.MIN_SESSIONS) {
        // Consecutive low ratings check
        if (consecutiveLow >= THRESHOLDS.CONSECUTIVE_LOW && newStatus !== 'suspended') {
          statusChange = { from: newStatus, to: 'suspended', reason: `${consecutiveLow} consecutive low ratings` }
          newStatus = 'suspended'
        }
        // Average rating check
        else if (newAverage < THRESHOLDS.WARNING_AVG && newStatus === 'active') {
          warnings++
          if (warnings >= THRESHOLDS.PROBATION_WARNINGS) {
            statusChange = { from: newStatus, to: 'probation', reason: `Average rating ${newAverage.toFixed(1)} with ${warnings} warnings` }
            newStatus = 'probation'
          } else {
            statusChange = { from: newStatus, to: newStatus, reason: `Warning issued - average rating ${newAverage.toFixed(1)}`, event: 'warning' }
          }
        }
        // Probation check
        else if (newStatus === 'probation' && newAverage < THRESHOLDS.SUSPENSION_AVG) {
          statusChange = { from: newStatus, to: 'suspended', reason: `Average ${newAverage.toFixed(1)} while on probation` }
          newStatus = 'suspended'
        }
        // Recovery check
        else if (newStatus === 'probation' && newAverage >= THRESHOLDS.WARNING_AVG) {
          statusChange = { from: newStatus, to: 'active', reason: 'Performance improved' }
          newStatus = 'active'
          warnings = Math.max(0, warnings - 1)
        }
      }

      // Update minister
      await supabase.from('cabinet_members').update({
        total_rating_sum: newTotalSum,
        total_rating_count: newTotalCount,
        consecutive_low_ratings: consecutiveLow,
        warnings,
        status: newStatus,
        last_rating_date: new Date().toISOString(),
      }).eq('id', r.minister_id)

      // Log status change
      if (statusChange) {
        await supabase.from('minister_performance_log').insert({
          cabinet_member_id: r.minister_id,
          event_type: statusChange.event || statusChange.to,
          reason: statusChange.reason,
          old_status: statusChange.from,
          new_status: statusChange.to,
        })
      }

      results.push({
        minister_id: r.minister_id,
        name: minister.name,
        new_average: newAverage.toFixed(2),
        status: newStatus,
        status_change: statusChange,
        warnings,
        sessions: newTotalCount,
      })
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, results }),
    }
  } catch (error: any) {
    console.error('Rating error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

