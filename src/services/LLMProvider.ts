import { ToolAgentSettings } from "../types/settings";
import { ActionPlan } from "../types/ActionPlan";

export abstract class BaseLLMProvider {
  protected settings: ToolAgentSettings;
  protected currentAbortController: AbortController | null = null;

  constructor(settings: ToolAgentSettings) {
    this.settings = settings;
  }

  abstract generatePlan(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<ActionPlan>;
  abstract generateStreamingPlan(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<ActionPlan>;

  abort(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }
}

export class OpenAIProvider extends BaseLLMProvider {
  private getApiKey(): string {
    return this.settings.llm.openaiApiKey || this.settings.llm.apiKey;
  }

  async generatePlan(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<ActionPlan> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify({
        model: this.settings.llm.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: this.settings.llm.temperature,
        max_tokens: this.settings.llm.maxTokens,
        response_format: { type: "json_object" },
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for error responses
    if (data.error) {
      throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
    }

    // Validate response structure
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error("Invalid OpenAI response: missing choices array");
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Invalid OpenAI response: no message content");
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error("Failed to parse JSON response from OpenAI");
    }
  }

  async generateStreamingPlan(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<ActionPlan> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify({
        model: this.settings.llm.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: this.settings.llm.temperature,
        max_tokens: this.settings.llm.maxTokens,
        stream: true,
        response_format: { type: "json_object" },
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    // Check if response is JSON (error) instead of streaming
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (data.error) {
        throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
      }
      // Shouldn't happen, but handle non-streaming response
      if (data.choices?.[0]?.message?.content) {
        return JSON.parse(data.choices[0].message.content);
      }
      throw new Error("Unexpected non-streaming response from OpenAI");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    if (!reader) {
      throw new Error("Failed to get response reader");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            // Check for error in stream
            if (parsed.error) {
              throw new Error(`OpenAI streaming error: ${parsed.error.message || parsed.error}`);
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onChunk(content);
            }
          } catch (e) {
            // Re-throw if it's our error
            if (e instanceof Error && e.message.includes("OpenAI")) {
              throw e;
            }
            // Skip malformed JSON
          }
        }
      }
    }

    if (!fullContent) {
      throw new Error("No content received from OpenAI streaming response");
    }

    try {
      return JSON.parse(fullContent);
    } catch (error) {
      throw new Error("Failed to parse streaming JSON response from OpenAI");
    }
  }
}

export class AnthropicProvider extends BaseLLMProvider {
  private getEndpoint(): string {
    return this.settings.llm.anthropicEndpoint?.trim() || "https://api.anthropic.com/v1/messages";
  }

  private getApiKey(): string {
    return this.settings.llm.anthropicApiKey || this.settings.llm.apiKey;
  }

  async generatePlan(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<ActionPlan> {
    const response = await fetch(this.getEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.getApiKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.settings.llm.model,
        max_tokens: this.settings.llm.maxTokens,
        temperature: this.settings.llm.temperature,
        messages: [
          { role: "user", content: `${systemPrompt}\n\n${userPrompt}` }
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for proxy/wrapper error responses that return 200 but contain errors
    if (data.success === false || data.error || data.code >= 400) {
      const errorMsg = data.msg || data.error || data.message || "Unknown API error";
      throw new Error(`API error: ${errorMsg}`);
    }

    // Validate Anthropic response structure
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      throw new Error(`Invalid API response structure: missing content array`);
    }

    const content = data.content[0]?.text;
    if (!content) {
      throw new Error(`Invalid API response: no text content in response`);
    }

    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error("Failed to parse JSON response from Anthropic");
    }
  }

  async generateStreamingPlan(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<ActionPlan> {
    const response = await fetch(this.getEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.getApiKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.settings.llm.model,
        max_tokens: this.settings.llm.maxTokens,
        temperature: this.settings.llm.temperature,
        stream: true,
        messages: [
          { role: "user", content: `${systemPrompt}\n\n${userPrompt}` }
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    // Check if response is actually streaming (content-type should include text/event-stream)
    const contentType = response.headers.get("content-type") || "";

    // If response is JSON (not streaming), it might be an error from a proxy
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (data.success === false || data.error || data.code >= 400) {
        const errorMsg = data.msg || data.error || data.message || "Unknown API error";
        throw new Error(`API error: ${errorMsg}`);
      }
      // If it's valid Anthropic JSON response, extract content
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const content = data.content[0]?.text;
        if (content) {
          onChunk(content);
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("No JSON found in response");
          }
          return JSON.parse(jsonMatch[0]);
        }
      }
      throw new Error("Invalid API response structure");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    if (!reader) {
      throw new Error("Failed to get response reader");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            // Check for error events
            if (parsed.type === "error") {
              throw new Error(`Streaming error: ${parsed.error?.message || "Unknown error"}`);
            }
            if (parsed.type === "content_block_delta") {
              const content = parsed.delta.text;
              if (content) {
                fullContent += content;
                onChunk(content);
              }
            }
          } catch (e) {
            // Re-throw if it's our error
            if (e instanceof Error && e.message.startsWith("Streaming error:")) {
              throw e;
            }
            // Skip malformed JSON
          }
        }
      }
    }

    if (!fullContent) {
      throw new Error("No content received from streaming response");
    }

    try {
      // Extract JSON from the response
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in streaming response");
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      if (error instanceof Error && error.message.includes("No JSON found")) {
        throw error;
      }
      throw new Error("Failed to parse streaming JSON response from Anthropic");
    }
  }
}

export class CustomProvider extends BaseLLMProvider {
  private getApiKey(): string {
    return this.settings.llm.customApiKey || this.settings.llm.apiKey;
  }

