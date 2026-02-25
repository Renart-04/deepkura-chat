<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Menu, ChevronDown, Check } from 'lucide-vue-next';
import MessageBubble from './MessageBubble.vue';
import ThinkingBubble from './ThinkingBubble.vue';
import LoginPrompt from './LoginPrompt.vue';
import UsageLimitModal from './UsageLimitModal.vue';
import { useChat } from '../composables/useChat';
import { useAuth } from '../composables/useAuth';
import { useModelUsage } from '../composables/useModelUsage';
import { parseResponse } from '../utils/responseParser';

// Use Props/Emits for layout control
const props = defineProps<{
  isSidebarOpen: boolean,
  currentModel: string
}>();

const emit = defineEmits(['update:currentModel', 'toggle-sidebar']);


import { useUserPlan } from '../composables/useUserPlan';

const { user } = useAuth();
const { messages, sendMessage, currentChatId } = useChat();
const { checkAvailability, incrementUsage, usageCount, MAX_DAILY_USAGE, refreshUsage } = useModelUsage();
const { isKurasiUnlimited } = useUserPlan();
const router = useRouter();

// Check initial intention from storage to prevent UI flash
const storedChatId = typeof localStorage !== 'undefined' ? localStorage.getItem('kula_active_chat') : null;
const hasStoredChat = !!storedChatId && storedChatId !== 'null' && storedChatId !== 'undefined' && storedChatId !== '';
// Track if we are in the initial loading phase where we rely on "hasStoredChat" hint
const isInitialLoad = ref(true);

watch([messages, currentChatId], () => {
   // Once we have state (messages or explicit chat ID), we are no longer "guessing" based on localStorage
   if (messages.value.length > 0 || currentChatId.value) {
       isInitialLoad.value = false;
   }
});

// Fallback: If nothing happens after 2 seconds (e.g. restore failed), stop assuming we are loading
onMounted(() => {
    setTimeout(() => {
        isInitialLoad.value = false;
    }, 2000);
});

const isNewChatView = computed(() => {
    // 0. If user is not logged in, force New Chat view (centered)
    // This prevents "bottom flash" on reload for guest users
    if (!user.value) return true;

    // 1. If we have messages, NOT new chat
    if (messages.value.length > 0) return false;
    
    // 2. If we have an active chat ID (even if empty msgs while loading), NOT new chat
    if (currentChatId.value) return false;
    
    // 3. If we are in initial load and have a stored ID, assume we are restoring IF user is logged in
    if (isInitialLoad.value && hasStoredChat) return false;
    
    // Otherwise, yes, it's a new chat (Empty, No ID, No pending restore)
    return true;
});

const showModelDropdown = ref(false);

const models = [
  { id: 'xone-v1', name: 'XOne', description: 'General Knowledge & Analysis' },
  { id: 'kurasi-v1', name: 'Kurasi Think', description: 'Quantitative Technical Insight' }
];

const selectedModelName = computed(() => {
    return models.find(m => m.id === props.currentModel)?.name || 'Select Model';
});

const isLimitReached = computed(() => {
    if (isKurasiUnlimited.value) return false; // Never reached if unlimited
    return usageCount.value >= MAX_DAILY_USAGE;
});

// Auto-switch if limit reached while kurasi is selected
watch([isLimitReached, () => props.currentModel], ([limit, model]) => {
    if (limit && model === 'kurasi-v1') {
        selectModel('xone-v1');
    }
});

const selectModel = (id: string) => {
    // Prevent selecting if limited
    if (id === 'kurasi-v1' && isLimitReached.value) return;

    emit('update:currentModel', id);
    localStorage.setItem('selectedModel', id); // Persist selection
    showModelDropdown.value = false;
};

// Accessibility: Close dropdown on Escape key
const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && showModelDropdown.value) {
        showModelDropdown.value = false;
    }
};

