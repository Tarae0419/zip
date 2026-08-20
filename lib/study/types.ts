export type InterviewQuestion = { question: string; intent: string; evidence: string }

export type StudyCourseRecord = {
  courseId: string
  courseName: string
  semester: string
  objective: string
  weeklyNotes: string
  assignments: string
  exams: string
  careerKeyword: string
  aiSummary: string
  interviewQuestions: InterviewQuestion[]
  generatedAt: string | null
  updatedAt: string
}

export type StudyHubData = { version: 1; records: StudyCourseRecord[] }
