import { createError } from 'h3'

// Fly Machines API client
const FLY_API_BASE = 'https://api.machines.dev'

interface FlyMachine {
  id: string
  name: string
  state: 'started' | 'stopped' | 'suspended' | 'created' | 'destroyed'
  region: string
  private_ip: string
  config: any
}

interface MachineConfig {
  image: string
  guest: {
    cpu_kind: string
    cpus: number
    memory_mb: number
  }
  env?: Record<string, string>
  services?: any[]
}

export class FlyMachinesClient {
  private apiToken: string
  private appName: string

  constructor(apiToken: string, appName: string) {
    this.apiToken = apiToken
    this.appName = appName
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${FLY_API_BASE}${path}`
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw createError({
        statusCode: response.status,
        statusMessage: `Fly API error: ${errorText}`
      })
    }

    return response.json()
  }

  // List machines in a region
  async listMachines(region: string): Promise<FlyMachine[]> {
    const response = await this.request<{ machines: FlyMachine[] }>(
      `/v1/apps/${this.appName}/machines?region=${region}`
    )
    return response.machines || []
  }

  // Get a specific machine
  async getMachine(machineId: string): Promise<FlyMachine> {
    return this.request<FlyMachine>(`/v1/apps/${this.appName}/machines/${machineId}`)
  }

  // Start a machine
  async startMachine(machineId: string): Promise<any> {
    return this.request(`/v1/apps/${this.appName}/machines/${machineId}/start`, {
      method: 'POST'
    })
  }

  // Stop a machine
  async stopMachine(machineId: string, timeout?: number): Promise<any> {
    const body: any = {}
    if (timeout) {
      body.timeout = timeout
    }
    
    return this.request(`/v1/apps/${this.appName}/machines/${machineId}/stop`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // Wait for machine to reach a specific state
  async waitForMachineState(
    machineId: string, 
    state: 'started' | 'stopped' | 'suspended' | 'destroyed',
    timeout: number = 60
  ): Promise<boolean> {
    const response = await this.request<{ ok: boolean }>(
      `/v1/apps/${this.appName}/machines/${machineId}/wait?state=${state}&timeout=${timeout}`
    )
    return response.ok
  }

  // Create a new machine in a region
  async createMachine(region: string, config: MachineConfig): Promise<FlyMachine> {
    const body = {
      region,
      config
    }
    
    return this.request<FlyMachine>(`/v1/apps/${this.appName}/machines`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // Find or create a machine in a region
  async ensureMachineInRegion(region: string): Promise<FlyMachine> {
    // First try to find an existing machine in the region
    const machines = await this.listMachines(region)
    
    // Prefer a stopped machine that we can start
    const stoppedMachine = machines.find(m => m.state === 'stopped')
    if (stoppedMachine) {
      return stoppedMachine
    }
    
    // Prefer any existing machine
    const existingMachine = machines.find(m => m.state !== 'destroyed')
    if (existingMachine) {
      return existingMachine
    }
    
    // If no machines exist, we need to create one
    // Get a template config from any existing machine in the app
    const allMachines = await this.listMachines('')
    if (allMachines.length > 0) {
      const templateMachine = allMachines[0]
      const newConfig = {
        ...templateMachine.config,
        // Reset any machine-specific fields
        metadata: {
          ...(templateMachine.config.metadata || {}),
          'fly_platform_version': 'v2',
          'fly_process_group': 'app'
        }
      }
      
      return this.createMachine(region, newConfig)
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `No template machine found to create new machine in region ${region}`
    })
  }

  // Warm up a machine in a region
  async warmUpMachine(region: string): Promise<FlyMachine> {
    const machine = await this.ensureMachineInRegion(region)
    
    // If machine is already started, return it
    if (machine.state === 'started') {
      return machine
    }
    
    // Start the machine
    await this.startMachine(machine.id)
    
    // Wait for it to be started (with timeout)
    try {
      await this.waitForMachineState(machine.id, 'started', 60)
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Machine ${machine.id} in region ${region} failed to start: ${error}`
      })
    }
    
    // Return the updated machine info
    return this.getMachine(machine.id)
  }

  // Scale down a machine in a region
  async scaleDownMachine(region: string): Promise<void> {
    const machines = await this.listMachines(region)
    const runningMachines = machines.filter(m => m.state === 'started')
    
    // Stop all running machines in the region
    await Promise.all(runningMachines.map(async (machine) => {
      try {
        await this.stopMachine(machine.id, 30) // 30 second timeout
        await this.waitForMachineState(machine.id, 'stopped', 60)
      } catch (error) {
        console.warn(`Failed to stop machine ${machine.id} in region ${region}:`, error)
        // Continue with other machines
      }
    }))
  }
}