import { ref, computed } from 'vue'
import { db } from '../firebase/config'
import { useAuth } from './useAuth'
import { useUserPlan } from './useUserPlan'

import {
    doc as fsDoc,
    setDoc as fsSetDoc,
    getDoc as fsGetDoc,
    Timestamp as fsTimestamp
} from 'firebase/firestore'

// Singleton State
const usageCount = ref(0)
const lastReset = ref<Date | null>(null)
const loading = ref(false)

// Limits
const MAX_DAILY_USAGE = 5;
const RESET_HOUR = 4; // 4 AM

export function useModelUsage() {
    const { user } = useAuth()

    // Helper: Calculate the start of the current cycle (Latest 4 AM)
    const getCycleStartTime = (): Date => {
        const now = new Date();
        const cycleStart = new Date(now);

        // precise reset to 4:00:00.000
        cycleStart.setHours(RESET_HOUR, 0, 0, 0);

        // If now is before 4 AM, the cycle started yesterday at 4 AM
        if (now.getHours() < RESET_HOUR) {
            cycleStart.setDate(now.getDate() - 1);
        }

        return cycleStart;
    }

    // Helper: Initialize or sync usage data
    const syncUsage = async (modelId: string) => {
        if (!user.value) return;

        loading.value = true;

        const usageRef = fsDoc(db, `users/${user.value.uid}/model_usage/${modelId}`);
        const cycleStart = getCycleStartTime();

        try {
            const snap = await fsGetDoc(usageRef);

            if (snap.exists()) {
                const data = snap.data();
                const storedReset = data.lastReset instanceof fsTimestamp ? data.lastReset.toDate() : null;
                const storedCount = data.count || 0;

                // Check reset logic
                if (storedReset && storedReset >= cycleStart) {
                    // Current cycle is valid
                    usageCount.value = storedCount;
                    lastReset.value = storedReset;
                } else {
                    // Stored data is old (before current cycle start) -> RESET
                    // We update Firestore eagerly to reflect the reset
                    await fsSetDoc(usageRef, {
                        count: 0,
                        lastReset: cycleStart // Set to current cycle start
                    }, { merge: true });

                    usageCount.value = 0;
                    lastReset.value = cycleStart;
                }
            } else {
                // No data found -> Initialize
                await fsSetDoc(usageRef, {
                    count: 0,
                    lastReset: cycleStart
                });
                usageCount.value = 0;
                lastReset.value = cycleStart;
            }
        } catch (e) {
            console.error("Error syncing model usage:", e);
        } finally {
            loading.value = false;
        }
    }

    const checkAvailability = async (modelId: string): Promise<boolean> => {
        // 1. Check User Plan first
        const { fetchPlan, isKurasiUnlimited } = useUserPlan();
        await fetchPlan(); // Ensure latest plan data

        if (modelId === 'kurasi-v1' && isKurasiUnlimited.value) {
            return true; // Bypass limit for unlimited users
        }

        // 2. Fallback to daily limit
        await syncUsage(modelId);
        return usageCount.value < MAX_DAILY_USAGE;
    }

    const incrementUsage = async (modelId: string) => {
        if (!user.value) return;

        const usageRef = fsDoc(db, `users/${user.value.uid}/model_usage/${modelId}`);

        // Optimistic update
        usageCount.value++;

        try {
            const cycleStart = getCycleStartTime();

            await fsSetDoc(usageRef, {
                count: usageCount.value,
                lastReset: cycleStart // Ensure we anchor to the current valid cycle
            }, { merge: true });

        } catch (e) {
            console.error("Error incrementing usage:", e);
            usageCount.value--; // Revert
        }
    }

    const remainingUsage = computed(() => {
        const { isKurasiUnlimited } = useUserPlan();
        if (isKurasiUnlimited.value) return 9999; // Unlimited effectively

        return Math.max(0, MAX_DAILY_USAGE - usageCount.value);
    })

    return {
        usageCount,
        loading,
        remainingUsage,
        refreshUsage: () => syncUsage('kurasi-v1'), // Defaulting or making generic? Let's keep it generic if possible, but the caller handles modelId.
        // Actually, syncUsage takes modelId.
        checkAvailability,
        incrementUsage,
        MAX_DAILY_USAGE
    }
}
