<script lang="ts">
  import { ChatMessage } from "../services/ChatController";
  import MessageItem from "./MessageItem.svelte";

  export let messages: ChatMessage[];

  let messagesContainer: HTMLElement;
  let previousMessageCount = 0;

  // Auto-scroll to bottom only when NEW messages are added (not on any messages change)
  $: if (messagesContainer && messages && messages.length > previousMessageCount) {
    previousMessageCount = messages.length;
    // Use requestAnimationFrame to ensure DOM is updated before scrolling
    requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  // Get time-of-day greeting
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }
</script>

<div class="messages" bind:this={messagesContainer}>
  {#if messages.length === 0}
    <div class="empty">
      <div class="wand-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Wand stick -->
          <path d="M3 21L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <!-- Star at top -->
          <path d="M15 5L16.5 8L20 9.5L16.5 11L15 14L13.5 11L10 9.5L13.5 8L15 5Z" fill="currentColor"/>
          <!-- Sparkles -->
          <circle class="sparkle sparkle-1" cx="6" cy="18" r="1" fill="currentColor"/>
          <circle class="sparkle sparkle-2" cx="8" cy="15" r="0.8" fill="currentColor"/>
          <circle class="sparkle sparkle-3" cx="18" cy="6" r="1" fill="currentColor"/>
          <circle class="sparkle sparkle-4" cx="20" cy="12" r="0.7" fill="currentColor"/>
        </svg>
      </div>
      <p class="greeting">{getGreeting()}!</p>
      <span class="hint">Ask Wand to help with your vault</span>
      <span class="subhint">Create notes, organize files, search content...</span>
    </div>
  {:else}
    {#each messages as message (message.id)}
      <MessageItem {message} />
    {/each}
  {/if}
</div>

<style>
  .messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    padding: 12px 12px;
    user-select: text;
    -webkit-user-select: text;
  }

  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    text-align: center;
    padding: 40px 20px;
    gap: 12px;
  }

  .wand-icon {
    width: 80px;
    height: 80px;
    color: var(--interactive-accent);
    opacity: 0.8;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px) rotate(-5deg);
    }
    50% {
      transform: translateY(-10px) rotate(-8deg);
    }
  }

  .wand-icon svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
  }

  .sparkle {
    animation: sparkle 2s ease-in-out infinite;
  }

  .sparkle-1 {
    animation-delay: 0s;
  }

  .sparkle-2 {
    animation-delay: 0.5s;
  }

  .sparkle-3 {
    animation-delay: 1s;
  }

  .sparkle-4 {
    animation-delay: 1.5s;
  }

  @keyframes sparkle {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wand-icon {
      animation: none;
    }
    .sparkle {
      animation: none;
      opacity: 0.6;
    }
  }

  .greeting {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
    letter-spacing: 0.3px;
  }

  .hint {
    font-size: 13px;
    color: var(--text-muted);
  }

  .subhint {
    font-size: 12px;
    color: var(--text-faint);
  }
</style>