const userInitials = computed(() => {
    if (user.value?.displayName) {
        return user.value.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return 'U';
});

const userInput = ref('');
const isGenerating = ref(false);
const isStreaming = ref(false);
const streamingMessage = ref<{ id: string; role: 'ai'; content: string } | null>(null);
const showLoginPrompt = ref(false);
const showLimitModal = ref(false);

const taglines = [
    "US stock market analysis",
    "Long-term stock analysis strategy",
    "DeepKura is a stock market analysis tool.",
    "31 US stock data updates every minute.",
    "Stock data taken from reliable sources.",
];
const currentTaglineIndex = ref(0);
const currentTagline = computed(() => taglines[currentTaglineIndex.value]);
let taglineInterval: number | null = null;

const messagesContainer = ref<HTMLElement | null>(null);

const scrollToBottom = async (behavior: ScrollBehavior = 'auto') => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: behavior
    });
  }
};

const textareaRef = ref<HTMLTextAreaElement | null>(null);

const adjustHeight = () => {
    const textarea = textareaRef.value;
    if (textarea) {
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Set to scrollHeight, max 200px
    }
};

const reloadPage = () => {
    window.location.reload();
}

// Watch for Chat Switch to clear persistent streaming bubble
watch(currentChatId, () => {
    streamingMessage.value = null;
    isStreaming.value = false;
});

const displayMessages = computed(() => {
    // If we have a persistent streaming bubble (even if isStreaming=false), 
    // we must HIDE the real firestore message to prevent duplication.
    if (streamingMessage.value && streamingMessage.value.id) {
         // 1. Direct ID Match (Best Case - IDs are synced)
         const filtered = messages.value.filter(m => m.id !== streamingMessage.value!.id);
         
         // 2. Race Condition Fallback (Temp ID vs Real ID)
         // If we are still using a temporary ID ('streaming-'), it means the Firestore update 
         // might have arrived BEFORE we updated our local ID. 
         // In this specific gap, we must also hide the LAST message if it's an AI message.
         if (streamingMessage.value.id.startsWith('streaming-')) {
             const msgs = filtered;
             if (msgs.length > 0) {
                 const last = msgs[msgs.length - 1];
                 // Check if the last message in the filtered list looks like the one we are streaming
                 if (last && last.role === 'ai') {
                      return msgs.slice(0, -1);
                 }
             }
             return msgs;
         }
         
         return filtered;
    }
    return messages.value;
});

watch(messages, (newVal, oldVal) => {
    // Smart Scroll:
    // If we are just loading (delta != 1), snap to bottom.
    // If it's a new single message being added, scroll smooth.
    // Also ignore if we are currently streaming locally, as the stream handles its own scroll.
    if (isStreaming.value) return; 

    const isIncremental = oldVal && (newVal.length - oldVal.length === 1);
    scrollToBottom(isIncremental ? 'smooth' : 'auto');
}, { deep: true });

// Watcher for streaming content to handle sticky scroll
watch(() => streamingMessage.value?.content, () => {
    if (isStreaming.value && isAtBottom()) {
        scrollToBottom('auto'); // Instant scroll during typing for stability
    }
}, { flush: 'post' });

const isAtBottom = () => {
    if (!messagesContainer.value) return false;
    const threshold = 100; // pixels from bottom to be considered "at bottom"
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
    return scrollHeight - (scrollTop + clientHeight) <= threshold;
};