  async generatePlan(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<ActionPlan> {
    if (!this.settings.llm.customEndpoint) {
      throw new Error("Custom endpoint not configured");
    }

    console.log("[Wand:LLM] CustomProvider.generatePlan START");
    console.log("[Wand:LLM] Endpoint:", this.settings.llm.customEndpoint);
    console.log("[Wand:LLM] Model:", this.settings.llm.model);

    const fetchStart = performance.now();
    console.log("[Wand:LLM] About to fetch...");
    const response = await fetch(this.settings.llm.customEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify({
        model: this.settings.llm.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: this.settings.llm.temperature,
        max_tokens: this.settings.llm.maxTokens,
        response_format: { type: "json_object" },
      }),
      signal,
    });
    console.log("[Wand:LLM] Fetch completed in", performance.now() - fetchStart, "ms");
    console.log("[Wand:LLM] Response status:", response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.statusText}`);
    }

    const jsonStart = performance.now();
    console.log("[Wand:LLM] About to parse response.json()...");
    const data = await response.json();
    console.log("[Wand:LLM] response.json() took", performance.now() - jsonStart, "ms");

    const content = data.choices?.[0]?.message?.content || data.content;
    console.log("[Wand:LLM] Content length:", content?.length || 0);

    try {
      const parseStart = performance.now();
      console.log("[Wand:LLM] About to JSON.parse content...");
      const result = JSON.parse(content);
      console.log("[Wand:LLM] JSON.parse took", performance.now() - parseStart, "ms");
      console.log("[Wand:LLM] CustomProvider.generatePlan COMPLETE");
      return result;
    } catch (error) {
      console.error("[Wand:LLM] JSON.parse failed:", error);
      throw new Error("Failed to parse JSON response from custom endpoint");
    }
  }

  async generateStreamingPlan(
    systemPrompt: string,
    userPrompt: string,
    _onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<ActionPlan> {
    // For custom endpoints, fall back to non-streaming
    return this.generatePlan(systemPrompt, userPrompt, signal);
  }
}

export class LLMProvider {
  private provider: BaseLLMProvider;
  private currentAbortController: AbortController | null = null;

  constructor(settings: ToolAgentSettings) {
    this.provider = this.createProvider(settings);
  }

  private createProvider(settings: ToolAgentSettings): BaseLLMProvider {
    switch (settings.llm.provider) {
      case "openai":
        return new OpenAIProvider(settings);
      case "anthropic":
        return new AnthropicProvider(settings);
      case "custom":
        return new CustomProvider(settings);
      default:
        throw new Error(`Unsupported provider: ${settings.llm.provider}`);
    }
  }

  updateSettings(settings: ToolAgentSettings) {
    this.provider = this.createProvider(settings);
  }

  abort(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }

  async generatePlan(systemPrompt: string, userPrompt: string): Promise<ActionPlan> {
    console.log("[Wand:LLM] LLMProvider.generatePlan wrapper START");
    const wrapperStart = performance.now();
    this.currentAbortController = new AbortController();
    try {
      const result = await this.provider.generatePlan(systemPrompt, userPrompt, this.currentAbortController.signal);
      console.log("[Wand:LLM] LLMProvider.generatePlan wrapper COMPLETE in", performance.now() - wrapperStart, "ms");
      return result;
    } finally {
      this.currentAbortController = null;
    }
  }

  async generateStreamingPlan(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void
  ): Promise<ActionPlan> {
    this.currentAbortController = new AbortController();
    try {
      return await this.provider.generateStreamingPlan(systemPrompt, userPrompt, onChunk, this.currentAbortController.signal);
    } finally {
      this.currentAbortController = null;
    }
  }
}