<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css'; // Import theme
import { Brain, ChevronDown, Check, Copy } from 'lucide-vue-next'; 

import { parseResponse } from '../utils/responseParser';
import DOMPurify from 'dompurify';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  model?: string;
}

const props = defineProps<{
  message: Message;
  isStreaming?: boolean;
}>();

// Copy Logic
const copied = ref(false);
const copyMessage = () => {
    navigator.clipboard.writeText(props.message.content).then(() => {
        copied.value = true;
        setTimeout(() => copied.value = false, 2000);
    });
};

// Think Block Logic
const isThinkOpen = ref(false);
const toggleThink = () => {
    isThinkOpen.value = !isThinkOpen.value;
};


// Custom Renderer for Code Blocks
const renderer = new marked.Renderer();

// Marked v12+ passes an object: { text, lang, escaped }
renderer.code = (token: any) => {
  const code = token.text;
  const language = token.lang;
  
  const validLang = !!(language && hljs.getLanguage(language));
  const highlighted = validLang
    ? hljs.highlight(code, { language }).value
    : hljs.highlightAuto(code).value;

  const langLabel = language || 'text';
  
  // Custom HTML structure with Copy Button
  return `
    <div class="code-block-wrapper my-4 rounded-xl overflow-hidden border border-gray-200 dark:border-[#333] shadow-sm">
      <div class="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-[#1f1f1f] border-b border-gray-200 dark:border-[#333]">
        <span class="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 lowercase">${langLabel}</span>
        <button class="copy-btn group flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" type="button">
           <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
           <span class="copy-text">Copy</span>
        </button>
      </div>
      <div class="bg-[#282c34] p-4 text-sm overflow-x-auto">
        <pre><code class="hljs language-${langLabel} font-mono leading-relaxed">${highlighted}</code></pre>
      </div>
    </div>
  `;
};

// Configure marked
marked.use({
  renderer: renderer,
  breaks: true,
  gfm: true
});


// Throttling logic for streaming content to prevent Markdown render flashing (e.g. tables)
const displayContent = ref(props.message.content);
let throttleTimeout: any = null;

watch(() => props.message.content, (newVal) => {
    if (props.isStreaming) {
        if (!throttleTimeout) {
             throttleTimeout = setTimeout(() => {
                 displayContent.value = newVal;
                 throttleTimeout = null;
             }, 50); // 50ms (20fps) provides much better stability for table layout than rAF
        }
    } else {
        displayContent.value = newVal;
    }
}, { immediate: true });

const parsedContent = computed(() => {
  if (props.message.role === 'user') {
    return { text: displayContent.value, data: null, think: null };
  }
  return parseResponse(displayContent.value);
});

const renderMarkdown = (text: string) => {
    // Cast to string in case type definitions are ambiguous
    let rawHtml = marked.parse(text || '') as string;
    
    // Wrap tables in specific container for proper scrolling and styling
    // Using simple regex replacement as marked generates standard HTML
    rawHtml = rawHtml.replace(/<table/g, '<div class="table-container"><table');
    rawHtml = rawHtml.replace(/<\/table>/g, '</table></div>');
    
    return DOMPurify.sanitize(rawHtml);
};

const renderedText = computed(() => {
    return renderMarkdown(parsedContent.value.text);
});

// Event Delegation for Copy Button
const handleMessageClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest('.copy-btn');
    if (target) {
        const wrapper = target.closest('.code-block-wrapper');
        const codeBlock = wrapper?.querySelector('code');
        
        if (codeBlock && codeBlock.textContent) {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                // Visual feedback
                const textSpan = target.querySelector('.copy-text');
                const originalText = textSpan?.textContent;
                
                if (textSpan) {
                    textSpan.textContent = 'Copied!';
                    target.classList.add('text-green-600', 'dark:text-green-400');
                    
                    setTimeout(() => {
                        textSpan.textContent = originalText || 'Copy';
                         target.classList.remove('text-green-600', 'dark:text-green-400');
                    }, 2000);
                }
            });
        }
    }
};

const handleContentClick = (event: MouseEvent) => {
    // 1. Handle Copy Button click inside code blocks (if any)
    handleMessageClick(event);
};
</script>

