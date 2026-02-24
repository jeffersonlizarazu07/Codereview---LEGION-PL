export type Role = 'user' | 'assistant'
export type Mode = 'qa' | 'review' | 'unknown'

export interface Message {
  id: string
  role: Role
  content: string
  mode?: Mode
  isStreaming?: boolean
}

export interface Branch {
  name: string
  pr: string
}