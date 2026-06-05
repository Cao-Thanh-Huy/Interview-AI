interface HotMemoryState {
  candidateSummary: string
  sessionSummary: string
  practiceSummary: string
}

class HotMemoryManager {
  private state: HotMemoryState = {
    candidateSummary: '',
    sessionSummary: '',
    practiceSummary: '',
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

  setPracticeSummary(summary: string): void {
    this.state.practiceSummary = summary.trim()
  }

  getPracticeSummary(): string {
    return this.state.practiceSummary
  }

  resetPracticeSummary(): void {
    this.state.practiceSummary = ''
  }
}

export const hotMemory = new HotMemoryManager()