<template>
  <div 
    class="relative flex mb-6" 
    :class="[
        message.role === 'user' ? 'flex-row-reverse gap-0 md:gap-4' : 'flex-col gap-2 items-start'
    ]"
  >
    
    <!-- AI Avatar Only (No User Avatar) -->
    <div v-if="message.role === 'ai'" 
         class="static shrink-0 w-full flex items-center pl-4"
    >
      <img 
        src="/logo.svg" 
        alt="DeepKura Logo" 
        class="w-8 h-8 md:w-10 md:h-10 object-contain transition-opacity duration-300"
        :class="{ 'animate-pulse': isStreaming }"
      />
      
       <!-- Think Toggle Button (Clean Header Layout) -->
       <button 
           v-if="parsedContent.think"
           @click="!isStreaming && toggleThink()"
           class="ml-2 inline-flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none text-xs font-medium rounded-full focus:outline-none w-fit transition-colors border border-transparent"
           :class="isStreaming 
               ? 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 pointer-events-none' 
               : 'bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800'"
       >
           <Brain class="w-4 h-4" />
           
           <span>{{ isStreaming ? 'Thinking...' : 'Think' }}</span>
           
           <ChevronDown 
               v-if="!isStreaming"
               class="w-3.5 h-3.5 transition-transform duration-200"
               :class="{ 'rotate-180': isThinkOpen }"
           />
       </button>

      <!-- Model Name -->
      <span class="ml-2 text-xs text-gray-400 font-mono whitespace-nowrap">{{ message.model || 'kurasi-v1' }}</span>
    </div>

    <!-- Think Content Row (Full Width Box) -->
    <div v-if="message.role === 'ai' && parsedContent.think && isThinkOpen" class="w-full pl-4 pr-0 my-2">
        <div class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1f1f1f]/50 prose prose-sm dark:prose-invert max-w-none shadow-sm">
            <div v-html="renderMarkdown(parsedContent.think)"></div>
        </div>
    </div>

    <!-- Bubble -->
    <div 
        class="min-w-0 group relative"
        :class="[
            message.role === 'user' ? 'max-w-[95%] md:max-w-[85%]' : 'max-w-[95%] md:max-w-full md:w-full'
        ]"
    >
        
        <!-- Action Buttons (Copy Only) for User - DESKTOP ONLY -->
        <div v-if="message.role === 'user'" 
             class="absolute -left-10 top-2 hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
             
            <!-- Copy Button -->
            <button 
                @click="copyMessage"
                class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Copy text"
            >
                <Check v-if="copied" class="w-4 h-4 text-green-500" />
                <Copy v-else class="w-4 h-4" />
            </button>
        </div>



        <!-- Text Part (Normal View) -->
        <div 
            class="prose prose-base max-w-none"
            :class="[
                message.role === 'user' 
                ? 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tr-sm px-5 py-3 shadow-sm border border-gray-200 dark:border-zinc-700' 
                : 'text-gray-800 dark:text-gray-100 pl-4 pr-1 py-1 dark:prose-invert text-left ml-0'
            ]">
            <div 
                 @click="handleContentClick"
                 v-html="renderedText" 
            ></div>
        </div>


    </div>

    <!-- Mobile Action Row (Below Bubble) -->
    <div v-if="message.role === 'user'" class="flex justify-end mt-1 px-1 md:hidden">
        <button 
            @click="copyMessage"
            class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-medium py-1 px-2 rounded-lg active:bg-gray-100 dark:active:bg-zinc-800 transition-colors"
        >
            <Check v-if="copied" class="w-3.5 h-3.5 text-green-500" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span :class="copied ? 'text-green-500' : ''">{{ copied ? 'Copied' : 'Salin' }}</span>
        </button>
    </div>

  </div>
</template>

<style scoped>
/* Scoped overrides for tidy typography */
:deep(p) {
    margin-bottom: 0.75em;
    line-height: 1.75;
}
:deep(p:last-child) {
    margin-bottom: 0;
}

/* Lists */
:deep(ul), :deep(ol) {
    margin-bottom: 0.75em;
    padding-left: 1.25em;
}
:deep(li) {
    margin-bottom: 0.25em;
    line-height: 1.6;
}
:deep(li::marker) {
    color: #9ca3af;
}
.dark :deep(li::marker) {
    color: #6b7280;
}