const generateAIResponse = async (contextMessage: string, options: { scrollToBottom?: boolean } = {}) => {
    const { scrollToBottom: shouldScrollToBottom = true } = options;
    
    isGenerating.value = true;
    
    if (shouldScrollToBottom) {
      await scrollToBottom('smooth');
    }

    try {
        // Prepare API call
        let endpoint = '/api/kurasi-v1';
        if (props.currentModel === 'xone-v1') {
             endpoint = '/api/xone-v1'; 
        }

        const token = await user.value?.getIdToken();
        if (!token) throw new Error("User not authenticated");

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: contextMessage,
                model: props.currentModel
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const rawAiResponse = data.content || data.response || data.result || data.answer || "I received your message but the API response format was unexpected.";

        // Start Streaming Effect
        isGenerating.value = false;
        isStreaming.value = true;
        
        // Parse first to handle <think> block smartly
        const { think, text } = parseResponse(rawAiResponse);
        
        // Initialize content
        let currentContent = think ? `<think>${think}</think>\n` : '';
        const textToStream = text || '';
        
        // Start Streaming
        isStreaming.value = true;
        // Construct streaming message. Cast to any/Message to avoid strict type checks on partial objects if needed, 
        // but ideally we should match the interface. 
        // We use null for createdAt since we don't need a timestamp during streaming.
        streamingMessage.value = {
            id: 'streaming-' + Date.now(),
            content: currentContent, // Start with think block if any
            role: 'ai',
            createdAt: null, 
            model: props.currentModel
        } as any;
        
        // Typing loop using requestAnimationFrame for smoothness
        let currentIndex = 0;
        let lastTime = 0;
        const charsPerSecond = 500; // Super fast as requested
        const interval = 1000 / charsPerSecond;
        
        await new Promise<void>((resolve) => {
            if (!textToStream) {
                resolve();
                return;
            }

            const step = (timestamp: number) => {
                if (!lastTime) lastTime = timestamp;
                const elapsed = timestamp - lastTime;

                if (elapsed > interval) {
                    // Add 1-3 chars depending on elapsed time to catch up if laggy
                    const charsToAdd = Math.max(1, Math.floor(elapsed / interval)); 
                    const nextChunk = textToStream.slice(currentIndex, currentIndex + charsToAdd);

                    if (nextChunk) {
                        currentContent += nextChunk;
                        if (streamingMessage.value) {
                            streamingMessage.value.content = currentContent;
                        }
                        
                        // Scroll is handled by the watch(streamingMessage) below
                        
                        currentIndex += nextChunk.length;
                        lastTime = timestamp;
                    }
                }

                if (currentIndex < textToStream.length && isStreaming.value) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(step);
        });



        // Streaming done, save to DB
        // CRITICAL: Save 'rawAiResponse' to preserve JSON data (Charts/Tables) which was stripped from 'currentContent'
        // Pass currentModel as 4th arg
        const newId = await sendMessage(rawAiResponse, 'ai', undefined, props.currentModel);
        
        // Wait for Vue to process the reactive update and render the new message
        await nextTick();
        
        // PERSISTENT BUBBLE STRATEGY:
        // Instead of destroying the streaming bubble, we KEEP it but update its ID to match the real message.
        // The displayMessages computed prop will continue to hide the real message from the list.
        // This ensures absolutely ZERO layout shift or component remount.
        if (newId && streamingMessage.value) {
            streamingMessage.value.id = newId; 
            // We set isStreaming to false to indicate "done typing", 
            // but we DO NOT set streamingMessage to null.
            isStreaming.value = false;
        } else {
             // Fallback
             isStreaming.value = false;
             streamingMessage.value = null;
        }
        
    } catch (error: any) {
        console.error('Failed to get AI response:', error);
        await sendMessage(`Error: Unable to connect to ${props.currentModel} API. (${error.message})`, 'ai', undefined, props.currentModel);
        isStreaming.value = false;
        streamingMessage.value = null;
    } finally {
        isGenerating.value = false;
        // isStreaming handled above
    }
};

const handleSend = async () => {
    if (!userInput.value.trim() || isGenerating.value || isStreaming.value) return;

    // Reset previous streaming message to allow old messages to appear in history
    streamingMessage.value = null;

    // Check if user is logged in
    if (!user.value) {
        showLoginPrompt.value = true;
        return;
    }

    // Check Model Usage Limit (only for kurasi-v1)
    if (props.currentModel === 'kurasi-v1') {
        const isAvailable = await checkAvailability('kurasi-v1');
        if (!isAvailable) {
            showLimitModal.value = true;
            return;
        }
    }

    const content = userInput.value; 
    userInput.value = '';
    
    // Reset textarea height
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
    }
    
    // Add User Message
    await sendMessage(content, 'user');

    // Increment Usage (only for kurasi-v1)
    if (props.currentModel === 'kurasi-v1') {
        incrementUsage('kurasi-v1'); // Fire and forget
    }
    
    // Trigger Generation (scroll to bottom for new messages)
    await generateAIResponse(content, { scrollToBottom: true });
};

const handleSuggestionClick = (text: string) => {
    userInput.value = text;
    handleSend();
};

const handleLoginRedirect = () => {
    showLoginPrompt.value = false;
    router.push('/login');
};

