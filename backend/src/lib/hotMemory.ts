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

  getActiveInterviewState(): string {
    return this.state.activeInterviewState
  }

  /** Reset khi bắt đầu phiên phỏng vấn mới. */
  reset(): void {
    this.state = {
      candidateSummary: this.state.candidateSummary, // giữ lại CV summary
      activeInterviewState: '',
    }
    console.log('🧠 Hot Memory Reset Done')
  }

  /** Xoá toàn bộ (khi user đổi CV). */
  resetAll(): void {
    this.state = {
      candidateSummary: '',
      activeInterviewState: '',
    }
    console.log('🧠 Hot Memory Full Reset Done')
  }
}

export const hotMemory = new HotMemoryManager()