/* Headings */
:deep(h1), :deep(h2), :deep(h3), :deep(h4) {
    margin-top: 1.25em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
}
:deep(h1:first-child), :deep(h2:first-child), :deep(h3:first-child) {
    margin-top: 0;
}

/* Inline Code - Styled distinctly from blocks */
:deep(:not(pre) > code) {
    background-color: rgba(0,0,0,0.06);
    padding: 0.15rem 0.3rem;
    border-radius: 0.375rem;
    font-size: 0.875em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: #c026d3; /* Fuchsia-600 for contrast */
}
.dark :deep(:not(pre) > code) {
    background-color: rgba(255,255,255,0.1);
    color: #e879f9; /* Fuchsia-400 */
}
.message-user :deep(:not(pre) > code) {
    background-color: rgba(255,255,255,0.2);
    color: white;
}

/* Blocks are handled by renderer and global styles, but clear default prose pre styles */
:deep(pre) {
    border-radius: 0;
    margin: 0;
    padding: 0;
    background: transparent;
    overflow: visible;
}

/* Loading Dots Animation */
.loading-dots {
    display: inline-flex;
    align-items: center;
    gap: 2px;
}

.loading-dots .dot {
    width: 3px;
    height: 3px;
    background-color: currentColor;
    border-radius: 50%;
    animation: dot-pulse 1.4s infinite ease-in-out;
}

.loading-dots .dot:nth-child(1) {
    animation-delay: -0.32s;
}

.loading-dots .dot:nth-child(2) {
    animation-delay: -0.16s;
}

@keyframes dot-pulse {
    0%, 80%, 100% {
        opacity: 0.3;
        transform: scale(0.8);
    }
    40% {
        opacity: 1;
        transform: scale(1.2);
    }
}

/* Subtle Pulse Animation for Think Button */
@keyframes pulse-subtle {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.95;
        transform: scale(1.02);
    }
}

.animate-pulse-subtle {
    animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Prevent details opening while streaming */
.think-block[open] summary {
    pointer-events: auto !important;
}
</style>

<!-- Unscoped styles for Markdown Content (Tables specifically) -->
<!-- This ensures the .dark class on HTML/Body can properly cascade down -->
<style>
/* Custom Table Styling with Wrapper */
.table-container {
    width: 100%;
    overflow-x: auto;
    margin: 1.5rem 0;
    border-radius: 1rem;
    border: 1px solid #e5e7eb;
    background-color: #ffffff; 
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}
.dark .table-container {
    border-color: #404040;
    background-color: #171717; /* Neutral-900: Deep Dark */
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

.table-container table {
    width: 100%;
    border-collapse: separate; /* Allows for border-radius on rows/cells if needed */
    border-spacing: 0;
    font-size: 0.875rem;
}

.table-container thead {
    background-color: #f8fafc;
}
.dark .table-container thead {
    background-color: #262626; /* Neutral-800 */
}

.table-container th {
    padding: 1rem 1.25rem;
    text-align: left;
    font-weight: 600;
    color: #374151; /* Gray-700 */
    white-space: nowrap;
    text-transform: capitalize; /* Cleaner than uppercase */
    font-size: 0.8rem;
    letter-spacing: 0.02em;
    border-bottom: 1px solid #e5e7eb;
}
.dark .table-container th {
    color: #e5e5e5; /* Neutral-200 */
    border-color: #404040;
}

.table-container td {
    padding: 1rem 1.25rem;
    color: #4b5563; /* Gray-600 */
    border-bottom: 1px solid #f3f4f6;
    white-space: nowrap;
    transition: background-color 0.15s ease;
}
.dark .table-container td {
    color: #d4d4d4; /* Neutral-300 */
    border-color: #262626;
}

.table-container tbody tr:last-child td {
    border-bottom: none;
}

.table-container tbody tr:hover td {
    background-color: #f8fafc;
}
.dark .table-container tbody tr:hover td {
    background-color: #262626; /* Slight highlight on hover */
}

/* Scrollbar for table container */
.table-container::-webkit-scrollbar {
    height: 6px; /* Sleeker */
    background: transparent;
}
.table-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
}
.dark .table-container::-webkit-scrollbar-thumb {
    background: #525252; /* Neutral-600 */
}
.table-container::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}
.dark .table-container::-webkit-scrollbar-thumb:hover {
    background: #737373;
}
</style>
