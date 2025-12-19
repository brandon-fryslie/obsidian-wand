<script lang="ts">
  import { ChatMessage } from "../services/ChatController";
  import ExecutionResults from "./ExecutionResults.svelte";
  import { onMount } from "svelte";

  export let message: ChatMessage;

  let visible = false;

  $: isUser = message.role === "user";
  $: isSystem = message.role === "system";
  $: showResults = message.executionResults && message.executionResults.length > 0;

  onMount(() => {
    // Trigger fade-in animation
    setTimeout(() => visible = true, 10);
  });

  // Simple markdown to HTML conversion
  function parseMarkdown(text: string): string {
    // Process line by line for better list handling
    const lines = text.split('\n');
    const result: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Check for bullet list items
      const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          result.push('<ul>');
          inList = true;
        }
        line = `<li>${parseInline(bulletMatch[2])}</li>`;
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        // Empty line becomes paragraph break
        if (line.trim() === '') {
          line = '<br>';
        } else {
          line = parseInline(line);
        }
      }
      result.push(line);
    }

    // Close any open list
    if (inList) {
      result.push('</ul>');
    }

    return result.join('\n');
  }

  // Parse inline markdown elements
  function parseInline(text: string): string {
    return text
      // Bold: **text** or __text__ (must come before italic)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_ (only single asterisk/underscore)
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
      // Code: `text`
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  $: renderedContent = parseMarkdown(message.content);
</script>

<div class="message {isUser ? 'user' : 'assistant'}" class:visible>
  <div class="message-meta">
    <span class="role">{isUser ? 'You' : 'Wand'}</span>
    <span class="time">{message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
  </div>
  <div class="content">{@html renderedContent}</div>
  {#if showResults}
    <ExecutionResults results={message.executionResults} />
  {/if}
</div>

<style>
  .message {
    padding: 10px 14px;
    border-radius: 8px;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .message.visible {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .message {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }

  .message.user {
    background: linear-gradient(135deg, var(--interactive-normal) 0%, var(--interactive-hover) 100%);
    margin-left: 24px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .message.assistant {
    background-color: var(--background-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .message-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-faint);
    margin-bottom: 6px;
  }

  .role {
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .content {
    color: var(--text-normal);
    line-height: 1.5;
    font-size: 13px;
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  }

  .content :global(strong) {
    font-weight: 600;
  }

  .content :global(p) {
    margin: 4px 0;
  }

  .content :global(ul), .content :global(ol) {
    margin: 6px 0;
    padding-left: 18px;
  }

  .content :global(li) {
    margin: 3px 0;
  }

  .content :global(code) {
    background-color: var(--background-modifier-border);
    padding: 2px 5px;
    border-radius: 3px;
    font-family: var(--font-monospace);
    font-size: 0.9em;
  }
</style>
