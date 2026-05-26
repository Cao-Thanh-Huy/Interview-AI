interface HotMemoryState {
  candidateSummary: string
  jdSummary: string
  currentTopic: string | null
  recentTopics: string[]
  activeInterviewState: string
}

class HotMemoryManager {
  private state: HotMemoryState = {
    candidateSummary: '',
    jdSummary: '',
    currentTopic: null,
    recentTopics: [],
    activeInterviewState: '',
  }

  setCandidateSummary(summary: string): void {
    this.state.candidateSummary = summary.trim()
  }

  getCandidateSummary(): string {
    return this.state.candidateSummary
  }

  setJdSummary(summary: string): void {
    this.state.jdSummary = summary.trim()
  }

  getJdSummary(): string {
    return this.state.jdSummary
  }

  setCurrentTopic(topic: string | null): void {
    this.state.currentTopic = topic
    if (topic && !this.state.recentTopics.includes(topic)) {
      this.state.recentTopics.push(topic)
      // Giới hạn tối đa 10 topics gần nhất để tránh phình to RAM
      if (this.state.recentTopics.length > 10) {
        this.state.recentTopics.shift()
      }
    }
  }

  getCurrentTopic(): string | null {
    return this.state.currentTopic
  }

  getRecentTopics(): string[] {
    return this.state.recentTopics
  }

  setActiveInterviewState(state: string): void {
    this.state.activeInterviewState = state.trim()
  }

  getActiveInterviewState(): string {
    return this.state.activeInterviewState
  }

  /**
   * Reset toàn bộ trạng thái bộ nhớ RAM khi bắt đầu phiên phỏng vấn mới.
   */
  reset(): void {
    this.state = {
      candidateSummary: '',
      jdSummary: '',
      currentTopic: null,
      recentTopics: [],
      activeInterviewState: '',
    }
    console.log('🧠 Hot Memory Reset Done')
  }

  /**
   * Xuất compact context dưới dạng markdown cực kỳ tối ưu cho Prompt Composer.
   */
  getCompactContextMarkdown(): string {
    const lines: string[] = []
    
    if (this.state.candidateSummary) {
      lines.push(`### Candidate Profile:\n${this.state.candidateSummary}`)
    }
    
    if (this.state.jdSummary) {
      lines.push(`### Job Description Summary:\n${this.state.jdSummary}`)
    }
    
    if (this.state.currentTopic) {
      lines.push(`### Current Discussion Topic: ${this.state.currentTopic}`)
    }

    if (this.state.recentTopics.length > 0) {
      lines.push(`### Recent Context Topics: ${this.state.recentTopics.join(', ')}`)
    }

    return lines.join('\n\n')
  }
}

export const hotMemory = new HotMemoryManager()
