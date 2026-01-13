import { tool } from 'ai'
import { z } from 'zod'

export const fetchTool = tool({
  description:
    'Make HTTP requests to external APIs and websites. Returns the response body as text.',
  parameters: z.object({
    url: z.string().describe('The URL to fetch data from (must start with http:// or https://)'),
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'])
      .describe('HTTP method to use (GET, POST, PUT, DELETE, PATCH, or HEAD)'),
    body: z.string().describe('Request body for POST/PUT/PATCH requests (use empty string "" if not needed)'),
    timeout: z
      .number()
      .describe('Request timeout in milliseconds (recommended: 10000 for 10 seconds)'),
  }),
  execute: async ({ url, method, body, timeout }) => {
    try {
      // Check for internal network requests
      const parsedUrl = new URL(url)
      const hostname = parsedUrl.hostname

      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.')
      ) {
        return 'Error: Requests to internal networks are not allowed for security reasons'
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const options: RequestInit = {
        method,
        signal: controller.signal,
      }

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = body
      }

      const response = await fetch(url, options)
      clearTimeout(timeoutId)

      // Just return the text response
      const text = await response.text()
      return text
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return `Request timed out after ${timeout}ms`
        }
        return `Error: ${error.message}`
      }
      return 'Unknown error during fetch'
    }
  },
})