onMounted(() => {
    scrollToBottom();
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel && user.value) { // Only restore if user logged in, or generic
        emit('update:currentModel', savedModel);
    }
    
    // Check usage limit on mount
    if (user.value) {
        refreshUsage();
    }
    // Add keyboard listener for accessibility
    window.addEventListener('keydown', handleEscapeKey);

    // Start Tagline Rotation
    taglineInterval = window.setInterval(() => {
        currentTaglineIndex.value = (currentTaglineIndex.value + 1) % taglines.length;
    }, 3000);
});

// Cleanup listener on unmount
onUnmounted(() => {
    window.removeEventListener('keydown', handleEscapeKey);
    if (taglineInterval) clearInterval(taglineInterval);
});

</script>

<template>
  <!-- Login Prompt Modal -->
  <LoginPrompt 
    v-if="showLoginPrompt"
    @close="showLoginPrompt = false"
    @login="handleLoginRedirect"
  />

  <!-- Usage Limit Modal -->
  <UsageLimitModal 
    v-if="showLimitModal"
    @close="showLimitModal = false"
  />
  
  <!-- Skip to Content Link (Accessibility) -->
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg">
    Skip to main content
  </a>
  
  <div class="absolute inset-0 flex flex-col bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 font-sans overflow-hidden w-full transition-colors duration-300 touch-none">
    
    <!-- Top Bar (Gemini-style) -->
    <header class="flex-none flex items-center justify-between px-4 py-2 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md z-20 transition-colors border-b border-transparent dark:border-transparent">
        <div class="flex items-center gap-3">
            <!-- Sidebar Toggle (Mobile/Collapsed) -->
            <button 
                @click="$emit('toggle-sidebar')" 
                aria-label="Toggle Sidebar"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-colors md:hidden"
            >
                <Menu class="w-5 h-5" />
            </button>
            
            <!-- Clickable Logo & Title for Reload -->
            <div @click="reloadPage" class="flex items-center gap-2 md:gap-3 cursor-pointer group select-none">
                <div class="relative w-7 h-7 md:w-9 md:h-9 flex items-center justify-center transition-transform group-hover:scale-110 duration-300">
                    <img src="/logo.svg" alt="DeepKura Logo" class="w-full h-full object-contain drop-shadow-sm" />
                </div>
                <h1 class="text-lg md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-none group-hover:opacity-80 transition-opacity !m-0">
                    DeepKura
                </h1>
            </div>
        </div>

        <div class="flex items-center gap-3">


             <!-- User Profile -->
             <div class="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center border border-white dark:border-gray-700 shadow-sm overflow-hidden"
                :class="user?.photoURL ? 'bg-transparent' : 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-gray-800 dark:to-gray-900'"
             >
                <img v-if="user?.photoURL" :src="user.photoURL" alt="User Profile" class="w-full h-full object-cover" />
                <span v-else class="text-xs font-bold text-blue-700 dark:text-gray-300">{{ userInitials }}</span>
             </div>
        </div>
    </header>

    <!-- Messages Area -->
    <main id="main-content" role="main" ref="messagesContainer" class="flex-1 overflow-y-auto p-0 md:p-4 z-10 custom-scrollbar overscroll-contain">
         <div class="max-w-4xl mx-auto w-full pb-32">
             <!-- Welcome Placeholder if empty AND new chat view -->
             <!-- Welcome Placeholder if empty AND new chat view -->
             <div v-if="isNewChatView" class="pt-20 md:pt-0 md:absolute md:inset-x-0 md:top-[35%] md:-translate-y-1/2 flex flex-col items-center text-center opacity-100 px-4 z-0">
                 <h1 class="text-3xl md:text-4xl font-bold text-gray-700 dark:text-gray-200 tracking-tight mb-2">DeepKura</h1>
                 <Transition name="tagline-fade" mode="out-in">
                    <p :key="currentTagline" class="text-base md:text-lg text-gray-500 dark:text-gray-400 font-medium">
                        {{ currentTagline }}
                    </p>
                 </Transition>
             </div>
             
             <!-- Suggestion prompt (Below ChatBox on Desktop & Mobile) -->
             <!-- Suggestion prompt (Below ChatBox on Desktop & Mobile) -->
             <Transition name="suggestion-slide" appear>
                 <div v-if="isNewChatView" class="flex flex-row flex-wrap justify-center gap-3 w-full px-4 absolute inset-x-0 top-[480px] -translate-y-1/2 md:top-[65%] z-20">
                     <button 
                        @click="handleSuggestionClick('Rekomendasi saham yang menarik saat ini')"
                        class="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-full transition-colors flex items-center gap-2 group border border-transparent hover:border-gray-300 dark:hover:border-gray-600 shadow-sm"
                     >
                        <span>✨ Rekomendasi saham yang menarik saat ini</span>
                     </button>
                     
                     <button 
                        @click="handleSuggestionClick('Analisis saham nvda')"
                        class="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-full transition-colors flex items-center gap-2 group border border-transparent hover:border-gray-300 dark:hover:border-gray-600 shadow-sm"
                     >
                        <span>📈 Analisis saham nvda</span>
                     </button>
                 </div>
             </Transition>

             <TransitionGroup name="message-list" tag="div">
                <MessageBubble 
                    v-for="msg in displayMessages" 
                    :key="msg.id"
                    :id="`message-${msg.id}`"
                    :message="msg" 
                />
             </TransitionGroup>

             <!-- Persistent Streaming Message Bubble (shown outside TransitionGroup) -->
             <!-- We keep this visible even after streaming finishes until new chat starts -->
             <MessageBubble 
                v-if="streamingMessage" 
                :message="streamingMessage" 
                :is-streaming="isStreaming"
                id="streaming-response"
             />

             <!-- Thinking Indicator -->
             <div v-if="isGenerating" class="mb-6">
                <ThinkingBubble />
            </div>
         </div>
    </main>

    <!-- Input Area Container -->
    <Transition mode="out-in" name="chatbox-state">
        <div 
            v-if="isNewChatView"
            key="hero-input"
            class="w-full px-4 z-30 absolute top-[360px] md:top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] md:w-full max-w-2xl transition-none"
        >
            <div class="w-full max-w-4xl mx-auto relative flex flex-col bg-[#f0f4f9]/90 dark:bg-[#262626]/90 backdrop-blur-md rounded-[2rem] border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)] dark:hover:shadow-[0_8px_40px_rgb(0,0,0,0.4)] transition-all focus-within:bg-white dark:focus-within:bg-[#262626] focus-within:ring-1 focus-within:ring-gray-200 dark:focus-within:ring-gray-700">
                <!-- Inner Content (Hero) -->
                <!-- Top: Text Area -->
                <textarea 
                ref="textareaRef"
                v-model="userInput"
                @input="adjustHeight"
                @keydown.enter.exact.prevent="handleSend"
                rows="1"
                placeholder="Message DeepKura..." 
                class="w-full bg-transparent px-5 py-4 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none font-medium text-base min-w-0 resize-none max-h-[200px] overflow-y-auto custom-scrollbar"
                style="min-height: 56px;"
            ></textarea>
            
            <!-- Bottom: Toolbar -->
            <div class="flex items-center justify-between px-3 pb-3 pt-1">
                <!-- Left: Model Selector -->
                 <div class="relative">
                    <button 
                        @click.stop="showModelDropdown = !showModelDropdown"
                        @mousedown.prevent
                        aria-label="Select Model"
                        class="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors text-gray-700 dark:text-gray-200 font-medium text-sm group shrink-0"
                    >
                        <span class="text-blue-600 dark:text-blue-400">{{ selectedModelName }}</span>
                        <ChevronDown class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" :class="{'rotate-180': showModelDropdown}" />
                    </button>

                    <!-- Dropdown Menu -->
                    <div v-if="showModelDropdown" 
                         class="absolute bottom-full left-0 mb-2 w-64 bg-[#f0f4f9] dark:bg-[#1f1f1f] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    >
                        <button 
                            v-for="model in models" 
                            :key="model.id"
                            @click="selectModel(model.id)"
                            @mousedown.prevent
                            :disabled="model.id === 'kurasi-v1' && isLimitReached"
                            class="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-colors group"
                            :class="[
                                model.id === 'kurasi-v1' && isLimitReached
                                ? 'cursor-not-allowed opacity-50 bg-gray-50 dark:bg-[#222]'
                                : 'hover:bg-white dark:hover:bg-[#262626]'
                            ]"
                        >
                             <div class="flex flex-col">
                                <span class="text-sm font-medium" 
                                    :class="[
                                        model.id === 'kurasi-v1' && isLimitReached 
                                        ? 'text-gray-400 dark:text-gray-500' 
                                        : 'text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                    ]"
                                >
                                    {{ model.name }}
                                </span>
                                <span v-if="model.id === 'kurasi-v1' && isLimitReached" class="text-[10px] text-red-500 font-medium">
                                    Limit Reached ({{ MAX_DAILY_USAGE }}/{{ MAX_DAILY_USAGE }})
                                </span>
                             </div>
                             <Check v-if="currentModel === model.id" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                    </div>
                     <!-- Click Outside Overlay -->
                    <div v-if="showModelDropdown" @click="showModelDropdown = false" @mousedown.prevent class="fixed inset-0 z-40 bg-transparent"></div>
                 </div>

                <!-- Right: Send/Search Button -->
                <!-- Right: Send/Search Button -->
                <div class="flex items-center justify-center w-[44px] h-[44px]">
                    <Transition name="scale">
                        <button 
                            v-if="userInput.trim()"
                            @click="handleSend"
                            :disabled="isGenerating || isStreaming"
                            aria-label="Send Message"
                            class="p-2.5 rounded-full transition-all duration-300 shadow-md flex items-center justify-center transform"
                            :class="[
                                isGenerating || isStreaming 
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                            ]"
                        >
                            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </button>
                    </Transition>
                </div>
            </div>
        </div>
            
        <div class="w-full text-center mt-3">
             <p class="text-[10px] text-gray-400 dark:text-gray-500 transition-opacity duration-500" :class="{'opacity-0': messages.length === 0}">
                  DeepKura may display inaccurate info, check its responses.
             </p>
        </div>
    </div>

    <div 
        v-else
            key="bottom-input"
            class="w-full px-4 z-30 shrink-0 pb-safe pt-2 transition-none"
        >
             <div class="w-full max-w-4xl mx-auto relative flex flex-col bg-[#f0f4f9]/90 dark:bg-[#262626]/90 backdrop-blur-md rounded-[2rem] border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)] dark:hover:shadow-[0_8px_40px_rgb(0,0,0,0.4)] transition-all focus-within:bg-white dark:focus-within:bg-[#262626] focus-within:ring-1 focus-within:ring-gray-200 dark:focus-within:ring-gray-700">
                <!-- Inner Content (Bottom) -->
                <!-- Top: Text Area -->
                <textarea 
                    ref="textareaRef"
                    v-model="userInput"
                    @input="adjustHeight"
                    @keydown.enter.exact.prevent="handleSend"
                    rows="1"
                    placeholder="Message DeepKura..." 
                    class="w-full bg-transparent px-5 py-4 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none font-medium text-base min-w-0 resize-none max-h-[200px] overflow-y-auto custom-scrollbar"
                    style="min-height: 56px;"
                ></textarea>
                
                <!-- Bottom: Toolbar -->
                <div class="flex items-center justify-between px-3 pb-3 pt-1">
                    <!-- Left: Model Selector -->
                     <div class="relative">
                        <button 
                            @click.stop="showModelDropdown = !showModelDropdown"
                            @mousedown.prevent
                            aria-label="Select Model"
                            class="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors text-gray-700 dark:text-gray-200 font-medium text-sm group shrink-0"
                        >
                            <span class="text-blue-600 dark:text-blue-400">{{ selectedModelName }}</span>
                            <ChevronDown class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" :class="{'rotate-180': showModelDropdown}" />
                        </button>

                        <!-- Dropdown Menu -->
                        <div v-if="showModelDropdown" 
                             class="absolute bottom-full left-0 mb-2 w-64 bg-[#f0f4f9] dark:bg-[#1f1f1f] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                        >
                            <button 
                                v-for="model in models" 
                                :key="model.id"
                                @click="selectModel(model.id)"
                                @mousedown.prevent
                                :disabled="model.id === 'kurasi-v1' && isLimitReached"
                                class="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-left transition-colors group"
                                :class="[
                                    model.id === 'kurasi-v1' && isLimitReached
                                    ? 'cursor-not-allowed opacity-50 bg-gray-50 dark:bg-[#222]'
                                    : 'hover:bg-white dark:hover:bg-[#262626]'
                                ]"
                            >
                                 <div class="flex flex-col">
                                    <span class="text-sm font-medium" 
                                        :class="[
                                            model.id === 'kurasi-v1' && isLimitReached 
                                            ? 'text-gray-400 dark:text-gray-500' 
                                            : 'text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                        ]"
                                    >
                                        {{ model.name }}
                                    </span>
                                    <span v-if="model.id === 'kurasi-v1' && isLimitReached" class="text-[10px] text-red-500 font-medium">
                                        Limit Reached ({{ MAX_DAILY_USAGE }}/{{ MAX_DAILY_USAGE }})
                                    </span>
                                 </div>
                                 <Check v-if="currentModel === model.id" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                        </div>
                         <!-- Click Outside Overlay -->
                        <div v-if="showModelDropdown" @click="showModelDropdown = false" @mousedown.prevent class="fixed inset-0 z-40 bg-transparent"></div>
                     </div>

                    <!-- Right: Send/Search Button -->
                    <div class="flex items-center justify-center w-[44px] h-[44px]">
                        <Transition name="scale">
                            <button 
                                v-if="userInput.trim()"
                                @click="handleSend"
                                :disabled="isGenerating || isStreaming"
                                aria-label="Send Message"
                                class="p-2.5 rounded-full transition-all duration-300 shadow-md flex items-center justify-center transform"
                                :class="[
                                    isGenerating || isStreaming 
                                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed animate-pulse'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                                ]"
                            >
                                <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </button>
                        </Transition>
                    </div>
                </div>
            </div>
            
            <div class="w-full text-center mt-3">
                 <p class="text-[10px] text-gray-400 dark:text-gray-500 transition-opacity duration-500" :class="{'opacity-0': messages.length === 0}">
                      DeepKura may display inaccurate info, check its responses.
                 </p>
            </div>
        </div>
    </Transition>

  </div>
