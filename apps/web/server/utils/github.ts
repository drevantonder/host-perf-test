import { importPKCS8, SignJWT } from 'jose'

export async function createAppJWT(appId: string, privateKeyPem: string) {
  const alg = 'RS256'
  const pk = await importPKCS8(privateKeyPem, alg)
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({})
    .setProtectedHeader({ alg })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(appId)
    .sign(pk)
}

export async function createInstallationToken(installationId: string | number, appJwt: string) {
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hosting-perf-test'
    }
  })
  if (!res.ok) throw new Error(`Failed to create installation token: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.token as string
}

export async function approveViaCallback(callbackUrl: string, token: string, state: 'approved' | 'rejected', comment: string) {
  const res = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hosting-perf-test',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ state, comment })
  })
  if (!res.ok) throw new Error(`Callback approval failed: ${res.status} ${await res.text()}`)
}

export async function approvePendingDeploymentFallback(repoFull: string, runId: number, envName: string, token: string, state: 'approved' | 'rejected', comment: string) {
  const [owner, repo] = repoFull.split('/')
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/pending_deployments`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hosting-perf-test',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      environment_names: [envName],
      state,
      comment
    })
  })
  if (!res.ok) throw new Error(`Pending deployment review failed: ${res.status} ${await res.text()}`)
}
