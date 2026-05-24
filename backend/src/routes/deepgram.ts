import { Hono } from 'hono'
import { createClient } from '@deepgram/sdk'

export const deepgramRouter = new Hono()

deepgramRouter.get('/', async (c) => {
  const apiKey = (process.env.DEEPGRAM_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()

  if (!apiKey) {
    return c.json({ error: 'DEEPGRAM_API_KEY is not configured' }, 400)
  }

  const dg = createClient(apiKey)

  try {
    const { result, error } = await dg.manage.getProjects()

    if (error || !result?.projects[0]) {
      return c.json({ key: apiKey })
    }

    const project = result.projects[0]

    const { result: keyResult, error: keyError } = await dg.manage.createProjectKey(
      project.project_id,
      {
        comment: 'interview-ai-temp',
        scopes: ['usage:write'],
        tags: ['interview-ai'],
        time_to_live_in_seconds: 60,
      },
    )

    if (keyError) return c.json({ key: apiKey })

    return c.json(keyResult)
  } catch {
    // Fallback: return the raw API key for direct browser use
    return c.json({ key: apiKey })
  }
})
