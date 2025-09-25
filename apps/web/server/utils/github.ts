interface WorkflowInputs {
  regions?: string;
  runs?: string;
  label?: string;
  callback_url?: string;
}

export class GitHubClient {
  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly baseUrl: string;

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = 'https://api.github.com';
  }

  async triggerWorkflow(workflowId: string, ref: string, inputs: WorkflowInputs): Promise<void> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref,
        inputs,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger workflow: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  async getWorkflowRuns(workflowId: string, limit: number = 10): Promise<any[]> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/runs?per_page=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get workflow runs: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.workflow_runs;
  }

  async getWorkflowRun(runId: number): Promise<any> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/actions/runs/${runId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get workflow run: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }
}