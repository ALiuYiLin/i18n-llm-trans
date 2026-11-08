import type { LlmEnv } from '../types'

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface ChatClient {
  chat(messages: ChatMessage[]): Promise<string>
}

export function createOpenAiChatClient(env: LlmEnv): ChatClient {
  const url = `${env.baseUrl}/chat/completions`

  return {
    async chat(messages) {
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.apiKey}`,
          },
          body: JSON.stringify({
            model: env.model,
            messages,
            temperature: 0,
            ...(env.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: AbortSignal.timeout(env.timeoutMs),
        })
      } catch (error) {
        throw new Error(`LLM request failed: ${(error as Error).message}`)
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`LLM request failed (${response.status}): ${body.slice(0, 300)}`)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new Error('LLM returned invalid JSON')
      }

      const choices = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices
      const content = choices?.[0]?.message?.content
      if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('LLM response has no message content')
      }

      return content
    },
  }
}
