interface HotMemoryState {
  candidateSummary: string
  sessionSummary: string
}

class HotMemoryManager {
  private state: HotMemoryState = {
    candidateSummary: '',
    sessionSummary: '',
  }

  setCandidateSummary(summary: string): void {
    this.state.candidateSummary = summary.trim()
  }

  getCandidateSummary(): string {
    return this.state.candidateSummary
  }

  setSessionSummary(summary: string): void {
    this.state.sessionSummary = summary.trim()
  }

  getSessionSummary(): string {
    return this.state.sessionSummary
  }
}

export const hotMemory = new HotMemoryManager()
