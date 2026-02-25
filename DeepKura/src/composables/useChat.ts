import { ref, watch, computed } from 'vue'
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    type Timestamp,
    doc,
    updateDoc,
    deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './useAuth'
import { deleteCollection } from '../firebase/utils'

export interface Message {
    id: string
    content: string
    role: 'user' | 'ai'
    createdAt: Timestamp | null
    parentId?: string | null
    childrenIds?: string[]
    selectedChildId?: string | null
    model?: string // Store which model generated this message
}

export interface ChatSession {
    id: string
    title: string
    createdAt: Timestamp | null
    isPinned?: boolean
    selectedRootId?: string | null // Added for branching
}

const rawMessages = ref<Message[]>([])

const chats = ref<ChatSession[]>([])
const currentChatId = ref<string | null>(null)
const activeChatMetadata = ref<any>(null)
const loading = ref(false)
let initialized = false
let autoSelectDone = false

let unsubscribeMessages: (() => void) | null = null
let unsubscribeChats: (() => void) | null = null
let unsubscribeChatDoc: (() => void) | null = null

export function useChat() {
    const { user } = useAuth()

    // Persist current chat selection
    watch(currentChatId, (newId) => {
        if (user.value) {
            localStorage.setItem('kula_active_chat', newId || '')
        }
    })

    // Computed: virtualize parentIds for legacy messages
    const extendedMessages = computed(() => {
        const sorted = [...rawMessages.value].sort((a, b) => {
            const ta = a.createdAt?.toMillis() || 0
            const tb = b.createdAt?.toMillis() || 0
            return ta - tb
        })

        const withVirtualParents = sorted.map((m, index) => {
            // Clone to avoid mutating raw state
            const extended = { ...m }

            // If legacy (undefined parentId), infer from sequence
            if (extended.parentId === undefined) {
                if (index === 0) {
                    extended.parentId = null // Root
                } else {
                    extended.parentId = sorted[index - 1]!.id // Child of previous (safe due to index check)
                }
            }
            return extended
        })

        return withVirtualParents
    })

    // Computed: Flatten the tree into the "Active Thread"
    // This now preserves the full chat history and only switches branches for edited messages
    const messages = computed(() => {
        const source = extendedMessages.value
        if (source.length === 0) return []

        const thread: Message[] = []
        const messageMap = new Map(source.map(m => [m.id, m]))

        // 1. Determine Root
        let currentNode: Message | undefined;

        if (activeChatMetadata.value?.selectedRootId) {
            currentNode = messageMap.get(activeChatMetadata.value.selectedRootId);
        }

        // Fallback: Use the very first message which is guaranteed to be a root in our virtual tree
        if (!currentNode && source.length > 0) {
            // Find virtual roots (parentId === null)
            // With our logic, index 0 is always a root. 
            // Are there others? (Edits of index 0).
            // Default to the one at index 0 (Original Root).
            currentNode = source.find(m => m.parentId === null)
        }

        // 2. Walk down the tree following selectedChildId or latest child
        while (currentNode) {
            thread.push(currentNode)

            // Determine Next
            let nextId = currentNode.selectedChildId

            if (nextId) {
                // Explicit path selected
                currentNode = messageMap.get(nextId)
            } else {
                // No explicit child selected.
                // Check children in our virtual tree
                const children = source.filter(m => m.parentId === currentNode!.id)

                if (children.length > 0) {
                    // Pick the latest child (most recently created)
                    // This ensures new messages always appear
                    currentNode = children[children.length - 1]
                } else {
                    // Start of Future Inheritance Logic:
                    // If this node is a leaf (no children), try to borrow future from parallel branches
                    // to keep the chat view populated.

                    const pId = currentNode.parentId;
                    let donor: Message | undefined;

                    // Helper: Find a candidate among a list that has children
                    const findCandidateWithChildren = (candidates: Message[]) => {
                        return candidates.find(c => {
                            const k = source.filter(k => k.parentId === c.id);
                            return k.length > 0;
                        });
                    };

                    // 1. Try Siblings (Same Parent)
                    const siblings = source.filter(m => m.parentId === pId && m.id !== currentNode!.id);
                    donor = findCandidateWithChildren(siblings);

                    // 2. Try Cousins (Uncle's Children) - Only if no sibling match and we are not at root
                    if (!donor && pId) {
                        const parent = source.find(m => m.id === pId);
                        if (parent) {
                            const gpId = parent.parentId;
                            // Uncles = Siblings of Parent
                            const uncles = source.filter(u => u.parentId === gpId && u.id !== parent.id);

                            // Find an uncle who has a child (Cousin) with a future
                            const richUncle = uncles.find(u => {
                                const cousins = source.filter(c => c.parentId === u.id);
                                return findCandidateWithChildren(cousins) !== undefined;
                            });

                            if (richUncle) {
                                const cousins = source.filter(c => c.parentId === richUncle.id);
                                donor = findCandidateWithChildren(cousins);
                            }
                        }
                    }

                    if (donor) {
                        // Found a donor node (Sibling or Cousin) that has children.
                        // Inherit its last child.
                        const donorChildren = source.filter(sc => sc.parentId === donor.id);
                        currentNode = donorChildren[donorChildren.length - 1];
                    } else {
                        currentNode = undefined;
                    }
                }
            }
        }

        return thread
    })

    async function deleteChat(chatId: string) {
        if (!user.value) return
        try {
            // Delete sub-collection 'messages' first
            await deleteCollection(db, `users/${user.value.uid}/chats/${chatId}/messages`)

            // Then delete the chat document
            await deleteDoc(doc(db, 'users', user.value.uid, 'chats', chatId))
            // If deleting current chat, reset
            if (currentChatId.value === chatId) {
                resetChat()
            }
        } catch (e) {
            console.error('Error deleting chat:', e)
        }
    }

    async function togglePinChat(chatId: string, currentStatus: boolean) {
        if (!user.value) return
        try {
            await updateDoc(doc(db, 'users', user.value.uid, 'chats', chatId), {
                isPinned: !currentStatus
            })
        } catch (e) {
            console.error('Error toggling pin:', e)
        }
    }

    async function renameChat(chatId: string, newTitle: string) {
        if (!user.value) return
        try {
            await updateDoc(doc(db, 'users', user.value.uid, 'chats', chatId), {
                title: newTitle
            })
        } catch (e) {
            console.error('Error renaming chat:', e)
        }
    }

    function initChatList() {
        if (!user.value) return

        if (unsubscribeChats) unsubscribeChats()

        const q = query(
            collection(db, 'users', user.value.uid, 'chats'),
            orderBy('createdAt', 'desc')
        )

        unsubscribeChats = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ChatSession[]

            // Sort: Pinned first, then Date
            chats.value = list.sort((a, b) => {
                const aPinned = a.isPinned ? 1 : 0
                const bPinned = b.isPinned ? 1 : 0
                return bPinned - aPinned
            })

            // Handle First Load Logic
            if (!autoSelectDone) {
                const savedId = localStorage.getItem('kula_active_chat')

                if (savedId && list.some(c => c.id === savedId)) {
                    // Restore last active chat
                    initChat(savedId)
                    autoSelectDone = true
                } else if (savedId === '') {
                    // Explicitly on New Chat (do nothing)
                    autoSelectDone = true
                } else if (list.length > 0) {
                    // List loaded but savedId not found/null
                    if (savedId === null) {
                        // First time / No history -> Open most recent
                        const firstChat = list[0]; // Use list directly as chats.value might be sorted differently? No, list is raw.
                        // Actually use the sorted 'chats.value' logic or just pick first from snapshot (which is ordered desc)
                        if (firstChat) initChat(firstChat.id)
                    }
                    // If savedId was set but not found (deleted), default to New Chat (do nothing) or above logic
                    autoSelectDone = true
                }
                // If list is empty, wait for data (don't set autoSelectDone)
            }
        })
    }

    // REPLACED initChat to use rawMessages AND Chat Metadata
    function initChat(chatId: string) {
        if (!user.value) return

        if (unsubscribeMessages) unsubscribeMessages()
        if (unsubscribeChatDoc) unsubscribeChatDoc()

        loading.value = true
        currentChatId.value = chatId

        // 1. Listen to Messages
        const q = query(
            collection(db, 'users', user.value.uid, 'chats', chatId, 'messages'),
            orderBy('createdAt', 'asc')
        )

        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            rawMessages.value = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Message[]
            loading.value = false
        }, (err) => {
            console.error(err)
            loading.value = false
        })

        // 2. Listen to Chat Metadata (for selectedRootId)
        const chatDocRef = doc(db, 'users', user.value.uid, 'chats', chatId);
        unsubscribeChatDoc = onSnapshot(chatDocRef, (snapshot) => {
            if (snapshot.exists()) {
                activeChatMetadata.value = snapshot.data();
            } else {
                activeChatMetadata.value = null;
            }
        });
    }

    function resetChat() {
        rawMessages.value = []
        currentChatId.value = null
        activeChatMetadata.value = null
        if (unsubscribeMessages) {
            unsubscribeMessages()
            unsubscribeMessages = null
        }
        if (unsubscribeChatDoc) {
            unsubscribeChatDoc()
            unsubscribeChatDoc = null
        }
    }

    async function createNewChat(firstMessagePreview?: string) {
        if (!user.value) return null

        // Clear current messages to show empty state immediately
        rawMessages.value = []
        currentChatId.value = null

        try {
            const newChatRef = await addDoc(collection(db, 'users', user.value.uid, 'chats'), {
                title: firstMessagePreview || 'New Chat',
                createdAt: serverTimestamp(),
                isPinned: false
            })

            initChat(newChatRef.id)
            return newChatRef.id
        } catch (e) {
            console.error('Error creating chat:', e)
            return null
        }
    }

    async function sendMessage(content: string, role: 'user' | 'ai' = 'user', explicitParentId?: string, model?: string) {
        const currentUser = user.value
        if (!currentUser) return null

        let targetChatId = currentChatId.value
        if (!targetChatId) {
            const newId = await createNewChat(content.substring(0, 30))
            if (!newId) throw new Error("Failed to create chat")
            targetChatId = newId
            currentChatId.value = newId
        }

        // Determine Parent
        // Use explicit if provided, otherwise fallback to visual thread end
        let parentId: string | null | undefined = explicitParentId;

        if (parentId === undefined) {
            const currentThread = messages.value
            parentId = currentThread.length > 0 ? currentThread[currentThread.length - 1]!.id : null
        }

        try {
            const msgData: any = {
                content,
                role,
                createdAt: serverTimestamp(),
                parentId: parentId || null,
                childrenIds: [],
                selectedChildId: null,
                model: model || null // Save model ID
            }

            const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'chats', targetChatId!, 'messages'), msgData)

            // If parent exists, update it to point to this new child
            if (parentId) {
                const parentRef = doc(db, 'users', currentUser.uid, 'chats', targetChatId!, 'messages', parentId)
                // Use source/rawMessages to find currentChildren safely?
                // Just reading rawMessages is safe enough for immediate childrenIds update but we need to match the parent.
                const parentMsg = rawMessages.value.find(m => m.id === parentId)
                const currentChildren = parentMsg?.childrenIds || []

                await updateDoc(parentRef, {
                    childrenIds: [...currentChildren, docRef.id],
                    selectedChildId: docRef.id
                })
            }

            return docRef.id

        } catch (e) {
            console.error('Error sending message:', e)
            throw e
        }
    }

    // We remove explicit "deleteMessagesAfter" because branching handles it naturally (we just switch path).

    // Initialize listeners once
    if (!initialized) {
        watch(user, (u) => {
            if (u) {
                // Reset autoSelectDone on user change so new login triggers check
                autoSelectDone = false
                initChatList()
            } else {
                rawMessages.value = []
                chats.value = []
                currentChatId.value = null
                if (unsubscribeMessages) unsubscribeMessages()
                if (unsubscribeChats) unsubscribeChats()
            }
        }, { immediate: true })
        initialized = true
    }

    return {
        messages, // Computed
        rawMessages, // Exported for UI calculation
        chats,
        currentChatId,
        loading,
        sendMessage,
        createNewChat,
        resetChat,
        initChat,
        togglePinChat,
        deleteChat,
        renameChat,
    }
}