</template>

<style>
/* Clean Scrollbar */
/* Clean Scrollbar */
/* Default (Mobile): Hidden Scrollbar but scrollable */
.custom-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.custom-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Desktop: Visible & Styled */
@media (min-width: 768px) {
  .custom-scrollbar {
      scrollbar-width: auto; /* Firefox restore */
  }
  .custom-scrollbar::-webkit-scrollbar {
      display: block;
      width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent; 
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1; 
      border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8; 
  }
}

/* Message Transitions - DISABLED to prevent flicker */
.message-list-enter-active,
.message-list-leave-active {
  transition: none;
}
.message-list-enter-from,
.message-list-leave-to {
  opacity: 1;
  transform: none;
}
.message-list-move {
  transition: transform 0.3s ease-out;
}

/* Send Button Scale Transition - Smoother */
.scale-enter-active {
  transition: opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: opacity, transform;
}
.scale-leave-active {
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
  will-change: opacity, transform;
}
.scale-enter-from {
  opacity: 0;
  transform: scale(0.8) rotate(-45deg);
}
.scale-leave-to {
  opacity: 0;
  transform: scale(0.8) rotate(45deg);
}
</style>

<style scoped>
/* State transition for chatbox (Hero <-> Bottom) */
.chatbox-state-enter-active {
  transition: all 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.chatbox-state-leave-active {
  transition: none;
}

.chatbox-state-enter-from {
  opacity: 0;
  transform: translateY(15px) scale(0.98);
}

.chatbox-state-leave-to {
  opacity: 0;
  transform: translateY(-15px) scale(0.98);
}

/* Suggestion Slide Animation */
.suggestion-slide-enter-active {
  transition: all 1.0s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: 0.8s; /* Increased delay for later appearance */
}
.suggestion-slide-leave-active {
  transition: none; /* No exit animation */
}

.suggestion-slide-enter-from {
  opacity: 0;
  transform: translateY(-30%) !important; /* Start lower than -50% (visual "up" movement) */
}
.suggestion-slide-leave-to {
  opacity: 0;
  transform: translateY(-30%) !important;
}

/* Tagline Fade Animation */
.tagline-fade-enter-active,
.tagline-fade-leave-active {
  transition: opacity 0.5s ease;
}

.tagline-fade-enter-from,
.tagline-fade-leave-to {
  opacity: 0;
}

/* Ensure smooth initial appear as well using same classes? 
   No, 'appear' maps to enter-active/from. 
   So the hero input will use this transition on mount too. */
</style>
