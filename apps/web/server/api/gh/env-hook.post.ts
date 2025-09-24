import { defineEventHandler, getRequestHeader, setResponseStatus, readRawBody } from 'h3'
import { verifyGitHubSignature } from '../../utils/crypto'
import { createAppJWT, createInstallationToken, approveViaCallback, approvePendingDeploymentFallback } from '../../utils/github'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig()
  const webhookSecret = cfg.github?.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || ''
  const appId = cfg.github?.appId || process.env.GITHUB_APP_ID || ''
  const defaultInstId = cfg.github?.defaultInstallationId || process.env.GITHUB_APP_INSTALLATION_ID || ''
  const privateKey = (cfg.github?.privateKey || process.env.GITHUB_APP_PRIVATE_KEY || '').trim()
  const runnerHost = cfg.benchmarkRunnerHost || process.env.BENCHMARK_RUNNER_HOST || ''

  const ghEvent = getRequestHeader(event, 'x-github-event') || ''
  const sig = getRequestHeader(event, 'x-hub-signature-256') || ''

  const rawStr = await readRawBody(event, 'utf8') || ''
  const rawBytes = new TextEncoder().encode(rawStr)

  const okSig = await verifyGitHubSignature(rawBytes, sig, webhookSecret)
  if (!okSig) {
    setResponseStatus(event, 401)
    return { error: 'invalid signature' }
  }

  if (ghEvent !== 'deployment_protection_rule') {
    setResponseStatus(event, 202)
    return { ok: true, note: `ignored event ${ghEvent}` }
  }

  const payload = rawStr ? JSON.parse(rawStr) : {}
  if (payload.action !== 'requested') {
    setResponseStatus(event, 202)
    return { ok: true, note: `ignored action ${payload.action}` }
  }

  const envName: string = payload.environment?.name || payload.environment || ''
  const region = (envName.split('-')[1] || '').trim() || 'iad'

  const healthy = await waitForHealth(runnerHost, region, 180_000, 5_000)
  const state: 'approved' | 'rejected' = healthy ? 'approved' : 'rejected'
  const comment = healthy ? `Healthy in region ${region}` : `Timed out waiting for health in ${region}`

  const installationId = String(payload.installation?.id || defaultInstId || '')
  if (!appId || !privateKey || !installationId) {
    setResponseStatus(event, 500)
    return { error: 'missing app configuration' }
  }

  try {
    const appJwt = await createAppJWT(appId, privateKey)
    const instToken = await createInstallationToken(installationId, appJwt)

    const callbackUrl: string | undefined = payload.deployment_callback_url
    if (callbackUrl) {
      await approveViaCallback(callbackUrl, instToken, state, comment)
    } else if (payload.workflow_run?.id && payload.repository?.full_name) {
      await approvePendingDeploymentFallback(payload.repository.full_name, payload.workflow_run.id, envName, instToken, state, comment)
    } else {
      throw new Error('No callback or fallback information to approve deployment')
    }

    return { ok: true, state, region }
  } catch (e: any) {
    setResponseStatus(event, 500)
    return { error: 'approval failed', detail: String(e?.message || e) }
  }
})

async function waitForHealth(host: string, region: string, timeoutMs = 180000, intervalMs = 5000) {
  if (!host) return false
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(`https://${host}/healthz`, {
        headers: { 'fly-prefer-region': region },
        signal: ctrl.signal
      })
      clearTimeout(t)
      if (res.ok) return true
    } catch { }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}
