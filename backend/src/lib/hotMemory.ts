interface HotMemoryState {
  candidateSummary: string
  activeInterviewState: string
}

class HotMemoryManager {
  private state: HotMemoryState = {
    candidateSummary: '',
    activeInterviewState: '',
  }

  setCandidateSummary(summary: string): void {
    this.state.candidateSummary = summary.trim()
  }

  getCandidateSummary(): string {
    return this.state.candidateSummary
  }

  setActiveInterviewState(state: string): void {
    this.state.activeInterviewState = state.trim()
  }
}

export const hotMemory = new HotMemoryManager()
