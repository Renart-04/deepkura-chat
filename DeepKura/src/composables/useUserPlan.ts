import { ref, computed } from 'vue'
import { db } from '../firebase/config'
import { useAuth } from './useAuth'
import {
    doc,
    getDoc,
    setDoc,
    Timestamp
} from 'firebase/firestore'

export type AccessType = 'limited' | 'unlimited';

export interface PlanFeature {
    access: AccessType;
    limit?: number;
    expiresAt?: Timestamp | null;
}

export interface UserPlan {
    type: 'free' | 'premium';
    features: {
        kurasi_think: PlanFeature;
    };
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const DEFAULT_FREE_PLAN: UserPlan = {
    type: 'free',
    features: {
        kurasi_think: {
            access: 'limited',
            limit: 5,
            expiresAt: null
        }
    }
};

// Singleton State
const currentPlan = ref<UserPlan | null>(null);
const loading = ref(false);

export function useUserPlan() {
    const { user } = useAuth();

    // Initialize Plan (Create if not exists)
    const initPlan = async () => {
        if (!user.value) return;

        const userRef = doc(db, 'users', user.value.uid);

        try {
            const snap = await getDoc(userRef);

            if (!snap.exists()) {
                // Create new user document with Free Plan
                const newPlan = {
                    ...DEFAULT_FREE_PLAN,
                    email: user.value.email,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };

                await setDoc(userRef, { plan: newPlan }, { merge: true });
                currentPlan.value = newPlan;
            } else {
                // Load existing plan
                const data = snap.data();
                if (data.plan) {
                    currentPlan.value = data.plan as UserPlan;
                } else {
                    // Legacy user without plan? Init it.
                    const newPlan = {
                        ...DEFAULT_FREE_PLAN,
                        updatedAt: Timestamp.now()
                    };
                    await setDoc(userRef, { plan: newPlan }, { merge: true });
                    currentPlan.value = newPlan;
                }
            }
        } catch (e) {
            console.error("Error initializing user plan:", e);
        }
    };

    // Refresh/Fetch Plan
    const fetchPlan = async () => {
        if (!user.value) return;
        loading.value = true;

        try {
            const userRef = doc(db, 'users', user.value.uid);
            const snap = await getDoc(userRef);

            if (snap.exists() && snap.data().plan) {
                currentPlan.value = snap.data().plan as UserPlan;
            } else {
                // If missing, try init
                await initPlan();
            }
        } catch (e) {
            console.error("Error fetching user plan:", e);
        } finally {
            loading.value = false;
        }
    };

    // Computed Helpers
    const isKurasiUnlimited = computed(() => {
        if (!currentPlan.value) return false;
        const feature = currentPlan.value.features.kurasi_think;

        // Check hard unlimited
        if (feature.access === 'unlimited') return true;

        // Check time-based unlimited
        if (feature.expiresAt) {
            const now = new Date();
            const expiry = feature.expiresAt.toDate(); // Convert Firestore Timestamp
            return now < expiry; // Active if not expired
        }

        return false;
    });

    return {
        currentPlan,
        loading,
        initPlan,
        fetchPlan,
        isKurasiUnlimited
    };
}
